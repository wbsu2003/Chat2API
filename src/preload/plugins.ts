import { ipcRenderer } from 'electron'
import { PluginIpcChannels } from '../main/plugins/channels'
import type { ProxyTestResult } from '../main/plugins/channels'
import type {
  PluginProxyConfig,
  ProviderProxyOverride,
  ProxyRule,
} from '../main/plugins/net/resolve'
import type {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
} from '../main/plugins/chat/store'

/**
 * Renderer-facing API for plugin features.
 * Exposed as `window.electronAPI.plugins`.
 */
export const pluginsAPI = {
  proxy: {
    getConfig: (): Promise<PluginProxyConfig> =>
      ipcRenderer.invoke(PluginIpcChannels.PROXY_GET_CONFIG),

    /** Sets the rule applied to providers without an override */
    setGlobal: (rule: ProxyRule | null): Promise<PluginProxyConfig> =>
      ipcRenderer.invoke(PluginIpcChannels.PROXY_SET_GLOBAL, rule),

    /**
     * Sets a provider override.
     * `null` forces a direct connection, `undefined` inherits the global rule.
     */
    setProvider: (
      providerId: string,
      override: ProviderProxyOverride | undefined
    ): Promise<PluginProxyConfig> =>
      ipcRenderer.invoke(PluginIpcChannels.PROXY_SET_PROVIDER, providerId, override),

    /** Probes connectivity through the provider's effective proxy */
    test: (providerId: string, url?: string): Promise<ProxyTestResult> =>
      ipcRenderer.invoke(PluginIpcChannels.PROXY_TEST, providerId, url),
  },

  chat: {
    listSessions: (providerId?: string): Promise<ChatSessionSummary[]> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_LIST_SESSIONS, providerId),

    getSession: (id: string): Promise<ChatSession | null> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_GET_SESSION, id),

    createSession: (providerId: string, model: string, title?: string): Promise<ChatSession> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_CREATE_SESSION, providerId, model, title),

    saveMessages: (id: string, messages: ChatMessage[]): Promise<ChatSession | null> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_SAVE_MESSAGES, id, messages),

    updateSession: (
      id: string,
      patch: Partial<Pick<ChatSession, 'title' | 'model'>>
    ): Promise<ChatSession | null> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_UPDATE_SESSION, id, patch),

    deleteSession: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_DELETE_SESSION, id),

    clearProvider: (providerId: string): Promise<number> =>
      ipcRenderer.invoke(PluginIpcChannels.CHAT_CLEAR_PROVIDER, providerId),
  },
}

export type PluginsAPI = typeof pluginsAPI
