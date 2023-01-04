import { describe, it, expect } from 'vitest'
import { EditHistory } from '../src/edit-history'

describe('EditHistory', () => {
  it('should be able to construct', () => {
    const initialState = {'value' : 0};
    const editHistory : EditHistory = new EditHistory(initialState);
    
    const state0 = {'value' : 1};
    editHistory.addHistory(state0);
    
    const ret0 = editHistory.undo();
    expect(ret0).toBe(initialState);
    
    const ret1 = editHistory.redo();
    expect(ret1).toBe(state0);
  })
})
