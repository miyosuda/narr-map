import { EDIT_STATE_NONE } from '../types'
import { NodeState } from '../types'
import { findNode, getNodeState, updateNodes } from '../utils/node-utils'
import { pluginInsertionTarget } from './context'
import { normalizeChildren } from './result'
import { PluginChildSpec } from './types'

export type ApplyPluginChildrenResult =
  | {
      status: 'applied'
      rootState: NodeState
      nextNodeId: number
      nextEditId: number
    }
  | { status: 'empty' }
  | { status: 'missing' }

type IdCursor = {
  nextNodeId: number
  nextEditId: number
}

function buildAddedNode(spec: PluginChildSpec, isLeft: boolean, ids: IdCursor): NodeState {
  const node = getNodeState({
    id: ids.nextNodeId,
    editId: ids.nextEditId,
    text: spec.text,
    isLeft,
    selected: false,
    folded: false,
    editState: EDIT_STATE_NONE
  })
  ids.nextNodeId += 1
  ids.nextEditId += 1

  const children = (spec.children ?? []).map((child) => {
    const built = buildAddedNode(child, isLeft, ids)
    built.parent = node
    return built
  })
  node.children = children
  return node
}

export function applyPluginAddChildren(
  rootState: NodeState,
  nodeId: number,
  specs: PluginChildSpec[],
  nextNodeId: number,
  nextEditId: number
): ApplyPluginChildrenResult {
  const node = findNode(rootState, (state) => state.id === nodeId)
  if (node == null) {
    return { status: 'missing' }
  }

  const childrenToAdd = normalizeChildren(specs)
  if (childrenToAdd.length === 0) {
    return { status: 'empty' }
  }

  const target = pluginInsertionTarget(node)
  const ids: IdCursor = { nextNodeId, nextEditId }
  const added = childrenToAdd.map((spec) => buildAddedNode(spec, target.isLeft, ids))

  const newRootState = updateNodes(
    rootState,
    (state) => state.id === target.id,
    (state) => {
      const children = [...state.children, ...added]
      const next = {
        ...state,
        folded: false,
        children
      }
      children.forEach((child) => {
        child.parent = next
      })
      return next
    }
  )

  return {
    status: 'applied',
    rootState: newRootState,
    nextNodeId: ids.nextNodeId,
    nextEditId: ids.nextEditId
  }
}
