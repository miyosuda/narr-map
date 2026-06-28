import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

import {
  NodeState,
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
  calcDepth,
  hasChildren,
  findNode,
  findNodes,
  updateNodes,
  addChildNode,
  addChildNodeBelow,
  getLatestNode,
  getLatestVisibleChild,
  getSibling,
  isCopiable,
  splitSymbolFromText
} from '@/utils/node-utils'
import { calcDrawStateMap } from '@/utils/node-draw-utils'
import { useHistory } from './hooks/useHistory'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCanvasTransform } from './hooks/useCanvasTransform'
import { useMindMapIO } from './hooks/useMindMapIO'
import { useMouseInteraction } from './hooks/useMouseInteraction'
import { MoveDirection } from './constants'

const { nmAPI } = window

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
  const [cursorDepth, setCursorDepth] = useState(0)
  const [copyingStates, setCopyingStates] = useState<NodeState[]>([])  

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<SVGSVGElement>(null)

  const drawStateMap = useMemo(() => calcDrawStateMap(rootState), [rootState])

  const { canvasTranslatePos, setCanvasTranslatePos, canvasTransform, recenter } = useCanvasTransform(
    { rootState, drawStateMap, svgRef }
  )

  const {
    ghostState,
    handleMouseDown,
    handleMouseMove,
    handleDoubleClick,
    resetDrag
  } = useMouseInteraction({
    rootState,
    setRootState,
    setRootStateWithHistory,
    drawStateMap,
    canvasTranslatePos,
    setCanvasTranslatePos,
    nextEditId,
    setNextEditId,
    recenter,
    editText,
    getLastNode,
    svgRef,
    canvasRef
  })

  const resetInteractionState = useCallback(() => {
    resetDrag()
    setCursorDepth(0)
    setCopyingStates([])
  }, [resetDrag])

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
