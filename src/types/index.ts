export const HOVER_STATE_NONE = 0
export const HOVER_STATE_TOP = 1
export const HOVER_STATE_RIGHT = 2
export const HOVER_STATE_LEFT = 3

export const EDIT_STATE_NONE = 0
export const EDIT_STATE_NORMAL = 1
export const EDIT_STATE_INSERT = 2

// State of the node
export type NodeState = {
  id: number

  text: string
  symbol: string | null
  shiftX: number
  shiftY: number
  selected: boolean
  folded: boolean
  isLeft: boolean
  accompaniedState: NodeState | null
  children: NodeState[]

  parent: NodeState | null

  hoverState: number
  handleShown: boolean
  editId: number
  editState: number
}

// State used for rendering node
export type NodeDrawState = {
  x: number
  y: number
  width: number
  height: number
}

// State of the dragging
export type NodeDragState = {
  startX: number // drag開始時のmouse x
  startY: number // drag開始時のmouse y
  startElementX: number // drag開始時のshiftX
  startElementY: number // drag開始時のshiftY
  mode: number
}

// State of node ghost rectangle
export type NodeGhostState = {
  x: number
  y: number
  width: number
  height: number
  nodeId: number
}

export type NodeDrawStateMapType = { [key: number]: NodeDrawState }

// State of saving
export type SavingNodeState = {
  text: string
  symbol: string | null
  shiftX: number
  shiftY: number
  selected: boolean
  folded: boolean
  isLeft: boolean

  accompaniedState: SavingNodeState | null
  children: SavingNodeState[]
}
