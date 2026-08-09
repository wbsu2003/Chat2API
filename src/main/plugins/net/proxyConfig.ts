/**
 * Plugin Proxy Configuration Storage
 *
 * Uses a dedicated electron-store file (`~/.chat2api/plugins.json`) rather than
 * extending the upstream AppConfig, so upstream type definitions stay untouched.
 *
 * The storage directory is recomputed here instead of calling
 * `storeManager.getStorePath()` on purpose: importing the store module would
 * create a runtime import cycle
 * (plugins -> providers -> net -> store -> store/types -> providers/builtin -> plugins),
 * because `store/types.ts` re-exports `builtinProviders` as BUILTIN_PROVIDERS.
 */

import Store from 'electron-store'
import { homedir } from 'os'
import { join } from 'path'
import {
  DEFAULT_PROXY_CONFIG,
  type PluginProxyConfig,
  type ProviderProxyOverride,
  type ProxyRule,
  resolveProxyRule,
} from './resolve'

interface PluginStoreSchema {
  proxy: PluginProxyConfig
}

type ProxyChangeListener = (config: PluginProxyConfig) => void

let store: Store<PluginStoreSchema> | null = null
const listeners = new Set<ProxyChangeListener>()

function getStore(): Store<PluginStoreSchema> {
  if (!store) {
    store = new Store<PluginStoreSchema>({
      name: 'plugins',
      cwd: join(homedir(), '.chat2api'),
      defaults: { proxy: DEFAULT_PROXY_CONFIG },
      encryptionKey: 'chat2api-plugins-encryption-key-v1',
    })
  }
  return store
}

/**
 * Reads the current proxy configuration.
 * Read on every call so changes take effect without an app restart.
 */
export function getProxyConfig(): PluginProxyConfig {
  try {
    const stored = getStore().get('proxy')
    return {
      global: stored?.global ?? null,
      perProvider: stored?.perProvider ?? {},
    }
  } catch (error) {
    console.error('[PluginProxy] Failed to read proxy config, falling back to direct:', error)
    return { ...DEFAULT_PROXY_CONFIG }
  }
}

function emitChange(config: PluginProxyConfig): void {
  for (const listener of listeners) {
    try {
      listener(config)
    } catch (error) {
      console.error('[PluginProxy] Proxy change listener failed:', error)
    }
  }
}

export function setProxyConfig(config: PluginProxyConfig): PluginProxyConfig {
  const normalized: PluginProxyConfig = {
    global: config.global ?? null,
    perProvider: config.perProvider ?? {},
  }

  getStore().set('proxy', normalized)
  emitChange(normalized)
  return normalized
}

/** Sets or clears the global rule applied to providers without an override */
export function setGlobalProxy(rule: ProxyRule | null): PluginProxyConfig {
  const config = getProxyConfig()
  return setProxyConfig({ ...config, global: rule })
}

/**
 * Sets a provider override.
 * Pass `null` to force a direct connection, or `undefined` to inherit global.
 */
export function setProviderProxy(
  providerId: string,
  override: ProviderProxyOverride | undefined
): PluginProxyConfig {
  const config = getProxyConfig()
  const perProvider = { ...config.perProvider }

  if (override === undefined) {
    delete perProvider[providerId]
  } else {
    perProvider[providerId] = override
  }

  return setProxyConfig({ ...config, perProvider })
}

/** Effective rule for a provider, or null for a direct connection */
export function resolveProviderProxy(providerId: string): ProxyRule | null {
  return resolveProxyRule(getProxyConfig(), providerId)
}

/** Subscribes to configuration changes; returns an unsubscribe function */
export function onProxyConfigChange(listener: ProxyChangeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
