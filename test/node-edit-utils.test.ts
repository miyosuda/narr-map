import { describe, it, expect } from 'vitest'
import { getNodeState, findNode } from '../src/utils/node-utils'
import {
  getLastNode,
  applyDeleteSelectedNodes,
  applySelectAll,
  applyPaste,
  applyToggleFold
} from '../src/utils/node-edit-utils'
import { NodeState } from '../src/types'

function buildTree(
  spec: {
    id: number
    text?: string
    isLeft?: boolean
    selected?: boolean
    editId?: number
    folded?: boolean
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

function buildStandardTree(): NodeState {
  return buildTree({
    id: 0,
    text: 'root',
    editId: 0,
    children: [
      buildTree({ id: 2, text: 'child-a', editId: 2 }),
      buildTree({ id: 3, text: 'child-b', editId: 3 })
    ],
    accompaniedState: buildTree({
      id: 1,
      text: '',
      isLeft: true,
      editId: 1,
      children: [buildTree({ id: 4, text: 'left-child', isLeft: true, editId: 4 })]
    })
  })
}

function findById(rootState: NodeState, id: number): NodeState | null {
  return findNode(rootState, (s) => s.id === id)
}

describe('getLastNode', () => {
  it('returns the selected node with the highest editId', () => {
    const rootState = buildTree({
      id: 0,
      editId: 0,
      children: [
        buildTree({ id: 2, selected: true, editId: 5 }),
        buildTree({ id: 3, selected: true, editId: 9 })
      ],
      accompaniedState: buildTree({ id: 1, isLeft: true, editId: 1 })
    })

    expect(getLastNode(rootState).id).toBe(3)
  })

  it('returns rootState when no node is selected', () => {
    const rootState = buildStandardTree()
    expect(getLastNode(rootState).id).toBe(0)
  })
})

describe('applyDeleteSelectedNodes', () => {
  it('removes selected children and selects the latest remaining node', () => {
    const rootState = buildTree({
      id: 0,
      editId: 0,
      children: [
        buildTree({ id: 2, text: 'keep', editId: 2 }),
        buildTree({ id: 3, text: 'delete', selected: true, editId: 3 })
      ],
      accompaniedState: buildTree({ id: 1, isLeft: true, editId: 1 })
    })

    const newRoot = applyDeleteSelectedNodes(rootState)

    expect(findById(newRoot, 3)).toBeNull()
    expect(findById(newRoot, 2)).not.toBeNull()
    // 削除後にlatest nodeがselectedになっている
    const selected = findNode(newRoot, (s) => s.selected)
    expect(selected).not.toBeNull()
  })
})

describe('applySelectAll', () => {
  it('selects all non-dummy nodes and advances editId', () => {
    const rootState = buildStandardTree()

    const { rootState: newRoot, nextEditId } = applySelectAll(rootState, 10)

    expect(findById(newRoot, 0)!.selected).toBe(true)
    expect(findById(newRoot, 2)!.selected).toBe(true)
    expect(findById(newRoot, 3)!.selected).toBe(true)
    expect(findById(newRoot, 4)!.selected).toBe(true)
    // dummy (id:1) はselectedにならない
    expect(findById(newRoot, 1)!.selected).toBe(false)
    // root, child-a, child-b, left-child の4ノードでeditId消費
    expect(nextEditId).toBe(14)
  })
})

describe('applyPaste', () => {
  it('pastes copying states as children of the target with new ids', () => {
    const rootState = buildStandardTree()
    // copyingStatesは実際にはisCopiableなnode(親を持つ)なので、親を付けて用意する
    const copySource = buildTree({
      id: 0,
      editId: 0,
      children: [buildTree({ id: 99, text: 'copied', editId: 99 })],
      accompaniedState: buildTree({ id: 1, isLeft: true, editId: 1 })
    })
    const copyingStates = [findById(copySource, 99)!]
    const targetNode = findById(rootState, 3)!

    const { rootState: newRoot, nextNodeId, nextEditId } = applyPaste(
      rootState,
      copyingStates,
      targetNode,
      10,
      20
    )

    const target = findById(newRoot, 3)!
    expect(target.children.length).toBe(1)
    const pasted = target.children[0]
    expect(pasted.id).toBe(10)
    expect(pasted.editId).toBe(20)
    expect(pasted.text).toBe('copied')
    expect(pasted.selected).toBe(false)
    expect(pasted.isLeft).toBe(targetNode.isLeft)
    expect(pasted.parent!.id).toBe(3)
    expect(nextNodeId).toBe(11)
    expect(nextEditId).toBe(21)
  })

  it('assigns new ids to nested copied children and advances counters', () => {
    const rootState = buildStandardTree()
    const copySource = buildTree({
      id: 0,
      editId: 0,
      children: [
        buildTree({
          id: 99,
          text: 'parent',
          editId: 99,
          children: [buildTree({ id: 98, text: 'child', editId: 98 })]
        })
      ],
      accompaniedState: buildTree({ id: 1, isLeft: true, editId: 1 })
    })
    const copyingStates = [findById(copySource, 99)!]
    const targetNode = findById(rootState, 2)!

    const { nextNodeId, nextEditId } = applyPaste(rootState, copyingStates, targetNode, 10, 20)

    // 2ノード分のidを消費
    expect(nextNodeId).toBe(12)
    expect(nextEditId).toBe(22)
  })
})

describe('applyToggleFold', () => {
  it('toggles folded on a non-root node with children', () => {
    const tree = buildTree({
      id: 0,
      editId: 0,
      children: [
        buildTree({
          id: 2,
          editId: 2,
          children: [buildTree({ id: 5, editId: 5 })]
        })
      ],
      accompaniedState: buildTree({ id: 1, isLeft: true, editId: 1 })
    })
    const target = findById(tree, 2)!

    const newRoot = applyToggleFold(tree, target, 30)

    expect(newRoot).not.toBeNull()
    expect(findById(newRoot!, 2)!.folded).toBe(true)
    expect(findById(newRoot!, 2)!.selected).toBe(true)
    expect(findById(newRoot!, 2)!.editId).toBe(30)
  })

  it('returns null for root node', () => {
    const rootState = buildStandardTree()
    expect(applyToggleFold(rootState, rootState, 30)).toBeNull()
  })

  it('returns null for a node without children', () => {
    const rootState = buildStandardTree()
    const leaf = findById(rootState, 3)!
    expect(applyToggleFold(rootState, leaf, 30)).toBeNull()
  })
})
