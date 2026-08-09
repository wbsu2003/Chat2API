/**
 * Provider Plugin Registry
 *
 * Derives, from a static plugin list, the exact shapes each upstream anchor
 * needs. Everything here is computed at module load time so anchors can use
 * plain spread syntax without worrying about initialization order.
 */

import type {
  ManualTokenConfig,
  TokenExtractionConfigMap,
  PluginForwarderEntry,
  ProviderPlugin,
} from './types'
import type { BuiltinProviderConfig } from '../store/types'

/**
 * Builds every derived registry shape from a plugin list.
 * Exported separately from the singleton so tests can build isolated registries.
 */
export function buildRegistry(plugins: ProviderPlugin[]) {
  const duplicates = plugins
    .map(plugin => plugin.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index)

  if (duplicates.length > 0) {
    throw new Error(`Duplicate provider plugin ids: ${duplicates.join(', ')}`)
  }

  for (const plugin of plugins) {
    if (plugin.id !== plugin.providerConfig.id) {
      throw new Error(
        `Plugin id "${plugin.id}" does not match providerConfig.id "${plugin.providerConfig.id}"`
      )
    }
  }

  const providerConfigs: BuiltinProviderConfig[] = plugins.map(plugin => plugin.providerConfig)

  const providerMap: Record<string, BuiltinProviderConfig> = {}
  for (const plugin of plugins) {
    providerMap[plugin.id] = plugin.providerConfig
  }

  const tokenExtraction: TokenExtractionConfigMap = {}
  for (const plugin of plugins) {
    if (plugin.tokenExtraction) {
      tokenExtraction[plugin.id] = plugin.tokenExtraction
    }
  }

  const manualTokenConfigs: Record<string, ManualTokenConfig[]> = {}
  for (const plugin of plugins) {
    if (plugin.manualTokenConfigs) {
      manualTokenConfigs[plugin.id] = plugin.manualTokenConfigs
    }
  }

  const forwarders: PluginForwarderEntry[] = plugins.map(plugin => ({
    name: plugin.id,
    matches: plugin.matches,
    forward: plugin.forward,
  }))

  const byId = new Map(plugins.map(plugin => [plugin.id, plugin]))

  return {
    plugins,
    providerConfigs,
    providerMap,
    tokenExtraction,
    manualTokenConfigs,
    forwarders,
    getPlugin: (id: string): ProviderPlugin | undefined => byId.get(id),
  }
}

export type PluginRegistry = ReturnType<typeof buildRegistry>
