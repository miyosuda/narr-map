import { describe, it, expect } from 'vitest'
import { getNodeState, findNode } from '../src/utils/node-utils'
import { calcDrawStateMap } from '../src/utils/node-draw-utils'
import {
  calcGhostHoverState,
  applyGhostHoverStates,
  applyGhostDrop
} from '../src/utils/node-interaction-utils'
import {
  NodeState,
  NodeDrawStateMapType,
  HOVER_STATE_NONE,
  HOVER_STATE_TOP,
  HOVER_STATE_RIGHT,
  HOVER_STATE_LEFT
} from '../src/types'

function buildTree(
  spec: {
    id: number
    text?: string
    isLeft?: boolean
    children?: ReturnType<typeof buildTree>[]
    accompaniedState?: ReturnType<typeof buildTree>
  },
  parent: NodeState | null = null
): NodeState {
  const children = (spec.children ?? []).map((child) => buildTree(child, null))
  const state = getNodeState({
    id: spec.id,
    text: spec.text ?? `node-${spec.id}`,
    isLeft: spec.isLeft ?? false,
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

function buildStandardTree(): NodeState {
  return buildTree({
    id: 0,
    text: 'root',
    children: [
      buildTree({ id: 2, text: 'right-child', isLeft: false }),
      buildTree({ id: 3, text: 'right-child-2', isLeft: false })
    ],
    accompaniedState: buildTree({
      id: 1,
      text: '',
      isLeft: true,
      children: [buildTree({ id: 4, text: 'left-child', isLeft: true })]
    })
  })
}

function pointInLeftHalf(drawStateMap: NodeDrawStateMapType, nodeId: number) {
  const ds = drawStateMap[nodeId]
  return { x: ds.x + ds.width * 0.25, y: ds.y + ds.height * 0.5 }
}

function pointInRightHalf(drawStateMap: NodeDrawStateMapType, nodeId: number) {
  const ds = drawStateMap[nodeId]
  return { x: ds.x + ds.width * 0.75, y: ds.y + ds.height * 0.5 }
}

function pointOutside(drawStateMap: NodeDrawStateMapType, nodeId: number) {
  const ds = drawStateMap[nodeId]
  return { x: ds.x - 100, y: ds.y - 100 }
}

function setHoverState(rootState: NodeState, nodeId: number, hoverState: number): NodeState {
  const target = findNode(rootState, (s) => s.id === nodeId)!
  target.hoverState = hoverState
  return rootState
}

function findNodeById(rootState: NodeState, id: number): NodeState | null {
  return findNode(rootState, (s) => s.id === id)
}

describe('calcGhostHoverState', () => {
  const rootState = buildStandardTree()
  const drawStateMap = calcDrawStateMap(rootState)
  const ghostNodeId = 2

  it('returns NONE for the ghost node itself', () => {
    const ds = drawStateMap[ghostNodeId]
    expect(calcGhostHoverState(rootState.children[0], ds, ghostNodeId, ds.x, ds.y)).toBe(
      HOVER_STATE_NONE
    )
  })

  it('returns NONE for dummy node', () => {
    const ds = drawStateMap[1]
    const { x, y } = pointInLeftHalf(drawStateMap, 1)
    expect(calcGhostHoverState(rootState.accompaniedState!, ds, ghostNodeId, x, y)).toBe(
      HOVER_STATE_NONE
    )
  })

  it('returns LEFT for root left half', () => {
    const ds = drawStateMap[0]
    const { x, y } = pointInLeftHalf(drawStateMap, 0)
    expect(calcGhostHoverState(rootState, ds, ghostNodeId, x, y)).toBe(HOVER_STATE_LEFT)
  })

  it('returns RIGHT for root right half', () => {
    const ds = drawStateMap[0]
    const { x, y } = pointInRightHalf(drawStateMap, 0)
    expect(calcGhostHoverState(rootState, ds, ghostNodeId, x, y)).toBe(HOVER_STATE_RIGHT)
  })

  it('returns LEFT for left node left half', () => {
    const leftChild = rootState.accompaniedState!.children[0]
    const ds = drawStateMap[4]
    const { x, y } = pointInLeftHalf(drawStateMap, 4)
    expect(calcGhostHoverState(leftChild, ds, ghostNodeId, x, y)).toBe(HOVER_STATE_LEFT)
  })

  it('returns TOP for left node right half', () => {
    const leftChild = rootState.accompaniedState!.children[0]
    const ds = drawStateMap[4]
    const { x, y } = pointInRightHalf(drawStateMap, 4)
    expect(calcGhostHoverState(leftChild, ds, ghostNodeId, x, y)).toBe(HOVER_STATE_TOP)
  })

  it('returns TOP for right node left half', () => {
    const rightChild = rootState.children[0]
    const ds = drawStateMap[2]
    const { x, y } = pointInLeftHalf(drawStateMap, 2)
    expect(calcGhostHoverState(rightChild, ds, 3, x, y)).toBe(HOVER_STATE_TOP)
  })

  it('returns RIGHT for right node right half', () => {
    const rightChild = rootState.children[0]
    const ds = drawStateMap[2]
    const { x, y } = pointInRightHalf(drawStateMap, 2)
    expect(calcGhostHoverState(rightChild, ds, 3, x, y)).toBe(HOVER_STATE_RIGHT)
  })

  it('returns NONE when outside node bounds', () => {
    const rightChild = rootState.children[0]
    const ds = drawStateMap[2]
    const { x, y } = pointOutside(drawStateMap, 2)
    expect(calcGhostHoverState(rightChild, ds, ghostNodeId, x, y)).toBe(HOVER_STATE_NONE)
  })
})

describe('applyGhostHoverStates', () => {
  it('applies hover states to all nodes based on cursor position', () => {
    const rootState = buildStandardTree()
    const drawStateMap = calcDrawStateMap(rootState)
    const ghostNodeId = 2
    const { x, y } = pointInRightHalf(drawStateMap, 0)

    const newRoot = applyGhostHoverStates(rootState, drawStateMap, ghostNodeId, x, y)

    expect(findNodeById(newRoot, 0)!.hoverState).toBe(HOVER_STATE_RIGHT)
    expect(findNodeById(newRoot, 2)!.hoverState).toBe(HOVER_STATE_NONE)
  })
})

describe('applyGhostDrop', () => {
  it('moves node as child when dropped on RIGHT half', () => {
    const rootState = buildStandardTree()
    const withHover = setHoverState(rootState, 3, HOVER_STATE_RIGHT)

    const { hoverCleared, moved } = applyGhostDrop(withHover, 2)

    expect(moved).not.toBeNull()
    expect(findNodeById(hoverCleared, 3)!.hoverState).toBe(HOVER_STATE_NONE)
    expect(findNodeById(moved!, 2)).not.toBeNull()
    expect(findNodeById(moved!, 2)!.parent!.id).toBe(3)
    expect(findNodeById(moved!, 0)!.children.some((c) => c.id === 2)).toBe(false)
  })

  it('moves node as child when dropped on LEFT half of non-root', () => {
    const rootState = buildStandardTree()
    const withHover = setHoverState(rootState, 3, HOVER_STATE_LEFT)

    const { moved } = applyGhostDrop(withHover, 2)

    expect(moved).not.toBeNull()
    expect(findNodeById(moved!, 2)!.parent!.id).toBe(3)
  })

  it('adds node as sibling above target when dropped on TOP half', () => {
    const rootState = buildStandardTree()
    const withHover = setHoverState(rootState, 3, HOVER_STATE_TOP)

    const { moved } = applyGhostDrop(withHover, 2)

    expect(moved).not.toBeNull()
    const parent = findNodeById(moved!, 0)!
    const childIds = parent.children.map((c) => c.id)
    expect(childIds.indexOf(2)).toBeLessThan(childIds.indexOf(3))
    expect(findNodeById(moved!, 2)!.parent!.id).toBe(0)
  })

  it('returns moved null when dropping onto own descendant', () => {
    const rootState = buildTree({
      id: 0,
      text: 'root',
      children: [
        buildTree({
          id: 2,
          text: 'parent',
          children: [buildTree({ id: 3, text: 'child' })]
        })
      ],
      accompaniedState: buildTree({ id: 1, text: '', isLeft: true })
    })
    const withHover = setHoverState(rootState, 3, HOVER_STATE_RIGHT)

    const { moved } = applyGhostDrop(withHover, 2)

    expect(moved).toBeNull()
  })

  it('aligns isLeft when moving across sides', () => {
    const rootState = buildStandardTree()
    const withHover = setHoverState(rootState, 4, HOVER_STATE_LEFT)

    const { moved } = applyGhostDrop(withHover, 2)

    expect(moved).not.toBeNull()
    const movedNode = findNodeById(moved!, 2)!
    expect(movedNode.isLeft).toBe(true)
    expect(movedNode.parent!.id).toBe(4)
  })

  it('moves to accompaniedState child when dropped on root left half', () => {
    const rootState = buildStandardTree()
    const withHover = setHoverState(rootState, 0, HOVER_STATE_LEFT)

    const { moved } = applyGhostDrop(withHover, 2)

    expect(moved).not.toBeNull()
    expect(findNodeById(moved!, 2)!.parent!.id).toBe(1)
  })

  it('returns moved null when no hover target', () => {
    const rootState = buildStandardTree()

    const { moved } = applyGhostDrop(rootState, 2)

    expect(moved).toBeNull()
  })
})
