/**
 * Provider Plugins - Single Entry Point
 *
 * Every upstream anchor imports from this module and nothing else. Registering
 * a new provider means adding its plugin to the `plugins` array below.
 *
 * Anchor map (see scripts/verify-anchors.js):
 *   pluginProviderConfigs      -> src/main/providers/builtin/index.ts
 *   pluginProviderMap          -> src/main/providers/builtin/index.ts
 *   pluginTokenExtraction      -> src/main/oauth/tokenExtractionConfig.ts
 *   pluginManualTokenConfigs   -> src/main/oauth/types.ts
 *   createPluginOAuthAdapter   -> src/main/oauth/adapters/index.ts
 *   getPluginAuthMethods       -> src/main/oauth/adapters/index.ts
 *   pluginForwarders           -> src/main/proxy/forwarder.ts
 */

import { buildRegistry } from './registry'
import type { AdapterConfig, BaseOAuthAdapter, ProviderPlugin } from './types'

/**
 * Static plugin list. Order determines forwarder match precedence.
 */
const plugins: ProviderPlugin[] = []

const registry = buildRegistry(plugins)

/** Builtin provider configurations contributed by plugins */
export const pluginProviderConfigs = registry.providerConfigs

/** Provider id -> configuration map contributed by plugins */
export const pluginProviderMap = registry.providerMap

/** In-app login token extraction configs contributed by plugins */
export const pluginTokenExtraction = registry.tokenExtraction

/** Manual token input hints contributed by plugins */
export const pluginManualTokenConfigs = registry.manualTokenConfigs

/** Forwarder entries spread into the upstream `providerForwarders` registry */
export const pluginForwarders = registry.forwarders

/** Provider ids owned by plugins, used for UI and validation */
export const pluginProviderIds = plugins.map(plugin => plugin.id)

/**
 * Creates the OAuth adapter for a plugin-owned provider.
 * Returns null when the provider is not plugin-owned, so upstream keeps its
 * existing switch behaviour.
 */
export function createPluginOAuthAdapter(
  providerType: string,
  config: AdapterConfig
): BaseOAuthAdapter | null {
  const plugin = registry.getPlugin(providerType)
  if (!plugin?.createOAuthAdapter) {
    return null
  }
  return plugin.createOAuthAdapter(config)
}

/**
 * Auth methods for a plugin-owned provider, or null when not plugin-owned.
 */
export function getPluginAuthMethods(providerType: string): string[] | null {
  const plugin = registry.getPlugin(providerType)
  if (!plugin) {
    return null
  }
  return plugin.supportedAuthMethods ?? ['manual']
}

/** Look up a plugin by provider id */
export function getProviderPlugin(id: string): ProviderPlugin | undefined {
  return registry.getPlugin(id)
}

export type { ProviderPlugin } from './types'
