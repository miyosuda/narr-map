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
/*
function hasSingleLeafChild(state: StateType): boolean {
  return (
    state.children &&
    state.children.length === 1 &&
    isLeaf(state.children[0])
  )
}
*/

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

  //..
  // 子が1つで、その子が孫を持たない場合は Entry
  // (stateがkey, childがvalue)
  /*
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
  */
  //..

  // valueは Mapping, Sequence, Scalar のいずれか (=名前を持たないもの)
  const value = convertStatesToNode(state.children!)

  // 空文字列の場合は直接値を返す
  // これにより、Sequence の要素として Mapping, Sequence, Scalar を直接持てる
  if(state.text === '') {
    return value
  }

  return {
    kind: 'entry',
    key: state.text,
    value,
  }
}

/**
 * 子ノード群を中間表現に変換
 */
function convertStatesToNode(children: StateType[]): Node {
  if(children.length === 1 && isLeaf(children[0])) {
    return {
      kind: 'scalar',
      value: children[0].text,
    }
  }

  const values = children.map((child) => convertStateToNode(child))

  // 全ての子が Entry の場合
  if(values.every((value) => value.kind === 'entry')) {
    // Mappingとして返す
    return {
      kind: 'mapping',
      entries: values.map((value) => value),
    }
  }

  // それ以外は Sequence として扱う
  return {
    kind: 'sequence',
    items: values,
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

