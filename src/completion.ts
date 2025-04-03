import OpenAI from 'openai';


import { NodeState } from './types'
import { convertStateToPlantUML, convertPlantUMLToState } from './conversion/uml';
import { cloneNodeState } from './utils/node-utils';


const COMPLETION_MODEL : string = 'gpt-4o';


class CompletionNode {
  state : NodeState;
  children : Array<CompletionNode> = []
  targetIndex : number = -1;
  completed : boolean = false;
  
  constructor(state : NodeState) {
    this.state = state;
  }

  isEmpty() {
    return this.state.text == '';
  }
  
  addChildNode(node : CompletionNode) {
    this.children.push(node);
  }

  setTargetIndex(targetIndex : number) {
    this.targetIndex = targetIndex;
    this.state.text = `{{${targetIndex}}}`;
  }
  
  setText(text : string) {
    this.state.text = text;
    this.completed = true;
  }
  
  cleanup() {
    if(this.targetIndex >= 0 && !this.completed) {
      this.state.text = '';
    }
  }
}


function parseState(state : NodeState,
                    parentNode : CompletionNode | null,
                    targetNodes : Array<CompletionNode>) {
  
  let node : CompletionNode = new CompletionNode(state);
  
  if( parentNode != null) {
    parentNode.addChildNode(node);
  }
  
  state.children.forEach((childState : NodeState) => {
    parseState(childState, node, targetNodes);
  });
  
  if(node.isEmpty()) {
    targetNodes.push(node);
  }
  
  return node;
}


function parseCompletionLine(str: string): { index: number, text: string } | null {
  const match = str.match(/\{\{(\d+)\}\}\s*(.*)/);
  if (match) {
    return {
      index: parseInt(match[1]),
      text: match[2]
    };
  }
  return null;
}


function parseCompletionResponse(response : string,
                                 targetNodeMap : { [index: number]: CompletionNode }) {
  const lines = response.split(/\n/);
  lines.forEach((line : string) => {
    const ret = parseCompletionLine(line);
    if(ret != null && ret.index in targetNodeMap) {
      const targetNode : CompletionNode = targetNodeMap[ret.index];
      targetNode.setText(ret.text);
    }
  })
}


export async function completeState(openaiApiKey: string,
                                    state : NodeState,
                                    abortController : AbortController) {

  const openai = new OpenAI({
    apiKey: openaiApiKey
  });

  state = cloneNodeState(state);
  
  const targetNodes : Array<CompletionNode> = [];
  const targetMap : Array<CompletionNode> = [];
  const targetNodeMap: { [index: number]: CompletionNode } = {};
  
  parseState(state, null, targetNodes);
  parseState(state['accompaniedState'], null, targetNodes);

  for(let i:number=0; i<targetNodes.length; i++) {
    targetNodes[i].setTargetIndex(i);
    targetNodeMap[i] = targetNodes[i];
  }

  if(targetNodes.length == 0) {
    // 入力をそのまま返す
    return null;
  }

  const targetNodeSize = targetNodes.length;
  
  const uml = convertStateToPlantUML(state);

  const targetListStr =
    targetNodeSize < 1
    ?
    `{{0}}`
    :
    `{{0}} ~ {{${targetNodeSize-1}}}`;
  
  const prompt = `
\`\`\`
${uml}
\`\`\`

上記はPlant UMLフォーマットで表記されたmind mapです。
このmind map内の${targetListStr}に入るものを考えて列挙してください。

出力は以下の例に従ってください。

\`\`\`
{{0}} あいうえお
\`\`\`
  `;

  const signal = abortController.signal;

  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: prompt,
      }
    ],
    model: COMPLETION_MODEL,
  }, {signal});

  if(chatCompletion.choices.length == 0) {
    return null;
  }
  
  const response : string | null = chatCompletion.choices[0].message.content;
  if( response == null ) {
    return null;
  }
  
  parseCompletionResponse(response!, targetNodeMap);
  
  targetNodes.forEach((targetNode : CompletionNode) => {
    targetNode.cleanup();
  });

  return state;
}
