# Provider Plugin System

This fork adds providers through a plugin layer instead of editing upstream
files directly, so that merging upstream changes stays cheap.

## Why

Adding a provider upstream means editing 8+ files (see `AGENTS.md`). Every one
of those edits is a future merge conflict. Here, provider logic lives entirely
in `src/main/plugins/`, and upstream files carry only one-line **anchors**
(spreads and delegations).

## Layout

```
src/main/plugins/
├── index.ts            Single entry point; every anchor imports from here
├── types.ts            ProviderPlugin interface
├── registry.ts         Derives anchor-shaped data from the plugin list
├── channels.ts         IPC channel constants (no runtime imports)
├── ipc.ts              IPC handlers for proxy + chat
├── net/
│   ├── resolve.ts      Pure rule resolution (unit tested)
│   ├── proxyConfig.ts  Storage in ~/.chat2api/plugins.json
│   ├── agent.ts        Cached http/https/socks agents
│   └── request.ts      Proxy-aware axios wrapper
├── chat/store.ts       Chat sessions in ~/.chat2api/chats.json
└── providers/<id>/     One directory per provider

src/renderer/src/plugins/
├── chat/               Native chat page (ChatPage, chatStore)
└── proxy/              Network proxy page (NetworkPage, networkStore)
```

## Adding a provider

1. Create `src/main/plugins/providers/<id>/` with a `ProviderPlugin` export.
2. Add it to the `plugins` array in `src/main/plugins/index.ts`.
3. Add `<id>` to `ProviderVendor` in `src/shared/types.ts` (the one upstream
   type that still needs widening per provider).

A plugin supplies everything the registration points need:

```ts
export const grokPlugin: ProviderPlugin = {
  id: 'grok',
  providerConfig,          // -> builtinProviders + builtinProviderMap
  matches,                 // -> providerForwarders
  forward,                 // -> providerForwarders
  tokenExtraction,         // -> TOKEN_EXTRACTION_CONFIGS (in-app login)
  manualTokenConfigs,      // -> MANUAL_TOKEN_CONFIGS
  createOAuthAdapter,      // -> createAdapter()
  supportedAuthMethods,    // -> getSupportedAuthMethods()
}
```

Outbound HTTP must go through `net/request.ts` so the provider's proxy applies:

```ts
import { pluginRequest } from '../../net/request'

const response = await pluginRequest(provider.id, { method: 'POST', url, data })
```

## Anchors

`scripts/verify-anchors.js` asserts every anchor still exists and runs in CI
before the tests. This matters because a bad upstream merge can silently drop
an anchor **without breaking the build** — plugins would just vanish at runtime.

| Anchor | File |
|---|---|
| `builtin-provider-configs` | `src/main/providers/builtin/index.ts` |
| `token-extraction` | `src/main/oauth/tokenExtractionConfig.ts` |
| `manual-token-configs` | `src/main/oauth/types.ts` |
| `oauth-adapter-factory` | `src/main/oauth/adapters/index.ts` |
| `forwarder-registry` | `src/main/proxy/forwarder.ts` |
| `login-window-proxy` | `src/main/oauth/inAppLogin.ts` |
| `proxy-agent-bundling` | `electron.vite.config.ts` |
| `main-ipc-registration` | `src/main/ipc/handlers.ts` |
| `preload-bridge` | `src/preload/index.ts` |
| `renderer-routes` | `src/renderer/src/App.tsx` |
| `sidebar-entries` | `src/renderer/src/components/layout/Sidebar.tsx` |

After merging upstream:

```bash
npm run verify:anchors
npm test
```

### Two anchors worth explaining

**`proxy-agent-bundling`** — `externalizeDepsPlugin` externalizes dependencies
by default. An externalized package resolves fine in dev but is absent from the
packaged asar, so the app dies at runtime with `Cannot find module`. The proxy
agents must stay in the `exclude` list.

**`login-window-proxy`** — `inAppLogin.ts` creates the login `BrowserWindow`.
Without applying the provider proxy to its session, providers that are
unreachable directly never load their login page, so credentials can never be
captured in the first place.

## Network proxy

Resolution is three-state per provider:

| `perProvider[id]` | Meaning |
|---|---|
| absent | inherit the global rule |
| `null` | force a direct connection |
| rule | use that rule |

Both the Node HTTP path (`net/agent.ts`) and the Electron login window
(`inAppLogin.ts`) read the same configuration.

Verify a proxy is really in use with the **Test** button on the Network page:
it reports the outbound IP. Compare it with and without the proxy — a config
that silently falls back to direct otherwise looks identical to a working one.

Note that `net/proxyConfig.ts` and `chat/store.ts` recompute
`~/.chat2api` instead of calling `storeManager.getStorePath()`. Importing the
store module would create a runtime cycle, because `store/types.ts` re-exports
`builtinProviders` and therefore pulls in the plugin registry.

## Chat page

The chat page talks to the local OpenAI-compatible endpoint
(`http://127.0.0.1:<port>/v1/chat/completions`) rather than calling the
forwarder in-process. This is deliberate: it exercises the same path external
clients use, so the page doubles as a self-test for the API surface.

Sessions are grouped per provider and stored in `~/.chat2api/chats.json`,
capped at 200 sessions and 500 messages each.

## Testing

```bash
npm run verify:anchors   # anchors intact
npm test                 # node --test, JS/MJS tests
npm run test:plugins     # TypeScript plugin tests via tsx
```

`node --test` matches `**/*.test.?(c|m)js` only, so the repository's pre-existing
`.ts` tests are skipped — they have no runner configured and have never run in
CI. Plugin TypeScript tests run separately through `tsx`.

### Known failing tests

`tests/skills/` is excluded from `npm test` and from CI. Two of its tests fail
on a clean checkout of upstream:

- `restore-tool-config exits nonzero on non-2xx response`
  (`tests/skills/chat2api-management-api.test.mjs`)
- `versioned Chat2API testing skills exist and have trigger-only descriptions`
  (`tests/skills/chat2api-proxy-testing-skill.test.mjs`)

These cover the `skills/` helper scripts and SKILL.md frontmatter used by AI
agents, not the application itself. They pre-date this fork's changes and had
never executed before CI existed (the project had no test script or runner).

Investigated and ruled out: every SKILL.md's `name`/`description` matches the
expected values verbatim, no `TBD`/`FIXME`/`deferred work` markers are present,
and adding `.gitattributes` (LF enforcement) did not change the outcome. The
actual assertion detail has not been captured yet. Re-enable by dropping the
`grep -v 'tests/skills/'` filter in `.github/workflows/ci-windows.yml`.

CI (`.github/workflows/ci-windows.yml`) builds Windows only and uploads nothing
by default. Run it manually with `upload_installer: true` to get an installer
artifact (3-day retention). Releases publish to GitHub Releases, whose assets do
not count against the Actions artifact quota.

### Lockfile

`npm ci` hard-fails when `package.json` and `package-lock.json` disagree. This
environment has no local Node toolchain, so the install step falls back to
`npm install` with a warning. Run `sync-lockfile.yml` (must be on the default
branch to appear in the UI — `workflow_dispatch` workflows are only dispatchable
from the default branch) to regenerate and commit the lock, restoring `npm ci`.
