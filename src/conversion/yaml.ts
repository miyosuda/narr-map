import { SavingNodeState } from '../types'
import { Document, Node, stateToDocument } from './ast'

// ========================================
// Document → YAML 文字列変換
// ========================================

/**
 * Node を YAML 文字列に変換（再帰）
 * @param node 変換対象のノード
 * @param level インデントレベル（0から開始）
 * @param isSequenceItem シーケンスの要素として出力するか
 */
function nodeToYaml(node: Node, level: number, isSequenceItem: boolean): string {
  const indent = '  '.repeat(level)

  switch (node.kind) {
    case 'scalar':
      if (isSequenceItem) {
        return `${indent}- ${node.value}\n`
      }
      return node.value

    case 'entry': {
      const valueNode = node.value

      if (valueNode.kind === 'scalar') {
        // Entry で値がスカラーの場合: `- key: value` または `key: value`
        if (isSequenceItem) {
          return `${indent}- ${node.key}: ${valueNode.value}\n`
        } else {
          return `${indent}${node.key}: ${valueNode.value}\n`
        }
      }

      if (valueNode.kind === 'mapping') {
        // Entry で値が Mapping の場合
        let output = ''
        if (isSequenceItem) {
          output += `${indent}- ${node.key}:\n`
        } else {
          output += `${indent}${node.key}:\n`
        }
        // Mapping の entries を出力
        valueNode.entries.forEach((entry) => {
          output += nodeToYaml(entry, level + 1, false)
        })
        return output
      }

      if (valueNode.kind === 'sequence') {
        // Entry で値が Sequence の場合
        let output = ''
        if (isSequenceItem) {
          output += `${indent}- ${node.key}:\n`
        } else {
          output += `${indent}${node.key}:\n`
        }
        // Sequence の items を出力
        valueNode.items.forEach((item) => {
          output += nodeToYaml(item, level + 1, true)
        })
        return output
      }

      // Entry が入れ子になっている場合
      return nodeToYaml(valueNode, level, isSequenceItem)
    }

    case 'mapping': {
      let output = ''
      node.entries.forEach((entry, index) => {
        if (isSequenceItem && index === 0) {
          // 最初のエントリは `- key: value` の形式で出力
          output += nodeToYaml(entry, level, true)
        } else if (isSequenceItem) {
          // 2番目以降のエントリは追加インデント（`- ` の分を補正）
          output += nodeToYaml(entry, level + 1, false)
        } else {
          output += nodeToYaml(entry, level, false)
        }
      })
      return output
    }

    case 'sequence': {
      let output = ''
      node.items.forEach((item) => {
        output += nodeToYaml(item, level, true)
      })
      return output
    }

    default:
      return ''
  }
}

/**
 * Document を YAML 文字列に変換
 */
export function documentToYaml(doc: Document): string {
  let yaml = ''

  // タイトルがあればコメントとして出力
  if (doc.title) {
    yaml += `# ${doc.title}\n`
  }

  // body を変換
  yaml += nodeToYaml(doc.body, 0, false)

  return yaml
}

/**
 * SavingNodeState を YAML 文字列に変換
 * （後方互換性のため既存のインターフェースを維持）
 */
export function convertStateToYAML(state: SavingNodeState): string {
  const doc = stateToDocument(state)
  return documentToYaml(doc)
}
