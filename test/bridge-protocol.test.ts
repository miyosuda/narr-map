// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { BRIDGE_MAX_LINE_BYTES, decodeRequestLine, encodeMessage } from '../src/bridge/protocol'
import { createQueue } from '../src/bridge/queue'

describe('bridge protocol', () => {
  it('reads a request and echoes it as one line', () => {
    const decoded = decodeRequestLine('{"id":1,"method":"get_topic"}')
    expect(decoded).toEqual({
      ok: true,
      request: { id: 1, method: 'get_topic' }
    })
    if (!decoded.ok) {
      return
    }
    expect(encodeMessage({ id: decoded.request.id, ok: true, result: { nodes: [] } })).toBe(
      '{"id":1,"ok":true,"result":{"nodes":[]}}\n'
    )
  })

  it('keeps params when they are an object', () => {
    expect(decodeRequestLine('{"id":2,"method":"find_nodes","params":{"text":"佐藤"}}')).toEqual({
      ok: true,
      request: { id: 2, method: 'find_nodes', params: { text: '佐藤' } }
    })
  })

  it('rejects an empty line', () => {
    expect(decodeRequestLine('')).toEqual({ ok: false, id: null, error: 'empty request' })
    expect(decodeRequestLine('   ')).toEqual({ ok: false, id: null, error: 'empty request' })
  })

  it('rejects invalid json', () => {
    expect(decodeRequestLine('{')).toEqual({ ok: false, id: null, error: 'invalid json' })
  })

  it('rejects a missing or non-numeric id', () => {
    expect(decodeRequestLine('{"method":"get_topic"}')).toEqual({
      ok: false,
      id: null,
      error: 'id must be a number'
    })
    expect(decodeRequestLine('{"id":"1","method":"get_topic"}')).toEqual({
      ok: false,
      id: null,
      error: 'id must be a number'
    })
  })

  it('rejects a missing method and keeps the id', () => {
    expect(decodeRequestLine('{"id":4}')).toEqual({
      ok: false,
      id: 4,
      error: 'method must be a string'
    })
  })

  it('rejects params that are not an object', () => {
    expect(decodeRequestLine('{"id":5,"method":"get_topic","params":[]}')).toEqual({
      ok: false,
      id: 5,
      error: 'params must be an object'
    })
  })

  it('rejects a line over the size limit', () => {
    const line = JSON.stringify({
      id: 1,
      method: 'get_topic',
      params: { text: 'a'.repeat(BRIDGE_MAX_LINE_BYTES) }
    })
    expect(decodeRequestLine(line)).toEqual({
      ok: false,
      id: null,
      error: 'request is too large'
    })
  })
})

describe('bridge queue', () => {
  it('runs the next task after the previous one finishes', async () => {
    const enqueue = createQueue()
    const order: string[] = []
    const first = enqueue(async () => {
      order.push('start1')
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push('end1')
    })
    const second = enqueue(async () => {
      order.push('start2')
    })
    await first
    await second
    expect(order).toEqual(['start1', 'end1', 'start2'])
  })
})
