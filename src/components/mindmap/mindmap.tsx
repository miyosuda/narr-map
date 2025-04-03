import { useState, useEffect, useMemo, useRef } from 'react'

import {
  NodeState,
  NodeDragState,
  NodeGhostState,
  NodeDrawStateMapType,
  SavingNodeState,
  HOVER_STATE_NONE,
  HOVER_STATE_LEFT,
  HOVER_STATE_RIGHT,
  HOVER_STATE_TOP,
  EDIT_STATE_NONE,
  EDIT_STATE_NORMAL,
  EDIT_STATE_INSERT
} from '@/types'
import { Node } from './node'
import { Rect } from './rect'
import { TextInput } from './text-input'
import { Spinner } from './spinner'
import {
  getNodeState,
  cloneNodeState,
  isRoot,
  isDummy,
  hasNodeInAncestor,
  calcDepth,
  hasChildren,
  getExtendedChildren,
  findNode,
  findNodes,
  updateNodes,
  addChildNode,
  addChildNodeAbove,
  addChildNodeBelow,
  removeChildNode,
  getLatestNode,
  getLatestVisibleChild,
  getSibling,
  isCopiable,
  splitSymbolFromText,
  getSavingNodeState,
  getNodeStateFromSaving,
  getMaxNodeId
} from '@/utils/node-utils'
import {
  containsPosForHandle,
  calcDrawStateMap,
  containsPos,
  containsPosHalf
} from '@/utils/node-draw-utils'
const { nmAPI } = window

const DRAG_NODE = 1
const DRAG_GHOST = 2
const DRAG_BACK = 3

const MOVE_UP = 1
const MOVE_DOWN = 2
const MOVE_RIGHT = 3
const MOVE_LEFT = 4

const EDIT_HISTORY_MAX = 30

type Range = {
  left: number
  right: number
  top: number
  bottom: number
}

const initialRange: Range = {
  left: Number.POSITIVE_INFINITY,
  right: Number.NEGATIVE_INFINITY,
  top: Number.POSITIVE_INFINITY,
  bottom: Number.NEGATIVE_INFINITY
}

const getRange = (
  state: NodeState,
  drawStateMap: NodeDrawStateMapType,
  range: Range = initialRange
): Range => {
  const drawState = drawStateMap[state.id]

  const left = Math.min(range.left, drawState.x)
  const right = Math.max(range.right, drawState.x + drawState.width)
  const top = Math.min(range.top, drawState.y)
  const bottom = Math.max(range.bottom, drawState.y + drawState.height)

  const newRange = {
    left,
    right,
    top,
    bottom
  }

  const f = (r: Range, s: NodeState): Range => {
    return getRange(s, drawStateMap, r)
  }

  if (state.folded) {
    return newRange
  } else {
    const children = getExtendedChildren(state)
    return children.reduce(f, newRange)
  }
}

function MindMap() {
  const initialRootState = getNodeState({
    id: 0,
    text: 'root',
    selected: true,
    editId: 0,
    accompaniedState: getNodeState({
      id: 1,
      editId: 1,
      isLeft: true
    })
  })

  const [rootState, setRootState] = useState(initialRootState)
  const [stateHistory, setStateHistory] = useState<NodeState[]>([initialRootState])
  const [historyCursor, setHistoryCursor] = useState(0)
  const [nextNodeId, setNextNodeId] = useState(2) // Node ID管理 (0,1はrootとdummpyRootで利用)
  const [nextEditId, setNextEditId] = useState(2) // Edit ID管理 (0,1はrootとdummpyRootで利用)
  const [darkMode, setDarkMode] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const drawStateMap = useMemo(() => calcDrawStateMap(rootState), [rootState])

  const [dragState, setDragState] = useState<NodeDragState | null>(null)

  const [ghostState, setGhostState] = useState<NodeGhostState | null>(null)

  const [canvasTranslatePos, setCanvasTranslatePos] = useState({
    x: 640,
    y: 480
  })

  const [cursorDepth, setCursorDepth] = useState(0)
  const [copyingStates, setCopyingStates] = useState<NodeState[]>([])

  // SVG, Canvasエレメントへのリファレンス
  const svg = useRef<SVGSVGElement>(null)
  const canvas = useRef<SVGSVGElement>(null)

  // マウス,キーハンドラの設定
  useEffect(() => {
    // TODO: 毎描画後に走ってしまっている. 依存stateを適切に設定する.
    prepareHandlers()

    return () => {
      cleanupHandlers()
    }
  })

  function handleCommand(command: string, obj: any) {
    if (command === 'copy') {
      copy()
    } else if (command === 'paste') {
      paste()
    } else if (command === 'cut') {
      cut()
    } else if (command === 'selectall') {
      selectAll()
    } else if (command === 'redo') {
      redo()
    } else if (command === 'undo') {
      undo()
    } else if (command === 'save') {
      save()
    } else if (command === 'load') {
      load(obj)
    } else if (command === 'export') {
      export_(obj)
    } else if (command === 'new-file') {
      newFile()
    } else if (command === 'complete') {
      complete()
    } else if (command === 'completed') {
      completed(obj)
    } else if (command === 'dark-mode') {
      setDarkMode(obj)
    }
  }

  useEffect(() => {
    // TODO: 毎描画後に走ってしまっている. 依存stateを適切に設定する.
    const offFunc = nmAPI.onReceiveMessage((arg: string, obj: any) => {
      // textInput表示中かどうか
      const editingNodeState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
      if (editingNodeState != null) {
        // textInput表示中だった場合はTextInput側が処理する
      } else {
        // textInput表示中でない場合
        handleCommand(arg, obj)
      }
    })
    return offFunc
  })

  useEffect(() => {
    // 初回render後にrecenterする
    recenter()
  }, [])

  const setRootStateWithHistory = (newRootState: NodeState): void => {
    setRootState(newRootState)

    let newStateHistory
    if (historyCursor !== stateHistory.length - 1) {
      newStateHistory = [...stateHistory.slice(0, historyCursor + 1), newRootState]
    } else {
      newStateHistory = [...stateHistory, newRootState]
    }

    if (newStateHistory.length > EDIT_HISTORY_MAX) {
      newStateHistory = newStateHistory.slice(1)
      setStateHistory(newStateHistory)
    } else {
      setStateHistory(newStateHistory)
      setHistoryCursor(historyCursor + 1)
    }

    setDirty()
  }

  const setDirty = () => {
    // TODO: useEffectの利用を検討
    nmAPI.sendMessage('set-dirty', null)
  }

  const undo = () => {
    if (historyCursor > 0) {
      setRootState(stateHistory[historyCursor - 1])
      setHistoryCursor(historyCursor - 1)
    }
  }

  const redo = () => {
    if (historyCursor < stateHistory.length - 1) {
      setRootState(stateHistory[historyCursor + 1])
      setHistoryCursor(historyCursor + 1)
    }
  }

  const save = () => {
    // TODO: useEffectの利用を検討
    const savingRootState = getSavingNodeState(rootState)
    nmAPI.sendMessage('response-save', savingRootState)
  }

  const export_ = (format: string) => {
    // TODO: useEffectの利用を検討
    const savingRootState = getSavingNodeState(rootState)
    nmAPI.sendMessage('response-export', [savingRootState, format])
  }

  const complete = () => {
    nmAPI.sendMessage('response-complete', rootState)
    setConnecting(true)
  }

  const completed = (newRootState: NodeState) => {
    setRootStateWithHistory(newRootState)
    setConnecting(false)
  }

  const load = (savingState: SavingNodeState) => {
    const newRootState = getNodeStateFromSaving(savingState)
    const maxNodeId = getMaxNodeId(newRootState)

    setRootState(newRootState)
    setStateHistory([newRootState])
    setHistoryCursor(0)
    setNextNodeId(maxNodeId + 1)
    setNextEditId(maxNodeId + 1)

    setDragState(null)
    setGhostState(null)
    setCursorDepth(0) // TODO: 要確認
    setCopyingStates([])
  }

  const newFile = () => {
    setRootState(initialRootState)
    setStateHistory([initialRootState])
    setHistoryCursor(0)
    setNextNodeId(2)
    setNextEditId(2)

    setDragState(null)
    setGhostState(null)
    setCursorDepth(0)
    setCopyingStates([])
  }

  function prepareHandlers() {
    document.addEventListener('mouseup', handleMouseUp)
    document.body.addEventListener('keydown', handleKeyDown)
  }

  function cleanupHandlers() {
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.removeEventListener('keydown', handleKeyDown)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.target !== document.body) {
      // input入力時のkey押下は無視する
      return
    }

    const shiftDown = e.shiftKey
    const ctrlDown = e.ctrlKey || e.metaKey

    if (e.key === 'Tab') {
      addChildToLatest()
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (!e.ctrlKey) {
        addSiblingToLatest()
      } else {
        const targetNode = getLastNode()
        editText(targetNode)
      }
      e.preventDefault()
    } else if (e.key === 'Backspace') {
      deleteSelectedNodes()
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && ctrlDown)) {
      move(MOVE_UP, shiftDown)
    } else if (e.key === 'ArrowDown' || (e.key === 'n' && ctrlDown)) {
      move(MOVE_DOWN, shiftDown)
    } else if (e.key === 'ArrowRight' || (e.key === 'f' && ctrlDown)) {
      move(MOVE_RIGHT, shiftDown)
    } else if (e.key === 'ArrowLeft' || (e.key === 'b' && ctrlDown)) {
      move(MOVE_LEFT, shiftDown)
    } else if (e.key === 'F2') {
      const targetNode = getLastNode()
      editText(targetNode)
    } else if (e.key === 'i' && ctrlDown) {
      const targetNode = getLastNode()
      editText(targetNode, true)
    } else if (e.key === ' ') {
      toggleFold()
      e.preventDefault()
    } else if (
      e.keyCode >= 49 && // '1'
      e.keyCode <= 90 && // 'Z'
      !ctrlDown
    ) {
      const targetNode = getLastNode()
      editText(targetNode, true)
    } else if (e.key === 'F2') {
      const targetNode = getLastNode()
      editText(targetNode)
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) {
      // 左クリック以外の場合
      return
    }

    const editingNodeState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
    if (editingNodeState != null) {
      // textInput表示中なら何もしない
      return
    }

    const { x: px, y: py } = getLocalPos(e)

    // マウスが乗ったnodeをpick対象として選ぶ
    function pickNodeForHandle(state: NodeState): boolean {
      return containsPosForHandle(state, px, py, drawStateMap)
    }

    function pickNode(state: NodeState): boolean {
      return containsPos(state, px, py, drawStateMap)
    }

    let pickedNodeForHandle = findNode(rootState, pickNodeForHandle)
    let pickedNode = findNode(rootState, pickNode)

    const shiftDown = e.shiftKey

    if (pickedNodeForHandle != null) {
      // ハンドルの上でクリックした
      setDragState({
        startX: px,
        startY: py,
        startElementX: pickedNodeForHandle.shiftX,
        startElementY: pickedNodeForHandle.shiftY,
        mode: DRAG_NODE
      })

      const newRootState = updateNodes(
        rootState,
        (state) => state.id === pickedNodeForHandle!.id,
        (state) => ({
          ...state,
          handleShown: true
        })
      )
      setRootState(newRootState)
    } else if (pickedNode != null) {
      // Nodeの上でクリックした
      let newRootState

      if (shiftDown) {
        // shift押下時
        // pickしたnodeをselectedに
        newRootState = updateNodes(
          rootState,
          (state) => state.id === pickedNode!.id,
          (state) => ({
            ...state,
            selected: true,
            editId: nextEditId
          })
        )
      } else {
        // pickしたnode以外のselectedをクリア
        newRootState = updateNodes(
          rootState,
          (state) => state.selected,
          (state) => ({
            ...state,
            selected: false
          })
        )
        newRootState = updateNodes(
          newRootState,
          (state) => state.id === pickedNode!.id,
          (state) => ({
            ...state,
            selected: true,
            editId: nextEditId
          })
        )
      }

      setNextEditId(nextEditId + 1)
      setRootState(newRootState)

      if (!isRoot(pickedNode)) {
        // GHOST表示
        const pickedNodeDrawState = drawStateMap[pickedNode!.id]
        setDragState({
          startX: px,
          startY: py,
          startElementX: pickedNodeDrawState.x,
          startElementY: pickedNodeDrawState.y,
          mode: DRAG_GHOST
        })

        setGhostState({
          x: pickedNodeDrawState.x,
          y: pickedNodeDrawState.y,
          width: pickedNodeDrawState.width,
          height: pickedNodeDrawState.height,
          nodeId: pickedNode!.id
        })
      }
    } else {
      // 1つを除いてNode選択クリア
      const lastNode = getLastNode()
      let newRootState = updateNodes(
        rootState,
        (state) => state.selected,
        (state) => ({
          ...state,
          selected: false
        })
      )
      newRootState = updateNodes(
        newRootState,
        (state) => state.id === lastNode.id,
        (state) => ({
          ...state,
          selected: true,
          editId: nextEditId
        })
      )
      setNextEditId(nextEditId + 1)
      setRootState(newRootState)

      setDragState({
        startX: e.clientX,
        startY: e.clientY,
        startElementX: canvasTranslatePos.x,
        startElementY: canvasTranslatePos.y,
        mode: DRAG_BACK
      })
    }

    if (document.activeElement === document.body) {
      e.preventDefault()
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (e.button !== 0) {
      // 左クリック以外の場合
      return
    }

    const { x: px, y: py } = getLocalPos(e)

    if (dragState != null) {
      if (dragState.mode === DRAG_NODE) {
        const dx = px - dragState.startX
        const dy = py - dragState.startY

        const draggingNode = findNode(rootState, (state) => state.handleShown)
        if (draggingNode != null) {
          const newRootState = updateNodes(
            rootState,
            (state) => state.id === draggingNode!.id,
            (state) => ({
              ...state,
              shiftX: dragState.startElementX + dx,
              shiftY: dragState.startElementY + dy
            })
          )
          setRootState(newRootState)
        }
      } else if (dragState.mode === DRAG_GHOST) {
        const dx = px - dragState.startX
        const dy = py - dragState.startY

        setGhostState({
          ...ghostState!,
          x: dragState.startElementX + dx,
          y: dragState.startElementY + dy
        })

        const calcHoverState = (state: NodeState, x: number, y: number) => {
          const drawState = drawStateMap[state.id]
          if (state.id === ghostState?.nodeId) {
            return HOVER_STATE_NONE
          }

          if (isDummy(state)) {
            return HOVER_STATE_NONE
          }

          if (containsPosHalf(state, drawState, x, y, true)) {
            // 左半分
            if (isRoot(state)) {
              // rootの場合
              return HOVER_STATE_LEFT
            } else {
              if (state.isLeft) {
                // 左nodeの場合
                return HOVER_STATE_LEFT
              } else {
                // 右nodeの場合
                return HOVER_STATE_TOP
              }
            }
          } else if (containsPosHalf(state, drawState, x, y, false)) {
            // 右半分
            if (isRoot(state)) {
              // rootの場合
              return HOVER_STATE_RIGHT
            } else {
              if (state.isLeft) {
                // 左nodeの場合
                return HOVER_STATE_TOP
              } else {
                // 右nodeの場合
                return HOVER_STATE_RIGHT
              }
            }
          } else {
            return HOVER_STATE_NONE
          }
        }

        const newRootState = updateNodes(
          rootState,
          (state) => true,
          (state) => ({
            ...state,
            hoverState: calcHoverState(state, px, py)
          })
        )
        setRootState(newRootState)
      } else if (dragState.mode === DRAG_BACK) {
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY

        setCanvasTranslatePos({ x: dragState.startElementX + dx, y: dragState.startElementY + dy })
      }
    } else {
      const pickedNodeForHandle = findNode(rootState, (state) =>
        containsPosForHandle(state, px, py, drawStateMap)
      )
      if (pickedNodeForHandle != null) {
        const newRootState = updateNodes(
          rootState,
          (state) => true,
          (state) => ({
            ...state,
            handleShown: state.id === pickedNodeForHandle!.id
          })
        )
        setRootState(newRootState)
      } else {
        const handleShownNode = findNode(rootState, (state) => state.handleShown)
        if (handleShownNode !== null) {
          const newRootState = updateNodes(
            rootState,
            (state) => true,
            (state) => ({
              ...state,
              handleShown: false
            })
          )
          setRootState(newRootState)
        }
      }
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (e.button !== 0) {
      // 左クリック以外の場合
      return
    }

    if (dragState != null) {
      if (dragState.mode === DRAG_NODE) {
        // ハンドルをdragして移動中だった場合
        const draggingNode = findNode(rootState, (state) => state.handleShown)
        if (draggingNode != null) {
          // 表示していたhandleを非表示に
          const newRootState = updateNodes(
            rootState,
            (state) => state.id === draggingNode!.id,
            (state) => ({
              ...state,
              handleShown: false
            })
          )
          setRootStateWithHistory(newRootState)
        }
      } else if (dragState.mode === DRAG_GHOST) {
        // ghostをhoverして乗せていた先のnode
        const ghostTargetState = findNode(
          rootState,
          (state) => state.hoverState !== HOVER_STATE_NONE
        )

        // ghostを出した元のnode
        const ghostOrgNodeId = ghostState!.nodeId
        const ghostOrgState = findNode(rootState, (state) => state.id === ghostOrgNodeId)

        // hover stateをクリア
        const newRootState = updateNodes(
          rootState,
          (state) => state.hoverState !== HOVER_STATE_NONE,
          (state) => ({
            ...state,
            hoverState: HOVER_STATE_NONE
          })
        )
        setRootState(newRootState)

        // Ghostを消す
        setGhostState(null)

        if (ghostTargetState !== null) {
          // ghostのhover先があった場合
          let newChildState = ghostOrgState!
          const targetHoverState = ghostTargetState.hoverState

          // nodeの右側にhoverして離した場合のみ、追加先がdummy nodeとなる.
          const toAccompanied = targetHoverState === HOVER_STATE_LEFT && isRoot(ghostTargetState)
          const targetState = toAccompanied ? ghostTargetState.accompaniedState! : ghostTargetState

          if (!hasNodeInAncestor(targetState, newChildState)) {
            // isLeftを移動先に合わせる
            if (targetState.isLeft !== newChildState.isLeft) {
              newChildState = updateNodes(
                newChildState,
                (state) => true,
                (state) => ({ ...state, isLeft: targetState.isLeft })
              )
            } else {
              newChildState = cloneNodeState(newChildState)
            }

            // 移動元の親から外す
            const newRootState0 = updateNodes(
              newRootState,
              (state) => state.id === newChildState.parent!.id,
              (state) => removeChildNode(state, newChildState.id)
            )

            if (targetHoverState === HOVER_STATE_RIGHT || targetHoverState === HOVER_STATE_LEFT) {
              // 移動先の子として追加
              const newRootState1 = updateNodes(
                newRootState0,
                (state) => state.id === targetState.id,
                (state) => addChildNode(state, newChildState)
              )
              setRootStateWithHistory(newRootState1)
            } else if (targetHoverState === HOVER_STATE_TOP) {
              // nodeの上側にhoverして離した
              // 移動先の上にsiblingとして追加する
              const newRootState1 = updateNodes(
                newRootState0,
                (state) => state.id === targetState.parent!.id,
                (state) => addChildNodeAbove(state, newChildState, ghostTargetState)
              )
              setRootStateWithHistory(newRootState1)
            }
          }
        }
      }

      // drag stateをクリア
      setDragState(null)
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    /*
    if( this.textInput.isShown ) {
      // textInput表示中なら何もしない
      return;
    }
    */

    if (e.button !== 0) {
      // 左クリック以外の場合
      return
    }

    if (e.shiftKey) {
      return
    }

    const { x: px, y: py } = getLocalPos(e)

    function pickNode(state: NodeState): boolean {
      return containsPos(state, px, py, drawStateMap)
    }

    const pickedNode = findNode(rootState, pickNode)
    if (pickedNode != null) {
      editText(pickedNode!)
    } else {
      recenter()
    }

    e.preventDefault()
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
    setRootStateWithHistory(newRootState1)
  }

  function copy() {
    const copiableStates = findNodes(rootState, (state) => isCopiable(state))
    setCopyingStates(copiableStates)
  }

  function paste() {
    const targetNode = getLastNode()

    let nodeId = nextNodeId
    let editId = nextEditId

    const getNextNodeId = () => {
      const ret = nodeId
      setNextNodeId(nodeId + 1)
      nodeId += 1
      return ret
    }

    const getNextEditId = () => {
      const ret = editId
      setNextEditId(editId + 1)
      editId += 1
      return ret
    }

    const modifyStateForCopy = (state: NodeState): NodeState => {
      // TODO: getExtendedChildren()は、accompaniedStateを含んでしまっているのでここでは使えないが、
      // getExtendedChildren()の方を変更することで共通化できる可能性がある.
      const stretchedChildren =
        isRoot(state) && !isDummy(state)
          ? [...state.children, ...state.accompaniedState!.children]
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

    setRootStateWithHistory(newRootState)
  }

  function cut() {
    copy()
    deleteSelectedNodes()
  }

  function selectAll() {
    let editId = nextEditId

    const getNextEditId = () => {
      const ret = editId
      setNextEditId(editId + 1)
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

    if (direction === MOVE_RIGHT) {
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
    } else if (direction === MOVE_LEFT) {
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
    } else if (direction === MOVE_UP) {
      node = getSibling(lastNode, true, cursorDepth)
    } else if (direction === MOVE_DOWN) {
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
    if (!isRoot(lastNode)) {
      if (hasChildren(lastNode)) {
        // toggle folded
        const newRootState0 = updateNodes(
          rootState,
          (state) => state.id === lastNode.id,
          (state) => ({
            ...state,
            folded: !lastNode.folded,
            selected: true,
            editId: nextEditId
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
        setRootStateWithHistory(newRootState1)
        setCursorDepth(calcDepth(lastNode))
        setNextEditId(nextEditId + 1)
      }
    }
  }

  function recenter() {
    const range = getRange(rootState, drawStateMap)

    const centerX = (range.left + range.right) * 0.5
    const centerY = (range.top + range.bottom) * 0.5

    const width = svg.current!.width.baseVal.value
    const height = svg.current!.height.baseVal.value

    setCanvasTranslatePos({ x: width / 2 - centerX, y: height / 2 - centerY })
  }

  function getLastNode(): NodeState {
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

  function getLocalPos(e: React.MouseEvent) {
    const pos = svg.current!.createSVGPoint()
    pos.x = e.clientX
    pos.y = e.clientY
    const canvasLocalPos = pos.matrixTransform(canvas.current!.getScreenCTM()!.inverse())
    return canvasLocalPos
  }

  // TextInputのprops用意
  let textInputState = null
  const editingState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
  if (editingState != null) {
    const editingDrawState = drawStateMap[editingState.id]
    textInputState = {
      text: editingState.text,
      symbol: editingState.symbol,
      x: editingDrawState.x,
      y: editingDrawState.y,
      width: editingDrawState.width,
      height: editingDrawState.height,
      isRoot: isRoot(editingState),
      isLeft: editingState.isLeft,
      textSelected: editingState.editState === EDIT_STATE_INSERT ? false : true
    }
  }

  // canvasのtranslate用意
  const canvasTransform = `translate(${canvasTranslatePos.x},${canvasTranslatePos.y})`

  const svgClassName = darkMode ? 'flex-grow h-full bg-black' : 'flex-grow h-full bg-white'

  return (
    <svg
      ref={svg}
      className={svgClassName}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onDoubleClick={handleDoubleClick}
    >
      {connecting && <Spinner darkMode={darkMode} />}

      <g id="canvas" ref={canvas} transform={canvasTransform}>
        <g id="nodes">
          <Node
            key={rootState.id}
            state={rootState}
            drawStateMap={drawStateMap}
            edgeStartX={0}
            edgeStartY={0}
            darkMode={darkMode}
          />
        </g>
        {ghostState && (
          <Rect
            x={ghostState.x}
            y={ghostState.y}
            width={ghostState.width}
            height={ghostState.height}
          ></Rect>
        )}
        {textInputState && (
          <TextInput
            text={textInputState.text}
            symbol={textInputState.symbol}
            x={textInputState.x}
            y={textInputState.y}
            width={textInputState.width}
            height={textInputState.height}
            isRoot={textInputState.isRoot}
            isLeft={textInputState.isLeft}
            textSelected={textInputState.textSelected}
            handleDecidedText={handleDecidedText}
            darkMode={darkMode}
          />
        )}
      </g>
    </svg>
  )
}

export default MindMap
