import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ContextMenuEntry = {
  key: string
  label: string
}

type NodeContextMenuProps = {
  x: number
  y: number
  items: ContextMenuEntry[]
  darkMode: boolean
  onSelect: (key: string) => void
  onClose: () => void
}

export const NodeContextMenu = (props: NodeContextMenuProps) => {
  const { x, y, items, darkMode, onSelect, onClose } = props
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (el == null) {
      return
    }
    const rect = el.getBoundingClientRect()
    let nextX = x
    let nextY = y
    if (rect.right > window.innerWidth) {
      nextX = Math.max(4, window.innerWidth - rect.width - 4)
    }
    if (rect.bottom > window.innerHeight) {
      nextY = Math.max(4, window.innerHeight - rect.height - 4)
    }
    setPos({ x: nextX, y: nextY })
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current != null && !menuRef.current.contains(event.target as globalThis.Node)) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  if (items.length === 0) {
    return null
  }

  const className =
    'fixed z-50 min-w-[10rem] border border-zinc-500 shadow-md ' +
    (darkMode ? 'bg-black text-white' : 'bg-white text-black')

  return (
    <div ref={menuRef} className={className} style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={
            'block w-full px-3 py-1.5 text-left text-sm whitespace-nowrap ' +
            (darkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200')
          }
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
