import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_PROXY_CONFIG,
  describeProxyRule,
  resolveProxyRule,
  toElectronProxyConfig,
  toProxyUrl,
  validateProxyRule,
  type PluginProxyConfig,
  type ProxyRule,
} from '../../src/main/plugins/net/resolve'

const httpRule: ProxyRule = { protocol: 'http', host: '127.0.0.1', port: 7890 }
const socksRule: ProxyRule = { protocol: 'socks5', host: '127.0.0.1', port: 1080 }

test('a provider without an override inherits the global rule', () => {
  const config: PluginProxyConfig = { global: httpRule, perProvider: {} }

  assert.deepEqual(resolveProxyRule(config, 'grok'), httpRule)
})

test('an explicit null override forces a direct connection', () => {
  const config: PluginProxyConfig = { global: httpRule, perProvider: { grok: null } }

  assert.equal(resolveProxyRule(config, 'grok'), null)
  assert.deepEqual(resolveProxyRule(config, 'claude'), httpRule, 'other providers still inherit')
})

test('a provider override beats the global rule', () => {
  const config: PluginProxyConfig = { global: httpRule, perProvider: { grok: socksRule } }

  assert.deepEqual(resolveProxyRule(config, 'grok'), socksRule)
})

test('the default config routes everything directly', () => {
  assert.equal(resolveProxyRule(DEFAULT_PROXY_CONFIG, 'anything'), null)
})

test('validateProxyRule rejects malformed rules', () => {
  assert.equal(validateProxyRule(httpRule), null)
  assert.match(validateProxyRule({ ...httpRule, host: '' }) ?? '', /host is required/)
  assert.match(validateProxyRule({ ...httpRule, host: 'a b' }) ?? '', /whitespace/)
  assert.match(validateProxyRule({ ...httpRule, port: 0 }) ?? '', /between 1 and 65535/)
  assert.match(validateProxyRule({ ...httpRule, port: 70000 }) ?? '', /between 1 and 65535/)
  assert.match(validateProxyRule({ ...httpRule, port: 1.5 }) ?? '', /integer/)
  assert.match(
    validateProxyRule({ ...httpRule, password: 'secret' }) ?? '',
    /requires a username/
  )
})

test('toProxyUrl percent-encodes credentials', () => {
  assert.equal(toProxyUrl(httpRule), 'http://127.0.0.1:7890')

  const withAuth: ProxyRule = { ...httpRule, username: 'user@corp', password: 'p@ss:word' }
  assert.equal(toProxyUrl(withAuth), 'http://user%40corp:p%40ss%3Aword@127.0.0.1:7890')
})

test('toElectronProxyConfig maps protocols to Electron proxyRules syntax', () => {
  assert.deepEqual(toElectronProxyConfig(null), { mode: 'direct' })

  assert.deepEqual(toElectronProxyConfig(httpRule), {
    proxyRules: 'http=127.0.0.1:7890;https=127.0.0.1:7890',
    proxyBypassRules: '<local>',
  })

  assert.deepEqual(toElectronProxyConfig(socksRule), {
    proxyRules: 'socks5://127.0.0.1:1080',
    proxyBypassRules: '<local>',
  })
})

test('describeProxyRule never leaks the password', () => {
  const withAuth: ProxyRule = { ...httpRule, username: 'alice', password: 'hunter2' }
  const described = describeProxyRule(withAuth)

  assert.equal(described, 'http://alice:***@127.0.0.1:7890')
  assert.ok(!described.includes('hunter2'))
  assert.equal(describeProxyRule(null), 'direct')
})
