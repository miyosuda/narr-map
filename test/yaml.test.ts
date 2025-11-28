import { describe, it, expect } from 'vitest'
import { convertStateToYAML } from '../src/conversion/yaml'
import { SavingNodeState } from '../src/types'

describe('YAML conversion', () => {
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
section:
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

  it('should convert empty string nodes to sequence of mappings', () => {
    // 空文字列のノードを使って、Mappingを要素として持つSequenceを表現
    const state = {
      text: 'root',
      children: [
        {
          text: 'members',
          children: [
            {
              text: '',  // 空文字列
              children: [
                {
                  text: 'name',
                  children: [{ text: 'Bob', children: [] }],
                },
                {
                  text: 'job',
                  children: [{ text: 'Programmer', children: [] }],
                },
              ],
            },
            {
              text: '',  // 空文字列
              children: [
                {
                  text: 'name',
                  children: [{ text: 'Alice', children: [] }],
                },
                {
                  text: 'job',
                  children: [{ text: 'Designer', children: [] }],
                },
              ],
            },
          ],
        },
      ],
      accompaniedState: null,
    }

    const yaml = convertStateToYAML(state as unknown as SavingNodeState)

    expect(yaml).toBe(`# root
members:
  - name: Bob
    job: Programmer
  - name: Alice
    job: Designer
`)
  })
})

