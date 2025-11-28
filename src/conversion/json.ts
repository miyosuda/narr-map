import { SavingNodeState } from '../types'
import { Document, Node, stateToDocument } from './ast'

// ========================================
// Document → JSON 文字列変換
// ========================================

/**
 * Node を JSON 用のオブジェクトに変換（再帰）
 */
function nodeToJsonValue(node: Node): unknown {
  switch (node.kind) {
    case 'scalar':
      return node.value

    case 'entry': {
      // Entry 単体は { key: value } として返す
      const result: Record<string, unknown> = {}
      result[node.key] = nodeToJsonValue(node.value)
      return result
    }

    case 'mapping': {
      // Mapping は全ての entries を1つのオブジェクトにマージ
      const result: Record<string, unknown> = {}
      node.entries.forEach((entry) => {
        result[entry.key] = nodeToJsonValue(entry.value)
      })
      return result
    }

    case 'sequence': {
      // Sequence は配列として返す
      return node.items.map((item) => nodeToJsonValue(item))
    }

    default:
      return null
  }
}

/**
 * Document を JSON 文字列に変換
 */
export function documentToJson(doc: Document): string {
  const jsonValue = nodeToJsonValue(doc.body)
  return JSON.stringify(jsonValue, null, 2)
}

/**
 * SavingNodeState を JSON 文字列に変換
 */
export function convertStateToJSON(state: SavingNodeState): string {
  const doc = stateToDocument(state)
  return documentToJson(doc)
}

