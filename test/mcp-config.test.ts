// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { buildMcpClientConfig } from '../src/bridge/mcp-config'

describe('mcp client config', () => {
  it('embeds the running app and the bundled server', () => {
    const text = buildMcpClientConfig(
      '/Applications/narr-map.app/Contents/MacOS/narr-map',
      '/Applications/narr-map.app/Contents/Resources/mcp.cjs'
    )
    expect(JSON.parse(text)).toEqual({
      mcpServers: {
        'narr-map': {
          command: '/Applications/narr-map.app/Contents/MacOS/narr-map',
          args: ['/Applications/narr-map.app/Contents/Resources/mcp.cjs'],
          env: { ELECTRON_RUN_AS_NODE: '1' }
        }
      }
    })
  })
})
