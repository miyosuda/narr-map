import { useState, useEffect, useRef } from 'react'

import { NodeState, SavingNodeState, EDIT_STATE_NONE } from '@/types'
import {
  PluginActionResponse,
  PluginChildSpec,
  PluginMenuEntry,
  PluginNodeContext
} from '@/plugins/types'

type PastePayload = { nodes?: SavingNodeState[] | null; text?: string }
import {
  getSavingNodeState,
  getNodeStateFromSaving,
  getMaxNodeId,
  findNode
} from '@/utils/node-utils'

const { nmAPI } = window

/**
 * ノード編集系のコマンド。useMindMapIO はこれらの実体を持たず、
 * commandHandlers / handleMessage 経由で呼び出すだけにする。
 */
export type MindMapCommands = {
  copy: () => void
  paste: (obj?: PastePayload) => void
  cut: () => void
  selectAll: () => void
  undo: () => void
  redo: () => void
  addPluginChildren: (nodeId: number, specs: PluginChildSpec[]) => 'applied' | 'empty' | 'missing'
}

type UseMindMapIOParams = {
  /** 現在の rootState（save/export/complete/handleMessage で参照） */
  rootState: NodeState
  /** 新規作成時の初期 rootState */
  initialRootState: NodeState
  /** 履歴付きで rootState を更新する（completed で利用） */
  setRootStateWithHistory: (state: NodeState) => void
  /** 履歴をリセットして rootState を差し替える（load/newFile で利用） */
  resetRootState: (state: NodeState) => void
  /** ノード編集系コマンド */
  commands: MindMapCommands
  /** Node ID / Edit ID の採番をリセットする（load/newFile で利用） */
  setNextNodeId: (id: number) => void
  setNextEditId: (id: number) => void
  /** drag/ghost/cursor/copy などの一時状態をリセットする（load/newFile で利用） */
  resetInteractionState: () => void
}

/**
 * nmAPI を介した IPC（保存・エクスポート・読み込み・補完・テキストインポート）と、
 * メインプロセスから受け取ったコマンドのルーティング、
 * および darkMode / connecting / トーストといった UI フラグ state を管理するフック。
 */
export function useMindMapIO(params: UseMindMapIOParams) {
  const {
    rootState,
    initialRootState,
    setRootStateWithHistory,
    resetRootState,
    commands,
    setNextNodeId,
    setNextEditId,
    resetInteractionState
  } = params

  const [darkMode, setDarkMode] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [copiedToastVisible, setCopiedToastVisible] = useState(false)
  const [textImportModalOpen, setTextImportModalOpen] = useState(false)
  const [isTextGenerating, setIsTextGenerating] = useState(false)
  const [pluginMenuItems, setPluginMenuItems] = useState<PluginMenuEntry[]>([])
  const [pluginNotice, setPluginNotice] = useState<string | null>(null)

  const toastTimerRef = useRef<number | null>(null)
  const pluginNoticeTimerRef = useRef<number | null>(null)
  const pluginRequestRef = useRef(0)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
      if (pluginNoticeTimerRef.current != null) {
        window.clearTimeout(pluginNoticeTimerRef.current)
        pluginNoticeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    nmAPI
      .invoke('get-plugins')
      .then((items: PluginMenuEntry[] | null) => {
        if (!cancelled && Array.isArray(items)) {
          setPluginMenuItems(items)
        }
      })
      .catch((error: unknown) => {
        console.error(error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const showPluginNotice = (message: string) => {
    setPluginNotice(message)
    if (pluginNoticeTimerRef.current != null) {
      window.clearTimeout(pluginNoticeTimerRef.current)
    }
    pluginNoticeTimerRef.current = window.setTimeout(() => {
      setPluginNotice(null)
      pluginNoticeTimerRef.current = null
    }, 3500)
  }

  const showCopiedToast = () => {
    setCopiedToastVisible(true)
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setCopiedToastVisible(false)
      toastTimerRef.current = null
    }, 1000)
  }

  const save = () => {
    const savingRootState = getSavingNodeState(rootState)
    nmAPI.sendMessage('response-save', savingRootState)
  }

  const export_ = (format: string) => {
    const savingRootState = getSavingNodeState(rootState)
    nmAPI.sendMessage('response-export', [savingRootState, format])
  }

  const clipboardExport = (format: string) => {
    const savingRootState = getSavingNodeState(rootState)
    nmAPI.sendMessage('response-clipboard-export', [savingRootState, format])
    showCopiedToast()
  }

  const handleTextGenerate = (text: string) => {
    setIsTextGenerating(true)
    nmAPI.sendMessage('response-text-generate', text)
  }

  const handleTextImportComplete = (result: {
    success: boolean
    state?: SavingNodeState
    error?: string
  }) => {
    setIsTextGenerating(false)
    setTextImportModalOpen(false)
    if (result.success && result.state) {
      load(result.state)
    } else {
      // エラーの場合はコンソールにログ出力（必要に応じてUIで表示）
      console.error('Text import failed:', result.error)
    }
  }

  const handleTextImportModalClose = () => {
    if (!isTextGenerating) {
      setTextImportModalOpen(false)
    }
  }

  const handleTextGenerateCancel = () => {
    nmAPI.sendMessage('cancel-text-generate', null)
    setIsTextGenerating(false)
    setTextImportModalOpen(false)
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

    resetRootState(newRootState)
    setNextNodeId(maxNodeId + 1)
    setNextEditId(maxNodeId + 1)

    resetInteractionState()
  }

  const newFile = () => {
    resetRootState(initialRootState)
    setNextNodeId(2)
    setNextEditId(2)

    resetInteractionState()
  }

  const runPluginAction = (pluginId: string, actionId: string, node: PluginNodeContext) => {
    const requestId = pluginRequestRef.current + 1
    pluginRequestRef.current = requestId
    setConnecting(true)
    setPluginNotice(null)
    nmAPI.sendMessage('plugin-action', { requestId, pluginId, actionId, node })
  }

  const handlePluginResult = (message: PluginActionResponse) => {
    if (message.requestId !== pluginRequestRef.current) {
      return
    }
    setConnecting(false)
    if (message.ok === false) {
      if (message.aborted === true) {
        return
      }
      if (typeof message.error === 'string' && message.error !== '') {
        showPluginNotice(message.error)
      }
      return
    }
    const status = commands.addPluginChildren(message.nodeId, message.addChildren)
    if (status === 'empty') {
      showPluginNotice('No nodes to add')
    } else if (status === 'missing') {
      showPluginNotice('The node is no longer available')
    }
  }

  const commandHandlers: Record<string, (obj?: any) => void> = {
    copy: () => commands.copy(),
    paste: (obj) => commands.paste(obj),
    cut: () => commands.cut(),
    selectall: () => commands.selectAll(),
    redo: () => commands.redo(),
    undo: () => commands.undo(),
    save: () => save(),
    load: (obj) => load(obj),
    export: (obj) => export_(obj),
    'new-file': () => newFile(),
    complete: () => complete(),
    completed: (obj) => completed(obj),
    'dark-mode': (obj) => setDarkMode(obj),
    'clipboard-export': (obj) => clipboardExport(obj),
    'open-text-import-modal': () => setTextImportModalOpen(true),
    'text-import-complete': (obj) => handleTextImportComplete(obj),
    'plugin-action-result': (obj) => handlePluginResult(obj),
    'async-cancelled': () => {
      pluginRequestRef.current += 1
      setConnecting(false)
      setIsTextGenerating(false)
      setTextImportModalOpen(false)
    }
  }

  function handleCommand(command: string, obj: any) {
    commandHandlers[command]?.(obj)
  }

  function handleMessage(arg: string, obj: any) {
    if (arg === 'plugin-action-result' || arg === 'async-cancelled') {
      handleCommand(arg, obj)
      return
    }

    // textInput表示中かどうか
    const editingNodeState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
    if (editingNodeState != null) {
      // textInput表示中だった場合はTextInput側が処理する
    } else if (textImportModalOpen) {
      // TextImportModal表示中だった場合はTextImportModal側が処理する
      // ただし、モーダル関連のコマンドは処理する
      if (arg === 'text-import-complete') {
        handleCommand(arg, obj)
      }
    } else {
      // textInput表示中でない場合
      handleCommand(arg, obj)
    }
  }

  // メッセージハンドラー用のref（イベントリスナーから最新のstateを参照するため）
  const handleMessageRef = useRef<(arg: string, obj: any) => void>(() => {})
  handleMessageRef.current = handleMessage

  // メッセージハンドラーの設定（一度だけ実行）
  useEffect(() => {
    const offFunc = nmAPI.onReceiveMessage((arg: string, obj: any) => {
      handleMessageRef.current(arg, obj)
    })
    return offFunc
  }, [])

  return {
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
  }
}
