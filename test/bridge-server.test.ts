// @vitest-environment node

import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { BRIDGE_MAX_LINE_BYTES } from '../src/bridge/protocol'
import { startBridgeServer, type StartedBridge } from '../src/bridge/server'

const started: StartedBridge[] = []

afterEach(() => {
  for (const server of started) {
    server.close()
  }
  started.length = 0
})

function socketPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'narr-bridge-')), 'bridge.sock')
}

function call(target: string, payload: string | object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(target)
    let buffer = ''
    socket.on('error', reject)
    socket.on('connect', () => {
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
      socket.write(text.endsWith('\n') ? text : text + '\n')
    })
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const newlineAt = buffer.indexOf('\n')
      if (newlineAt === -1) {
        return
      }
      socket.end()
      resolve(JSON.parse(buffer.slice(0, newlineAt)))
    })
  })
}

describe('bridge server', () => {
  it('answers one request and leaves the socket readable only by this user', async () => {
    const target = socketPath()
    const server = await startBridgeServer(target, async (request) => ({
      id: request.id,
      ok: true,
      result: { method: request.method }
    }))
    expect(server).not.toBeNull()
    started.push(server!)

    expect(fs.statSync(target).mode & 0o777).toBe(0o600)
    await expect(call(target, { id: 3, method: 'get_topic' })).resolves.toEqual({
      id: 3,
      ok: true,
      result: { method: 'get_topic' }
    })
  })

  it('does not listen when another server already owns the socket', async () => {
    const target = socketPath()
    const first = await startBridgeServer(target, async (request) => ({
      id: request.id,
      ok: true,
      result: null
    }))
    started.push(first!)
    const second = await startBridgeServer(target, async () => {
      throw new Error('should not run')
    })
    expect(second).toBeNull()
  })

  it('returns an error for invalid json', async () => {
    const target = socketPath()
    const server = await startBridgeServer(target, async () => {
      throw new Error('should not run')
    })
    started.push(server!)
    await expect(call(target, '{')).resolves.toEqual({
      id: null,
      ok: false,
      error: 'invalid json'
    })
  })

  it('rejects a line that exceeds the size limit before a newline', async () => {
    const target = socketPath()
    const server = await startBridgeServer(target, async () => {
      throw new Error('should not run')
    })
    started.push(server!)
    const payload = 'x'.repeat(BRIDGE_MAX_LINE_BYTES + 1)
    await expect(call(target, payload)).resolves.toEqual({
      id: null,
      ok: false,
      error: 'request is too large'
    })
  })

  it('times out a handler that does not return', async () => {
    const target = socketPath()
    const server = await startBridgeServer(
      target,
      () => new Promise(() => undefined),
      { timeoutMs: 30 }
    )
    started.push(server!)
    await expect(call(target, { id: 8, method: 'get_topic' })).resolves.toEqual({
      id: 8,
      ok: false,
      error: 'timed out'
    })
  })
})
