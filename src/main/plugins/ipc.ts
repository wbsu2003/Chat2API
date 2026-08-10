/**
 * Plugin IPC Handlers
 *
 * Registered from `src/main/ipc/handlers.ts` with a single call so the upstream
 * handler file keeps only a one-line anchor. Channel names live here rather
 * than in `src/main/ipc/channels.ts` for the same reason.
 */

import { ipcMain } from 'electron'
import axios from 'axios'

import { PluginIpcChannels, type ProxyTestResult } from './channels'
import {
  getProxyConfig,
  setGlobalProxy,
  setProviderProxy,
  resolveProviderProxy,
} from './net/proxyConfig'
import { getProxyAgents } from './net/agent'
import {
  describeProxyRule,
  validateProxyRule,
  type PluginProxyConfig,
  type ProviderProxyOverride,
  type ProxyRule,
} from './net/resolve'
import {
  clearProviderSessions,
  createSession,
  deleteSession,
  getSession,
  listSessions,
  saveMessages,
  updateSession,
  type ChatMessage,
  type ChatSession,
  type ChatSessionSummary,
} from './chat/store'

export { PluginIpcChannels, type ProxyTestResult } from './channels'

/** Default endpoint used to reveal the outbound IP when testing a proxy */
const DEFAULT_TEST_URL = 'https://api.ipify.org?format=json'

/**
 * Sends a probe request through a provider's effective proxy.
 *
 * Comparing the reported outbound IP with and without the proxy is the
 * practical way to confirm traffic is actually being routed, rather than
 * silently falling back to a direct connection.
 */
async function testProxy(providerId: string, url?: string): Promise<ProxyTestResult> {
  const rule = resolveProviderProxy(providerId)
  const via = describeProxyRule(rule)
  const target = url || DEFAULT_TEST_URL
  const startedAt = Date.now()

  try {
    const response = await axios.request({
      method: 'GET',
      url: target,
      timeout: 15000,
      validateStatus: () => true,
      proxy: false,
      ...getProxyAgents(providerId),
    })

    const latency = Date.now() - startedAt
    const outboundIp =
      typeof response.data === 'object' && response.data !== null
        ? (response.data as { ip?: string }).ip
        : undefined

    return {
      success: response.status < 400,
      via,
      status: response.status,
      latency,
      outboundIp,
      error: response.status >= 400 ? `HTTP ${response.status}` : undefined,
    }
  } catch (error) {
    return {
      success: false,
      via,
      latency: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function registerPluginIpcHandlers(): void {
  ipcMain.handle(PluginIpcChannels.PROXY_GET_CONFIG, async (): Promise<PluginProxyConfig> => {
    return getProxyConfig()
  })

  ipcMain.handle(
    PluginIpcChannels.PROXY_SET_GLOBAL,
    async (_event, rule: ProxyRule | null): Promise<PluginProxyConfig> => {
      if (rule) {
        const error = validateProxyRule(rule)
        if (error) throw new Error(error)
      }
      return setGlobalProxy(rule)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.PROXY_SET_PROVIDER,
    async (
      _event,
      providerId: string,
      override: ProviderProxyOverride | undefined
    ): Promise<PluginProxyConfig> => {
      if (override) {
        const error = validateProxyRule(override)
        if (error) throw new Error(error)
      }
      return setProviderProxy(providerId, override)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.PROXY_TEST,
    async (_event, providerId: string, url?: string): Promise<ProxyTestResult> => {
      return testProxy(providerId, url)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_LIST_SESSIONS,
    async (_event, providerId?: string): Promise<ChatSessionSummary[]> => {
      return listSessions(providerId)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_GET_SESSION,
    async (_event, id: string): Promise<ChatSession | null> => {
      return getSession(id)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_CREATE_SESSION,
    async (_event, providerId: string, model: string, title?: string): Promise<ChatSession> => {
      return createSession(providerId, model, title)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_SAVE_MESSAGES,
    async (_event, id: string, messages: ChatMessage[]): Promise<ChatSession | null> => {
      return saveMessages(id, messages)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_UPDATE_SESSION,
    async (
      _event,
      id: string,
      patch: Partial<Pick<ChatSession, 'title' | 'model'>>
    ): Promise<ChatSession | null> => {
      return updateSession(id, patch)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_DELETE_SESSION,
    async (_event, id: string): Promise<boolean> => {
      return deleteSession(id)
    }
  )

  ipcMain.handle(
    PluginIpcChannels.CHAT_CLEAR_PROVIDER,
    async (_event, providerId: string): Promise<number> => {
      return clearProviderSessions(providerId)
    }
  )
}
