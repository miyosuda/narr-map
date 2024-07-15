import { NodeState, HOVER_STATE_NONE, EDIT_STATE_NONE } from '../types'


export function getNodeState(
  {
    id = -1,
    text = '',
    symbol = null,
    shiftX = 0,
    shiftY = 0,
    selected = false,
    folded = false,
    isLeft = false,
    accompaniedState = null,
    children = [],
    parent = null,
    hoverState = HOVER_STATE_NONE,
    handleShown = false,
    editId = -1,
    editState = EDIT_STATE_NONE,
  } : Partial<NodeState>={}
): NodeState {
  return {
    id : id,
    text : text,
    symbol : symbol,
    shiftX : shiftX,
    shiftY : shiftY,
    selected : selected,
    folded : folded,
    isLeft : isLeft,
    accompaniedState : accompaniedState,
    children : children,
    parent : parent,
    hoverState : hoverState,
    handleShown : handleShown,
    editId : editId,
    editState : editState
  }
}


export function cloneNodeState(state: NodeState): NodeState {
  // structureCloneでNodeStateをcloneしようとすると
  // parentに対して再帰的にcloneがかかってしまい重くなるのを回避するclone処理
  
  const clonedState = { ...state };
  
  const clonedChildren = state.children.map(childState => {
    const clonedChildState = cloneNodeState(childState);
    clonedChildState.parent = clonedState;
    return clonedChildState;
  });

  clonedState.children = clonedChildren;

  if(state.accompaniedState != null) {
    const clonedAccompaniedState = cloneNodeState(state.accompaniedState!);
    clonedState.accompaniedState = clonedAccompaniedState;
  }
  
  return clonedState;
}


export function isCopiable(state: NodeState): boolean {
  if(!state.selected) {
    return false;
  }

  const hasSelectedAncestor = (state: NodeState) : boolean => {
    if(state.parent == null) {
      return false;
    } else {
      if(state.parent.selected) {
        return true;
      } else {
        return hasSelectedAncestor(state.parent);
      }
    }
  }

  if(hasSelectedAncestor(state)) {
    return false;
  }

  return true;
}

export function addChildNode(state : NodeState, newChildState : NodeState) : NodeState {
  const clonedState = cloneNodeState(state);
  clonedState.children.push(newChildState);
  newChildState.parent = clonedState;
  
  return clonedState;
}


export function addChildNodeBelow(state : NodeState, newChildState : NodeState, targetNode : NodeState) {
  // stateの子の中のtargetNodeの下にnewChildNodeを追加.
  const clonedState = cloneNodeState(state);
  const targetNodeIndex = clonedState.children.findIndex(state => state.id === targetNode.id);
  clonedState.children.splice(targetNodeIndex+1, 0, newChildState);
  newChildState.parent = clonedState;
  return clonedState;
}

export function addChildNodeAbove(state : NodeState, newChildState : NodeState, targetNode : NodeState) {
  // stateの子の中のtargetNodeの下にnewChildNodeを追加.
  const clonedState = cloneNodeState(state);
  const targetNodeIndex = clonedState.children.findIndex(state => state.id === targetNode.id);
  clonedState.children.splice(targetNodeIndex, 0, newChildState);
  newChildState.parent = clonedState;
  return clonedState;
}

export function removeChildNode(state: NodeState, childId: number) : NodeState {
  const clonedState = cloneNodeState(state);
  const targetNodeIndex = clonedState.children.findIndex(state => state.id === childId);
  clonedState.children.splice(targetNodeIndex, 1);
  return clonedState;
}


// Rootの場合はchildrenに加えてdummyのleftRootStateも含めて返す.
export function getExtendedChildren(state: NodeState) : NodeState[] {
  if(isRoot(state) && !isDummy(state)) {
    return [state.accompaniedState!, ...state.children];
  } else {
    return state.children;
  }
}

// 挿入位置算出のsiblings把握処理関連

const getBottomDescendant = (state: NodeState, cursorDepth : number) : NodeState => {
  let bottomChild = state.children[state.children.length-1];
  if(calcDepth(bottomChild) < cursorDepth && hasVisibleChildren(bottomChild)) {
    return getBottomDescendant(bottomChild, cursorDepth);
  } else {
    return bottomChild;
  }
}


const getTopDescendant = (state: NodeState, cursorDepth : number) : NodeState => {
  let topChild = state.children[0];
  if(calcDepth(topChild) < cursorDepth && hasVisibleChildren(topChild)) {
    return getTopDescendant(topChild, cursorDepth);
  } else {
    return topChild;
  }
}

const getSiblingOfChild = (state: NodeState, targetState : NodeState, above : boolean, cursorDepth : number ) : NodeState | null => {
  const targetChildren = state.children;
  const nodeIndex = targetChildren.indexOf(targetState);
  
  if(above) {
    // 上方向へ
    if(nodeIndex >= 1) {
      // 上のnode
      const aboveNode = targetChildren[nodeIndex-1]
      if(calcDepth(aboveNode) === cursorDepth) {
        return aboveNode;
      } else if(calcDepth(aboveNode) < cursorDepth) {
        if(hasVisibleChildren(aboveNode)) {
          // aboveNodeの子孫を探す
          return getBottomDescendant(aboveNode, cursorDepth);
        } else {
          return aboveNode;
        }
      } else {
        console.log('この場合はないはず(above)')
        // aboveNode.depth > cursorDepth の場合
        return aboveNode;
      }
    } else {
      // nodeが既にtopのnodeだった
      return getSibling(state, above, cursorDepth);
    }
  } else {
    // 下方向へ
    if(nodeIndex <= targetChildren.length-2) {
      const belowNode = targetChildren[nodeIndex+1];
      if(calcDepth(belowNode) === cursorDepth) {
        return belowNode;
      } else if(calcDepth(belowNode) < cursorDepth) {
        if(hasVisibleChildren(belowNode)) {
          // belowNodeの子を探す
          return getTopDescendant(belowNode, cursorDepth);
        } else {
          return belowNode;
        }
      } else {
        console.log('この場合はないはず(below)')
        // belowNode.depth > cursorDepth の場合
        return belowNode;
      }
    } else {
      // nodeが既にbottomのnodeだった
      return getSibling(state, above, cursorDepth);
    }
  }
}

export function getSibling(state: NodeState, above : boolean, cursorDepth : number) : NodeState | null {
  // カーソル上下移動時に利用
  if(state.parent == null) {
    return null;
  }
  
  return getSiblingOfChild(state.parent, state, above, cursorDepth);
}

export function getLatestNode(state: NodeState) : NodeState {
  // TODO: dummy nodeが最終的な返り値とならない様にする

  const extendedChidren = getExtendedChildren(state);

  if(extendedChidren.length === 0) {
    return state;
  }

  const f = (latestState: NodeState|null, state: NodeState) => {
    if(latestState == null) {
      return getLatestNode(state);
    } else {
      const s = getLatestNode(state);
      if(s.editId > latestState.editId) {
        return s;
      } else {
        return latestState;
      }
    }
  }

  const latestChildState = extendedChidren.reduce(f, null);
  
  if(isDummy(latestChildState!)) {
    return state;
  }

  if(isDummy(state)) {
    return latestChildState!;
  }

  if(latestChildState!.editId > state.editId) {
    return latestChildState!;
  } else {
    return state;
  }
}


export function getLatestVisibleChild(state: NodeState) : NodeState | null {
  if(!hasVisibleChildren(state)) {
    return null;
  }

  // TODO: 要Refactor
  let latestChildNode = null;
  let latestActionId = -1;
   
  state.children.forEach(node => {
    if(node.editId! >= latestActionId ) {
      latestActionId = node.editId!;
      latestChildNode = node;
    }
  })
  
  return latestChildNode;
}


export function findNode(state: NodeState, cond: (state: NodeState) => boolean) : NodeState | null {
  if(cond(state)) {
    return state;
  }
  
  const children = getExtendedChildren(state);
  const foundChildren = children.map(childState => findNode(childState, cond)).filter(state => state != null)
  
  if(foundChildren.length !== 0) {
    return foundChildren[0];
  } else {
    return null;
  }
}


export function findNodes(state: NodeState, cond: (state: NodeState) => boolean) : NodeState[] {
  const children = getExtendedChildren(state);
  const foundChildren = children.map(childState => findNodes(childState, cond)).flat()
  if(cond(state)) {
    return [state, ...foundChildren];
  } else {
    return foundChildren;
  }
}


export function updateNodes(state: NodeState, cond: (state: NodeState) => boolean, applyFunc: (state: NodeState) => NodeState): NodeState {
  if(cond(state)) {
    state = applyFunc(state);
  }

  if(state.accompaniedState != null) {
    state = {
      ...state,
      accompaniedState: updateNodes(state.accompaniedState, cond, applyFunc)
    }
  }

  if(state.children.length > 0) {
    const newChildren = state.children.map(
      childState => updateNodes(childState, cond, applyFunc)
    );
    
    state = {
      ...state,
      children: newChildren
    };

    // 親を付け替えておく
    newChildren.forEach((childState) => childState.parent = state);
  }
  
  return state;
}

export function isRoot(state: NodeState) : boolean {
  // True when state is right root or left root.
  return state.parent === null;
}

export function isDummy(state: NodeState) : boolean {
  return isRoot(state) && state.isLeft;
}

export function hasChildren(state: NodeState) : boolean {
  return state.children.length > 0;
}

export function hasVisibleChildren(state: NodeState) : boolean {
  if(state.folded) {
    return false;
  } else {
    return hasChildren(state);
  }
}


export function hasNodeInAncestor(state: NodeState, targetState : NodeState) : boolean {
  let tmpState = state.parent;
  
  while(tmpState != null) {
    if(tmpState.id === targetState.id) {
      return true;
    }
    tmpState = tmpState.parent;
  }
  return false;
}


const hasParent = (state: NodeState) : boolean => {
  return state.parent != null;
}


export function isVisible(state: NodeState) : boolean {
  if(isDummy(state)) {
    return false;
  }

  if(!hasParent(state)) {
    return true;
  }

  if(isDummy(state.parent!)) {
    return true;
  }

  if(state.parent!.folded) {
      return false;
  }
  
  return isVisible(state.parent!);
}


export function calcDepth(state: NodeState) : number {
  let p = state.parent;
  
  let depth = 0;
  while(p != null) {
    p = p.parent;
    depth += 1;
  }
  return depth;
}


export function splitSymbolFromText(text: string) : { symbol: text|null, rawText: text } {
  const regex = /\{(\w+)\}\s*=\s*(.+)/;
  const match = regex.exec(text);

  if(match != null && match.length >= 2) {
    const symbol = match[1].trim();
    const rawText = match[2].trim();
    
    return {
      symbol,
      rawText
    }
  } else{
    const symbol = null;
    const rawText = text;
    
    return {
      symbol,
      rawText
    }
  }
}


export function getTextWithSymbol(text: string, symbol: string|null) : text {
  if(symbol != null) {
    return `{${symbol}} = ${text}`;
  } else {
    return text;
  }
}
