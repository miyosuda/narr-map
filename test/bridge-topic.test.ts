// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { findNodesByText, nodePath, pruneTopicIds, topicNodes } from '../src/bridge/topic'
import { NodeState } from '../src/types'
import { findNode, getNodeState } from '../src/utils/node-utils'

function buildTree(
  spec: {
    id: number
    text?: string
    isLeft?: boolean
    symbol?: string | null
    children?: ReturnType<typeof buildTree>[]
    accompaniedState?: ReturnType<typeof buildTree>
  },
  parent: NodeState | null = null
): NodeState {
  const children = (spec.children ?? []).map((child) => buildTree(child, null))
  const state = getNodeState({
    id: spec.id,
    text: spec.text ?? '',
    symbol: spec.symbol ?? null,
    isLeft: spec.isLeft ?? false,
    children,
    accompaniedState: spec.accompaniedState ? buildTree(spec.accompaniedState, null) : null,
    parent
  })
  children.forEach((child) => {
    child.parent = state
  })
  return state
}

function storyTree(): NodeState {
  return buildTree({
    id: 0,
    text: '小説',
    children: [
      {
        id: 2,
        text: '佐藤',
        symbol: '人物',
        children: [{ id: 5, text: '教師' }]
      },
      { id: 3, text: '田中', symbol: '人物' },
      { id: 6, text: '佐藤' }
    ],
    accompaniedState: {
      id: 1,
      text: '',
      isLeft: true,
      children: [{ id: 4, text: '関係', isLeft: true }]
    }
  })
}

describe('topic set', () => {
  it('drops missing, dummy, and duplicate ids while keeping order', () => {
    const root = storyTree()
    expect(pruneTopicIds([2, 1, 99, 2, 4], root)).toEqual([2, 4])
  })

  it('builds a path from the root and includes the center root on the left', () => {
    const root = storyTree()
    const sato = findNode(root, (state) => state.id === 2)
    const relation = findNode(root, (state) => state.id === 4)
    expect(nodePath(root, sato!)).toEqual(['小説', '佐藤'])
    expect(nodePath(root, relation!)).toEqual(['小説', '関係'])
  })

  it('returns topic nodes in pin order with direct children', () => {
    const root = storyTree()
    expect(topicNodes(root, [4, 2, 1])).toEqual([
      {
        id: 4,
        text: '関係',
        symbol: null,
        path: ['小説', '関係'],
        children: []
      },
      {
        id: 2,
        text: '佐藤',
        symbol: '人物',
        path: ['小説', '佐藤'],
        children: [{ text: '教師' }]
      }
    ])
  })

  it('finds every exact text match and skips the dummy root', () => {
    const root = storyTree()
    expect(findNodesByText(root, '佐藤').map((node) => node.id)).toEqual([2, 6])
    expect(findNodesByText(root, '')).toEqual([])
    expect(findNodesByText(root, 'いない')).toEqual([])
  })
})
