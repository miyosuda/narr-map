// Cursor が起動する MCP サーバ。
// narr-map 本体は MCP を話さず、Unix ソケットで JSON を1往復する。
// ソケットの場所は src/bridge/protocol.ts の BRIDGE_DIR_NAME / BRIDGE_SOCKET_NAME と揃える。

import net from 'net'
import os from 'os'
import path from 'path'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const SOCKET_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'narr-map',
  'bridge.sock'
)
const CALL_TIMEOUT_MS = 20000

let nextId = 1

function callBridge(method, params) {
  if (process.platform !== 'darwin') {
    return Promise.reject(new Error('narr-map bridge is available on macOS'))
  }

  const id = nextId
  nextId += 1
  const request = { id, method }
  if (params !== undefined) {
    request.params = params
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(SOCKET_PATH)
    let buffer = ''
    let settled = false
    const finish = (error, response) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      socket.destroy()
      if (error != null) {
        reject(error)
        return
      }
      resolve(response)
    }
    const timer = setTimeout(() => {
      finish(new Error('timed out'))
    }, CALL_TIMEOUT_MS)

    socket.once('connect', () => {
      socket.write(JSON.stringify(request) + '\n')
    })
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const newlineAt = buffer.indexOf('\n')
      if (newlineAt === -1) {
        return
      }
      try {
        finish(null, JSON.parse(buffer.slice(0, newlineAt)))
      } catch {
        finish(new Error('invalid response'))
      }
    })
    socket.once('error', (error) => {
      if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
        finish(new Error('narr-map is not running'))
        return
      }
      finish(error)
    })
  })
}

function toolResult(response) {
  if (response == null || typeof response !== 'object' || response.ok !== true) {
    const error =
      response != null && typeof response.error === 'string' && response.error !== ''
        ? response.error
        : 'bridge failed'
    return {
      isError: true,
      content: [{ type: 'text', text: error }]
    }
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(response.result) }]
  }
}

async function runTool(method, params) {
  try {
    return toolResult(await callBridge(method, params))
  } catch (error) {
    const message = error instanceof Error && error.message !== '' ? error.message : 'bridge failed'
    return {
      isError: true,
      content: [{ type: 'text', text: message }]
    }
  }
}

const server = new McpServer({
  name: 'narr-map',
  version: '0.1.0'
})

server.registerTool(
  'get_topic',
  {
    description:
      '開いている narr-map の話題セットを返す。ユーザーが「この2人」「話題のノード」と言ったときは、名前から id を作らず、この結果を使う。symbol は種類のラベルであり、話題の指定ではない。nodes が空なら、話題にノードを載せるようユーザーに伝える。'
  },
  async () => runTool('get_topic')
)

server.registerTool(
  'find_nodes',
  {
    description:
      '表示テキストが完全一致するノードを返す。子を足す nodeId は、この戻りか get_topic の戻りだけを使う。同名が複数あるときは一つに決めず、候補をユーザーに示す。symbol は種類のラベルであり、話題の指定ではない。',
    inputSchema: {
      text: z.string().describe('ノードの表示テキスト。完全一致')
    }
  },
  async ({ text }) => runTool('find_nodes', { text })
)

const childSchema = z
  .object({
    text: z.string(),
    children: z.array(z.any()).optional()
  })
  .passthrough()

server.registerTool(
  'add_children',
  {
    description:
      '指定した nodeId の子ノードを足す。nodeId は get_topic または find_nodes が返した id だけを使う。名前から id を作らない。',
    inputSchema: {
      nodeId: z.number().int().describe('親ノードの id'),
      children: z.array(childSchema).describe('足す子。text と、任意の children')
    }
  },
  async ({ nodeId, children }) => runTool('add_children', { nodeId, children })
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main()
