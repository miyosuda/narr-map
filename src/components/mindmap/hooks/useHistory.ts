import { useState, useCallback, useRef } from 'react'

const DEFAULT_MAX_HISTORY = 30

type UseHistoryOptions = {
  maxHistory?: number
  onDirty?: () => void
}

type UseHistoryReturn<T> = {
  state: T
  setState: (newState: T) => void
  setStateWithHistory: (newState: T) => void
  undo: () => void
  redo: () => void
  reset: (newState: T) => void
}

export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { maxHistory = DEFAULT_MAX_HISTORY, onDirty } = options

  const [state, setStateInternal] = useState<T>(initialState)
  const historyRef = useRef<T[]>([initialState])
  const cursorRef = useRef(0)
  const [, forceUpdate] = useState({})

  const setState = useCallback((newState: T) => {
    setStateInternal(newState)
  }, [])

  const setStateWithHistory = useCallback(
    (newState: T) => {
      setStateInternal(newState)

      const history = historyRef.current
      const cursor = cursorRef.current

      let newHistory: T[]
      if (cursor !== history.length - 1) {
        // カーソルが履歴の途中にある場合、それ以降を切り捨て
        newHistory = [...history.slice(0, cursor + 1), newState]
      } else {
        newHistory = [...history, newState]
      }

      if (newHistory.length > maxHistory) {
        newHistory = newHistory.slice(1)
        historyRef.current = newHistory
        // cursorは変わらない（先頭が消えるので相対位置は同じ）
      } else {
        historyRef.current = newHistory
        cursorRef.current = cursor + 1
      }

      forceUpdate({})
      onDirty?.()
    },
    [maxHistory, onDirty]
  )

  const undo = useCallback(() => {
    const cursor = cursorRef.current
    if (cursor > 0) {
      setStateInternal(historyRef.current[cursor - 1])
      cursorRef.current = cursor - 1
      forceUpdate({})
    }
  }, [])

  const redo = useCallback(() => {
    const cursor = cursorRef.current
    const history = historyRef.current
    if (cursor < history.length - 1) {
      setStateInternal(history[cursor + 1])
      cursorRef.current = cursor + 1
      forceUpdate({})
    }
  }, [])

  const reset = useCallback((newState: T) => {
    setStateInternal(newState)
    historyRef.current = [newState]
    cursorRef.current = 0
    forceUpdate({})
  }, [])

  return {
    state,
    setState,
    setStateWithHistory,
    undo,
    redo,
    reset,
  }
}
