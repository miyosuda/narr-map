export const MoveDirection = {
  UP: 1,
  DOWN: 2,
  RIGHT: 3,
  LEFT: 4,
} as const

export type MoveDirectionType = (typeof MoveDirection)[keyof typeof MoveDirection]
