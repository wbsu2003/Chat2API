#!/usr/bin/env node

/**
 * Anchor Guard
 *
 * The provider plugin system keeps its logic inside `src/main/plugins/` and
 * touches upstream files only through a handful of one-line "anchors" (spreads
 * and delegations). That keeps merge conflicts with upstream minimal, but it
 * also means a careless merge can silently drop an anchor and disable plugins
 * without breaking the build.
 *
 * This script asserts every anchor is still present. Run it in CI before tests.
 */

const fs = require('node:fs')
const path = require('node:path')

const ANCHORS = [
  {
    id: 'builtin-provider-configs',
    file: 'src/main/providers/builtin/index.ts',
    patterns: [/\.\.\.pluginProviderConfigs/, /\.\.\.pluginProviderMap/],
    reason: 'Plugin providers must appear in builtinProviders and builtinProviderMap',
  },
  {
    id: 'token-extraction',
    file: 'src/main/oauth/tokenExtractionConfig.ts',
    patterns: [
      /\.\.\.pluginTokenExtraction/,
      /TOKEN_EXTRACTION_CONFIGS:\s*Record<string,/,
    ],
    reason: 'In-app login needs plugin token extraction configs, with a widened key type',
  },
  {
    id: 'manual-token-configs',
    file: 'src/main/oauth/types.ts',
    patterns: [
      /\.\.\.pluginManualTokenConfigs/,
      /MANUAL_TOKEN_CONFIGS:\s*Record<string,/,
    ],
    reason: 'Manual token hints for plugin providers, with a widened key type',
  },
  {
    id: 'oauth-adapter-factory',
    file: 'src/main/oauth/adapters/index.ts',
    patterns: [/createPluginOAuthAdapter\(/, /getPluginAuthMethods\(/],
    reason: 'createAdapter/getSupportedAuthMethods must delegate to plugins before their switch',
  },
  {
    id: 'forwarder-registry',
    file: 'src/main/proxy/forwarder.ts',
    patterns: [/\.\.\.pluginForwarders/],
    reason: 'Plugin forwarders must be spread into the providerForwarders registry',
  },
  {
    id: 'login-window-proxy',
    file: 'src/main/oauth/inAppLogin.ts',
    patterns: [/resolveProviderProxy\(/, /toElectronProxyConfig\(/],
    reason:
      'The login window must honour the provider proxy, otherwise unreachable providers never load their login page',
  },
  {
    id: 'proxy-agent-bundling',
    file: 'electron.vite.config.ts',
    patterns: [/'http-proxy-agent'/, /'https-proxy-agent'/, /'socks-proxy-agent'/],
    reason:
      'Proxy agents must stay out of externalizeDepsPlugin, or the packaged app fails with "Cannot find module"',
  },
  {
    id: 'main-ipc-registration',
    file: 'src/main/ipc/handlers.ts',
    patterns: [/registerPluginIpcHandlers\(\)/],
    reason: 'Plugin IPC handlers must be registered, otherwise the renderer cannot reach them',
  },
  {
    id: 'preload-bridge',
    file: 'src/preload/index.ts',
    patterns: [/plugins:\s*pluginsAPI/],
    reason: 'window.electronAPI.plugins must be exposed for the chat and network pages',
  },
  {
    id: 'renderer-routes',
    file: 'src/renderer/src/App.tsx',
    patterns: [/path="\/chat"/, /path="\/network"/],
    reason: 'Chat and network pages need their routes registered',
  },
  {
    id: 'sidebar-entries',
    file: 'src/renderer/src/components/layout/Sidebar.tsx',
    patterns: [/'nav\.chat'/, /'nav\.network'/],
    reason: 'Chat and network entries must stay in the sidebar navigation',
  },
  {
    id: 'account-screen-proxy',
    file: 'src/renderer/src/pages/Providers.tsx',
    patterns: [/ProviderProxySection/],
    reason:
      'Proxy must be configurable from the account screen: the login window needs it before any account exists',
  },
]

function checkAnchors(root = process.cwd()) {
  const failures = []

  for (const anchor of ANCHORS) {
    const filePath = path.join(root, anchor.file)

    if (!fs.existsSync(filePath)) {
      failures.push({
        id: anchor.id,
        file: anchor.file,
        problem: 'file not found',
        reason: anchor.reason,
      })
      continue
    }

    const source = fs.readFileSync(filePath, 'utf8')
    const missing = anchor.patterns.filter(pattern => !pattern.test(source))

    if (missing.length > 0) {
      failures.push({
        id: anchor.id,
        file: anchor.file,
        problem: `missing ${missing.map(String).join(', ')}`,
        reason: anchor.reason,
      })
    }
  }

  return failures
}

function main() {
  const failures = checkAnchors()

  if (failures.length === 0) {
    console.log(`All ${ANCHORS.length} plugin anchors are intact.`)
    return
  }

  console.error('Missing plugin anchors detected:')
  for (const failure of failures) {
    console.error(`  - [${failure.id}] ${failure.file}: ${failure.problem}`)
    console.error(`    why: ${failure.reason}`)
  }
  console.error(
    '\nAn upstream merge likely overwrote these lines. Re-apply them before building;' +
      '\notherwise plugin providers silently disappear at runtime.'
  )
  process.exitCode = 1
}

if (require.main === module) {
  main()
}

module.exports = { ANCHORS, checkAnchors }
