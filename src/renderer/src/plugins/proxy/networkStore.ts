import { create } from 'zustand'
import type {
  PluginProxyConfig,
  Provider,
  ProxyProtocol,
  ProxyRule,
  ProxyTestResult,
} from '@/types/electron'

export type ProxyDraft = {
  protocol: ProxyProtocol
  host: string
  port: string
  username: string
  password: string
}

export const EMPTY_DRAFT: ProxyDraft = {
  protocol: 'http',
  host: '',
  port: '',
  username: '',
  password: '',
}

export function ruleToDraft(rule: ProxyRule | null | undefined): ProxyDraft {
  if (!rule) return { ...EMPTY_DRAFT }
  return {
    protocol: rule.protocol,
    host: rule.host,
    port: String(rule.port),
    username: rule.username ?? '',
    password: rule.password ?? '',
  }
}

/**
 * Converts form state into a rule.
 * Returns an error string when the draft is incomplete.
 */
export function draftToRule(draft: ProxyDraft): { rule: ProxyRule } | { error: string } {
  const host = draft.host.trim()
  if (!host) return { error: 'proxyNet.errors.hostRequired' }

  const port = Number(draft.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'proxyNet.errors.portInvalid' }
  }

  const username = draft.username.trim()
  if (draft.password && !username) {
    return { error: 'proxyNet.errors.passwordNeedsUser' }
  }

  return {
    rule: {
      protocol: draft.protocol,
      host,
      port,
      ...(username ? { username } : {}),
      ...(username && draft.password ? { password: draft.password } : {}),
    },
  }
}

/** How a provider resolves its proxy */
export type ProviderProxyMode = 'inherit' | 'direct' | 'custom'

export function getProviderMode(
  config: PluginProxyConfig | null,
  providerId: string
): ProviderProxyMode {
  if (!config) return 'inherit'
  if (!Object.prototype.hasOwnProperty.call(config.perProvider, providerId)) return 'inherit'
  return config.perProvider[providerId] === null ? 'direct' : 'custom'
}

interface NetworkState {
  config: PluginProxyConfig | null
  providers: Provider[]
  loading: boolean
  error: string | null
  testResults: Record<string, ProxyTestResult>
  testing: Record<string, boolean>

  load: () => Promise<void>
  saveGlobal: (rule: ProxyRule | null) => Promise<void>
  saveProvider: (
    providerId: string,
    override: ProxyRule | null | undefined
  ) => Promise<void>
  testProvider: (providerId: string) => Promise<void>
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  config: null,
  providers: [],
  loading: false,
  error: null,
  testResults: {},
  testing: {},

  load: async () => {
    set({ loading: true, error: null })
    try {
      const [config, providers] = await Promise.all([
        window.electronAPI.plugins.proxy.getConfig(),
        window.electronAPI.providers.getAll(),
      ])
      set({ config, providers, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load proxy configuration',
      })
    }
  },

  saveGlobal: async (rule) => {
    set({ error: null })
    try {
      const config = await window.electronAPI.plugins.proxy.setGlobal(rule)
      set({ config })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save proxy' })
      throw error
    }
  },

  saveProvider: async (providerId, override) => {
    set({ error: null })
    try {
      const config = await window.electronAPI.plugins.proxy.setProvider(providerId, override)
      set({ config })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save proxy' })
      throw error
    }
  },

  testProvider: async (providerId) => {
    set({ testing: { ...get().testing, [providerId]: true } })
    try {
      const result = await window.electronAPI.plugins.proxy.test(providerId)
      set({
        testResults: { ...get().testResults, [providerId]: result },
        testing: { ...get().testing, [providerId]: false },
      })
    } catch (error) {
      set({
        testResults: {
          ...get().testResults,
          [providerId]: {
            success: false,
            via: 'unknown',
            error: error instanceof Error ? error.message : 'Test failed',
          },
        },
        testing: { ...get().testing, [providerId]: false },
      })
    }
  },
}))
