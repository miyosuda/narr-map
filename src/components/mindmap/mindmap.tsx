import { useEffect, useMemo, useRef, useCallback } from 'react'

import {
  EDIT_STATE_NONE,
  EDIT_STATE_INSERT
} from '@/types'
import { Node } from './node'
import { Rect } from './rect'
import { TextInput } from './text-input'
import { Spinner } from './spinner'
import { TextImportModal } from './text-import-modal'
import { getNodeState, isRoot, findNode } from '@/utils/node-utils'
import { calcDrawStateMap } from '@/utils/node-draw-utils'
import { useHistory } from './hooks/useHistory'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCanvasTransform } from './hooks/useCanvasTransform'
import { useMindMapIO } from './hooks/useMindMapIO'
import { useMouseInteraction } from './hooks/useMouseInteraction'
import { useNodeEditing } from './hooks/useNodeEditing'
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

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<SVGSVGElement>(null)

  const drawStateMap = useMemo(() => calcDrawStateMap(rootState), [rootState])

  const { canvasTranslatePos, setCanvasTranslatePos, canvasTransform, recenter } = useCanvasTransform(
    { rootState, drawStateMap, svgRef }
  )

  // ノードの追加・削除・移動・コピー&ペースト・テキスト編集などの操作と、
  // nextNodeId / nextEditId / cursorDepth / copyingStates の状態を管理する。
  const {
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
  } = useNodeEditing({
    rootState,
    setRootState,
    setRootStateWithHistory
  })

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
    resetEditingState()
  }, [resetDrag, resetEditingState])

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
      copy,
      paste,
      cut,
      selectAll,
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
