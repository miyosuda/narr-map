import {
  TextComponent,
  LineComponent,
  FoldMarkComponent,
  HandleComponent,
  HANDLE_WIDTH,
  HANDLE_HEIGHT,
  TEXT_COMPONENT_STYLE_NONE,
  TEXT_COMPONENT_STYLE_HOVER_TOP,
  TEXT_COMPONENT_STYLE_HOVER_RIGHT,
  TEXT_COMPONENT_STYLE_HOVER_LEFT,
  TEXT_COMPONENT_STYLE_SELECTED,
} from './components';
import { Config } from './config';
import { StateType } from './types';

export const SPAN_Y_PER_NODE = 30.0; // 1ノードの取る縦幅

const HOVER_STATE_NONE  = 0;
const HOVER_STATE_TOP   = 1;
const HOVER_STATE_RIGHT = 2;
const HOVER_STATE_LEFT  = 3;

export const HOVER_HIT_NONE        = 0;
export const HOVER_HIT_SIBLING     = 1;
export const HOVER_HIT_CHILD       = 2;
export const HOVER_HIT_OTHER_CHILD = 3;

const OFFSET_Y_FOR_SINGLE_CHILD = -3.0;
const GAP_X = 20;


export class Node {
  parentNode : Node | null;
  isLeft : boolean;
  accompaniedNode : Node | null;
  children : Array<Node>;
  textComponent : TextComponent | null;
  lineComponent : LineComponent | null;
  handleComponent : HandleComponent | null;
  foldMarkComponent : FoldMarkComponent | null;
  shiftX : number;
  shiftY : number;
  selected : boolean;
  hoverState : number;
  handleShown : boolean;
  folded : boolean;
  x : number | null; 
  y : number | null;
  topY : number | null;
  bottomY : number | null;
  locateOffset : number | null;
  timeStamp : number | null;
  startElementX : number | null;
  startElementY : number | null;
  
  constructor(parentNode : Node | null,
              container : Element,
              config : Config,
              isLeft : boolean=false,
              accompaniedNode : Node|null=null) {
    this.parentNode = parentNode;
    this.isLeft = isLeft;
    this.accompaniedNode = accompaniedNode;
    this.children = [];
    
    if(!this.isDummy) {
      this.textComponent = new TextComponent(container, this.isRoot, config);
    } else {
      this.textComponent = null;
    }

    if(!this.isRoot) {
      this.lineComponent = new LineComponent(container);
      this.handleComponent = new HandleComponent(container, config);
      this.foldMarkComponent = new FoldMarkComponent(container, config);
    } else {
      this.lineComponent = null;
      this.handleComponent = null;
      this.foldMarkComponent = null;
    }

    if(!this.isDummy) {
      this.setText('');
    }

    this.shiftX = 0;
    this.shiftY = 0;
    
    this.selected = false;
    this.hoverState = HOVER_STATE_NONE;
    this.handleShown = false;
    this.folded = false;
  }

  applyConfig(config : Config) {
    if(this.textComponent != null) {
      this.textComponent.applyConfig(config);
      
      // selected状態もconfigが影響するので再反映しておく
      if(this.selected) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
      } else {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE);
      }
    }
    if(this.handleComponent != null) {
      this.handleComponent.applyConfig(config);
    }
    if(this.foldMarkComponent != null) {
      this.foldMarkComponent.applyConfig(config);
    }

    // hoverの状態にconfigが影響するのでクリアしておく
    this.clearGhostHover();
  }
  
  get isDummy() {
    return this.isRoot && this.isLeft;
  }

  get isVisible() {
    if(this.isDummy) {
      return false;
    }
    return this.textComponent.isVisible;
  }

  setVisible(visible : boolean) {
    if(this.isVisible != visible) {
      this.textComponent.setVisible(visible);
      
      if(this.lineComponent != null) {
        this.lineComponent.setVisible(visible);
      }
      if(this.handleComponent != null) {
        if(visible) {
          if(this.handleShown) {
            this.handleComponent.setVisible(visible);
          } else {
            this.handleComponent.setVisible(false);
          }
        } else {
          this.handleComponent.setVisible(visible);
        }
      }
      if(this.foldMarkComponent != null) {
        if(visible) {
          if(this.folded) {
            this.foldMarkComponent.setVisible(visible);
          } else {
            this.foldMarkComponent.setVisible(false);
          }
        } else {
          this.foldMarkComponent.setVisible(visible);
        }        
      }

      if(!this.folded || !visible) {
        this.children.forEach(node => {
          node.setVisible(visible);
        })
      }
    }
  }

  startTempHide() {
    this.textComponent.setVisible(false);
  }

  stopTempHide() {
    this.textComponent.setVisible(true);
  }

  addChildNode(node : Node) {
    this.children.push(node);
  }

  addChildNodeBelow(node : Node, targetNode : Node) {
    const targetNodeIndex = this.children.indexOf(targetNode);
    this.children.splice(targetNodeIndex+1, 0, node);
  }

  calcChildStartOffsetY() {
    let childYOffset = 0.0
    if( this.children.length == 1 ) {
      // 子が1ノードしかない場合は少し上に上げておく
      childYOffset = OFFSET_Y_FOR_SINGLE_CHILD;
    }

    for(let i=0; i<this.children.length; i++) {
      const node = this.children[i];
      if(node.topY < 0) {
        childYOffset += node.topY;
      }
    }
    
    childYOffset -= (this.children.length-1) / 2 * SPAN_Y_PER_NODE;
    
    return childYOffset;
  }

  updateChildrenLayout() {
    const toLeft = this.children[0].isLeft;
    
    let childBaseX = 0;
    if(!toLeft) {
      childBaseX = this.x + this.width + GAP_X;
    } else {
      childBaseX = this.x - GAP_X;
    }

    const childStartOffsetY = this.calcChildStartOffsetY();

    // 子ノードのY方向の開始位置
    let childY = this.y + childStartOffsetY;
    
    for(let i=0; i<this.children.length; i++) {
      const node = this.children[i];
      // 各ノードのx,yを更新する
      node.updateLayout(childBaseX, childY);
      
      childY += (node.bottomY - node.topY);
    }
  }

  updateLayout(baseX : number, baseY : number) {
    if(this.isRoot) {
      // baseX,Yが原点(0,0)なのでbaseX,Yを左上に変更しておく
      baseX = -this.width / 2;
      baseY = -this.height / 2;
    }
    // baseX,YにshiftX,Yを足してx,yとする
    this.updatePos(baseX, baseY);

    if(this.children.length == 0) {
      return;
    }

    // 子のx,yを更新
    this.updateChildrenLayout();
  }

  updateYBounds() {
    for(let i=0; i<this.children.length; i++) {
      const node = this.children[i]
      // 子Nodeのboundsを更新する
      node.updateYBounds();
    }
    
    // このNodeのデフォルト位置を起点として、その位置から子Nodeを含めた上下の範囲を算出.
    // shiftYも反映されている.
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    
    if(this.children.length == 0 || this.isFolded) {
      // 子Nodeが無い場合
      top = 0;
      bottom = SPAN_Y_PER_NODE;
    } else {
      // 子ノードのY方向の開始位置
      top = this.calcChildStartOffsetY();
      bottom = top;
      
      for(let i=0; i<this.children.length; i++) {
        const node = this.children[i];
        // 子Nodeのboundsを算出する
        const childSpanY = node.bottomY - node.topY;
        bottom += childSpanY;
      }
    }
    
    // Nodeを配置するときのこのboundsのtopからの下方向のoffset
    let locateOffset = -top;
    if(locateOffset < 0) {
      locateOffset = 0;
    }
    
    if(this.shiftY <= 0) {
      // 上にシフトされている時.
      // すぐにNodeを置いて下にshiftY分のスペースを開ける場合に相当
      // topを上に移動 (上にスペースを作る)
      top += this.shiftY;
    } else {
      // 下にシフトされている時.      
      // Nodeを置いてから下にshiftY分のスペースを開ける場合に相当
      // bottomを下に移動 (下にスペースを作る)
      bottom += this.shiftY;
      
      locateOffset += this.shiftY;
    }
    
    if(top > 0) {
      top = 0;
    }
    if(bottom < SPAN_Y_PER_NODE) {
      bottom = SPAN_Y_PER_NODE;
    }

    this.topY = top;
    this.bottomY = bottom;
    this.locateOffset = locateOffset;
  }

  get hasChildren() : boolean {
    return this.children.length > 0;
  }

  get hasVisibleChildren() : boolean {
    if(this.folded) {
      return false;
    } else {
      return this.hasChildren;
    }
  }

  get hasParent() : boolean {
    return this.parentNode != null;
  }
  
  get parent() : Node | null {
    return this.parentNode;
  }

  get width() : number {
    if(this.isDummy) {
      return this.accompaniedNode.width;
    }
    return this.textComponent.width;
  }
  
  get height() : number {
    if(this.isDummy) {
      return this.accompaniedNode.height;
    }
    return this.textComponent.height;
  }

  get text() : string | null {
    if(this.isDummy) {
      return null;
    } else {
      return this.textComponent.text;
    }
  }
  
  setText(text : string) {
    if(this.isDummy) {
      return;
    }
    this.textComponent.setText(text)
    this.updateTimeStamp();
  }

  updatePos(baseX : number, baseY : number) {
    if(this.isLeft && !this.isRoot) {
      this.x = baseX - this.width + this.shiftX;
    } else {
      this.x = baseX + this.shiftX;
    }

    if(this.isRoot) {
      this.y = baseY;
    } else {
      this.y = baseY + this.locateOffset;
    }

    if(!this.isDummy) {
      this.textComponent.setPos(this.x, this.y);
    }
    
    if(!this.isRoot) {
      // 親Node側
      const edgeStartPos = this.parentNode.edgeOutPos;

      // 子Node側
      const edgeEndPosY = this.y + this.height - 0.5; // lineの幅を考慮している

      let edgeEndPosX
      if(this.isLeft) {
        edgeEndPosX = this.x + this.width;
      } else {
        edgeEndPosX = this.x;
      }
      
      this.lineComponent.setPos(edgeStartPos.x,
                                edgeStartPos.y,
                                edgeEndPosX,
                                edgeEndPosY)

      if(!this.isLeft) {
        this.handleComponent.setPos(this.x-HANDLE_WIDTH, this.y);
        this.foldMarkComponent.setPos(this.x + this.width,
                                      this.y + this.height);
      } else {
        this.handleComponent.setPos(this.x + this.width, this.y);
        this.foldMarkComponent.setPos(this.x,
                                      this.y + this.height);
      }
    }
  }
  
  get isRoot() {
    return this.parentNode == null;
  }
  
  get edgeOutPos() {
    // 親Nodeの出口
    const pos : {[key: string]: number;} = {};
    
    if(this.isRoot) {
      pos['x'] = this.x + this.width / 2;
      pos['y'] = this.y + this.height / 2;
    } else {
      if(this.isLeft) {
        pos['x'] = this.x;
        pos['y'] = this.y + this.height - 0.5; // lineの幅を考慮している
      } else {
        pos['x'] = this.x + this.width;
        pos['y'] = this.y + this.height - 0.5; // lineの幅を考慮している
      }
    }
    
    return pos;
  }

  get left() {
    return this.x;
  }

  get top() {
    return this.y;
  }

  get right() {
    return this.x + this.width;
  }

  get bottom() {
    return this.y + this.height;
  }

  onDragStart() {
    this.startElementX = this.shiftX;
    this.startElementY = this.shiftY;
  }

  onDrag(dx : number, dy : number) {
    this.shiftX = this.startElementX + dx;
    this.shiftY = this.startElementY + dy;

    // ここではforeignObjectのx,y座標はまだ更新していない
  }

  containsPos(x : number, y : number) {
    if(!this.isVisible) {
      return false;
    }
    return (x >= this.left) && (x <= this.right) && (y >= this.top) && (y <= this.bottom);
  }

  containsPosForHandle(x : number,
                       y : number) {
    if(!this.isVisible) {
      return false;
    }
    
    if(this.isRoot) {
      return false;
    } else {
      return this.handleComponent.containsPos(x, y);
    }
  }

  containsPosHalf(x : number,
                  y : number,
                  leftHalf : boolean) {
    if(!this.isVisible) {
      return false;
    }
    
    if(leftHalf) {
      return (x >= this.left) &&
        (x <= this.left + this.width/2) &&
        (y >= this.top) &&
        (y <= this.bottom);
    } else {
      return (x > this.left + this.width/2) &&
        (x <= this.right) &&
        (y >= this.top) &&
        (y <= this.bottom);
    }
  }

  setHoverState(hoverState : number) {
    if(hoverState != this.hoverState) {
      if(hoverState == HOVER_STATE_TOP) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_TOP);
      } else if( hoverState == HOVER_STATE_RIGHT ) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_RIGHT);
      } else if( hoverState == HOVER_STATE_LEFT ) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_LEFT);
      } else {
        if(this.selected) {
          this.textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
        } else {
          this.textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE);
        }
      }
      this.hoverState = hoverState;
    }
  }

  setSelected(selected : boolean) {
    if(selected) {
      this.updateTimeStamp();
    }
    
    if(selected != this.selected) {
      if(selected) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
      } else {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE);
      }
      this.selected = selected;
    }
  }

  toggleFolded() {
    if(this.hasChildren) {
      return this.setFolded(!this.folded);
    } else {
      return false;
    }
  }

  setFolded(folded : boolean) {
    if(folded != this.folded) {
      this.folded = folded;
      
      if(folded) {
        this.foldMarkComponent.setVisible(true);
        this.children.forEach(node => {
          node.setVisible(false);
        })
      } else {
        this.foldMarkComponent.setVisible(false);
        this.children.forEach(node => {
          node.setVisible(true);
        })
      }

      return true;
    } else {
      return false;
    }
  }

  setHandleShown(handleShown : boolean) {
    if(handleShown != this.handleShown) {
      if(handleShown) {
        this.handleComponent.setVisible(true);
      } else {
        this.handleComponent.setVisible(false);
      }
      this.handleShown = handleShown;
    }
  }

  checkHover(x : number,
             y : number) {
    if(this.isDummy) {
      return false;
    }
    
    if(this.containsPosForHandle(x, y)) {
      this.setHandleShown(true);
    } else {
      this.setHandleShown(false);
    }
  }
  
  checkGhostHover(x : number,
                  y : number) {
    if(this.isDummy) {
      return HOVER_STATE_NONE;
    }
    
    if(this.containsPosHalf(x, y, true)) {
      // 左半分
      if(this.isRoot) {
        // rootの場合
        this.setHoverState(HOVER_STATE_LEFT);
        return HOVER_HIT_OTHER_CHILD;
      } else {
        if(this.isLeft) {
          // 左Nodeの場合
          this.setHoverState(HOVER_STATE_LEFT);
          return HOVER_HIT_CHILD;
        } else {
          // 右Nodeの場合
          this.setHoverState(HOVER_STATE_TOP);
          return HOVER_HIT_SIBLING;
        }
      }
    } else if(this.containsPosHalf(x, y, false)) {
      // 右半分
      if(this.isRoot) {
        // rootの場合
        this.setHoverState(HOVER_STATE_RIGHT);
        return HOVER_HIT_CHILD;
      } else {
        if(this.isLeft) {
          // 左Nodeの場合
          this.setHoverState(HOVER_STATE_TOP);
          return HOVER_HIT_SIBLING;
        } else {
          // 右Nodeの場合
          this.setHoverState(HOVER_STATE_RIGHT);
          return HOVER_HIT_CHILD;
        }
      }
    } else {
      this.setHoverState(HOVER_STATE_NONE);
      return HOVER_STATE_NONE;
    }
  }

  clearGhostHover() {
    this.setHoverState(HOVER_STATE_NONE);
  }

  get isSelected() {
    return this.selected;
  }

  get isFolded() {
    return this.folded;
  }

  remove(removeNodeCallback : (node: Node) => void) {
    for(let i=this.children.length-1; i>=0; i-=1) {
      this.children[i].remove(removeNodeCallback);
    }
    
    if( this.parent != null ) {
      this.parent.removeChild(this);
    }

    if(this.textComponent != null) {
      this.textComponent.remove();
    }

    if(this.lineComponent != null) {
      this.lineComponent.remove();
    }

    if(this.handleComponent != null ) {
      this.handleComponent.remove();
    }

    if(this.foldMarkComponent != null ) {
      this.foldMarkComponent.remove();
    }
    
    // MapManager # nodes[]からこのnodeを削除する
    removeNodeCallback(this);
  }

  removeChild(node : Node) {
    let nodeIndex = this.children.indexOf(node);
    if(nodeIndex >= 0) {
      this.children.splice(nodeIndex, 1);
    }

    if(this.hasChildren && this.folded) {
      this.setFolded(false);
    }
  }

  detachFromParent() : Node | null {
    if(this.parent != null) {
      this.parent.removeChild(this);
      const oldParent = this.parent;
      this.parentNode = null;
      return oldParent;
    } else {
      return null;
    }
  }

  attachChildNodeToTail(node : Node) {
    if(this.folded) {
      // foldされていたら開いておく
      this.setFolded(false);
    }
    
    node.parentNode = this;

    this.addChildNode(node);
  }

  attachChildNodeAboveSibling(node : Node,
                              siblingNode : Node) {
    // nodeをsiblingNodeの上の兄弟にする
    node.parentNode = this;

    if(siblingNode.isLeft != node.isLeft) {
      node.changeSideRecursive(siblingNode.isLeft);
    }
    
    const nodeIndex = this.children.indexOf(siblingNode);
    if(nodeIndex >= 0) {
      this.children.splice(nodeIndex, 0, node);
    }
  }

  changeSideRecursive(isLeft : boolean) {
    // TREAT: handleとfold markの位置の変更が必要かどうかを調査
    
    this.isLeft = isLeft;
    
    this.children.forEach(node => {
      node.changeSideRecursive(isLeft);
    })
  }

  hasNodeInAncestor(node : Node) {
    let tmpNode = this.parent;
    
    while(tmpNode != null) {
      if(tmpNode === node) {
        return true;
      }
      tmpNode = tmpNode.parent;
    }
    return false;
  }
  
  getState() {
    const state : StateType = {
      'text'     : this.text,
      'shiftX'   : this.shiftX,
      'shiftY'   : this.shiftY,
      'selected' : this.selected,
      'folded'   : this.folded,
      'isLeft'   : this.isLeft,
    };
    
    const childStates = new Array<StateType>();
    this.children.forEach(node => {
      childStates.push(node.getState());
    })
    
    state['children'] = childStates;
    return state;
  }
  
  applyState(state : StateType) {
    this.setText(state['text']);
    
    this.shiftX = state['shiftX'];
    this.shiftY = state['shiftY'];
    this.isLeft = state['isLeft'];
    
    this.setSelected(state['selected']);
    this.setFolded(state['folded']);
    this.setHoverState(HOVER_STATE_NONE);
    this.setHandleShown(false);
  }

  updateTimeStamp() {
    this.timeStamp = Date.now();
  }

  getBottomDescendant(cursorDepth : number) : Node {
    let bottomChild = this.children[this.children.length-1];
    if(bottomChild.depth < cursorDepth && bottomChild.hasVisibleChildren) {
      return bottomChild.getBottomDescendant(cursorDepth);
    } else {
      return bottomChild;
    }
  }

  getTopDescendant(cursorDepth : number) : Node {
    let topChild = this.children[0];
    if(topChild.depth < cursorDepth && topChild.hasVisibleChildren) {
      return topChild.getTopDescendant(cursorDepth);
    } else {
      return topChild;
    }
  } 

  getSiblingOfChild(node : Node,
                    above : boolean,
                    cursorDepth : number ) : Node | null {
    let targetChildren = this.children;
    
    let nodeIndex;
    nodeIndex = targetChildren.indexOf(node);
    
    if(above) {
      // 上方向へ
      if(nodeIndex >= 1) {
        // 上のnode
        const aboveNode = targetChildren[nodeIndex-1]
        if(aboveNode.depth == cursorDepth) {
          return aboveNode;
        } else if(aboveNode.depth < cursorDepth) {
          if(aboveNode.hasVisibleChildren) {
            // aboveNodeの子孫を探す
            return aboveNode.getBottomDescendant(cursorDepth);
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
        return this.getSibling(above, cursorDepth);
      }
    } else {
      // 下方向へ
      if(nodeIndex <= targetChildren.length-2) {
        const belowNode = targetChildren[nodeIndex+1];
        if(belowNode.depth == cursorDepth) {
          return belowNode;
        } else if(belowNode.depth < cursorDepth) {
          if(belowNode.hasVisibleChildren) {
            // belowNodeの子を探す
            return belowNode.getTopDescendant(cursorDepth);
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
        return this.getSibling(above, cursorDepth);
      }
    }
  }
  
  getSibling(above : boolean,
             cursorDepth : number) {
    // カーソル上下移動時に利用
    if(this.parent == null) {
      return null;
    }
    
    return this.parent.getSiblingOfChild(this, above, cursorDepth);
  }
  
  get depth() : number {
    let p = this.parent;
    let depth = 0;
    while(p != null) {
      p = p.parent;
      depth += 1;
    }
    return depth;
  }

  getLatestVisibleChild() : Node | null {
    if(!this.hasVisibleChildren) {
      return null;
    }
    
    let latestChildNode = null;
    let latestTimeStamp = -1;
    
    this.children.forEach(node => {
      if(node.timeStamp >= latestTimeStamp ) {
        latestTimeStamp = node.timeStamp;
        latestChildNode = node;
      }
    })
    
    return latestChildNode;
  }

  checkCopiable(otherNodes : Array<Node>) : boolean {
    let p = this.parent;
    while(p != null) {
      let found = false
      otherNodes.forEach(otherNode => {
        if(otherNode === p) {
          found = true;
        }
      })
      if(found) {
        return false;
      }
      p = p.parent;
    }
    return true;
  }

  debugDump() {
    console.log('[' + this.text + ']')
    console.log('  x       : ' + this.x);
    console.log('  y       : ' + this.y);
    console.log('  shiftY  : ' + this.shiftY);
    console.log('  isLeft  : ' + this.isLeft);
    console.log('  topY    : ' + this.topY);
    console.log('  bottomY : ' + this.bottomY);
    console.log('  selected: ' + this.selected);
    if(this.parentNode != null) {
      console.log('  parent : ' + this.parentNode.text);
    }
  }
}
