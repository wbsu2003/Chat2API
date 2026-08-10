import { create } from 'zustand'
import type { ChatMessage, ChatSessionSummary, Provider } from '@/types/electron'

/**
 * Chat goes through the local OpenAI-compatible endpoint rather than calling
 * the forwarder directly. That is deliberate: it exercises exactly the same
 * path external clients (Cline, Roo-Code, Cherry Studio) use, so this page
 * doubles as a self-test for the API surface.
 */
async function resolveEndpoint(): Promise<{ url: string; headers: Record<string, string> }> {
  const status = await window.electronAPI.proxy.getStatus()

  if (!status?.isRunning) {
    throw new Error('chat.errors.proxyNotRunning')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const config = await window.electronAPI.config.get()
  if (config?.enableApiKey) {
    const key = config.apiKeys?.find((item) => item.enabled)?.key
    if (!key) {
      throw new Error('chat.errors.noApiKey')
    }
    headers.Authorization = `Bearer ${key}`
  }

  // Always dial the loopback address: the server may bind 0.0.0.0
  return { url: `http://127.0.0.1:${status.port}/v1/chat/completions`, headers }
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
    createdAt: Date.now(),
  }
}

interface ChatState {
  providers: Provider[]
  activeProviderId: string | null
  sessions: ChatSessionSummary[]
  activeSessionId: string | null
  messages: ChatMessage[]
  model: string
  streaming: boolean
  /** Assistant text accumulated during the current stream */
  streamingContent: string
  error: string | null

  init: () => Promise<void>
  selectProvider: (providerId: string) => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  newSession: () => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  setModel: (model: string) => void
  send: (content: string) => Promise<void>
  stop: () => void
}

let abortController: AbortController | null = null

export const useChatStore = create<ChatState>((set, get) => ({
  providers: [],
  activeProviderId: null,
  sessions: [],
  activeSessionId: null,
  messages: [],
  model: '',
  streaming: false,
  streamingContent: '',
  error: null,

  init: async () => {
    try {
      const all = await window.electronAPI.providers.getAll()
      const enabled = all.filter((provider) => provider.enabled)
      set({ providers: enabled, error: null })

      if (enabled.length > 0 && !get().activeProviderId) {
        await get().selectProvider(enabled[0].id)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load providers' })
    }
  },

  selectProvider: async (providerId) => {
    const provider = get().providers.find((item) => item.id === providerId)
    const sessions = await window.electronAPI.plugins.chat.listSessions(providerId)

    set({
      activeProviderId: providerId,
      sessions,
      activeSessionId: null,
      messages: [],
      streamingContent: '',
      model: provider?.supportedModels?.[0] ?? '',
    })

    if (sessions.length > 0) {
      await get().selectSession(sessions[0].id)
    }
  },

  selectSession: async (sessionId) => {
    const session = await window.electronAPI.plugins.chat.getSession(sessionId)
    if (!session) return

    set({
      activeSessionId: session.id,
      messages: session.messages,
      model: session.model,
      streamingContent: '',
    })
  },

  newSession: async () => {
    const { activeProviderId, model } = get()
    if (!activeProviderId) return

    const session = await window.electronAPI.plugins.chat.createSession(activeProviderId, model)
    const sessions = await window.electronAPI.plugins.chat.listSessions(activeProviderId)

    set({
      sessions,
      activeSessionId: session.id,
      messages: [],
      streamingContent: '',
    })
  },

  deleteSession: async (sessionId) => {
    await window.electronAPI.plugins.chat.deleteSession(sessionId)
    const { activeProviderId, activeSessionId } = get()
    const sessions = await window.electronAPI.plugins.chat.listSessions(
      activeProviderId ?? undefined
    )

    set({ sessions })

    if (activeSessionId === sessionId) {
      set({ activeSessionId: null, messages: [], streamingContent: '' })
      if (sessions.length > 0) {
        await get().selectSession(sessions[0].id)
      }
    }
  },

  setModel: (model) => {
    set({ model })
    const { activeSessionId } = get()
    if (activeSessionId) {
      window.electronAPI.plugins.chat.updateSession(activeSessionId, { model })
    }
  },

  stop: () => {
    abortController?.abort()
    abortController = null
  },

  send: async (content) => {
    const trimmed = content.trim()
    if (!trimmed || get().streaming) return

    let sessionId = get().activeSessionId
    if (!sessionId) {
      await get().newSession()
      sessionId = get().activeSessionId
      if (!sessionId) return
    }

    const model = get().model
    if (!model) {
      set({ error: 'chat.errors.noModel' })
      return
    }

    const userMessage = createMessage('user', trimmed)
    const history = [...get().messages, userMessage]

    set({ messages: history, streaming: true, streamingContent: '', error: null })

    abortController = new AbortController()
    let assistantText = ''
    let failed = false

    try {
      const { url, headers } = await resolveEndpoint()

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          model,
          stream: true,
          messages: history.map(({ role, content: text }) => ({ role, content: text })),
        }),
      })

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '')
        throw new Error(detail || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith('data:')) continue

          const payload = trimmedLine.slice(5).trim()
          if (!payload || payload === '[DONE]') continue

          try {
            const parsed = JSON.parse(payload)
            const delta = parsed?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) {
              assistantText += delta
              set({ streamingContent: assistantText })
            }
          } catch {
            // Ignore keep-alive comments and non-JSON frames
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User stopped generation; keep whatever arrived
      } else {
        failed = true
        assistantText =
          assistantText || (error instanceof Error ? error.message : 'Request failed')
        set({ error: error instanceof Error ? error.message : 'Request failed' })
      }
    } finally {
      abortController = null
    }

    const assistantMessage: ChatMessage = {
      ...createMessage('assistant', assistantText),
      ...(failed ? { failed: true } : {}),
    }
    const finalMessages = [...history, assistantMessage]

    set({ messages: finalMessages, streaming: false, streamingContent: '' })

    await window.electronAPI.plugins.chat.saveMessages(sessionId, finalMessages)

    const providerId = get().activeProviderId
    if (providerId) {
      set({ sessions: await window.electronAPI.plugins.chat.listSessions(providerId) })
    }
  },
}))
