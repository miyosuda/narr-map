import { NodeState, ChatInputNodeState } from '../types'
import { getExtendedChildren } from './node-utils'

// TOOD: exportしなくて良くなった
export function getChatInputNodeState(state: NodeState): ChatInputNodeState {
  const chatState : ChatInputNodeState = {
    text : state.text,
    symbol : state.symbol,
    children : null,
  };

  // TODO: accompaniedをスキップする様なextendが必要
  const children = getExtendedChildren(state);
  
  const chatStateChildren = children.map(childState => {
    return getChatInputNodeState(childState);
  });

  if(chatStateChildren.length > 0) {
    chatState.children = chatStateChildren;
  }
  
  return chatState;
}


export function containsSymbol(text: string): boolean {
  const regex = /\{(\w+)\}/;
  const match = regex.exec(text);
  return match != null;
}


// TOOD: exportしなくて良くなった
export function collectSymbols(text: string): string[] | null {
  const regex = /\{(\w+)\}/g;
  const symbols = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    symbols.push(match[1]);
  }
  return symbols.length > 0 ? symbols : null;
}


export function getMindmapInputPrompt(text: string, state: NodeState): string {
  const chatInputNodeState = getChatInputNodeState(state);
  const symbols = collectSymbols(text);

  const symbolsLine = symbols.map((symbol) => `{${symbol}}`).join(', ');
  const rawSymbolsLine = symbols.map((symbol) => `"${symbol}"`).join(', ');

  // json変換時にnullのエントリを消すためのreplaceer
  const replacer = (key:string, value:any) => {
    return value === null ? undefined : value;
  };

  const mindMapJson = JSON.stringify(chatInputNodeState, replacer);

  const prompt = `
  上記の記述の中で ${symbolsLine} は下記のjsonの中のsymbolキーの値が${rawSymbolsLine}であるnodeのことを指します。

  \`\`\`
  ${mindMapJson}
  \`\`\`

　その上で返答を行ってください。
  `
  
  return prompt;
}
