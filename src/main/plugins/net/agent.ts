/**
 * Proxy Agent Factory
 *
 * Produces cached http/https agents for a provider's effective proxy rule.
 * The cache is keyed by proxy URL and invalidated whenever configuration
 * changes, so edits take effect without restarting the app.
 */

import type { Agent } from 'http'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

import { onProxyConfigChange, resolveProviderProxy } from './proxyConfig'
import { describeProxyRule, toProxyUrl, type ProxyRule } from './resolve'

export interface ProxyAgents {
  httpAgent?: Agent
  httpsAgent?: Agent
}

const agentCache = new Map<string, ProxyAgents>()

onProxyConfigChange(() => {
  agentCache.clear()
  console.log('[PluginProxy] Proxy configuration changed, agent cache cleared')
})

function createAgents(rule: ProxyRule): ProxyAgents {
  const url = toProxyUrl(rule)

  if (rule.protocol === 'socks5') {
    const agent = new SocksProxyAgent(url)
    return { httpAgent: agent, httpsAgent: agent }
  }

  return {
    httpAgent: new HttpProxyAgent(url),
    httpsAgent: new HttpsProxyAgent(url),
  }
}

/**
 * Agents for a provider, or an empty object for a direct connection.
 * Spread the result into an axios request config.
 */
export function getProxyAgents(providerId: string): ProxyAgents {
  const rule = resolveProviderProxy(providerId)
  if (!rule) {
    return {}
  }

  const key = toProxyUrl(rule)
  const cached = agentCache.get(key)
  if (cached) {
    return cached
  }

  try {
    const agents = createAgents(rule)
    agentCache.set(key, agents)
    console.log(
      `[PluginProxy] Provider "${providerId}" routed through ${describeProxyRule(rule)}`
    )
    return agents
  } catch (error) {
    console.error(
      `[PluginProxy] Failed to create agent for ${describeProxyRule(rule)}, using direct:`,
      error
    )
    return {}
  }
}

/** Clears cached agents; exposed for tests and manual recovery */
export function clearProxyAgentCache(): void {
  agentCache.clear()
}
