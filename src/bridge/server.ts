import fs from 'fs'
import net from 'net'
import path from 'path'

import {
  BRIDGE_DIR_NAME,
  BRIDGE_MAX_LINE_BYTES,
  BRIDGE_SOCKET_NAME,
  BridgeRequest,
  BridgeResponse,
  decodeRequestLine,
  encodeMessage
} from './protocol'

// レンダラ側の待ちは 5 秒。こちらは、前の呼び出しの待ち行列に並んでいるあいだに
// ソケットを切らないための上限。
const DEFAULT_TIMEOUT_MS = 20000

export type BridgeHandler = (request: BridgeRequest) => Promise<BridgeResponse>

export type StartedBridge = {
  socketPath: string
  close: () => void
}

export function bridgeSocketPath(appData: string): string {
  return path.join(appData, BRIDGE_DIR_NAME, BRIDGE_SOCKET_NAME)
}

function socketInUse(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(socketPath)
    let settled = false
    const finish = (inUse: boolean) => {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolve(inUse)
    }
    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function writeResponse(socket: net.Socket, response: BridgeResponse) {
  if (socket.destroyed) {
    return
  }
  socket.end(encodeMessage(response))
}

function handleConnection(socket: net.Socket, handler: BridgeHandler, timeoutMs: number) {
  let buffer = Buffer.alloc(0)
  let settled = false

  const fail = (id: number | null, error: string) => {
    if (settled) {
      return
    }
    settled = true
    writeResponse(socket, { id, ok: false, error })
  }

  const takeLine = (line: string) => {
    if (settled) {
      return
    }
    settled = true
    const decoded = decodeRequestLine(line)
    if (decoded.ok === false) {
      writeResponse(socket, { id: decoded.id, ok: false, error: decoded.error })
      return
    }

    let finished = false
    const timer = setTimeout(() => {
      if (finished) {
        return
      }
      finished = true
      writeResponse(socket, { id: decoded.request.id, ok: false, error: 'timed out' })
    }, timeoutMs)

    handler(decoded.request)
      .then((response) => {
        if (finished) {
          return
        }
        finished = true
        clearTimeout(timer)
        writeResponse(socket, response)
      })
      .catch((error: unknown) => {
        if (finished) {
          return
        }
        finished = true
        clearTimeout(timer)
        const message = error instanceof Error && error.message !== '' ? error.message : 'bridge failed'
        writeResponse(socket, { id: decoded.request.id, ok: false, error: message })
      })
  }

  socket.on('data', (chunk: Buffer) => {
    if (settled) {
      return
    }
    buffer = Buffer.concat([buffer, chunk])
    const newlineAt = buffer.indexOf(0x0a)
    if (newlineAt === -1) {
      if (buffer.length > BRIDGE_MAX_LINE_BYTES) {
        fail(null, 'request is too large')
      }
      return
    }
    if (newlineAt > BRIDGE_MAX_LINE_BYTES) {
      fail(null, 'request is too large')
      return
    }
    takeLine(buffer.subarray(0, newlineAt).toString('utf8'))
  })

  socket.on('error', () => {
    settled = true
  })
  socket.on('end', () => {
    socket.destroy()
  })
}

export async function startBridgeServer(
  socketPath: string,
  handler: BridgeHandler,
  options: { timeoutMs?: number } = {}
): Promise<StartedBridge | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  fs.mkdirSync(path.dirname(socketPath), { recursive: true })

  if (fs.existsSync(socketPath)) {
    const inUse = await socketInUse(socketPath)
    if (inUse) {
      return null
    }
    try {
      fs.unlinkSync(socketPath)
    } catch {
      return null
    }
  }

  const server = net.createServer((socket) => {
    handleConnection(socket, handler, timeoutMs)
  })

  const listening = await new Promise<boolean>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening)
      if (error.code === 'EADDRINUSE') {
        resolve(false)
        return
      }
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve(true)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(socketPath)
  })

  if (!listening) {
    server.close()
    return null
  }

  fs.chmodSync(socketPath, 0o600)

  let closed = false
  return {
    socketPath,
    close: () => {
      if (closed) {
        return
      }
      closed = true
      server.close()
      try {
        fs.unlinkSync(socketPath)
      } catch {
        // すでに消えている
      }
    }
  }
}
