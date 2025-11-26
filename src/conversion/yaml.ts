import { SavingNodeState } from '../types'

type StateType = SavingNodeState

function getStateYAMLStr(state: StateType, level: number, skip: boolean, isLeft: boolean): string {
  let output = ''

  if (!state) {
    return output
  }

  const indent = level <= 1 ? '' : '  '.repeat(level - 2)

  const hasChildren = state.children && state.children.length > 0
  // 子が1つで、その子が更に子を持たない場合はtrue
  const hasSingleLeafChild =
    state.children &&
    state.children.length === 1 &&
    (!state.children[0].children || state.children[0].children.length === 0)
  // 直下の全ての子が「子を一つだけ持ち、その孫は持たない」場合はtrue
  const childrenAllSingleLeaf =
    state.children &&
    state.children.length > 0 &&
    state.children.every(
      (ch) =>
        ch.children &&
        ch.children.length === 1 &&
        (!ch.children[0].children || ch.children[0].children.length === 0)
    )

  const tail = hasChildren ? ':' : ''

  let inlinedSingleChild = false

  if (!skip) {
    // ノードレベルに応じた出力形式の設定
    if (level === 1) {
      output += `# ${state.text}\n`
    } else {
      if (hasSingleLeafChild) {
        // 子が1つで、その子が更に子を持たない場合は 1 行に畳み込む
        const onlyChild = state.children![0]
        output += `${indent}- ${state.text}: ${onlyChild.text}\n`
        inlinedSingleChild = true
      } else {
        output += `${indent}- ${state.text}${tail}\n`
      }
    }
  }

  // 子ノードの処理
  if (state.children && state.children.length > 0) {
    if (!inlinedSingleChild) {
      if (childrenAllSingleLeaf) {
        const mappingIndent = level <= 1 ? '' : indent + '  '
        state.children.forEach((child) => {
          const onlyGrandChild = child.children![0]
          output += `${mappingIndent}${child.text}: ${onlyGrandChild.text}\n`
        })
      } else {
        state.children.forEach((child) => {
          output += getStateYAMLStr(child, level + 1, false, isLeft)
        })
      }
    }
  }

  return output
}

export function convertStateToYAML(state: StateType): string {
  let yaml = ''

  yaml += getStateYAMLStr(state, 1, false, false)
  yaml += getStateYAMLStr(state.accompaniedState, 1, true, true)

  return yaml
}
