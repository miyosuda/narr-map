import { NodeState } from '../types'
import { hasChildren, isDummy, isRoot } from '../utils/node-utils'
import { PluginNodeContext } from './types'

// Tab での子追加と同じく、子を持つルートは左側 (accompaniedState) に足す.
export function pluginInsertionTarget(node: NodeState): NodeState {
  if (isRoot(node) && !isDummy(node) && hasChildren(node) && node.accompaniedState != null) {
    return node.accompaniedState
  }
  return node
}

export function buildPluginNodeContext(root: NodeState, node: NodeState): PluginNodeContext {
  const ancestors: { text: string }[] = []
  let current = node.parent
  while (current != null) {
    if (!isDummy(current)) {
      ancestors.push({ text: current.text })
    }
    current = current.parent
  }
  ancestors.reverse()

  // 左側のノードの親は dummy なので、経路に中央のルートテキストを足す.
  if (node.isLeft && !isDummy(node)) {
    ancestors.unshift({ text: root.text })
  }

  const target = pluginInsertionTarget(node)
  return {
    id: node.id,
    text: node.text,
    symbol: node.symbol,
    children: target.children.map((child) => ({ text: child.text })),
    ancestors
  }
}
