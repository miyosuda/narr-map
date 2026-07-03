import { useState, useCallback } from 'react'

import {
  NodeState,
  SavingNodeState,
  EDIT_STATE_NONE,
  EDIT_STATE_NORMAL,
  EDIT_STATE_INSERT
} from '@/types'
import {
  getNodeState,
  isRoot,
  isDummy,
  hasChildren,
  findNode,
  findNodes,
  updateNodes,
  addChildNode,
  addChildNodeBelow,
  getLatestVisibleChild,
  getSibling,
  isCopiable,
  calcDepth,
  splitSymbolFromText,
  getSavingNodeState,
  getCopyingStatesFromSaving
} from '@/utils/node-utils'
import {
  getLastNode as getLastNodePure,
  applyDeleteSelectedNodes,
  applySelectAll,
  applyPaste,
  applyToggleFold
} from '@/utils/node-edit-utils'
import { MoveDirection } from '../constants'

const { nmAPI } = window

type UseNodeEditingParams = {
  rootState: NodeState
  setRootState: (state: NodeState) => void
  setRootStateWithHistory: (state: NodeState) => void
}

/**
 * ノード編集に関わる状態(nextNodeId / nextEditId / cursorDepth / copyingStates)と、
 * ノードの追加・削除・移動・折りたたみ・コピー&ペースト・テキスト編集などの操作を提供するフック。
 */
export function useNodeEditing(params: UseNodeEditingParams) {
  const { rootState, setRootState, setRootStateWithHistory } = params

  const [nextNodeId, setNextNodeId] = useState(2) // Node ID管理 (0,1はrootとdummpyRootで利用)
  const [nextEditId, setNextEditId] = useState(2) // Edit ID管理 (0,1はrootとdummpyRootで利用)
  const [cursorDepth, setCursorDepth] = useState(0)
  const [copyingStates, setCopyingStates] = useState<NodeState[]>([])

  const resetEditingState = useCallback(() => {
    setCursorDepth(0)
    setCopyingStates([])
  }, [])

  function getLastNode(): NodeState {
    return getLastNodePure(rootState)
  }

  function handleDecidedText(text: string) {
    const { symbol, rawText } = splitSymbolFromText(text)

    const targetState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
    if (targetState != null) {
      // textを設定
      const newRootState = updateNodes(
        rootState,
        (state) => state.id === targetState!.id,
        (state) => ({
          ...state,
          text: rawText,
          symbol: symbol,
          selected: true,
          editState: EDIT_STATE_NONE,
          editId: nextEditId
        })
      )
      setRootStateWithHistory(newRootState)
      setNextEditId(nextEditId + 1)
      setCursorDepth(calcDepth(targetState))

      if (isRoot(targetState)) {
        if (rawText.length > 0) {
          // TODO: useEffectの利用を検討
          nmAPI.sendMessage('set-root-text', rawText)
        } else {
          nmAPI.sendMessage('set-root-text', null)
        }
      }
    }
  }

  function deleteSelectedNodes() {
    const newRootState = applyDeleteSelectedNodes(rootState)
    setRootStateWithHistory(newRootState)
  }

  function copy() {
    const copiableStates = findNodes(rootState, (state) => isCopiable(state))
    setCopyingStates(copiableStates)
    const savingNodes = copiableStates.map(getSavingNodeState)
    nmAPI.sendMessage('response-copy-nodes', savingNodes)
  }

  function paste(obj?: { nodes?: SavingNodeState[] | null }) {
    const states =
      obj?.nodes != null ? getCopyingStatesFromSaving(obj.nodes) : copyingStates

    if (states.length === 0) {
      return
    }

    const targetNode = getLastNode()

    const {
      rootState: newRootState,
      nextNodeId: newNextNodeId,
      nextEditId: newNextEditId
    } = applyPaste(rootState, states, targetNode, nextNodeId, nextEditId)

    setNextNodeId(newNextNodeId)
    setNextEditId(newNextEditId)
    setRootStateWithHistory(newRootState)
  }

  function cut() {
    copy()
    deleteSelectedNodes()
  }

  function selectAll() {
    const { rootState: newRootState, nextEditId: newNextEditId } = applySelectAll(
      rootState,
      nextEditId
    )
    setNextEditId(newNextEditId)
    setRootState(newRootState)
  }

  function editText(targetNode: NodeState, inserting: boolean = false) {
    const newRootState = updateNodes(
      rootState,
      (state) => state.id === targetNode.id,
      (state) => ({
        ...state,
        editState: inserting ? EDIT_STATE_INSERT : EDIT_STATE_NORMAL
      })
    )
    setRootState(newRootState)
  }

  function move(direction: number, shiftDown: boolean) {
    let node: NodeState | null = null
    const lastNode = getLastNode()

    if (direction === MoveDirection.RIGHT) {
      // 右に移動
      if (lastNode.isLeft) {
        // 親に移動
        node = lastNode.parent
      } else {
        // 子に移動
        node = getLatestVisibleChild(lastNode)
      }

      if (node != null) {
        if (isDummy(node)) {
          node = rootState
        }
        setCursorDepth(calcDepth(node))
      } else if (lastNode.folded) {
        toggleFold()
      }
    } else if (direction === MoveDirection.LEFT) {
      // 左に移動
      if (lastNode.isLeft) {
        node = getLatestVisibleChild(lastNode)
      } else {
        if (isRoot(lastNode)) {
          node = getLatestVisibleChild(lastNode.accompaniedState!)
        } else {
          node = lastNode.parent
        }
      }

      if (node != null) {
        setCursorDepth(calcDepth(node))
      } else if (lastNode.folded) {
        toggleFold()
      }
    } else if (direction === MoveDirection.UP) {
      node = getSibling(lastNode, true, cursorDepth)
    } else if (direction === MoveDirection.DOWN) {
      node = getSibling(lastNode, false, cursorDepth)
    }

    if (node != null) {
      if (!shiftDown) {
        // selectionをnode以外をクリア.　cursorDepthを更新しない.
        const newRootState0 = updateNodes(
          rootState,
          (state) => state.id === node!.id,
          (state) => ({
            ...state,
            selected: true,
            editId: nextEditId
          })
        )
        const newRootState1 = updateNodes(
          newRootState0,
          (state) => state.selected && state.id !== node!.id,
          (state) => ({
            ...state,
            selected: false
          })
        )
        setRootState(newRootState1)
        setNextEditId(nextEditId + 1)
      } else {
        // nodeをselectedに. cursorDepthを更新しない.
        const newRootState = updateNodes(
          rootState,
          (state) => state.id === node!.id,
          (state) => ({
            ...state,
            selected: true,
            editId: nextEditId
          })
        )
        setRootState(newRootState)
        setNextEditId(nextEditId + 1)
      }
    }
  }

  function toggleFold() {
    const lastNode = getLastNode()
    const newRootState = applyToggleFold(rootState, lastNode, nextEditId)
    if (newRootState != null) {
      setRootStateWithHistory(newRootState)
      setCursorDepth(calcDepth(lastNode))
      setNextEditId(nextEditId + 1)
    }
  }

  function addChildToLatest() {
    const lastNodeState = getLastNode()

    let parentNode: NodeState

    if (isRoot(lastNodeState) && hasChildren(lastNodeState)) {
      parentNode = lastNodeState.accompaniedState!
    } else {
      parentNode = lastNodeState
    }

    const newChildState = getNodeState({
      id: nextNodeId,
      text: '',
      editId: nextEditId,
      parent: parentNode,
      isLeft: parentNode.isLeft,
      editState: EDIT_STATE_NORMAL,
      selected: true
    })

    setNextNodeId(nextNodeId + 1)
    setNextEditId(nextEditId + 1)

    const newRootState0 = updateNodes(
      rootState,
      (state) => state.id === parentNode.id,
      (state) => addChildNode(state, newChildState)
    )
    // clear node selection
    const newRootState1 = updateNodes(
      newRootState0,
      (state) => state.selected === true && state.id !== newChildState.id,
      (state) => ({
        ...state,
        selected: false
      })
    )
    setRootState(newRootState1)
  }

  function addSiblingToLatest() {
    const lastNodeState = getLastNode()

    if (isRoot(lastNodeState)) {
      addChildToLatest()
    } else {
      const newChildState = getNodeState({
        id: nextNodeId,
        text: '',
        editId: nextEditId,
        isLeft: lastNodeState.isLeft,
        editState: EDIT_STATE_NORMAL
      })

      setNextNodeId(nextNodeId + 1)
      setNextEditId(nextEditId + 1)

      const newRootState0 = updateNodes(
        rootState,
        (state) => state.id === lastNodeState.parent!.id,
        (state) => addChildNodeBelow(state, newChildState, lastNodeState)
      )

      // clear node selection
      const newRootState1 = updateNodes(
        newRootState0,
        (state) => state.selected === true && state.id !== newChildState.id,
        (state) => ({
          ...state,
          selected: false
        })
      )
      setRootState(newRootState1)
    }
  }

  return {
    nextEditId,
    setNextNodeId,
    setNextEditId,
    resetEditingState,
    getLastNode,
    editText,
    handleDecidedText,
    deleteSelectedNodes,
    copy,
    paste,
    cut,
    selectAll,
    move,
    toggleFold,
    addChildToLatest,
    addSiblingToLatest
  }
}
