/**
 * Chat Session Storage
 *
 * Sessions are grouped per provider so each provider keeps its own
 * conversation history. Stored in a dedicated `~/.chat2api/chats.json` file to
 * keep upstream data structures untouched.
 *
 * Like `net/proxyConfig`, the storage directory is recomputed rather than read
 * from storeManager, to avoid a runtime import cycle back into the plugin
 * registry.
 */

import Store from 'electron-store'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** Set when the assistant turn failed, so the UI can render it differently */
  failed?: boolean
}

export interface ChatSession {
  id: string
  providerId: string
  model: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

/** Session metadata without messages, for list rendering */
export type ChatSessionSummary = Omit<ChatSession, 'messages'> & { messageCount: number }

interface ChatStoreSchema {
  sessions: ChatSession[]
}

/** Guards the JSON store against unbounded growth */
const MAX_SESSIONS = 200
const MAX_MESSAGES_PER_SESSION = 500

let store: Store<ChatStoreSchema> | null = null

function getStore(): Store<ChatStoreSchema> {
  if (!store) {
    store = new Store<ChatStoreSchema>({
      name: 'chats',
      cwd: join(homedir(), '.chat2api'),
      defaults: { sessions: [] },
    })
  }
  return store
}

function readSessions(): ChatSession[] {
  try {
    return getStore().get('sessions') ?? []
  } catch (error) {
    console.error('[PluginChat] Failed to read sessions:', error)
    return []
  }
}

function writeSessions(sessions: ChatSession[]): void {
  const trimmed = [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS)

  getStore().set('sessions', trimmed)
}

function toSummary(session: ChatSession): ChatSessionSummary {
  const { messages, ...rest } = session
  return { ...rest, messageCount: messages.length }
}

/** Sessions for a provider, or all sessions when providerId is omitted */
export function listSessions(providerId?: string): ChatSessionSummary[] {
  return readSessions()
    .filter(session => !providerId || session.providerId === providerId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toSummary)
}

export function getSession(id: string): ChatSession | null {
  return readSessions().find(session => session.id === id) ?? null
}

export function createSession(providerId: string, model: string, title?: string): ChatSession {
  const now = Date.now()
  const session: ChatSession = {
    id: randomUUID(),
    providerId,
    model,
    title: title || 'New chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }

  writeSessions([session, ...readSessions()])
  return session
}

/**
 * Replaces a session's messages wholesale.
 * The renderer owns streaming state and persists the final turn, so partial
 * streamed chunks never hit disk.
 */
export function saveMessages(id: string, messages: ChatMessage[]): ChatSession | null {
  const sessions = readSessions()
  const index = sessions.findIndex(session => session.id === id)
  if (index === -1) return null

  const existing = sessions[index]
  const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION)

  // Derive a title from the first user message until the user renames it
  const firstUser = trimmed.find(message => message.role === 'user')
  const title =
    existing.title === 'New chat' && firstUser
      ? firstUser.content.slice(0, 40).trim() || existing.title
      : existing.title

  const updated: ChatSession = {
    ...existing,
    title,
    messages: trimmed,
    updatedAt: Date.now(),
  }

  sessions[index] = updated
  writeSessions(sessions)
  return updated
}

export function updateSession(
  id: string,
  patch: Partial<Pick<ChatSession, 'title' | 'model'>>
): ChatSession | null {
  const sessions = readSessions()
  const index = sessions.findIndex(session => session.id === id)
  if (index === -1) return null

  const updated: ChatSession = { ...sessions[index], ...patch, updatedAt: Date.now() }
  sessions[index] = updated
  writeSessions(sessions)
  return updated
}

export function deleteSession(id: string): boolean {
  const sessions = readSessions()
  const remaining = sessions.filter(session => session.id !== id)
  if (remaining.length === sessions.length) return false

  writeSessions(remaining)
  return true
}

/** Removes every session belonging to a provider */
export function clearProviderSessions(providerId: string): number {
  const sessions = readSessions()
  const remaining = sessions.filter(session => session.providerId !== providerId)
  writeSessions(remaining)
  return sessions.length - remaining.length
}
