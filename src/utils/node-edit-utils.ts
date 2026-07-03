import { NodeState } from '../types'
import {
  cloneNodeState,
  isRoot,
  isDummy,
  hasChildren,
  findNodes,
  updateNodes,
  getLatestNode
} from './node-utils'

/** selectedなnodeのうち、最後に操作された(editIdが最大の)nodeを返す */
export function getLastNode(rootState: NodeState): NodeState {
  const selectedNodes = findNodes(rootState, (state) => state.selected)
  if (selectedNodes.length === 0) {
    // この場合は無い
    return rootState
  } else {
    const clonedSelectedNodes = [...selectedNodes]
    clonedSelectedNodes.sort((state0, state1) => state1.editId - state0.editId)
    return clonedSelectedNodes[0]
  }
}

/** selectedなnodeを削除し、削除後のlatest nodeをselectedにした新しいrootStateを返す */
export function applyDeleteSelectedNodes(rootState: NodeState): NodeState {
  const hasDetableChildren = (state: NodeState) => {
    // TODO: rootとdummyの対応
    if (!hasChildren(state)) {
      return false
    }

    const deletableChildren = state.children.filter((childState) => childState.selected)
    return deletableChildren.length > 0
  }

  const deleteSelectedChildren = (state: NodeState) => {
    const clonedState = cloneNodeState(state)
    const filteredChildren = clonedState.children.filter((childState) => !childState.selected)
    clonedState.children = filteredChildren
    return clonedState
  }

  // selectedのnodeを削除
  const newRootState0 = updateNodes(
    rootState,
    (state) => hasDetableChildren(state),
    (state) => deleteSelectedChildren(state)
  )

  // latestのchildをselectedにする
  const latestNode = getLatestNode(newRootState0)
  const newRootState1 = updateNodes(
    newRootState0,
    (state) => state.id === latestNode.id,
    (state) => ({
      ...state,
      selected: true
    })
  )
  return newRootState1
}

/** dummy以外の全nodeをselectedにする。editIdはstartEditIdから順に振る */
export function applySelectAll(
  rootState: NodeState,
  startEditId: number
): { rootState: NodeState; nextEditId: number } {
  let editId = startEditId

  const getNextEditId = () => {
    const ret = editId
    editId += 1
    return ret
  }

  const newRootState = updateNodes(
    rootState,
    (state) => !isDummy(state),
    (state) => ({
      ...state,
      selected: true,
      editId: getNextEditId()
    })
  )

  return { rootState: newRootState, nextEditId: editId }
}

/**
 * copyingStatesをtargetNodeの子としてpasteした新しいrootStateを返す。
 * node id / edit id はstartNodeId / startEditIdから順に振り、最終値を返す。
 */
export function applyPaste(
  rootState: NodeState,
  copyingStates: NodeState[],
  targetNode: NodeState,
  startNodeId: number,
  startEditId: number
): { rootState: NodeState; nextNodeId: number; nextEditId: number } {
  let nodeId = startNodeId
  let editId = startEditId

  const getNextNodeId = () => {
    const ret = nodeId
    nodeId += 1
    return ret
  }

  const getNextEditId = () => {
    const ret = editId
    editId += 1
    return ret
  }

  const modifyStateForCopy = (state: NodeState): NodeState => {
    // TODO: getExtendedChildren()は、accompaniedStateを含んでしまっているのでここでは使えないが、
    // getExtendedChildren()の方を変更することで共通化できる可能性がある.
    const stretchedChildren =
      isRoot(state) && !isDummy(state) && state.accompaniedState != null
        ? [...state.children, ...state.accompaniedState.children]
        : state.children

    return {
      ...state,
      isLeft: targetNode.isLeft,
      id: getNextNodeId(),
      editId: getNextEditId(),
      children: stretchedChildren.map(modifyStateForCopy),
      accompaniedState: null,
      selected: false
    }
  }

  const modifiedCopyingStates = copyingStates.map(modifyStateForCopy)

  const modifyTargetState = (state: NodeState): NodeState => {
    const newChildren = [...state.children, ...modifiedCopyingStates]
    const newState = {
      ...state,
      children: newChildren
    }

    newChildren.forEach((childState) => (childState.parent = newState))
    return newState
  }

  const newRootState = updateNodes(
    rootState,
    (state) => state.id === targetNode.id,
    (state) => modifyTargetState(state)
  )

  return { rootState: newRootState, nextNodeId: nodeId, nextEditId: editId }
}

/**
 * lastNodeのfoldをtoggleした新しいrootStateを返す。
 * rootまたは子を持たないnodeの場合は変更不可として null を返す。
 */
export function applyToggleFold(
  rootState: NodeState,
  lastNode: NodeState,
  editId: number
): NodeState | null {
  if (isRoot(lastNode)) {
    return null
  }
  if (!hasChildren(lastNode)) {
    return null
  }

  // toggle folded
  const newRootState0 = updateNodes(
    rootState,
    (state) => state.id === lastNode.id,
    (state) => ({
      ...state,
      folded: !lastNode.folded,
      selected: true,
      editId
    })
  )
  // clear node selected except last node
  const newRootState1 = updateNodes(
    newRootState0,
    (state) => state.selected && state.id !== lastNode.id,
    (state) => ({
      ...state,
      selected: false
    })
  )
  return newRootState1
}
