/**
 * Proxy-aware HTTP client for plugin providers
 *
 * Plugin adapters should route every outbound call through here so the
 * per-provider proxy setting is always applied.
 */

import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

import { getProxyAgents } from './agent'

const DEFAULT_TIMEOUT = 120000

/**
 * Applies the provider's proxy agents to a request config.
 *
 * `proxy: false` is required: once httpAgent/httpsAgent are set, axios' own
 * proxy handling (which also reads HTTP_PROXY/HTTPS_PROXY from the
 * environment) would otherwise fight the agent and can silently bypass it.
 */
export function withProxyConfig(
  providerId: string,
  config: AxiosRequestConfig = {}
): AxiosRequestConfig {
  const agents = getProxyAgents(providerId)

  if (!agents.httpAgent && !agents.httpsAgent) {
    return config
  }

  return {
    ...config,
    ...agents,
    proxy: false,
  }
}

/**
 * Issues a request through the provider's configured proxy.
 */
export function pluginRequest<T = unknown>(
  providerId: string,
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return axios.request<T>(
    withProxyConfig(providerId, {
      timeout: DEFAULT_TIMEOUT,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      ...config,
    })
  )
}
