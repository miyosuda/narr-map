import { useEffect, useRef } from 'react'

type KeyCondition = {
  key?: string
  keyCode?: number
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  alt?: boolean
}

type ShortcutHandler = (e: KeyboardEvent) => void

type Shortcut = {
  condition: KeyCondition | ((e: KeyboardEvent) => boolean)
  handler: ShortcutHandler
  preventDefault?: boolean
}

type UseKeyboardShortcutsOptions = {
  enabled?: boolean
  target?: 'body' | 'document'
}

function matchesCondition(e: KeyboardEvent, condition: KeyCondition): boolean {
  if (condition.key !== undefined && e.key !== condition.key) {
    return false
  }
  if (condition.keyCode !== undefined && e.keyCode !== condition.keyCode) {
    return false
  }
  if (condition.ctrl !== undefined && (e.ctrlKey || e.metaKey) !== condition.ctrl) {
    return false
  }
  if (condition.shift !== undefined && e.shiftKey !== condition.shift) {
    return false
  }
  if (condition.meta !== undefined && e.metaKey !== condition.meta) {
    return false
  }
  if (condition.alt !== undefined && e.altKey !== condition.alt) {
    return false
  }
  return true
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, target = 'body' } = options
  const shortcutsRef = useRef<Shortcut[]>(shortcuts)

  // 最新のショートカット定義を保持
  shortcutsRef.current = shortcuts

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // input要素などでのキー入力は無視
      if (e.target !== document.body) {
        return
      }

      for (const shortcut of shortcutsRef.current) {
        const matches =
          typeof shortcut.condition === 'function'
            ? shortcut.condition(e)
            : matchesCondition(e, shortcut.condition)

        if (matches) {
          shortcut.handler(e)
          if (shortcut.preventDefault !== false) {
            e.preventDefault()
          }
          return
        }
      }
    }

    const targetElement = target === 'body' ? document.body : document
    targetElement.addEventListener('keydown', handleKeyDown as EventListener)

    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown as EventListener)
    }
  }, [enabled, target])
}

// ヘルパー関数: キー条件を簡単に作成
export const key = (k: string, modifiers: Partial<KeyCondition> = {}): KeyCondition => ({
  key: k,
  ...modifiers
})

export const ctrl = (k: string): KeyCondition => ({ key: k, ctrl: true })
export const shift = (k: string): KeyCondition => ({ key: k, shift: true })
export const ctrlShift = (k: string): KeyCondition => ({ key: k, ctrl: true, shift: true })
