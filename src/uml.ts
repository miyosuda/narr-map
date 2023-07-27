import { StateType } from './types'


function getStateUMLStr(state : StateType,
                        level : number,
                        skip : boolean) : string {

  let uml = ''

  if(!skip) {
    for(let i=0; i<level; i++) {
      uml += '+'
    }
    uml += ' '
    uml += state['text']
    uml += '\n'
  }
  
  state.children.forEach((childState : StateType) => {
    uml += getStateUMLStr(childState, level+1, false)
  })

  return uml
}


export function convertStateToPlanetUML(state : StateType) : string {
  let uml = '@startmindmap\n'

  uml += getStateUMLStr(state['right'], 1, false)
  uml += getStateUMLStr(state['left'], 1, true)
  
  uml += '@endmindmap\n'
  return uml
}


function countNodeLevelPlus(str : string) {
  const match = str.match(/^\++/)
  const count = match ? match[0].length : 0
  return count
}


function countNodeLevelMinus(str : string) {
  const match = str.match(/^\-+/)
  const count = match ? match[0].length : 0
  return count
}


function getMapNodeStr(line : string, level : number) {
  const str = line.substring(level).trim()
  return str
}


class UMLNode {
  text : string
  level : number

  children : UMLNode[] = []
  
  constructor(text : string, level : number) {
    this.text = text
    this.level = level
  }

  addChild(node : UMLNode) {
    this.children.push(node)
  }

  getState() : StateType {
    const selected = this.level == 1
    
    const state : StateType = {
      'text'     : this.text,
      'shiftX'   : 0,
      'shiftY'   : 0,
      'selected' : selected,
      'folded'   : false,
      'isLeft'   : false,
    }
    
    const childStates = new Array<StateType>()
    this.children.forEach(node => {
      childStates.push(node.getState())
    })
    
    state['children'] = childStates
    return state
  }
}


class Stack<T> {
    items: T[]

    constructor() {
        this.items = []
    }

    push(item: T): void {
        this.items.push(item)
    }

    pop(): T | undefined {
      if(this.isEmpty()) {
        return undefined
      }
      return this.items.pop()
    }
  
    isEmpty(): boolean {
        return this.items.length === 0
    }
}



export function convertPlanetUMLToState(uml : string) : StateType {
  const lines = uml.split('\n')
  
  const stack = new Stack<UMLNode>()
  
  for(let i=0; i<lines.length; i++) {
    const line = lines[i]
    if(line.startsWith('@startmindmap')) {
      continue
    } else if(line.startsWith('@endmindmap')) {
      break
    } else if(line.startsWith('+')) {
      const level = countNodeLevelPlus(line)
      const text = getMapNodeStr(line, level)
      
      const node = new UMLNode(text, level)
      
      if(stack.isEmpty()) {
        stack.push(node)
      } else {
        const poppedNodes : UMLNode[] = []
        
        while(true) {
          const tmpNode = stack.pop()
          poppedNodes.push(tmpNode)
          
          if(tmpNode.level < node.level) {
            poppedNodes.unshift(node)
            tmpNode.addChild(node)
            break
          }
        }
        
        for(let i=poppedNodes.length-1; i>=0; i--) {
          const poppedNode = poppedNodes[i]
          stack.push(poppedNode)
        }
      }
    }
  }

  const rightState = stack.items[0].getState()

  const leftState : StateType = {
    'text'     : null,
    'shiftX'   : 0,
    'shiftY'   : 0,
    'selected' : false,
    'folded'   : false,
    'isLeft'   : true,
    'children' : []
  }
  
  const mapState = {
    'right' : rightState,
    'left' : leftState,
  }
  
  return mapState
}
