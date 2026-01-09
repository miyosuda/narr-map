import { useState, useCallback } from 'react'
import { NodeDragState, NodeGhostState } from '@/types'

const DRAG_NODE = 1
const DRAG_GHOST = 2
const DRAG_BACK = 3

export const DragMode = {
  NODE: DRAG_NODE,
  GHOST: DRAG_GHOST,
  BACK: DRAG_BACK
} as const

type CanvasPosition = {
  x: number
  y: number
}

type UseDragAndDropReturn = {
  dragState: NodeDragState | null
  ghostState: NodeGhostState | null
  canvasTranslatePos: CanvasPosition
  setDragState: (state: NodeDragState | null) => void
  setGhostState: (state: NodeGhostState | null) => void
  setCanvasTranslatePos: (pos: CanvasPosition) => void
  startNodeDrag: (x: number, y: number, elementX: number, elementY: number) => void
  startGhostDrag: (
    x: number,
    y: number,
    elementX: number,
    elementY: number,
    width: number,
    height: number,
    nodeId: number
  ) => void
  startBackgroundDrag: (clientX: number, clientY: number) => void
  endDrag: () => void
  updateGhostPosition: (dx: number, dy: number) => void
  updateCanvasPosition: (dx: number, dy: number) => void
  isNodeDragging: boolean
  isGhostDragging: boolean
  isBackgroundDragging: boolean
}

type UseDragAndDropOptions = {
  initialCanvasPosition?: CanvasPosition
}

export function useDragAndDrop(
  options: UseDragAndDropOptions = {}
): UseDragAndDropReturn {
  const { initialCanvasPosition = { x: 640, y: 480 } } = options

  const [dragState, setDragState] = useState<NodeDragState | null>(null)
  const [ghostState, setGhostState] = useState<NodeGhostState | null>(null)
  const [canvasTranslatePos, setCanvasTranslatePos] =
    useState<CanvasPosition>(initialCanvasPosition)

  const startNodeDrag = useCallback(
    (x: number, y: number, elementX: number, elementY: number) => {
      setDragState({
        startX: x,
        startY: y,
        startElementX: elementX,
        startElementY: elementY,
        mode: DRAG_NODE
      })
    },
    []
  )

  const startGhostDrag = useCallback(
    (
      x: number,
      y: number,
      elementX: number,
      elementY: number,
      width: number,
      height: number,
      nodeId: number
    ) => {
      setDragState({
        startX: x,
        startY: y,
        startElementX: elementX,
        startElementY: elementY,
        mode: DRAG_GHOST
      })
      setGhostState({
        x: elementX,
        y: elementY,
        width,
        height,
        nodeId
      })
    },
    []
  )

  const startBackgroundDrag = useCallback((clientX: number, clientY: number) => {
    setDragState({
      startX: clientX,
      startY: clientY,
      startElementX: canvasTranslatePos.x,
      startElementY: canvasTranslatePos.y,
      mode: DRAG_BACK
    })
  }, [canvasTranslatePos])

  const endDrag = useCallback(() => {
    setDragState(null)
    setGhostState(null)
  }, [])

  const updateGhostPosition = useCallback((dx: number, dy: number) => {
    if (dragState && ghostState) {
      setGhostState({
        ...ghostState,
        x: dragState.startElementX + dx,
        y: dragState.startElementY + dy
      })
    }
  }, [dragState, ghostState])

  const updateCanvasPosition = useCallback((dx: number, dy: number) => {
    if (dragState) {
      setCanvasTranslatePos({
        x: dragState.startElementX + dx,
        y: dragState.startElementY + dy
      })
    }
  }, [dragState])

  return {
    dragState,
    ghostState,
    canvasTranslatePos,
    setDragState,
    setGhostState,
    setCanvasTranslatePos,
    startNodeDrag,
    startGhostDrag,
    startBackgroundDrag,
    endDrag,
    updateGhostPosition,
    updateCanvasPosition,
    isNodeDragging: dragState?.mode === DRAG_NODE,
    isGhostDragging: dragState?.mode === DRAG_GHOST,
    isBackgroundDragging: dragState?.mode === DRAG_BACK
  }
}
