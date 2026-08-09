const test = require('node:test')
const assert = require('node:assert/strict')
const { join } = require('node:path')

const { ANCHORS, checkAnchors } = require('../../scripts/verify-anchors.js')

const root = join(__dirname, '..', '..')

test('every plugin anchor is still present in its upstream file', () => {
  const failures = checkAnchors(root)

  const detail = failures
    .map(failure => `[${failure.id}] ${failure.file}: ${failure.problem}`)
    .join('\n')

  assert.deepEqual(failures, [], `Plugin anchors were lost:\n${detail}`)
})

test('anchor list covers the provider registration surface', () => {
  const ids = ANCHORS.map(anchor => anchor.id)

  for (const required of [
    'builtin-provider-configs',
    'token-extraction',
    'manual-token-configs',
    'oauth-adapter-factory',
    'forwarder-registry',
    'login-window-proxy',
    'proxy-agent-bundling',
    'main-ipc-registration',
    'preload-bridge',
    'renderer-routes',
    'sidebar-entries',
  ]) {
    assert.ok(ids.includes(required), `Anchor "${required}" is no longer tracked`)
  }
})

test('checkAnchors reports a failure when an anchor is missing', () => {
  const failures = checkAnchors(join(root, 'scripts'))

  assert.ok(failures.length > 0, 'Expected missing-anchor detection to fire on a wrong root')
})
