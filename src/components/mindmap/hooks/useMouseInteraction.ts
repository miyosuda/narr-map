import { useState, useEffect, useRef, useCallback, RefObject } from 'react'

import {
  NodeState,
  NodeDrawStateMapType,
  NodeDragState,
  NodeGhostState,
  EDIT_STATE_NONE
} from '@/types'
import {
  isRoot,
  findNode,
  updateNodes
} from '@/utils/node-utils'
import {
  containsPosForHandle,
  containsPos
} from '@/utils/node-draw-utils'
import {
  applyGhostHoverStates,
  applyGhostDrop
} from '@/utils/node-interaction-utils'
import { DragMode } from '../constants'

type CanvasPosition = {
  x: number
  y: number
}

type UseMouseInteractionParams = {
  rootState: NodeState
  setRootState: (state: NodeState) => void
  setRootStateWithHistory: (state: NodeState) => void
  drawStateMap: NodeDrawStateMapType
  canvasTranslatePos: CanvasPosition
  setCanvasTranslatePos: (pos: CanvasPosition) => void
  nextEditId: number
  setNextEditId: (id: number) => void
  recenter: () => void
  editText: (targetNode: NodeState) => void
  getLastNode: () => NodeState
  svgRef: RefObject<SVGSVGElement | null>
  canvasRef: RefObject<SVGSVGElement | null>
}

export function useMouseInteraction(params: UseMouseInteractionParams) {
  const {
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
  } = params

  const [dragState, setDragState] = useState<NodeDragState | null>(null)
  const [ghostState, setGhostState] = useState<NodeGhostState | null>(null)

  const resetDrag = useCallback(() => {
    setDragState(null)
    setGhostState(null)
  }, [])

  const getLocalPos = useCallback(
    (e: React.MouseEvent) => {
      const pos = svgRef.current!.createSVGPoint()
      pos.x = e.clientX
      pos.y = e.clientY
      const canvasLocalPos = pos.matrixTransform(canvasRef.current!.getScreenCTM()!.inverse())
      return canvasLocalPos
    },
    [svgRef, canvasRef]
  )

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
      return
    }

    const editingNodeState = findNode(rootState, (state) => state.editState !== EDIT_STATE_NONE)
    if (editingNodeState != null) {
      return
    }

    const { x: px, y: py } = getLocalPos(e)

    function pickNodeForHandle(state: NodeState): boolean {
      return containsPosForHandle(state, px, py, drawStateMap)
    }

    function pickNode(state: NodeState): boolean {
      return containsPos(state, px, py, drawStateMap)
    }

    const pickedNodeForHandle = findNode(rootState, pickNodeForHandle)
    const pickedNode = findNode(rootState, pickNode)

    const shiftDown = e.shiftKey

    if (pickedNodeForHandle != null) {
      handleMouseDownForHandle(px, py, pickedNodeForHandle)
    } else if (pickedNode != null) {
      handleMouseDownForNode(px, py, shiftDown, pickedNode)
    } else {
      handleMouseDownForBack(e.clientX, e.clientY)
    }

    if (document.activeElement === document.body) {
      e.preventDefault()
    }
  }

  function handleMouseMoveForHandle(px: number, py: number) {
    const dx = px - dragState!.startX
    const dy = py - dragState!.startY

    const draggingNode = findNode(rootState, (state) => state.handleShown)
    if (draggingNode != null) {
      const newRootState = updateNodes(
        rootState,
        (state) => state.id === draggingNode!.id,
        (state) => ({
          ...state,
          shiftX: dragState!.startElementX + dx,
          shiftY: dragState!.startElementY + dy
        })
      )
      setRootState(newRootState)
    }
  }

  function handleMouseMoveForGhost(px: number, py: number) {
    const dx = px - dragState!.startX
    const dy = py - dragState!.startY

    setGhostState({
      ...ghostState!,
      x: dragState!.startElementX + dx,
      y: dragState!.startElementY + dy
    })

    const newRootState = applyGhostHoverStates(
      rootState,
      drawStateMap,
      ghostState!.nodeId,
      px,
      py
    )
    setRootState(newRootState)
  }

  function handleMouseMoveForBack(clientX: number, clientY: number) {
    const dx = clientX - dragState!.startX
    const dy = clientY - dragState!.startY

    setCanvasTranslatePos({ x: dragState!.startElementX + dx, y: dragState!.startElementY + dy })
  }

  function handleMouseMoveForHandleHover(node: NodeState) {
    const newRootState = updateNodes(
      rootState,
      () => true,
      (state) => ({
        ...state,
        handleShown: state.id === node!.id
      })
    )
    setRootState(newRootState)
  }

  function handleMouseMoveForNone() {
    const handleShownNode = findNode(rootState, (state) => state.handleShown)
    if (handleShownNode !== null) {
      const newRootState = updateNodes(
        rootState,
        () => true,
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
      return
    }

    const { x: px, y: py } = getLocalPos(e)

    if (dragState != null) {
      if (dragState.mode === DragMode.NODE) {
        handleMouseMoveForHandle(px, py)
      } else if (dragState.mode === DragMode.GHOST) {
        handleMouseMoveForGhost(px, py)
      } else if (dragState.mode === DragMode.BACK) {
        handleMouseMoveForBack(e.clientX, e.clientY)
      }
    } else {
      const pickedNodeForHandle = findNode(rootState, (state) =>
        containsPosForHandle(state, px, py, drawStateMap)
      )
      if (pickedNodeForHandle != null) {
        handleMouseMoveForHandleHover(pickedNodeForHandle)
      } else {
        handleMouseMoveForNone()
      }
    }
  }

  function handleMouseUpForNode() {
    const draggingNode = findNode(rootState, (state) => state.handleShown)
    if (draggingNode != null) {
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
    const ghostOrgNodeId = ghostState!.nodeId

    const { hoverCleared, moved } = applyGhostDrop(rootState, ghostOrgNodeId)
    setRootState(hoverCleared)
    setGhostState(null)

    if (moved != null) {
      setRootStateWithHistory(moved)
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (e.button !== 0) {
      return
    }

    if (dragState != null) {
      if (dragState.mode === DragMode.NODE) {
        handleMouseUpForNode()
      } else if (dragState.mode === DragMode.GHOST) {
        handleMouseUpForGhost()
      }

      setDragState(null)
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (e.button !== 0) {
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

  const handleMouseUpRef = useRef<(e: MouseEvent) => void>(() => {})
  handleMouseUpRef.current = handleMouseUp

  useEffect(() => {
    const mouseUpHandler = (e: MouseEvent) => handleMouseUpRef.current(e)
    document.addEventListener('mouseup', mouseUpHandler)

    return () => {
      document.removeEventListener('mouseup', mouseUpHandler)
    }
  }, [])

  return {
    ghostState,
    handleMouseDown,
    handleMouseMove,
    handleDoubleClick,
    resetDrag
  }
}
