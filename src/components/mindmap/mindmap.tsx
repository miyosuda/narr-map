import { useEffect, useMemo, useRef, useCallback, useState } from 'react'

import { EDIT_STATE_NONE, EDIT_STATE_INSERT } from '@/types'
import { Node } from './node'
import { Rect } from './rect'
import { TextInput } from './text-input'
import { Spinner } from './spinner'
import { TextImportModal } from './text-import-modal'
import { NodeContextMenu } from './node-context-menu'
import { TopicBar } from './topic-bar'
import { getNodeState, isRoot, isDummy, findNode } from '@/utils/node-utils'
import { pruneTopicIds, topicNodes } from '@/bridge/topic'
import { buildPluginNodeContext } from '@/plugins/context'
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
  // initialRootState は、マインドマップの初期データ構造.
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

  // rootState は、マインドマップのデータ構造（ルートノードを頂点に、子ノードが木構造でぶら下がっている状態）.
  // 「どんなノードがあるか／テキスト／折りたたみ状態／シフト量」といった論理的なデータで、画面上の座標は持っていない.
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
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    nodeId: number
  } | null>(null)
  const [topicIds, setTopicIds] = useState<number[]>([])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const clearTopic = useCallback(() => {
    setTopicIds([])
  }, [])

  const toggleTopic = useCallback((nodeId: number) => {
    setTopicIds((ids) =>
      ids.includes(nodeId) ? ids.filter((id) => id !== nodeId) : [...ids, nodeId]
    )
  }, [])

  const removeTopic = useCallback((nodeId: number) => {
    setTopicIds((ids) => ids.filter((id) => id !== nodeId))
  }, [])

  // drawStateMap は、ノードの描画情報（画面上の座標やサイズ）.
  // NodeId をキーに、{x, y, width, height} を値としたオブジェクト.
  // (rootState が変わると再計算される)
  const drawStateMap = useMemo(() => calcDrawStateMap(rootState), [rootState])

  // canvasTranslatePos は、キャンバスの移動量（画面上の表示位置）.
  const { canvasTranslatePos, setCanvasTranslatePos, canvasTransform, recenter } =
    useCanvasTransform({ rootState, drawStateMap, svgRef })

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
    addSiblingToLatest,
    selectOnly,
    addPluginChildren
  } = useNodeEditing({
    rootState,
    setRootState,
    setRootStateWithHistory
  })

  // ghostState は、ノードの移動中のゴーストノードの描画情報. ドラッグ中に表示される、ノードの移動先の仮想ノード.
  const { ghostState, handleMouseDown, handleMouseMove, handleDoubleClick, resetDrag, pickNodeAt } =
    useMouseInteraction({
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

  // resetInteractionState は、ノードの移動中のゴーストノードの描画情報をリセットする.
  const resetInteractionState = useCallback(() => {
    resetDrag() // ノードの移動中のゴーストノードの描画情報をリセット.
    resetEditingState() // 編集・コピーまわりの一時状態を消す
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
    handleTextGenerateCancel,
    pluginMenuItems,
    pluginNotice,
    runPluginAction
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
      redo,
      addPluginChildren
    },
    setNextNodeId,
    setNextEditId,
    resetInteractionState,
    topicIds,
    clearTopic
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

  const isCtrlDown = useCallback((e: KeyboardEvent): boolean => {
    return e.ctrlKey
  }, [])

  const isCtrlOrMetaDown = useCallback((e: KeyboardEvent): boolean => {
    return e.ctrlKey || e.metaKey
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
      condition: (e) => e.key === 'Enter' && !isCtrlDown(e),
      handler: () => addSiblingToLatest()
    },
    // Ctrl+Enter: テキスト編集
    {
      condition: (e) => e.key === 'Enter' && isCtrlDown(e),
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
      condition: (e) => e.key === 'ArrowUp' || (e.key === 'p' && isCtrlDown(e)),
      handler: (e) => move(MoveDirection.UP, e.shiftKey)
    },
    // 下移動: ArrowDown または Ctrl+n
    {
      condition: (e) => e.key === 'ArrowDown' || (e.key === 'n' && isCtrlDown(e)),
      handler: (e) => move(MoveDirection.DOWN, e.shiftKey)
    },
    // 右移動: ArrowRight または Ctrl+f
    {
      condition: (e) => e.key === 'ArrowRight' || (e.key === 'f' && isCtrlDown(e)),
      handler: (e) => move(MoveDirection.RIGHT, e.shiftKey)
    },
    // 左移動: ArrowLeft または Ctrl+b
    {
      condition: (e) => e.key === 'ArrowLeft' || (e.key === 'b' && isCtrlDown(e)),
      handler: (e) => move(MoveDirection.LEFT, e.shiftKey)
    },
    // F2: テキスト編集
    {
      condition: { key: 'F2' },
      handler: () => editText(getLastNode())
    },
    // Ctrl+i: 挿入モードでテキスト編集
    {
      condition: (e) => e.key === 'i' && isCtrlDown(e),
      handler: () => editText(getLastNode(), true)
    },
    // Space: 折りたたみ切り替え
    {
      condition: { key: ' ' },
      handler: () => toggleFold()
    },
    // 英数字キー: 挿入モードでテキスト編集
    {
      condition: (e) => e.keyCode >= 49 && e.keyCode <= 90 && !isCtrlOrMetaDown(e),
      handler: () => editText(getLastNode(), true),
      preventDefault: false
    }
  ])

  // TextInputのprops用意
  let textInputState = null
  // editingState は、編集中のノードのデータ構造.
  const editingState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
  if (editingState != null) {
    // 編集中のノードがあった場合、そのノードの描画情報を取得.
    const editingDrawState = drawStateMap[editingState.id]
    // TextInputのpropsを作成.
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const picked = pickNodeAt(e)
    if (picked == null || isDummy(picked)) {
      setContextMenu(null)
      return
    }
    selectOnly(picked)
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: picked.id })
  }

  const topicSummaries = topicNodes(rootState, topicIds)
  const topicIdSet = new Set(pruneTopicIds(topicIds, rootState))
  const menuItems =
    contextMenu == null
      ? []
      : [
          {
            key: 'topic',
            label: topicIdSet.has(contextMenu.nodeId) ? '話題から外す' : '話題に追加'
          },
          ...pluginMenuItems.map((item) => ({
            key: `plugin:${item.pluginId}:${item.actionId}`,
            label: item.label
          }))
        ]

  const svgClassName = darkMode ? 'flex-grow h-full bg-black' : 'flex-grow h-full bg-white'

  return (
    <>
      <svg
        ref={svgRef}
        className={svgClassName}
        onMouseDown={(e) => {
          if (e.button === 0) {
            setContextMenu(null)
          }
          handleMouseDown(e)
        }}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
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
              topicIds={topicIdSet}
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
      {contextMenu != null && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          darkMode={darkMode}
          onClose={closeContextMenu}
          onSelect={(key) => {
            const node = findNode(rootState, (state) => state.id === contextMenu.nodeId)
            setContextMenu(null)
            if (node == null) {
              return
            }
            if (key === 'topic') {
              toggleTopic(node.id)
              return
            }
            if (!key.startsWith('plugin:')) {
              return
            }
            const rest = key.slice('plugin:'.length)
            const splitAt = rest.indexOf(':')
            if (splitAt <= 0) {
              return
            }
            const pluginId = rest.slice(0, splitAt)
            const actionId = rest.slice(splitAt + 1)
            runPluginAction(pluginId, actionId, buildPluginNodeContext(rootState, node))
          }}
        />
      )}
      <TopicBar
        nodes={topicSummaries}
        darkMode={darkMode}
        onFocus={(id) => {
          const node = findNode(rootState, (state) => state.id === id)
          if (node != null) {
            selectOnly(node)
          }
        }}
        onRemove={removeTopic}
      />
      {pluginNotice != null && (
        <div
          className={
            'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-md text-sm border border-zinc-500 ' +
            (darkMode ? 'bg-black text-white' : 'bg-white text-black')
          }
        >
          {pluginNotice}
        </div>
      )}
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
