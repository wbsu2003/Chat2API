/**
 * Proxy Rule Resolution - Pure Logic
 *
 * Deliberately free of Electron and filesystem imports so it can be unit
 * tested directly. Storage lives in `./proxyConfig`, Electron/agent wiring in
 * `./agent`.
 */

export type ProxyProtocol = 'http' | 'https' | 'socks5'

export interface ProxyRule {
  protocol: ProxyProtocol
  host: string
  port: number
  username?: string
  password?: string
}

/**
 * `undefined` for a provider means "inherit the global rule".
 * `null` means "force a direct connection", overriding the global rule.
 */
export type ProviderProxyOverride = ProxyRule | null

export interface PluginProxyConfig {
  /** Applied to any provider without an explicit override */
  global: ProxyRule | null
  /** providerId -> override */
  perProvider: Record<string, ProviderProxyOverride>
}

export const DEFAULT_PROXY_CONFIG: PluginProxyConfig = {
  global: null,
  perProvider: {},
}

/**
 * Resolves the effective rule for a provider.
 * Returns null when the provider should connect directly.
 */
export function resolveProxyRule(
  config: PluginProxyConfig,
  providerId: string
): ProxyRule | null {
  if (Object.prototype.hasOwnProperty.call(config.perProvider, providerId)) {
    return config.perProvider[providerId]
  }
  return config.global
}

/**
 * Validates a rule, returning an error message or null when valid.
 */
export function validateProxyRule(rule: ProxyRule): string | null {
  if (!rule.host || !rule.host.trim()) {
    return 'Proxy host is required'
  }

  if (/\s/.test(rule.host)) {
    return 'Proxy host must not contain whitespace'
  }

  if (!Number.isInteger(rule.port) || rule.port < 1 || rule.port > 65535) {
    return 'Proxy port must be an integer between 1 and 65535'
  }

  if (!['http', 'https', 'socks5'].includes(rule.protocol)) {
    return `Unsupported proxy protocol: ${rule.protocol}`
  }

  if (rule.password && !rule.username) {
    return 'Proxy password requires a username'
  }

  return null
}

/**
 * Builds a connection URL, e.g. `socks5://user:pass@127.0.0.1:1080`.
 * Credentials are percent-encoded so passwords containing `@` or `:` work.
 */
export function toProxyUrl(rule: ProxyRule): string {
  const auth = rule.username
    ? `${encodeURIComponent(rule.username)}:${encodeURIComponent(rule.password ?? '')}@`
    : ''

  return `${rule.protocol}://${auth}${rule.host}:${rule.port}`
}

/**
 * Builds an Electron `session.setProxy()` argument.
 *
 * Electron's proxyRules syntax carries no credentials; authentication is
 * handled separately through the app's 'login' event.
 */
export function toElectronProxyConfig(
  rule: ProxyRule | null
): { mode: 'direct' } | { proxyRules: string; proxyBypassRules: string } {
  if (!rule) {
    return { mode: 'direct' }
  }

  const endpoint = `${rule.host}:${rule.port}`
  const proxyRules =
    rule.protocol === 'socks5'
      ? `socks5://${endpoint}`
      : `http=${endpoint};https=${endpoint}`

  return {
    proxyRules,
    proxyBypassRules: '<local>',
  }
}

/**
 * Masks credentials for logging.
 */
export function describeProxyRule(rule: ProxyRule | null): string {
  if (!rule) return 'direct'
  const auth = rule.username ? `${rule.username}:***@` : ''
  return `${rule.protocol}://${auth}${rule.host}:${rule.port}`
}
