/**
 * Provider Plugin Type Definitions
 *
 * A ProviderPlugin bundles everything a new provider needs to register itself
 * across the upstream extension points, so that adding a provider only requires
 * creating a plugin directory plus one line in `src/plugins/index.ts`.
 *
 * Upstream files consume these through thin spread/delegation anchors; no
 * provider-specific logic lives outside `src/plugins/`.
 */

import type { BaseOAuthAdapter } from '../oauth/adapters/base'
import type { AdapterConfig, ManualTokenConfig } from '../oauth/types'
import type { TokenExtractionConfig } from '../oauth/tokenExtractionConfig'
import type { Account, BuiltinProviderConfig, Provider } from '../store/types'
import type { ChatCompletionRequest, ForwardResult } from '../proxy/types'

/** Re-exported so plugin code only ever imports from `./types` */
export type {
  AdapterConfig,
  Account,
  BaseOAuthAdapter,
  BuiltinProviderConfig,
  ChatCompletionRequest,
  ForwardResult,
  ManualTokenConfig,
  Provider,
  TokenExtractionConfig,
}

/**
 * Keyed by provider id. Upstream declares its own map as
 * `Record<ProviderType, TokenExtractionConfig>`; plugins use a widened string
 * key so new provider ids do not require touching the union type.
 */
export type TokenExtractionConfigMap = Record<string, TokenExtractionConfig>

/**
 * Forward function signature.
 * Mirrors the upstream `ProviderForwarder['forward']` shape in
 * `src/main/proxy/forwarder.ts` so plugin forwarders can be spread directly
 * into the `providerForwarders` registry.
 */
export type PluginForward = (
  request: ChatCompletionRequest,
  account: Account,
  provider: Provider,
  actualModel: string,
  startTime: number
) => Promise<ForwardResult>

/**
 * Structural match of the upstream (non-exported) `ProviderForwarder` type.
 */
export interface PluginForwarderEntry {
  name: string
  matches: (provider: Provider) => boolean
  forward: PluginForward
}

/**
 * A self-contained provider plugin.
 */
export interface ProviderPlugin {
  /** Provider id, must match `providerConfig.id` (e.g. 'grok') */
  id: string

  /** Builtin provider configuration, registered into `builtinProviders` */
  providerConfig: BuiltinProviderConfig

  /** Determines whether a stored provider should be handled by this plugin */
  matches: (provider: Provider) => boolean

  /** Chat completion forwarding implementation */
  forward: PluginForward

  /** In-app login token extraction config, registered into TOKEN_EXTRACTION_CONFIGS */
  tokenExtraction?: TokenExtractionConfig

  /** Manual token input hints, registered into MANUAL_TOKEN_CONFIGS */
  manualTokenConfigs?: ManualTokenConfig[]

  /** OAuth adapter factory, consumed by `createAdapter()` */
  createOAuthAdapter?: (config: AdapterConfig) => BaseOAuthAdapter

  /** Auth methods reported by `getSupportedAuthMethods()`, defaults to ['manual'] */
  supportedAuthMethods?: string[]
}
