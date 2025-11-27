import { SavingNodeState } from '../types'

// ========================================
// 汎用中間表現 - 出力形式に依存しないAST
// ========================================

// スカラー値（末端の値）
export type Scalar = {
  kind: 'scalar'
  value: string
}

// マッピングの要素（Key・Valueのペア）
export type Entry = {
  kind: 'entry'
  key: string
  value: Node
}

// マッピング（Key・Valueのペア群、順序を保持）
export type Mapping = {
  kind: 'mapping'
  entries: Entry[]
}

// シーケンス（順序付きリスト）
export type Sequence = {
  kind: 'sequence'
  items: Node[]
}

// ノードの統合型
export type Node = Scalar | Mapping | Sequence | Entry

// ドキュメント（ルート）
export type Document = {
  kind: 'document'
  title?: string // オプショナルなタイトル（YAMLではコメント、JSONでは無視）
  body: Node
}

// ========================================
// StateType → Document 変換
// ========================================

type StateType = SavingNodeState

/**
 * 子ノードがリーフ（子を持たない）かどうかを判定
 */
function isLeaf(state: StateType): boolean {
  return !state.children || state.children.length === 0
}

/**
 * 子が1つで、その子が孫を持たない場合は true
 */
function hasSingleLeafChild(state: StateType): boolean {
  return (
    state.children &&
    state.children.length === 1 &&
    isLeaf(state.children[0])
  )
}

/**
 * 全ての子が「子を一つだけ持ち、その孫は子を持たない」場合は true
 */
function childrenAllSingleLeaf(children: StateType[]): boolean {
  return (
    children.length > 0 &&
    children.every((ch) => hasSingleLeafChild(ch))
  )
}

/**
 * StateType のノードを中間表現の Node に変換
 */
function convertStateToNode(state: StateType): Node {
  // 子がない場合はスカラー (テキストもスカラーとして扱う)
  if (isLeaf(state)) {
    return {
      kind: 'scalar',
      value: state.text,
    }
  }

  // 子が1つで、その子が孫を持たない場合は Entry
  // (stateがkey, childがvalue)
  if (hasSingleLeafChild(state)) {
    return {
      kind: 'entry',
      key: state.text,
      value: {
        kind: 'scalar',
        value: state.children![0].text,
      },
    }
  }

  // 全ての子が単一リーフ子を持つ場合は Mapping として返す
  if (childrenAllSingleLeaf(state.children!)) {
    const mapping: Mapping = {
      kind: 'mapping',
      entries: state.children!.map((child) => ({
        kind: 'entry' as const,
        key: child.text,
        value: {
          kind: 'scalar' as const,
          value: child.children![0].text,
        },
      })),
    }

    // 空文字列の場合は直接 Mapping を返す（Entry でラップしない）
    // これにより、Sequence の要素として Mapping を直接持てる
    if (state.text === '') {
      return mapping
    }

    // 空文字列でない場合は Entry として返す
    return {
      kind: 'entry',
      key: state.text,
      value: mapping,
    }
  }

  // それ以外は Entry でキーがテキスト、値が Sequence
  return {
    kind: 'entry',
    key: state.text,
    value: {
      kind: 'sequence',
      items: state.children!.map((child) => convertStateToNode(child)),
    },
  }
}

/**
 * 子ノード群を中間表現に変換
 */
function convertStatesToNode(children: StateType[]): Node {
  // 全ての子が単一リーフ子を持つ場合は Mappingとして扱う
  if (childrenAllSingleLeaf(children)) {
    return {
      kind: 'mapping',
      entries: children.map((child) => ({
        kind: 'entry' as const,
        key: child.text,
        value: {
          kind: 'scalar' as const,
          value: child.children![0].text,
        },
      })),
    }
  }

  // それ以外は Sequence として扱う
  return {
    kind: 'sequence',
    items: children.map((child) => convertStateToNode(child)),
  }
}

/**
 * SavingNodeState を Document に変換
 * accompaniedState の子も統合される
 */
export function stateToDocument(state: StateType): Document {
  // 全ての子を収集（accompaniedState の子も含める）
  const allChildren: StateType[] = []

  if (state.children && state.children.length > 0) {
    allChildren.push(...state.children)
  }

  if (state.accompaniedState?.children && state.accompaniedState.children.length > 0) {
    allChildren.push(...state.accompaniedState.children)
  }

  // 子がない場合
  if (allChildren.length === 0) {
    return {
      kind: 'document',
      title: state.text,
      body: {
        kind: 'sequence',
        items: [],
      },
    }
  }

  return {
    kind: 'document',
    title: state.text,
    body: convertStatesToNode(allChildren),
  }
}

