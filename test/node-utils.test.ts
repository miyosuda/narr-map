import { describe, it, expect } from 'vitest'
import { getNodeStateFromSaving, cloneNodeState } from '../src/utils/node-utils'
import { getMaxNodeId } from '../src/utils/node-utils'

describe('SavingNodeState', () => {
  it('can be converted to NodeState', () => {
    const savingState = {
      'text': '0',
      'symbol': null,
      'shiftX': 0,
      'shiftY': 0,
      'selected': false,
      'folded': false,
      'isLeft': false,
      'children': [
        {
          'text': '1',
          'symbol': null,
          'shiftX': 0,
          'shiftY': 0,
          'selected': false,
          'folded': false,
          'isLeft': false,
          'children': [],
          'accompaniedState': null
        },
        {
          'text': '2',
          'symbol': null,
          'shiftX': 0,
          'shiftY': 0,
          'selected': false,
          'folded': false,
          'isLeft': false,
          'children': [
            {
              'text': '3',
              'symbol': null,
              'shiftX': 0,
              'shiftY': 0,
              'selected': false,
              'folded': false,
              'isLeft': false,
              'children': [],
              'accompaniedState': null
            },
            {
              'text': '4',
              'symbol': null,
              'shiftX': 0,
              'shiftY': 0,
              'selected': false,
              'folded': false,
              'isLeft': false,
              'children': [
                {
                  'text': '5',
                  'symbol': null,
                  'shiftX': 0,
                  'shiftY': 0,
                  'selected': false,
                  'folded': false,
                  'isLeft': false,
                  'children': [],
                  'accompaniedState': null
                }
              ],
              'accompaniedState': null
            }
          ],
          'accompaniedState': null
        }
      ],
      'accompaniedState': {
        'text': '',
        'symbol': null,
        'shiftX': 0,
        'shiftY': 0,
        'selected': false,
        'folded': false,
        'isLeft': true,
        'children': [
          {
            'text': '6',
            'symbol': null,
            'shiftX': 0,
            'shiftY': 0,
            'selected': true,
            'folded': false,
            'isLeft': true,
            'children': [],
            'accompaniedState': null
          }
        ],
        'accompaniedState': null
      }
    };
    
    const state = getNodeStateFromSaving(savingState);

    expect(state.id).toBe(0);
    expect(state.text).toBe('0');
    expect(state.children.length).toBe(2);

    expect(state.children[0].text).toBe('1');
    expect(state.children[0].parent.text).toBe('0');
    
    expect(state.children[1].children.length).toBe(2);
    expect(state.children[1].children[0].text).toBe('3');
    expect(state.accompaniedState.text).toBe('');
    expect(state.accompaniedState.children.length).toBe(1);
    expect(state.accompaniedState.children[0].text).toBe('6');

    const maxNodeId = getMaxNodeId(state);
    expect(maxNodeId).toBe(7);
  });
})
