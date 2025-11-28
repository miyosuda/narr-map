import { describe, it, expect } from 'vitest'
import { Mapping, Scalar, Sequence, stateToDocument } from '../src/conversion/ast'
import { SavingNodeState } from '../src/types'

describe('AST', () => {
  it('should convert state with single leaf children to mapping', () => {
    const state = {
      text: 'root',
      children: [
        {
          text: 'key1',
          children: [{ text: 'value1', children: [] }],
        },
        {
          text: 'key2',
          children: [{ text: 'value2', children: [] }],
        },
      ],
      accompaniedState: null,
    }

    const doc = stateToDocument(state as unknown as SavingNodeState)

    expect(doc.kind).toBe('document')
    expect(doc.title).toBe('root')
    expect(doc.body.kind).toBe('mapping')

    if (doc.body.kind === 'mapping') {
      expect(doc.body.entries.length).toBe(2)
      expect(doc.body.entries[0].key).toBe('key1')
      expect(doc.body.entries[0].value.kind).toBe('scalar')
      expect((doc.body.entries[0].value as Scalar).value).toBe('value1')

      expect(doc.body.entries[1].key).toBe('key2')
      expect(doc.body.entries[1].value.kind).toBe('scalar')
      expect((doc.body.entries[1].value as Scalar).value).toBe('value2')
    }
  })

  it('should convert state with nested children to mapping', () => {
    const state = {
      text: 'root',
      children: [
        {
          text: 'item1',
          children: [
            { text: 'sub1', children: [] },
            { text: 'sub2', children: [] },
          ],
        },
      ],
      accompaniedState: null,
    }

    const doc = stateToDocument(state as unknown as SavingNodeState)

    expect(doc.kind).toBe('document')
    expect(doc.body.kind).toBe('mapping')
    const mapping = doc.body as unknown as Mapping

    expect(mapping.entries.length).toBe(1)
    expect(mapping.entries[0].key).toBe('item1')
    expect(mapping.entries[0].value.kind).toBe('sequence')    
    const sequence = mapping.entries[0].value as unknown as Sequence

    expect(sequence.items.length).toBe(2)
    expect(sequence.items[0].kind).toBe('scalar')
    expect((sequence.items[0] as Scalar).value).toBe('sub1')
    expect(sequence.items[1].kind).toBe('scalar')
    expect((sequence.items[1] as Scalar).value).toBe('sub2')
  })

  it('should merge accompaniedState children into body', () => {
    const state = {
      text: 'root',
      children: [
        { text: 'right1', children: [] },
      ],
      accompaniedState: {
        text: null,
        children: [
          { text: 'left1', children: [] },
        ],
      },
    }

    const doc = stateToDocument(state as unknown as SavingNodeState)

    expect(doc.body.kind).toBe('sequence')
    if (doc.body.kind === 'sequence') {
      expect(doc.body.items.length).toBe(2)
    }
  })
})
