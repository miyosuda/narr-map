import { describe, it, expect } from 'vitest'
import { migrateState1to2 } from '../src/migrate'

describe('Migrate', () => {
  it('from 1 to 2', () => {
    const stateVer1 = {
      'right': {
        'text': 'test',
        'shiftX': 0,
        'shiftY': 0,
        'selected': false,
        'folded': false,
        'isLeft': false,
        'children': [
          {
            'text': '0',
            'shiftX': 0,
            'shiftY': 0,
            'selected': false,
            'folded': false,
            'isLeft': false,
            'children': []
          },
          {
            'text': '1',
            'shiftX': 0,
            'shiftY': 0,
            'selected': false,
            'folded': false,
            'isLeft': false,
            'children': [
              {
                'text': '2',
                'shiftX': 0,
                'shiftY': 0,
                'selected': false,
                'folded': false,
                'isLeft': false,
                'children': []
              }
            ]
          }
        ]
      },
      'left': {
        'text': null,
        'shiftX': 0,
        'shiftY': 0,
        'selected': false,
        'folded': false,
        'isLeft': true,
        'children': [
          {
            'text': '3',
            'shiftX': 0,
            'shiftY': 0,
            'selected': false,
            'folded': false,
            'isLeft': true,
            'children': []
          },
          {
            'text': '4',
            'shiftX': 0,
            'shiftY': 0,
            'selected': false,
            'folded': false,
            'isLeft': true,
            'children': [
              {
                'text': '5',
                'shiftX': 0,
                'shiftY': 0,
                'selected': true,
                'folded': false,
                'isLeft': true,
                'children': []
              }
            ]
          }
        ]
      }
    };
    
    const stateVer2 = migrateState1to2(stateVer1);
    expect(stateVer2.text).toBe('test');
    expect(stateVer2.isLeft).toBe(false);
    
    expect(stateVer2.children[0].text).toBe('0');
    expect(stateVer2.children[0].isLeft).toBe(false);

    expect(stateVer2.accompaniedState.text).toBe(null);
    expect(stateVer2.accompaniedState.isLeft).toBe(true);
    
    expect(stateVer2.accompaniedState.children[0].text).toBe('3');
    expect(stateVer2.accompaniedState.children[0].isLeft).toBe(true);
  });
})
