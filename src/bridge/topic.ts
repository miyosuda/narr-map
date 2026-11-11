import { NodeState } from '../types'
import { findNode, findNodes, isDummy } from '../utils/node-utils'

export type TopicNode = {
  id: number
  text: string
  symbol: string | null
  path: string[]
  children: { text: string }[]
}

export type FoundNode = {
  id: number
  text: string
  symbol: string | null
  path: string[]
}

export function nodePath(root: NodeState, node: NodeState): string[] {
  const ancestors: string[] = []
  let current = node.parent
  while (current != null) {
    if (!isDummy(current)) {
      ancestors.push(current.text)
    }
    current = current.parent
  }
  ancestors.reverse()

  if (node.isLeft && !isDummy(node)) {
    ancestors.unshift(root.text)
  }
  if (!isDummy(node)) {
    ancestors.push(node.text)
  }
  return ancestors
}

export function pruneTopicIds(ids: number[], root: NodeState): number[] {
  const seen = new Set<number>()
  const kept: number[] = []
  for (const id of ids) {
    if (seen.has(id)) {
      continue
    }
    const node = findNode(root, (state) => state.id === id)
    if (node == null || isDummy(node)) {
      continue
    }
    seen.add(id)
    kept.push(id)
  }
  return kept
}

export function topicNodes(root: NodeState, ids: number[]): TopicNode[] {
  return pruneTopicIds(ids, root).map((id) => {
    const node = findNode(root, (state) => state.id === id) as NodeState
    return {
      id: node.id,
      text: node.text,
      symbol: node.symbol,
      path: nodePath(root, node),
      children: node.children.map((child) => ({ text: child.text }))
    }
  })
}

export function findNodesByText(root: NodeState, text: string): FoundNode[] {
  return findNodes(root, (state) => !isDummy(state) && state.text === text).map((node) => ({
    id: node.id,
    text: node.text,
    symbol: node.symbol,
    path: nodePath(root, node)
  }))
}
