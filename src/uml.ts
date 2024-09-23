import { SavingNodeState } from './types';

type StateType = SavingNodeState;


function getStateUMLStr(state : StateType,
                        level : number,
                        skip : boolean,
                        isLeft : boolean) : string {

                          let uml = '';
  const char = isLeft ? '-' : '+';

  if(!skip) {
    for(let i=0; i<level; i++) {
      uml += char;
    }
    uml += ' ';
    uml += state['text'];
    uml += '\n';
  }
  
  state.children.forEach((childState : StateType) => {
    uml += getStateUMLStr(childState, level+1, false, isLeft);
  })

  return uml;
}


export function convertStateToPlantUML(state : StateType) : string {
  let uml = '@startmindmap\n';

  uml += getStateUMLStr(state, 1, false, false);
  uml += getStateUMLStr(state.accompaniedState, 1, true, true);
  
  uml += '@endmindmap\n';
  return uml;
}


function countNodeLevelPlus(str : string) {
  const match = str.match(/^\++/);
  const count = match ? match[0].length : 0;
  return count;
}


function countNodeLevelMinus(str : string) {
  const match = str.match(/^\-+/);
  const count = match ? match[0].length : 0;
  return count;
}


function getMapNodeStr(line : string, level : number) {
  const str = line.substring(level).trim();
  return str;
}


class UMLNode {
  text : string | null;
  level : number;
  isLeft : boolean;

  children : UMLNode[] = [];
  
  constructor(text : string | null,
              level : number,
              isLeft : boolean) {
    this.text = text;
    this.level = level;
    this.isLeft = isLeft;
  }

  addChild(node : UMLNode) {
    this.children.push(node);
  }

  getState() : StateType {
    const childStates = new Array<StateType>()
    this.children.forEach(node => {
      childStates.push(node.getState());
    });

    const state : StateType = {
      'text'     : this.text,
      'symbol'   : null,
      'shiftX'   : 0,
      'shiftY'   : 0,
      'selected' : false,
      'folded'   : false,
      'isLeft'   : this.isLeft,
      'accompaniedState' : null,
      'children' : childStates
    };
    return state;
  }
}


class Stack<T> {
    items: T[];

    constructor() {
        this.items = [];
    }

    push(item: T): void {
        this.items.push(item);
    }

    pop(): T | undefined {
      if(this.isEmpty()) {
        return undefined;
      }
      return this.items.pop();
    }
  
    isEmpty(): boolean {
        return this.items.length === 0;
    }
}



export function convertPlantUMLToState(uml : string) : StateType {
  const lines = uml.split('\n');
  
  const rightStack = new Stack<UMLNode>();
  const leftStack = new Stack<UMLNode>();
  
  leftStack.push(new UMLNode(null, 1, true));
  
  for(let i=0; i<lines.length; i++) {
    const line = lines[i]
    if(line.startsWith('@startmindmap')) {
      continue;
    } else if(line.startsWith('@endmindmap')) {
      break;
    } else if(line.startsWith('+')) {
      const level = countNodeLevelPlus(line);
      const text = getMapNodeStr(line, level);
      
      const node = new UMLNode(text, level, false);
      
      if(rightStack.isEmpty()) {
        rightStack.push(node);
      } else {
        const poppedNodes : UMLNode[] = [];
        
        while(true) {
          const tmpNode = rightStack.pop();
          poppedNodes.push(tmpNode);
          
          if(tmpNode.level < node.level) {
            poppedNodes.unshift(node);
            tmpNode.addChild(node);
            break;
          }
        }
        
        for(let i=poppedNodes.length-1; i>=0; i--) {
          const poppedNode = poppedNodes[i];
          rightStack.push(poppedNode);
        }
      }
    } else if(line.startsWith('-')) {
      const level = countNodeLevelMinus(line);
      const text = getMapNodeStr(line, level);
      
      const node = new UMLNode(text, level, true);
      
      if(leftStack.isEmpty()) {
        leftStack.push(node);
      } else {
        const poppedNodes : UMLNode[] = [];
        
        while(true) {
          const tmpNode = leftStack.pop();
          poppedNodes.push(tmpNode);
          
          if(tmpNode.level < node.level) {
            poppedNodes.unshift(node);
            tmpNode.addChild(node);
            break;
          }
        }
        
        for(let i=poppedNodes.length-1; i>=0; i--) {
          const poppedNode = poppedNodes[i];
          leftStack.push(poppedNode);
        }        
      }
    }
  }
                 
  const state = rightStack.items[0].getState();
  const accompaniedState = leftStack.items[0].getState();
  
  // There should be at least one selected nodes.
  state.selected = true;
  
  state['accompaniedState'] = accompaniedState;
  return state;
}
