import { describe, it, expect } from 'vitest'
import { getNodeState } from '../src/utils/node-utils'
import { calcDrawStateMap } from '../src/utils/node-draw-utils'
import { NodeState, NodeDrawStateMapType } from '../src/types'

/** テスト用に id と parent を付けたツリーを組み立てる */
function buildTree(
  spec: {
    id: number
    text?: string
    folded?: boolean
    isLeft?: boolean
    shiftX?: number
    shiftY?: number
    children?: ReturnType<typeof buildTree>[]
    accompaniedState?: ReturnType<typeof buildTree>
  },
  parent: NodeState | null = null
): NodeState {
  const children = (spec.children ?? []).map((child) => buildTree(child, null))
  const state = getNodeState({
    id: spec.id,
    text: spec.text ?? `node-${spec.id}`,
    folded: spec.folded ?? false,
    isLeft: spec.isLeft ?? false,
    shiftX: spec.shiftX ?? 0,
    shiftY: spec.shiftY ?? 0,
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

/** fold を考慮して画面上に存在するノード id を集める */
function collectVisibleNodeIds(state: NodeState): number[] {
  const ids = [state.id]
  if (state.accompaniedState != null) {
    ids.push(...collectVisibleNodeIds(state.accompaniedState))
  }
  if (!state.folded) {
    for (const child of state.children) {
      ids.push(...collectVisibleNodeIds(child))
    }
  }
  return ids
}

/** ツリー内の全ノード id を集める（fold 無視） */
function collectAllNodeIds(state: NodeState): number[] {
  const ids = [state.id]
  if (state.accompaniedState != null) {
    ids.push(...collectAllNodeIds(state.accompaniedState))
  }
  for (const child of state.children) {
    ids.push(...collectAllNodeIds(child))
  }
  return ids
}

function pickDrawStates(
  drawStateMap: NodeDrawStateMapType,
  ids: number[]
): NodeDrawStateMapType {
  const picked: NodeDrawStateMapType = {}
  for (const id of ids) {
    picked[id] = drawStateMap[id]
  }
  return picked
}

/** 深い枝をまとめて作る（fold テスト用） */
function buildDeepBranchTree(leafCount: number, folded: boolean): NodeState {
  const leaves = Array.from({ length: leafCount }, (_, i) =>
    buildTree({ id: 10 + i, text: `leaf-${i}` })
  )

  const branch = buildTree({
    id: 2,
    text: 'branch',
    folded,
    children: leaves
  })

  return buildTree({
    id: 0,
    text: 'root',
    accompaniedState: buildTree({ id: 1, text: '', isLeft: true }),
    children: [branch]
  })
}

describe('calcDrawStateMap', () => {
  describe('fold 時のレイアウト（回帰: 変更前後で見えているノードの座標が一致）', () => {
    it('fold した枝の見えているノードの座標は、最適化前後で変わらない', () => {
      const folded = buildDeepBranchTree(5, true)
      const unfolded = buildDeepBranchTree(5, false)

      const foldedMap = calcDrawStateMap(folded)
      const unfoldedMap = calcDrawStateMap(unfolded)

      const visibleIds = collectVisibleNodeIds(folded)
      expect(pickDrawStates(foldedMap, visibleIds)).toEqual(
        pickDrawStates(unfoldedMap, visibleIds)
      )
    })

    it('unfold 時の全ノード座標は、最適化前後で変わらない', () => {
      const unfolded = buildDeepBranchTree(5, false)
      const baseline = calcDrawStateMap(unfolded)

      // 最適化後も同じ入力なら同じ出力であること（回帰の基準）
      expect(calcDrawStateMap(unfolded)).toEqual(baseline)
    })
  })

  describe('fold 時の走査スキップ（1-a 最適化の検証）', () => {
    it('fold した子孫は drawStateMap に含めない', () => {
      const folded = buildDeepBranchTree(20, true)
      const drawStateMap = calcDrawStateMap(folded)

      const visibleIds = new Set(collectVisibleNodeIds(folded))
      const mapIds = Object.keys(drawStateMap).map(Number)

      expect(mapIds.sort((a, b) => a - b)).toEqual([...visibleIds].sort((a, b) => a - b))
    })

    it('fold していないときは全ノードが drawStateMap に含まれる', () => {
      const unfolded = buildDeepBranchTree(20, false)
      const drawStateMap = calcDrawStateMap(unfolded)

      const allIds = new Set(collectAllNodeIds(unfolded))
      const mapIds = Object.keys(drawStateMap).map(Number)

      expect(mapIds.sort((a, b) => a - b)).toEqual([...allIds].sort((a, b) => a - b))
    })

    it('多数の fold 済み葉を持つツリーでは、drawStateMap のエントリ数が可視ノード数と一致する', () => {
      const folded = buildDeepBranchTree(500, true)
      const drawStateMap = calcDrawStateMap(folded)

      const visibleCount = collectVisibleNodeIds(folded).length
      const mapCount = Object.keys(drawStateMap).length

      // root + left dummy + branch = 3
      expect(visibleCount).toBe(3)
      expect(mapCount).toBe(visibleCount)
    })
  })
})
