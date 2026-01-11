import { useState, useMemo, useCallback, RefObject } from 'react'
import { NodeState, NodeDrawStateMapType, Range } from '@/types'
import { getExtendedChildren } from '@/utils/node-utils'

type CanvasPosition = {
  x: number
  y: number
}

const initialRange: Range = {
  left: Number.POSITIVE_INFINITY,
  right: Number.NEGATIVE_INFINITY,
  top: Number.POSITIVE_INFINITY,
  bottom: Number.NEGATIVE_INFINITY
}

const getRange = (
  state: NodeState,
  drawStateMap: NodeDrawStateMapType,
  range: Range = initialRange
): Range => {
  const drawState = drawStateMap[state.id]

  const left = Math.min(range.left, drawState.x)
  const right = Math.max(range.right, drawState.x + drawState.width)
  const top = Math.min(range.top, drawState.y)
  const bottom = Math.max(range.bottom, drawState.y + drawState.height)

  const newRange = {
    left,
    right,
    top,
    bottom
  }

  const f = (r: Range, s: NodeState): Range => {
    return getRange(s, drawStateMap, r)
  }

  if (state.folded) {
    return newRange
  } else {
    const children = getExtendedChildren(state)
    return children.reduce(f, newRange)
  }
}

type UseCanvasTransformOptions = {
  initialPosition?: CanvasPosition
}

type UseCanvasTransformParams = {
  rootState: NodeState
  drawStateMap: NodeDrawStateMapType
  svgRef: RefObject<SVGSVGElement | null>
}

export function useCanvasTransform(
  params: UseCanvasTransformParams,
  options: UseCanvasTransformOptions = {}
) {
  const { rootState, drawStateMap, svgRef } = params
  const { initialPosition = { x: 640, y: 480 } } = options

  const [canvasTranslatePos, setCanvasTranslatePos] = useState<CanvasPosition>(initialPosition)

  const canvasTransform = useMemo(
    () => `translate(${canvasTranslatePos.x},${canvasTranslatePos.y})`,
    [canvasTranslatePos.x, canvasTranslatePos.y]
  )

  const recenter = useCallback(() => {
    if (!svgRef.current) {
      return
    }

    const range = getRange(rootState, drawStateMap)

    const centerX = (range.left + range.right) * 0.5
    const centerY = (range.top + range.bottom) * 0.5

    const width = svgRef.current.width.baseVal.value
    const height = svgRef.current.height.baseVal.value

    setCanvasTranslatePos({ x: width / 2 - centerX, y: height / 2 - centerY })
  }, [rootState, drawStateMap, svgRef])

  return {
    canvasTranslatePos,
    setCanvasTranslatePos,
    canvasTransform,
    recenter
  }
}
