import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

import { normalizePluginResult } from './result'
import {
  PluginAction,
  PluginActionContext,
  PluginActionResult,
  PluginMenuEntry,
  PluginNodeContext
} from './types'

type ManifestAction = {
  id: string
  label: string
  placement: string
}

type PluginManifest = {
  id: string
  actions: ManifestAction[]
}

export type LoadedPlugin = {
  id: string
  dir: string
  actions: {
    id: string
    label: string
    run: PluginAction
  }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function readManifest(dir: string): PluginManifest {
  const manifestPath = path.join(dir, 'manifest.json')
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown
  if (!isRecord(json) || typeof json.id !== 'string' || json.id.trim() === '') {
    throw new Error('manifest.json needs a string id')
  }
  if (!Array.isArray(json.actions)) {
    throw new Error('manifest.json needs an actions array')
  }
  return {
    id: json.id.trim(),
    actions: json.actions as ManifestAction[]
  }
}

function loadPluginModule(entryPath: string): Record<string, unknown> {
  // webpack がバンドルしようとしないよう、Node 本体の require で読む.
  const pluginRequire = createRequire(entryPath)
  const loaded = pluginRequire(entryPath) as unknown
  if (!isRecord(loaded)) {
    throw new Error('Plugin entry must export an object')
  }
  if (loaded.__esModule === true && isRecord(loaded.default)) {
    return loaded.default
  }
  return loaded
}

function loadPlugin(dir: string): LoadedPlugin {
  const manifest = readManifest(dir)
  const entryPath = path.join(dir, 'index.js')
  if (!fs.existsSync(entryPath)) {
    throw new Error('index.js is missing')
  }

  const exported = loadPluginModule(entryPath)
  const actions: LoadedPlugin['actions'] = []
  const seen = new Set<string>()

  for (const action of manifest.actions) {
    if (!isRecord(action)) {
      continue
    }
    if (action.placement !== 'node-context-menu') {
      continue
    }
    if (typeof action.id !== 'string' || action.id.trim() === '') {
      continue
    }
    if (typeof action.label !== 'string' || action.label.trim() === '') {
      continue
    }
    const id = action.id.trim()
    if (seen.has(id)) {
      continue
    }
    const run = exported[id]
    if (typeof run !== 'function') {
      throw new Error(`action "${id}" is not a function in index.js`)
    }
    seen.add(id)
    actions.push({
      id,
      label: action.label.trim(),
      run: run as PluginAction
    })
  }

  if (actions.length === 0) {
    throw new Error('no node-context-menu actions')
  }

  return {
    id: manifest.id,
    dir,
    actions
  }
}

function loadPluginsFromDir(dir: string): LoadedPlugin[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const plugins: LoadedPlugin[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const pluginDir = path.join(dir, entry.name)
    try {
      plugins.push(loadPlugin(pluginDir))
    } catch (error) {
      console.error(`Failed to load plugin at ${pluginDir}`, error)
    }
  }
  return plugins
}

// 先に渡したディレクトリを優先し、同じ id は後ろのディレクトリで上書きする.
export function loadPlugins(dirs: string[]): LoadedPlugin[] {
  const byId = new Map<string, LoadedPlugin>()
  const order: string[] = []

  for (const dir of dirs) {
    for (const plugin of loadPluginsFromDir(dir)) {
      if (!byId.has(plugin.id)) {
        order.push(plugin.id)
      }
      byId.set(plugin.id, plugin)
    }
  }

  return order.map((id) => byId.get(id) as LoadedPlugin)
}

export function existingPluginDirs(candidates: string[]): string[] {
  const seen = new Set<string>()
  const dirs: string[] = []
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue
    }
    let real = candidate
    try {
      real = fs.realpathSync(candidate)
    } catch {
      continue
    }
    if (seen.has(real)) {
      continue
    }
    seen.add(real)
    dirs.push(real)
  }
  return dirs
}

export function listMenuEntries(plugins: LoadedPlugin[]): PluginMenuEntry[] {
  const entries: PluginMenuEntry[] = []
  for (const plugin of plugins) {
    for (const action of plugin.actions) {
      entries.push({
        pluginId: plugin.id,
        actionId: action.id,
        label: action.label
      })
    }
  }
  return entries
}

export function isPluginNodeContext(value: unknown): value is PluginNodeContext {
  if (!isRecord(value)) {
    return false
  }
  if (typeof value.id !== 'number' || typeof value.text !== 'string') {
    return false
  }
  if (value.symbol !== null && typeof value.symbol !== 'string') {
    return false
  }
  if (!Array.isArray(value.children) || !Array.isArray(value.ancestors)) {
    return false
  }
  return true
}

export async function runPluginAction(
  plugins: LoadedPlugin[],
  pluginId: string,
  actionId: string,
  node: PluginNodeContext,
  ai: PluginActionContext['ai']
): Promise<PluginActionResult> {
  const plugin = plugins.find((item) => item.id === pluginId)
  if (plugin == null) {
    throw new Error(`Plugin not found: ${pluginId}`)
  }
  const action = plugin.actions.find((item) => item.id === actionId)
  if (action == null) {
    throw new Error(`Plugin action not found: ${pluginId}.${actionId}`)
  }

  const raw = await action.run({ node, ai })
  return normalizePluginResult(raw)
}
