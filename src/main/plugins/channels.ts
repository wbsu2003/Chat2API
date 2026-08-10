/**
 * Plugin IPC Channels
 *
 * Constants and shared types only. Kept free of runtime imports so the preload
 * bundle can reference it without pulling main-process code (ipcMain, axios)
 * into the renderer sandbox - the same reason upstream keeps
 * `src/main/ipc/channels.ts` dependency-free.
 */

export const PluginIpcChannels = {
  PROXY_GET_CONFIG: 'pluginProxy:getConfig',
  PROXY_SET_GLOBAL: 'pluginProxy:setGlobal',
  PROXY_SET_PROVIDER: 'pluginProxy:setProvider',
  PROXY_TEST: 'pluginProxy:test',

  CHAT_LIST_SESSIONS: 'pluginChat:listSessions',
  CHAT_GET_SESSION: 'pluginChat:getSession',
  CHAT_CREATE_SESSION: 'pluginChat:createSession',
  CHAT_SAVE_MESSAGES: 'pluginChat:saveMessages',
  CHAT_UPDATE_SESSION: 'pluginChat:updateSession',
  CHAT_DELETE_SESSION: 'pluginChat:deleteSession',
  CHAT_CLEAR_PROVIDER: 'pluginChat:clearProvider',
} as const

export interface ProxyTestResult {
  success: boolean
  /** Rule that was exercised, credentials masked */
  via: string
  status?: number
  latency?: number
  /** Outbound IP when the probe endpoint reports one */
  outboundIp?: string
  error?: string
}
