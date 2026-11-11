// @vitest-environment node

import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { applyPluginAddChildren } from '../src/plugins/apply'
import { buildPluginNodeContext } from '../src/plugins/context'
import { listMenuEntries, loadPlugins, runPluginAction } from '../src/plugins/host'
import { NodeState } from '../src/types'
import { findNode, getNodeState } from '../src/utils/node-utils'

function buildTree(
  spec: {
    id: number
    text?: string
    isLeft?: boolean
    selected?: boolean
    editId?: number
    folded?: boolean
    symbol?: string | null
    children?: ReturnType<typeof buildTree>[]
    accompaniedState?: ReturnType<typeof buildTree>
  },
  parent: NodeState | null = null
): NodeState {
  const children = (spec.children ?? []).map((child) => buildTree(child, null))
  const state = getNodeState({
    id: spec.id,
    text: spec.text ?? `node-${spec.id}`,
    symbol: spec.symbol ?? null,
    isLeft: spec.isLeft ?? false,
    selected: spec.selected ?? false,
    editId: spec.editId ?? spec.id,
    folded: spec.folded ?? false,
    children,
    accompaniedState: spec.accompaniedState ? buildTree(spec.accompaniedState, null) : null,
    parent
  })

  children.forEach((child) => {
    child.parent = state
  })
  if (state.accompaniedState != null) {
    state.accompaniedState.parent = null
  }

  return state
}

function storyTree(): NodeState {
  return buildTree({
    id: 0,
    text: '物語',
    children: [
      {
        id: 2,
        text: 'ホームレス',
        children: [
          {
            id: 3,
            text: 'ホームレスになった経緯',
            folded: true,
            symbol: 'past',
            children: [{ id: 5, text: '既にある案' }]
          }
        ]
      }
    ],
    accompaniedState: {
      id: 1,
      text: '',
      isLeft: true,
      children: [{ id: 4, text: '左のメモ', isLeft: true }]
    }
  })
}

describe('plugin context and apply', () => {
  it('gives the plugin the path from the root and the existing children', () => {
    const root = storyTree()
    const node = findNode(root, (state) => state.id === 3)
    expect(node).not.toBeNull()

    const context = buildPluginNodeContext(root, node!)
    expect(context).toEqual({
      id: 3,
      text: 'ホームレスになった経緯',
      symbol: 'past',
      children: [{ text: '既にある案' }],
      ancestors: [{ text: '物語' }, { text: 'ホームレス' }]
    })
  })

  it('includes the center root on a left-side node', () => {
    const root = storyTree()
    const node = findNode(root, (state) => state.id === 4)
    const context = buildPluginNodeContext(root, node!)
    expect(context.ancestors).toEqual([{ text: '物語' }])
    expect(context.children).toEqual([])
  })

  it('adds children under the clicked node and unfolds it', () => {
    const root = storyTree()
    const applied = applyPluginAddChildren(
      root,
      3,
      [
        { text: '仕事を失った' },
        { text: '  ' },
        { text: '親案', children: [{ text: '子案' }, { text: '' }] }
      ],
      10,
      10
    )

    expect(applied.status).toBe('applied')
    if (applied.status !== 'applied') {
      return
    }

    const node = findNode(applied.rootState, (state) => state.id === 3)
    expect(node).not.toBeNull()
    expect(node!.folded).toBe(false)
    expect(node!.children.map((child) => child.text)).toEqual([
      '既にある案',
      '仕事を失った',
      '親案'
    ])
    expect(node!.children[1].isLeft).toBe(false)
    expect(node!.children[1].parent?.id).toBe(3)
    expect(node!.children[2].children.map((child) => child.text)).toEqual(['子案'])
    expect(node!.children[2].children[0].parent?.id).toBe(node!.children[2].id)
    expect(applied.nextNodeId).toBe(13)
    expect(applied.nextEditId).toBe(13)
    expect(applied.added).toEqual([
      { id: 10, text: '仕事を失った' },
      { id: 11, text: '親案' },
      { id: 12, text: '子案' }
    ])
  })

  it('adds to the left side when the root already has children', () => {
    const root = storyTree()
    const applied = applyPluginAddChildren(root, 0, [{ text: '新しい左' }], 10, 10)
    expect(applied.status).toBe('applied')
    if (applied.status !== 'applied') {
      return
    }

    const rootNode = findNode(applied.rootState, (state) => state.id === 0)
    const left = rootNode!.accompaniedState!
    expect(rootNode!.children.map((child) => child.text)).toEqual(['ホームレス'])
    expect(left.children.map((child) => child.text)).toEqual(['左のメモ', '新しい左'])
    expect(left.children[1].isLeft).toBe(true)
  })

  it('does not change the tree when there is nothing to add or the node is gone', () => {
    const root = storyTree()
    expect(applyPluginAddChildren(root, 3, [{ text: '  ' }], 10, 10)).toEqual({ status: 'empty' })
    expect(applyPluginAddChildren(root, 99, [{ text: '案' }], 10, 10)).toEqual({
      status: 'missing'
    })
  })
})

describe('plugin host', () => {
  it('loads the story-ideas sample and turns model output into children', async () => {
    const plugins = loadPlugins([path.resolve(process.cwd(), 'plugins')])
    expect(listMenuEntries(plugins)).toEqual([
      { pluginId: 'story-ideas', actionId: 'propose', label: '案を出す' }
    ])

    const result = await runPluginAction(
      plugins,
      'story-ideas',
      'propose',
      {
        id: 3,
        text: 'ホームレスになった経緯',
        symbol: null,
        children: [{ text: '既にある案' }],
        ancestors: [{ text: '物語' }, { text: 'ホームレス' }]
      },
      {
        complete: async (prompt: string) => {
          expect(prompt).toContain('ホームレスになった経緯')
          expect(prompt).toContain('ホームレス')
          expect(prompt).toContain('既にある案')
          return [
            '1. 仕事を失い、家賃が払えなくなった',
            '2. 家族と縁が切れた',
            '3日後に家を出た',
            '```'
          ].join('\n')
        }
      }
    )

    expect(result.addChildren).toEqual([
      { text: '仕事を失い、家賃が払えなくなった' },
      { text: '家族と縁が切れた' },
      { text: '3日後に家を出た' }
    ])
  })

  it('skips a broken plugin and keeps a valid one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'narr-plugin-'))
    const badDir = path.join(dir, 'bad')
    fs.mkdirSync(badDir)
    fs.writeFileSync(path.join(badDir, 'manifest.json'), '{')

    const junkDir = path.join(dir, 'junk')
    fs.mkdirSync(junkDir)
    fs.writeFileSync(
      path.join(junkDir, 'manifest.json'),
      JSON.stringify({
        id: 'junk',
        actions: [{ id: 'run', label: 'Junk', placement: 'node-context-menu' }]
      })
    )
    fs.writeFileSync(
      path.join(junkDir, 'index.js'),
      `module.exports = { run() { return { addChildren: [{ text: '  ok  ' }, { text: '' }, { text: 1 }, { text: 'nested', children: [{ text: 'child' }] }] } } }\n`
    )

    const plugins = loadPlugins([dir])
    expect(plugins.map((plugin) => plugin.id)).toEqual(['junk'])

    const result = await runPluginAction(
      plugins,
      'junk',
      'run',
      { id: 1, text: 'n', symbol: null, children: [], ancestors: [] },
      { complete: async () => '' }
    )
    expect(result.addChildren).toEqual([
      { text: 'ok' },
      { text: 'nested', children: [{ text: 'child' }] }
    ])
  })
})
