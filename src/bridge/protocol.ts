// 中継プロセスと narr-map のあいだで往復する、1行1個の JSON。
// Node API は置かない。main とテストの両方から使う。

export const BRIDGE_MAX_LINE_BYTES = 1024 * 1024
export const BRIDGE_DIR_NAME = 'narr-map'
export const BRIDGE_SOCKET_NAME = 'bridge.sock'

export type BridgeRequest = {
  id: number
  method: string
  params?: Record<string, unknown>
}

export type BridgeSuccess = {
  id: number | null
  ok: true
  result: unknown
}

export type BridgeFailure = {
  id: number | null
  ok: false
  error: string
}

export type BridgeResponse = BridgeSuccess | BridgeFailure

export type DecodeRequestResult =
  | { ok: true; request: BridgeRequest }
  | { ok: false; id: number | null; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function readId(value: unknown): number | null {
  if (!isRecord(value)) {
    return null
  }
  const id = value.id
  if (typeof id === 'number' && Number.isFinite(id)) {
    return id
  }
  return null
}

export function encodeMessage(message: BridgeRequest | BridgeResponse): string {
  return JSON.stringify(message) + '\n'
}

export function decodeRequestLine(line: string): DecodeRequestResult {
  const bytes = new TextEncoder().encode(line).length
  if (bytes > BRIDGE_MAX_LINE_BYTES) {
    return { ok: false, id: null, error: 'request is too large' }
  }
  if (line.trim() === '') {
    return { ok: false, id: null, error: 'empty request' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return { ok: false, id: null, error: 'invalid json' }
  }

  const id = readId(parsed)
  if (!isRecord(parsed) || typeof parsed.id !== 'number' || !Number.isFinite(parsed.id)) {
    return { ok: false, id: null, error: 'id must be a number' }
  }
  if (typeof parsed.method !== 'string' || parsed.method === '') {
    return { ok: false, id, error: 'method must be a string' }
  }
  const params = parsed.params
  if (params !== undefined && !isRecord(params)) {
    return { ok: false, id, error: 'params must be an object' }
  }

  const request: BridgeRequest = {
    id,
    method: parsed.method
  }
  if (isRecord(params)) {
    request.params = params
  }
  return { ok: true, request }
}
