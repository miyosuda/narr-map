import { 
  NodeState, NodeDrawState,
  NodeDrawStateMapType, 
} from '@/types'

import { isVisible, isDummy, isRoot, getTextWithSymbol } from './node-utils';

export const HANDLE_WIDTH  = 10;
export const HANDLE_HEIGHT = 21;

const SPAN_Y_PER_NODE = 30.0; // 1ノードの取る縦幅
const OFFSET_Y_FOR_SINGLE_CHILD = -3.0;
const GAP_X = 20;

const getElementDimension = (html : string, className : string|null=null) => {
  const element = document.createElement('foreignObject');

  // elementのsizeは子に依存
  element.style.display = 'inline-block';
  element.style.visibility = 'hidden';
  element.innerHTML = html;

  if( className != null ) {
    element.className = className;
  }

  document.body.append(element);

  const width = element.getBoundingClientRect().width;
  const height = element.getBoundingClientRect().height;

  element.remove();

  return {
    width,
    height
  };
}


const calcDimensionSub = (text: string, isRoot: boolean) => {
  if(text.trim().length === 0) {
    // 空文字のデフォルトの幅だとクリックしにくいので広げておく
    const width = 13;
    
    // 空文字の時文字(16pt)の高さが反映されず3+3+1+2となってしまうので対処を入れる.
    const height = 4 + 1 + 1 + 16 + 2;
    
    return {
      width,
      height
    };
  } else {
    let className;
    if(isRoot) {
      className = 'border border-gray-400 rounded-md p-[2px_3px_3px_4px] bg-white text-black';
    } else {
      className = 'border-b border-gray-400 p-[0px_3px_0px_4px]';
    }
    
    const innerHTML = '<span class="select-none whitespace-nowrap">' + text + '</span>';
    let {width, height} = getElementDimension(innerHTML, className);
    
    width += 3;
    
    return {
      width,
      height
    };
  }
}


const dimensionCache = new Map();

const cachedCalcDimensionSub = (text:string, isRoot: boolean) => {
  const prefix = isRoot ? '1' : '0';
  const index = prefix + text;

  if (dimensionCache.has(index)) {
    return dimensionCache.get(index);
  }

  const ret = calcDimensionSub(text, isRoot);
  dimensionCache.set(index, ret);
  return ret;
};


const calcDimension = (state: NodeState) => {
  const text = getTextWithSymbol(state.text, state.symbol);
  const symbol = state.symbol;
  const root = isRoot(state);

  return cachedCalcDimensionSub(text, root);
}


export function containsPosHalf(state: NodeState, drawState: NodeDrawState, x: number, y: number, leftHalf: boolean ) : boolean {
  if( !isVisible(state) ) {
    return false;
  }

  if(leftHalf) {
    return (x >= drawState.x) &&
           (x <= drawState.x + drawState.width/2) &&
           (y >= drawState.y) &&
           (y <= drawState.y + drawState.height);
  } else {
    return (x > drawState.x + drawState.width/2) &&
           (x <= drawState.x + drawState.width) &&
           (y >= drawState.y) &&
           (y <= drawState.y + drawState.height);
  }
}

// Info used for NodeDrawState calculation
type NodeDrawInfo = {
  topY: number;
  bottomY: number;
  locateOffset: number;
}

type NodeDrawInfoMapType = {[key: number]: NodeDrawInfo;};


const calcDrawInfoMap = (state: NodeState, d: NodeDrawInfoMapType) : NodeDrawInfoMapType => {
  let dd = structuredClone(d);
  
  for(let i=0; i<state.children.length; i++) {
    const childState = state.children[i];
    // 子Nodeのboundsを更新する
    dd = calcDrawInfoMap(childState, dd);
  }
  
  // このNodeのデフォルト位置を起点として、その位置から子Nodeを含めた上下の範囲を算出.
  // shiftYも反映されている.
  
  let topY;
  let bottomY;
  
  if(state.children.length === 0 || state.folded) {
    // 子Nodeが無い場合
    topY = 0;
    bottomY = SPAN_Y_PER_NODE;
  } else {
    // 子ノードのY方向の開始位置
    topY = calcChildStartOffsetY(state, dd);
    bottomY = topY;
    
    for(let i=0; i<state.children.length; i++) {
      // 子NodeのtopY, bottomY, locateOffsetを算出
      const childState = state.children[i];
      const { topY: childTopY,
              bottomY: childBottomY } = dd[childState.id];
      
      // 子Nodeのboundsを算出する
      const childSpanY = childBottomY - childTopY;
      bottomY += childSpanY;
    }
  }
  
  // Nodeを配置するときのこのboundsのtopからの下方向のoffset
  let locateOffset = -topY;
  if(locateOffset < 0) {
    locateOffset = 0;
  }
  
  if(state.shiftY <= 0) {
    // 上にシフトされている時.
    // すぐにNodeを置いて下にshiftY分のスペースを開ける場合に相当
    // topを上に移動 (上にスペースを作る)
    topY += state.shiftY;
  } else {
    // 下にシフトされている時.
    // Nodeを置いてから下にshiftY分のスペースを開ける場合に相当
    // bottomを下に移動 (下にスペースを作る)
    bottomY += state.shiftY;
    locateOffset += state.shiftY;
  }
  
  if(topY > 0) {
    topY = 0;
  }
  
  if(bottomY < SPAN_Y_PER_NODE) {
    bottomY = SPAN_Y_PER_NODE;
  }

  dd[state.id] = {
    topY,
    bottomY,
    locateOffset,
  }
  
  return dd;
}


// 以前はupdateLayout()
const calcXY = (state: NodeState, baseX: number, baseY: number, width: number, drawInfoMap: NodeDrawInfoMapType) => {
  // baseXにshiftXを足す
  let x = baseX + state.shiftX;

  if(state.isLeft && !isDummy(state)) {
    // leftの場合は、右端から左端を算出
    x -= width;
  }

  const { locateOffset } = drawInfoMap[state.id];
  const y = isRoot(state) ? baseY : baseY + locateOffset;

  return {
    x,
    y
  };
}

const calcDrawStateMapSub = (state: NodeState, rootState: NodeState, baseX: number, baseY: number, d: NodeDrawStateMapType, drawInfoMap: NodeDrawInfoMapType) : NodeDrawStateMapType => {
  // baseX, Y, edgeStartX, Y には子孫のshiftY, foldedの情報が既に反映された結果となっている.
  
  let dd = structuredClone(d);

  const targetState = isDummy(state) ? rootState : state;

  const { width, height } = calcDimension(targetState);
  const { x, y } = calcXY(state, baseX, baseY, width, drawInfoMap);

  dd[state.id] = { x, y, width, height };
  
  let childBaseX : number;

  if(state.isLeft) {
    childBaseX = x - GAP_X;
  } else {
    childBaseX = x + width + GAP_X;
  }
  
  const childStartOffsetY = calcChildStartOffsetY(state, drawInfoMap);
  
  let childBaseY = y + childStartOffsetY;
  
  state.children.forEach(childState => {
    const {topY, bottomY} = drawInfoMap[childState.id]!;
    dd = calcDrawStateMapSub(childState, rootState, childBaseX, childBaseY, dd, drawInfoMap);
    
    childBaseY += (bottomY - topY);
  });
  
  return dd;
}


const calcRootBaseXY = (rootState: NodeState) => {  
  const {width, height } = calcDimension(rootState);
  
  const x = -width / 2;
  const y = -height / 2;
  
  return {
    x,
    y
  };
}


export function calcDrawStateMap(rootState: NodeState) : NodeDrawStateMapType {
  const { x, y } = calcRootBaseXY(rootState);

  let d: NodeDrawStateMapType = {};

  const drawInfoMap = calcDrawInfoMap(rootState, {});
  d = calcDrawStateMapSub(rootState, rootState, x, y, d, drawInfoMap);

  const leftDrawInfoMap = calcDrawInfoMap(rootState.accompaniedState!, {});
  d = calcDrawStateMapSub(rootState.accompaniedState!, rootState, x, y, d, leftDrawInfoMap);
  
  return d;
}


// 各子のtopYを使って、最初の子のY方向の開始位置を算出
const calcChildStartOffsetY = (state: NodeState, drawInfoMap: NodeDrawInfoMapType) => {
  let childYOffset = 0.0;
  
  if( state.children.length === 1 ) {
    // 子が1ノードしかない場合は少し上に上げておく (-3)
    childYOffset = OFFSET_Y_FOR_SINGLE_CHILD;
  }

  for(let i=0; i<state.children.length; i++) {
    // 子のY方向Boundsを算出
    const childState = state.children[i];
    const { topY } = drawInfoMap[childState.id]!;
    
    if(topY < 0) {
      childYOffset += topY;
    }
  }
  
  childYOffset -= (state.children.length-1) / 2 * SPAN_Y_PER_NODE;
  
  return childYOffset;
}


export function containsPos(state: NodeState, px : number, py : number, drawStateMap: NodeDrawStateMapType) : boolean {
  if(!isVisible(state)) {
    return false;
  }
  
  const { x, y, width, height } = drawStateMap[state.id];
  return (px >= x) && (px <= (x + width)) && (py >= y) && (py <= (y + height));
}


export function containsPosForHandle(state: NodeState, px : number, py : number, drawStateMap: NodeDrawStateMapType) : boolean {
  if(!isVisible(state)) {
    return false;
  }
  
  if(isRoot(state)) {
    return false;
  } else {

    const { x, y, width } = drawStateMap[state.id];
    const { x: handleX, y: handleY } = calcHandlePos(state, x, y, width);

    return (px >= handleX - 2) && // 2pxだけ広げてtouchしやすくしている
           (px <= handleX + HANDLE_WIDTH + 2) &&
           (py >= handleY) &&
           (py <= handleY + HANDLE_HEIGHT);
  }
}

export function calcHandlePos(state: NodeState, x: number, y: number, width: number) {
  // handleの左上位置を算出
  if(state.isLeft) {
    return {
      x : x + width,
      y : y
    };
  } else {
    return {
      x : x - HANDLE_WIDTH,
      y : y
    };
  }
}
