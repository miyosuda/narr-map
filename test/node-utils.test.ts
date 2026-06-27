import { describe, it, expect } from 'vitest'
import { getNodeStateFromSaving, updateNodes } from '../src/utils/node-utils'
import { getMaxNodeId } from '../src/utils/node-utils'

describe('SavingNodeState', () => {
  it('can be converted to NodeState', () => {
    const savingState = {
      text: '0',
      symbol: null,
      shiftX: 0,
      shiftY: 0,
      selected: false,
      folded: false,
      isLeft: false,
      children: [
        {
          text: '1',
          symbol: null,
          shiftX: 0,
          shiftY: 0,
          selected: false,
          folded: false,
          isLeft: false,
          children: [],
          accompaniedState: null
        },
        {
          text: '2',
          symbol: null,
          shiftX: 0,
          shiftY: 0,
          selected: false,
          folded: false,
          isLeft: false,
          children: [
            {
              text: '3',
              symbol: null,
              shiftX: 0,
              shiftY: 0,
              selected: false,
              folded: false,
              isLeft: false,
              children: [],
              accompaniedState: null
            },
            {
              text: '4',
              symbol: null,
              shiftX: 0,
              shiftY: 0,
              selected: false,
              folded: false,
              isLeft: false,
              children: [
                {
                  text: '5',
                  symbol: null,
                  shiftX: 0,
                  shiftY: 0,
                  selected: false,
                  folded: false,
                  isLeft: false,
                  children: [],
                  accompaniedState: null
                }
              ],
              accompaniedState: null
            }
          ],
          accompaniedState: null
        }
      ],
      accompaniedState: {
        text: '',
        symbol: null,
        shiftX: 0,
        shiftY: 0,
        selected: false,
        folded: false,
        isLeft: true,
        children: [
          {
            text: '6',
            symbol: null,
            shiftX: 0,
            shiftY: 0,
            selected: true,
            folded: false,
            isLeft: true,
            children: [],
            accompaniedState: null
          }
        ],
        accompaniedState: null
      }
    }

    const state = getNodeStateFromSaving(savingState)

    expect(state.id).toBe(0)
    expect(state.text).toBe('0')
    expect(state.children.length).toBe(2)

    expect(state.children[0].text).toBe('1')
    expect(state.children[0].parent).toBe(state)
    expect(state.children[0].parent.id).toBe(state.id)
    expect(state.accompaniedState.children[0].parent).toBe(state.accompaniedState)

    expect(state.children[1].children.length).toBe(2)
    expect(state.children[1].children[0].text).toBe('3')
    expect(state.accompaniedState.text).toBe('')
    expect(state.accompaniedState.children.length).toBe(1)
    expect(state.accompaniedState.children[0].text).toBe('6')

    const maxNodeId = getMaxNodeId(state)
    expect(maxNodeId).toBe(7)
  })

  it('assigns ids from 0 on each load', () => {
    const savingState = {
      text: 'root',
      symbol: null,
      shiftX: 0,
      shiftY: 0,
      selected: false,
      folded: false,
      isLeft: false,
      children: [
        {
          text: 'a',
          symbol: null,
          shiftX: 0,
          shiftY: 0,
          selected: true,
          folded: false,
          isLeft: false,
          children: [],
          accompaniedState: null
        }
      ],
      accompaniedState: {
        text: '',
        symbol: null,
        shiftX: 0,
        shiftY: 0,
        selected: false,
        folded: false,
        isLeft: true,
        children: [],
        accompaniedState: null
      }
    }

    const firstLoad = getNodeStateFromSaving(savingState)
    const secondLoad = getNodeStateFromSaving(savingState)

    expect(firstLoad.id).toBe(0)
    expect(secondLoad.id).toBe(0)
    expect(firstLoad.children[0].id).toBe(1)
    expect(secondLoad.children[0].id).toBe(1)
  })

  it('preserves parent links for keyboard navigation after load', () => {
    const savingState = {
      text: 'root',
      symbol: null,
      shiftX: 0,
      shiftY: 0,
      selected: false,
      folded: false,
      isLeft: false,
      children: [
        {
          text: 'a',
          symbol: null,
          shiftX: 0,
          shiftY: 0,
          selected: true,
          folded: false,
          isLeft: false,
          children: [],
          accompaniedState: null
        }
      ],
      accompaniedState: {
        text: '',
        symbol: null,
        shiftX: 0,
        shiftY: 0,
        selected: false,
        folded: false,
        isLeft: true,
        children: [],
        accompaniedState: null
      }
    }

    const rootState = getNodeStateFromSaving(savingState)
    const lastNode = rootState.children[0]
    const targetNode = lastNode.parent!

    const newRootState0 = updateNodes(
      rootState,
      (state) => state.id === targetNode.id,
      (state) => ({ ...state, selected: true })
    )
    const newRootState1 = updateNodes(
      newRootState0,
      (state) => state.selected && state.id !== targetNode.id,
      (state) => ({ ...state, selected: false })
    )

    expect(newRootState1.selected).toBe(true)
    expect(newRootState1.children[0].selected).toBe(false)
  })
})
