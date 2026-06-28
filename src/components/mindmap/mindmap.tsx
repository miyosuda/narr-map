import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

import {
  NodeState,
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
import { TextImportModal } from './text-import-modal'
import {
  getNodeState,
  cloneNodeState,
  isRoot,
  isDummy,
  hasNodeInAncestor,
  calcDepth,
  hasChildren,
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
  splitSymbolFromText
} from '@/utils/node-utils'
import {
  containsPosForHandle,
  calcDrawStateMap,
  containsPos,
  containsPosHalf
} from '@/utils/node-draw-utils'
import { useHistory } from './hooks/useHistory'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCanvasTransform } from './hooks/useCanvasTransform'
import { useMindMapIO } from './hooks/useMindMapIO'
import { MoveDirection } from './constants'
import { NodeDragState, NodeGhostState } from '@/types'

const { nmAPI } = window

export const DragMode = {
  NODE: 1,
  GHOST: 2,
  BACK: 3
} as const


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

  const setDirty = useCallback(() => {
    nmAPI.sendMessage('set-dirty', null)
  }, [])

  const {
    state: rootState,
    setState: setRootState,
    setStateWithHistory: setRootStateWithHistory,
    undo,
    redo,
    reset: resetRootState
  } = useHistory(initialRootState, { onDirty: setDirty })

  const [nextNodeId, setNextNodeId] = useState(2) // Node ID管理 (0,1はrootとdummpyRootで利用)
  const [nextEditId, setNextEditId] = useState(2) // Edit ID管理 (0,1はrootとdummpyRootで利用)
  const [dragState, setDragState] = useState<NodeDragState | null>(null)
  const [ghostState, setGhostState] = useState<NodeGhostState | null>(null)
  const [cursorDepth, setCursorDepth] = useState(0)
  const [copyingStates, setCopyingStates] = useState<NodeState[]>([])  

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<SVGSVGElement>(null)

  const drawStateMap = useMemo(() => calcDrawStateMap(rootState), [rootState])

  const { canvasTranslatePos, setCanvasTranslatePos, canvasTransform, recenter } = useCanvasTransform(
    { rootState, drawStateMap, svgRef }
  )

  const resetInteractionState = useCallback(() => {
    setDragState(null)
    setGhostState(null)
    setCursorDepth(0)
    setCopyingStates([])
  }, [])

  // IPC（保存・読み込み・補完・テキストインポート）とコマンドルーティング、
  // および darkMode / connecting / トーストなどの UI フラグを管理する。
  const {
    darkMode,
    connecting,
    copiedToastVisible,
    textImportModalOpen,
    isTextGenerating,
    handleTextGenerate,
    handleTextImportModalClose,
    handleTextGenerateCancel
  } = useMindMapIO({
    rootState,
    initialRootState,
    setRootStateWithHistory,
    resetRootState,
    commands: {
      copy: () => copy(),
      paste: () => paste(),
      cut: () => cut(),
      selectAll: () => selectAll(),
      undo,
      redo
    },
    setNextNodeId,
    setNextEditId,
    resetInteractionState
  })

  // ハンドラー関数をrefに保存（イベントリスナーから最新のstateを参照するため）
  const handleMouseUpRef = useRef<(e: MouseEvent) => void>(() => {})

  // マウスハンドラの設定（一度だけ実行）
  useEffect(() => {
    const mouseUpHandler = (e: MouseEvent) => handleMouseUpRef.current(e)
    document.addEventListener('mouseup', mouseUpHandler)

    return () => {
      document.removeEventListener('mouseup', mouseUpHandler)
    }
  }, [])

  useEffect(() => {
    // 初回render後にrecenterする
    // (SVGのサイズはCSSの flex-grow, h-full で決まり、
    // useEffectの実行時点でレイアウト計算が完了していない場合がありえるため)
    if (!svgRef.current) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        recenter()
        observer.disconnect() // 初回のみ実行
      }
    })

    observer.observe(svgRef.current)

    return () => observer.disconnect()
  }, [])

  // refを最新のハンドラーで更新
  handleMouseUpRef.current = handleMouseUp

  // キーボードショートカットの定義
  useKeyboardShortcuts([
    // Tab: 子ノード追加
    {
      condition: { key: 'Tab' },
      handler: () => addChildToLatest()
    },
    // Enter: 兄弟ノード追加
    {
      condition: (e) => e.key === 'Enter' && !e.ctrlKey && !e.metaKey,
      handler: () => addSiblingToLatest()
    },
    // Ctrl+Enter: テキスト編集
    {
      condition: (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey),
      handler: () => editText(getLastNode())
    },
    // Backspace: 選択ノード削除
    {
      condition: { key: 'Backspace' },
      handler: () => deleteSelectedNodes(),
      preventDefault: false
    },
    // 上移動: ArrowUp または Ctrl+p
    {
      condition: (e) => e.key === 'ArrowUp' || (e.key === 'p' && (e.ctrlKey || e.metaKey)),
      handler: (e) => move(MoveDirection.UP, e.shiftKey)
    },
    // 下移動: ArrowDown または Ctrl+n
    {
      condition: (e) => e.key === 'ArrowDown' || (e.key === 'n' && (e.ctrlKey || e.metaKey)),
      handler: (e) => move(MoveDirection.DOWN, e.shiftKey)
    },
    // 右移動: ArrowRight または Ctrl+f
    {
      condition: (e) => e.key === 'ArrowRight' || (e.key === 'f' && (e.ctrlKey || e.metaKey)),
      handler: (e) => move(MoveDirection.RIGHT, e.shiftKey)
    },
    // 左移動: ArrowLeft または Ctrl+b
    {
      condition: (e) => e.key === 'ArrowLeft' || (e.key === 'b' && (e.ctrlKey || e.metaKey)),
      handler: (e) => move(MoveDirection.LEFT, e.shiftKey)
    },
    // F2: テキスト編集
    {
      condition: { key: 'F2' },
      handler: () => editText(getLastNode())
    },
    // Ctrl+i: 挿入モードでテキスト編集
    {
      condition: (e) => e.key === 'i' && (e.ctrlKey || e.metaKey),
      handler: () => editText(getLastNode(), true)
    },
    // Space: 折りたたみ切り替え
    {
      condition: { key: ' ' },
      handler: () => toggleFold()
    },
    // 英数字キー: 挿入モードでテキスト編集
    {
      condition: (e) => e.keyCode >= 49 && e.keyCode <= 90 && !(e.ctrlKey || e.metaKey),
      handler: () => editText(getLastNode(), true),
      preventDefault: false
    }
  ])

  // ハンドルの上でクリックした
  function handleMouseDownForHandle(px: number, py: number, node: NodeState) {
    setDragState({
      startX: px,
      startY: py,
      startElementX: node.shiftX,
      startElementY: node.shiftY,
      mode: DragMode.NODE
    })

    const newRootState = updateNodes(
      rootState,
      (state) => state.id === node!.id,
      (state) => ({
        ...state,
        handleShown: true
      })
    )
    setRootState(newRootState)
  }

  // Nodeの上でクリックした
  function handleMouseDownForNode(px: number, py: number, shiftDown: boolean, pickedNode: NodeState) {
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
        mode: DragMode.GHOST
      })

      setGhostState({
        x: pickedNodeDrawState.x,
        y: pickedNodeDrawState.y,
        width: pickedNodeDrawState.width,
        height: pickedNodeDrawState.height,
        nodeId: pickedNode!.id
      })
    }
  }

  // 背景の上でクリックした
  function handleMouseDownForBack(clientX: number, clientY: number) {
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
      startX: clientX,
      startY: clientY,
      startElementX: canvasTranslatePos.x,
      startElementY: canvasTranslatePos.y,
      mode: DragMode.BACK
    })    
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
      handleMouseDownForHandle(px, py, pickedNodeForHandle)
    } else if (pickedNode != null) {
      // Nodeの上でクリックした
      handleMouseDownForNode(px, py, shiftDown, pickedNode)
    } else {
      // 背景の上でクリックした
      handleMouseDownForBack(e.clientX, e.clientY)
    }

    if (document.activeElement === document.body) {
      e.preventDefault()
    }
  }

  // ハンドルをdragして移動中
  function handleMouseMoveForHandle(px: number, py: number) {
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
  }

  function handleMouseMoveForGhost(px: number, py: number) {
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
  }

  // 背景をdragして移動中
  function handleMouseMoveForBack(clientX: number, clientY: number) {
    const dx = clientX - dragState.startX
    const dy = clientY - dragState.startY

    setCanvasTranslatePos({ x: dragState.startElementX + dx, y: dragState.startElementY + dy })    
  }

  // ハンドルの上でhoverした
  function handleMouseMoveForHandleHover(node: NodeState) {
    const newRootState = updateNodes(
      rootState,
      (state) => true,
      (state) => ({
        ...state,
        handleShown: state.id === node!.id
      })
    )
    setRootState(newRootState)
  }

  // ハンドルの上でhoverしていなかった場合
  function handleMouseMoveForNone() {
    // 表示していたhandleを非表示に
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

  function handleMouseMove(e: React.MouseEvent) {
    if (e.button !== 0) {
      // 左クリック以外の場合
      return
    }

    const { x: px, y: py } = getLocalPos(e)

    if (dragState != null) {
      // drag中だった場合
      if (dragState.mode === DragMode.NODE) {
        // Nodeをdragして移動中
        handleMouseMoveForHandle(px, py)
      } else if (dragState.mode === DragMode.GHOST) {
        // GhostとしてNodeをdragして移動中
        handleMouseMoveForGhost(px, py)
      } else if (dragState.mode === DragMode.BACK) {
        // 背景をdragして移動中
        handleMouseMoveForBack(e.clientX, e.clientY)
      }
    } else {
      // drag中でなかった場合
      const pickedNodeForHandle = findNode(rootState, (state) =>
        containsPosForHandle(state, px, py, drawStateMap)
      )
      if (pickedNodeForHandle != null) {
        // ハンドルの上でhoverした場合
        handleMouseMoveForHandleHover(pickedNodeForHandle)
      } else {
        // ハンドルの上でhoverしていなかった場合
        handleMouseMoveForNone()
      }
    }
  }

  function handleMouseUpForNode() {
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
  }

  function handleMouseUpForGhost() {
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

  function handleMouseUp(e: MouseEvent) {
    if (e.button !== 0) {
      // 左クリック以外の場合
      return
    }

    if (dragState != null) {
      if (dragState.mode === DragMode.NODE) {
        // ハンドルをdragして移動中だった場合
        handleMouseUpForNode()
      } else if (dragState.mode === DragMode.GHOST) {
        // GhostとしてNodeをdragして移動中だった場合
        handleMouseUpForGhost()
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
    const pos = svgRef.current!.createSVGPoint()
    pos.x = e.clientX
    pos.y = e.clientY
    const canvasLocalPos = pos.matrixTransform(canvasRef.current!.getScreenCTM()!.inverse())
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

  const svgClassName = darkMode ? 'flex-grow h-full bg-black' : 'flex-grow h-full bg-white'

  return (
    <>
      <svg
        ref={svgRef}
        className={svgClassName}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
      >
        {connecting && <Spinner darkMode={darkMode} />}

        <g id="canvas" ref={canvasRef} transform={canvasTransform}>
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
      {copiedToastVisible && (
        <div
          className={
            'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-md text-sm border border-zinc-500 ' +
            (darkMode ? 'bg-black text-white' : 'bg-white text-black')
          }
        >
          Copied to clipboard
        </div>
      )}
      <TextImportModal
        isOpen={textImportModalOpen}
        onClose={handleTextImportModalClose}
        onGenerate={handleTextGenerate}
        onCancel={handleTextGenerateCancel}
        isGenerating={isTextGenerating}
        darkMode={darkMode}
      />
    </>
  )
}

export default MindMap
