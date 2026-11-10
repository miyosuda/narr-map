import { PluginActionResult, PluginChildSpec } from './types'

function normalizeChild(value: unknown): PluginChildSpec | null {
  if (value == null || typeof value !== 'object') {
    return null
  }

  const text = (value as { text?: unknown }).text
  if (typeof text !== 'string') {
    return null
  }

  const trimmed = text.trim()
  if (trimmed === '') {
    return null
  }

  const rawChildren = (value as { children?: unknown }).children
  const children = Array.isArray(rawChildren) ? normalizeChildren(rawChildren) : []

  if (children.length > 0) {
    return { text: trimmed, children }
  }
  return { text: trimmed }
}

export function normalizeChildren(values: unknown[]): PluginChildSpec[] {
  const children: PluginChildSpec[] = []
  for (const value of values) {
    const child = normalizeChild(value)
    if (child != null) {
      children.push(child)
    }
  }
  return children
}

// プラグインの戻り値は信用せず、足せる子だけを残す.
export function normalizePluginResult(value: unknown): PluginActionResult {
  if (value == null || typeof value !== 'object') {
    return { addChildren: [] }
  }

  const rawChildren = (value as { addChildren?: unknown }).addChildren
  if (!Array.isArray(rawChildren)) {
    return { addChildren: [] }
  }

  return { addChildren: normalizeChildren(rawChildren) }
}
