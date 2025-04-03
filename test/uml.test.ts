import { describe, it, expect } from 'vitest'
import { convertStateToPlantUML, convertPlantUMLToState } from '../src/conversion/uml'
import { SavingNodeState } from '../src/types'

describe('UML', () => {
  it('should be able convert state to PlantUML', () => {
    const state = {
      text: 'a',
      children: [
        {
          text: 'b',
          children: []
        },
        {
          text: 'c',
          children: []
        }
      ],
      accompaniedState: {
        text: null,
        children: [
          {
            text: 'd',
            children: []
          }
        ]
      }
    }

    const uml = convertStateToPlantUML(state as unknown as SavingNodeState)

    const expectedUML = `@startmindmap
+ a
++ b
++ c
-- d
@endmindmap
`

    expect(uml).toBe(expectedUML)
  })

  it('should be able convert PlantUML to state', () => {
    const uml = `@startmindmap
+ a
++ 1
++ 2
++ 3
+++ 4
+++ 5
+++ 6
++++ 7
++ 8
++ 9
+++ 10
+++ 11
-- L1
--- L2
@endmindmap
`

    const state = convertPlantUMLToState(uml)

    expect(state.text).toBe('a')
    expect(state.isLeft).toBe(false)

    expect(state.children[0].text).toBe('1')
    expect(state.children[0].isLeft).toBe(false)

    expect(state.accompaniedState?.text).toBe(null)
    expect(state.accompaniedState?.isLeft).toBe(true)

    expect(state.accompaniedState?.children[0].text).toBe('L1')
    expect(state.accompaniedState?.children[0].isLeft).toBe(true)
  })
})
