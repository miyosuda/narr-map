import { describe, it, expect } from 'vitest'
import { stateToDocument, Document, Node } from '../src/conversion/ast'
import { convertStateToYAML, documentToYaml } from '../src/conversion/yaml'
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
      expect(doc.body.entries[1].key).toBe('key2')
    }
  })

  it('should convert state with nested children to sequence', () => {
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
    expect(doc.body.kind).toBe('sequence')
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

describe('YAML', () => {
  it('should convert simple state to YAML', () => {
    const state = {
      text: 'root',
      children: [
        { text: 'item1', children: [] },
        { text: 'item2', children: [] },
      ],
      accompaniedState: null,
    }

    const yaml = convertStateToYAML(state as unknown as SavingNodeState)

    expect(yaml).toBe(`# root
- item1
- item2
`)
  })

  it('should convert state with single leaf children to mapping YAML', () => {
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

    const yaml = convertStateToYAML(state as unknown as SavingNodeState)

    expect(yaml).toBe(`# root
key1: value1
key2: value2
`)
  })

  it('should convert nested state to YAML', () => {
    const state = {
      text: 'root',
      children: [
        {
          text: 'section',
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
        },
      ],
      accompaniedState: null,
    }

    const yaml = convertStateToYAML(state as unknown as SavingNodeState)

    expect(yaml).toBe(`# root
- section:
  key1: value1
  key2: value2
`)
  })

  it('should include accompaniedState in YAML output', () => {
    const state = {
      text: 'root',
      children: [
        { text: 'right', children: [] },
      ],
      accompaniedState: {
        text: null,
        children: [
          { text: 'left', children: [] },
        ],
      },
    }

    const yaml = convertStateToYAML(state as unknown as SavingNodeState)

    expect(yaml).toBe(`# root
- right
- left
`)
  })
})

