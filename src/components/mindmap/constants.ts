export const MoveDirection = {
  UP: 1,
  DOWN: 2,
  RIGHT: 3,
  LEFT: 4,
} as const

export type MoveDirectionType = (typeof MoveDirection)[keyof typeof MoveDirection]

export const DragMode = {
  NODE: 1,
  GHOST: 2,
  BACK: 3
} as const

export type DragModeType = (typeof DragMode)[keyof typeof DragMode]
