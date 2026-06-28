import {
  NodeState,
  NodeDrawState,
  NodeDrawStateMapType,
  HOVER_STATE_NONE,
  HOVER_STATE_TOP,
  HOVER_STATE_RIGHT,
  HOVER_STATE_LEFT
} from '../types'
import {
  isRoot,
  isDummy,
  findNode,
  updateNodes,
  cloneNodeState,
  hasNodeInAncestor,
  removeChildNode,
  addChildNode,
  addChildNodeAbove
} from './node-utils'
import { containsPosHalf } from './node-draw-utils'

export function calcGhostHoverState(
  state: NodeState,
  drawState: NodeDrawState,
  ghostNodeId: number,
  x: number,
  y: number
): number {
  if (state.id === ghostNodeId) {
    return HOVER_STATE_NONE
  }

  if (isDummy(state)) {
    return HOVER_STATE_NONE
  }

  if (containsPosHalf(state, drawState, x, y, true)) {
    // 左半分
    if (isRoot(state)) {
      return HOVER_STATE_LEFT
    } else if (state.isLeft) {
      return HOVER_STATE_LEFT
    } else {
      return HOVER_STATE_TOP
    }
  } else if (containsPosHalf(state, drawState, x, y, false)) {
    // 右半分
    if (isRoot(state)) {
      return HOVER_STATE_RIGHT
    } else if (state.isLeft) {
      return HOVER_STATE_TOP
    } else {
      return HOVER_STATE_RIGHT
    }
  } else {
    return HOVER_STATE_NONE
  }
}

export function applyGhostHoverStates(
  rootState: NodeState,
  drawStateMap: NodeDrawStateMapType,
  ghostNodeId: number,
  x: number,
  y: number
): NodeState {
  return updateNodes(
    rootState,
    () => true,
    (state) => ({
      ...state,
      hoverState: calcGhostHoverState(state, drawStateMap[state.id], ghostNodeId, x, y)
    })
  )
}

export function applyGhostDrop(
  rootState: NodeState,
  ghostNodeId: number
): { hoverCleared: NodeState; moved: NodeState | null } {
  const ghostTargetState = findNode(
    rootState,
    (state) => state.hoverState !== HOVER_STATE_NONE
  )

  const ghostOrgState = findNode(rootState, (state) => state.id === ghostNodeId)

  const hoverCleared = updateNodes(
    rootState,
    (state) => state.hoverState !== HOVER_STATE_NONE,
    (state) => ({
      ...state,
      hoverState: HOVER_STATE_NONE
    })
  )

  if (ghostTargetState === null || ghostOrgState === null) {
    return { hoverCleared, moved: null }
  }

  let newChildState = ghostOrgState
  const targetHoverState = ghostTargetState.hoverState

  // nodeの右側にhoverして離した場合のみ、追加先がdummy nodeとなる.
  const toAccompanied = targetHoverState === HOVER_STATE_LEFT && isRoot(ghostTargetState)
  const targetState = toAccompanied ? ghostTargetState.accompaniedState! : ghostTargetState

  if (hasNodeInAncestor(targetState, newChildState)) {
    return { hoverCleared, moved: null }
  }

  // isLeftを移動先に合わせる
  if (targetState.isLeft !== newChildState.isLeft) {
    newChildState = updateNodes(
      newChildState,
      () => true,
      (state) => ({ ...state, isLeft: targetState.isLeft })
    )
  } else {
    newChildState = cloneNodeState(newChildState)
  }

  // 移動元の親から外す
  const newRootState0 = updateNodes(
    hoverCleared,
    (state) => state.id === newChildState.parent!.id,
    (state) => removeChildNode(state, newChildState.id)
  )

  if (targetHoverState === HOVER_STATE_RIGHT || targetHoverState === HOVER_STATE_LEFT) {
    const moved = updateNodes(
      newRootState0,
      (state) => state.id === targetState.id,
      (state) => addChildNode(state, newChildState)
    )
    return { hoverCleared, moved }
  } else if (targetHoverState === HOVER_STATE_TOP) {
    const moved = updateNodes(
      newRootState0,
      (state) => state.id === targetState.parent!.id,
      (state) => addChildNodeAbove(state, newChildState, ghostTargetState)
    )
    return { hoverCleared, moved }
  }

  return { hoverCleared, moved: null }
}
