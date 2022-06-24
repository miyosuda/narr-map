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
} from './components.js'
  
export const SPAN_Y_PER_NODE = 30.0 // 1ノードの取る縦幅

const HOVER_STATE_NONE  = 0
const HOVER_STATE_TOP   = 1
const HOVER_STATE_RIGHT = 2
const HOVER_STATE_LEFT  = 3

export const HOVER_HIT_NONE        = 0
export const HOVER_HIT_SIBLING     = 1
export const HOVER_HIT_CHILD       = 2
export const HOVER_HIT_OTHER_CHILD = 3

const OFFSET_Y_FOR_SINGLE_CHILD = -3.0
const GAP_X = 20


export class Node {
  constructor(parentNode, container, isLeft=false) {
    this.parentNode = parentNode
    this.children = []
    if(this.isRoot) {
      // rootの左側のchildren
      this.otherChildren = []
    }
    
    this.textComponent = new TextComponent(container, this.isRoot)

    if(!this.isRoot) {
      this.lineComponent = new LineComponent(container)
      this.handleComponent = new HandleComponent(container)
      this.foldMarkComponent = new FoldMarkComponent(container)
    } else {
      this.lineComponent = null
      this.handleCompnent = null
      this.foldMarkComponent = null
    }
    
    this.setText('')

    this.shiftX = 0
    this.shiftY = 0
    this.adjustY = 0
    
    this.selected = false
    this.hoverState = HOVER_STATE_NONE
    this.handleShown = false
    this.folded = false
    
    this.isLeft = isLeft
  }

  get isVisible() {
    return this.textComponent.isVisible
  }

  setVisible(visible) {
    if(this.isVisible != visible) {
      this.textComponent.setVisible(visible)
      
      if(this.lineComponent != null) {
        this.lineComponent.setVisible(visible)
      }
      if(this.handleComponent != null) {
        if(visible) {
          if(this.handleShown) {
            this.handleComponent.setVisible(visible)
          } else {
            this.handleComponent.setVisible(false)
          }
        } else {
          this.handleComponent.setVisible(visible)
        }
      }
      if(this.foldMarkComponent != null) {
        if(visible) {
          if(this.folded) {
            this.foldMarkComponent.setVisible(visible)
          } else {
            this.foldMarkComponent.setVisible(false)
          }
        } else {
          this.foldMarkComponent.setVisible(visible)
        }        
      }

      this.children.forEach(node => {
        node.setVisible(visible)
      })
    }
  }
  
  addChildNode(node) {
    if(this.isRoot && node.isLeft) {
      this.otherChildren.push(node)
    } else {
      this.children.push(node)
    }
  }

  updateLayoutSub(baseY, children) {
    if(children.length == 0) {
      return
    }
    
    let childYOffset = 0.0
    if( this.children.length == 1 ) {
      // 子が1ノードしかない場合は少し上に上げておく
      childYOffset = OFFSET_Y_FOR_SINGLE_CHILD
    }
    
    const toLeft = children[0].isLeft
    
    let childBaseX = 0
    if(!toLeft) {
      childBaseX = this.x + this.width + GAP_X
    } else {
      childBaseX = this.x - GAP_X
    }
    
    // 子ノードのY方向の開始位置
    const childDefaultStartY = this.y + childYOffset -
          (children.length-1) / 2 * SPAN_Y_PER_NODE
    
    for(let i=0; i<children.length; i++) {
      const node = children[i]
      // 各ノードのx,yを更新する
      const nodeDefaultY = childDefaultStartY + i * SPAN_Y_PER_NODE
      node.updateLayout(childBaseX, nodeDefaultY)
    }
  }
  
  updateLayout(baseX, baseY) {
    if(this.isRoot) {
      // baseX,Yが原点(0,0)なのでbaseX,Yを左上に変更しておく
      baseX = -this.width / 2
      baseY = -this.height / 2
    }
    // baseX,YにshiftX,Yを足してx,yとする
    this.updatePos(baseX, baseY)
    
    this.updateLayoutSub(baseY, this.children)
    if(this.isRoot) {
      this.updateLayoutSub(baseY, this.otherChildren)
    }
  }

  calcYBounds() {
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    
    if(this.children.length == 0) {
      // 子Nodeが無い場合
      top = 0
      bottom = SPAN_Y_PER_NODE
    } else {
      // 子Nodeがある場合
      let childYOffset = 0.0
      if( this.children.length == 1 ) {
        // 子が1ノードしかない場合は少し上に上げておく
        childYOffset = OFFSET_Y_FOR_SINGLE_CHILD
      }
      
      // 子ノードのY方向の開始位置
      let offsetY = childYOffset - (this.children.length-1) / 2 * SPAN_Y_PER_NODE
      
      for(let i=0; i<this.children.length; i++) {
        const node = this.children[i]
        // 子Nodeのboundsを算出する
        const childYBounds = node.calcYBounds()
        const childTop    = offsetY + childYBounds.top    + node.adjustY
        const childBottom = offsetY + childYBounds.bottom + node.adjustY
        
        if(childTop < top) {
          top = childTop
        }
        
        if(childBottom > bottom) {
          bottom = childBottom
        }
        
        offsetY += SPAN_Y_PER_NODE
      }
    }
    
    const bounds = {}
    
    if(top > 0) {
      top = 0
    }
    if(bottom < SPAN_Y_PER_NODE) {
      bottom = SPAN_Y_PER_NODE
    }
    
    if(this.shiftY <= 0) {
      // 上にシフトされているのでtopを上に移動 (上にスペースを作る)
      top += this.shiftY
    } else {
      // 下にシフト. bottomを下に移動 (下にスペースを作る)
      bottom += this.shiftY
    }
    
    bounds.top = top
    bounds.bottom = bottom
    return bounds
  }

  get hasChildren() {
    if(this.isRoot) {
      // TODO: これで問題ないか要確認
      return this.children.length > 0 || this.otherChildren.length > 0
    } else {
      return this.children.length > 0
    }
  }

  get hasVisibleChildren() {
    if(this.folded) {
      return false
    } else {
      return this.hasChildren
    }
  }
  
  get hasParent() {
    return this.parentNode != null
  }
  
  get parent() {
    return this.parentNode
  }

  get width() {
    return this.textComponent.width
  }
  
  get height() {
    return this.textComponent.height
  }

  get text() {
    return this.textComponent.text
  }
  
  setText(text) {
    this.textComponent.setText(text)
    this.updateTimeStamp()
  }

  updatePos(baseX, baseY) {
    if(this.isLeft) {
      this.x = baseX - this.width + this.shiftX
    } else {
      this.x = baseX + this.shiftX
    }

    this.y = baseY + this.shiftY + this.adjustY
    
    this.textComponent.setPos(this.x, this.y)
    
    if(!this.isRoot) {
      const edgeStartPos = this.parentNode.edgeOutPos
      
      this.lineComponent.setPos(edgeStartPos.x,
                                edgeStartPos.y,
                                this.x,
                                this.y + this.height - 0.5) // lineの幅を考慮している
      this.handleComponent.setPos(this.x, this.y)
      this.foldMarkComponent.setPos(this.x + this.width, this.y + this.height)
    }
  }
  
  get isRoot() {
    return this.parentNode == null
  }
  
  get edgeOutPos() {
    const pos = {}
    
    if(this.isRoot) {
      pos.x = this.x + this.width / 2
      pos.y = this.y + this.height / 2
    } else {
      pos.x = this.x + this.width
      pos.y = this.y + this.height - 0.5 // lineの幅を考慮している
    }
    
    return pos
  }

  get left() {
    return this.x
  }

  get top() {
    return this.y
  }

  get right() {
    return this.x + this.width
  }

  get bottom() {
    return this.y + this.height
  }

  onDragStart() {
    this.startElementX = this.shiftX
    this.startElementY = this.shiftY
  }

  onDrag(dx, dy) {
    this.shiftX = this.startElementX + dx
    this.shiftY = this.startElementY + dy

    // ここではforeignObjectのx,y座標はまだ更新していない
  }

  containsPos(x, y) {
    if(!this.isVisible) {
      return false
    }
    return (x >= this.left) && (x <= this.right) && (y >= this.top) && (y <= this.bottom)
  }

  containsPosForHandle(x, y) {
    // TREAT: left対応, 右側にHandleが来る
    if(!this.isVisible) {
      return false
    }
    
    if(this.isRoot) {
      return false
    } else {
      return (x >= this.left-HANDLE_WIDTH) && (x <= this.left) &&
        (y >= this.top) && (y <= this.bottom)
    }
  }

  containsPosHalf(x, y, leftHalf) {
    if(!this.isVisible) {
      return false
    }
    
    if(leftHalf) {
      return (x >= this.left) &&
        (x <= this.left + this.width/2) &&
        (y >= this.top) &&
        (y <= this.bottom)
    } else {
      return (x > this.left + this.width/2) &&
        (x <= this.right) &&
        (y >= this.top) &&
        (y <= this.bottom)
    }
  }

  setHoverState(hoverState) {
    if(hoverState != this.hoverState) {
      if(hoverState == HOVER_STATE_TOP) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_TOP)
      } else if( hoverState == HOVER_STATE_RIGHT ) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_RIGHT)
      } else if( hoverState == HOVER_STATE_LEFT ) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_LEFT)
      } else {
        if(this.selected) {
          this.textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED)
        } else {
          this.textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE)
        }
      }
      this.hoverState = hoverState
    }
  }

  setSelected(selected) {
    if(selected) {
      this.updateTimeStamp()
    }
    
    if(selected != this.selected) {
      if(selected) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED)
      } else {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE)
      }
      this.selected = selected
    }
  }

  toggleFolded() {
    if(this.hasChildren) {
      this.setFolded(!this.folded)
    }
  }

  setFolded(folded) {
    if(folded != this.folded) {
      if(folded) {
        this.foldMarkComponent.setVisible(true)
        this.children.forEach(node => {
          node.setVisible(false)
        })  
      } else {
        this.foldMarkComponent.setVisible(false)
        this.children.forEach(node => {
          node.setVisible(true)
        })
      }
      this.folded = folded
    }
  }

  setHandleShown(handleShown) {
    if(handleShown != this.handleShown) {
      if(handleShown) {
        this.handleComponent.setVisible(true)
      } else {
        this.handleComponent.setVisible(false)
      }
      this.handleShown = handleShown
    }
  }

  checkHover(x, y) {
    if(this.containsPosForHandle(x, y)) {
      this.setHandleShown(true)
    } else {
      this.setHandleShown(false)
    }
  }
  
  checkGhostHover(x, y) {
    if(this.containsPosHalf(x, y, true)) {
      // 左半分
      if(this.isRoot) {
        // rootの場合
        this.setHoverState(HOVER_STATE_LEFT)
        return HOVER_HIT_OTHER_CHILD
      } else {
        if(this.isLeft) {
          // 左Nodeの場合
          this.setHoverState(HOVER_STATE_LEFT)
          return HOVER_HIT_CHILD
        } else {
          // 右Nodeの場合
          this.setHoverState(HOVER_STATE_TOP)
          return HOVER_HIT_SIBLING
        }
      }
    } else if(this.containsPosHalf(x, y, false)) {
      // 右半分
      if(this.isRoot) {
        // rootの場合
        this.setHoverState(HOVER_STATE_RIGHT)
        return HOVER_HIT_CHILD
      } else {
        if(this.isLeft) {
          // 左Nodeの場合
          this.setHoverState(HOVER_STATE_TOP)
          return HOVER_HIT_SIBLING          
        } else {
          // 右Nodeの場合
          this.setHoverState(HOVER_STATE_RIGHT)
          return HOVER_HIT_CHILD
        }
      }
    } else {
      this.setHoverState(HOVER_STATE_NONE)
      return HOVER_STATE_NONE
    }
  }

  clearGhostHover() {
    this.setHoverState(HOVER_STATE_NONE)
  }

  get isSelected() {
    return this.selected
  }

  remove(removeNodeCallback) {
    // TREAT: left対応
    for(let i=this.children.length-1; i>=0; i-=1) {
      this.children[i].remove(removeNodeCallback)
    }
    if(this.isRoot) {
      for(let i=this.children.length-1; i>=0; i-=1) {
        this.otherChildren[i].remove(removeNodeCallback)
      }   
    }
    
    if( this.parent != null ) {
      this.parent.removeChild(this)
    }

    this.textComponent.remove()

    if(this.lineComponent != null) {
      this.lineComponent.remove()
    }

    if(this.handleComponent != null ) {
      this.handleComponent.remove()
    }

    if(this.foldMarkComponent != null ) {
      this.foldMarkComponent.remove()
    }
    
    // MapManager # nodes[]からこのnodeを削除する
    removeNodeCallback(this)
  }

  removeChild(node) {
    // TREAT: left対応
    let nodeIndex = this.children.indexOf(node)
    if(nodeIndex >= 0) {
      this.children.splice(nodeIndex, 1)
    }
    if(this.isRoot && nodeIndex < 0) {
      nodeIndex = this.otherChildren.indexOf(node)
      if(nodeIndex >= 0) {
        this.otherChildren.splice(nodeIndex, 1)
      }
    }

    if(this.hasChildren && this.folded) {
      this.setFolded(false)
    }
  }

  detachFromParent() {
    if(this.parent != null) {
      this.parent.removeChild(this)
      const oldParent = this.parent
      this.parentNode = null
      return oldParent
    } else {
      return null
    }
  }

  attachChildNodeToTail(node) {
    // TREAT: nodeを左に入れる時の対応
    
    if(this.folded) {
      // foldされていたら開いておく
      this.setFolded(false)
    }
    
    node.parentNode = this

    // TREAT: 今addChildNode()の中でnode.isLeftをみてotherに入れるかどうかを決めている
    this.addChildNode(node)
  }

  attachChildNodeAboveSibling(node, siblingNode) {
    // nodeをsiblingNodeの上の兄弟にする
    node.parentNode = this

    if(siblingNode.isLeft != node.isLeft) {
      node.changeSideRecursive(siblingNode.isLeft)
    }
    
    if(this.isRoot && siblingNode.isLeft ) {
      const nodeIndex = this.otherChildren.indexOf(siblingNode)
      if(nodeIndex >= 0) {
        this.otherChildren.splice(nodeIndex, 0, node)
      } 
    } else {
      const nodeIndex = this.children.indexOf(siblingNode)
      if(nodeIndex >= 0) {
        this.children.splice(nodeIndex, 0, node)
      }
    }
  }

  changeSideRecursive(isLeft) {
    // TREAT: handleとfold markの位置の変更が必要かどうかを調査
    
    this.isLeft = isLeft
    
    this.children.forEach(node => {
      changeSideRecursive(isLeft)
    })
  }

  hasNodeInAncestor(node) {
    let tmpNode = this.parent
    
    while(tmpNode != null) {
      if(tmpNode === node) {
        return true
      }
      tmpNode = tmpNode.parent
    }
    return false
  }
  
  getState() {
    const state = {
      'text'     : this.text,
      'shiftX'   : this.shiftX,
      'shiftY'   : this.shiftY,
      'adjustY'  : this.adjustY,
      'selected' : this.selected,
      'folded'   : this.folded,
      'isLeft'   : this.isLeft,
    }
    
    const childStates = []
    this.children.forEach(node => {
      childStates.push(node.getState())
    })
    
    state['children'] = childStates
    
    if(this.isRoot) {
      const otherChildStates = []
      this.otherChildren.forEach(node => {
        otherChildStates.push(node.getState())
      })
      state['otherChildren'] = otherChildStates
    }
    
    return state
  }
  
  applyState(state) {
    this.setText(state['text'])
    
    this.shiftX = state['shiftX']
    this.shiftY = state['shiftY']
    this.adjustY = state['adjustY']
    this.isLeft = state['isLeft']
    
    this.setSelected(state['selected'])
    this.setFolded(state['folded'])
    this.setHoverState(HOVER_NONE)
    this.setHandleShown(false)
  }

  updateTimeStamp() {
    this.timeStamp = Date.now()
  }

  getBottomDescendant(cursorDepth) {
    let bottomChild = this.children[this.children.length-1]
    if(bottomChild.depth < cursorDepth && bottomChild.hasVisibleChildren) {
      return bottomChild.getBottomDescendant(cursorDepth)
    } else {
      return bottomChild
    }
  }

  getTopDescendant(cursorDepth) {
    let topChild = this.children[0]
    if(topChild.depth < cursorDepth && topChild.hasVisibleChildren) {
      return topChild.getTopDescendant(cursorDepth)
    } else {
      return topChild
    }
  } 

  getSiblingOfChild(node, above, cursorDepth) {
    const nodeIndex = this.children.indexOf(node)
    
    if(above) {
      // 上方向へ
      if(nodeIndex >= 1) {
        // 上のnode
        const aboveNode = this.children[nodeIndex-1]
        if(aboveNode.depth == cursorDepth) {
          return aboveNode
        } else if(aboveNode.depth < cursorDepth) {
          if(aboveNode.hasVisibleChildren) {
            // aboveNodeの子孫を探す
            return aboveNode.getBottomDescendant(cursorDepth)
          } else {
            return aboveNode
          }
        } else {
          console.log('この場合はないはず(above)')
          // aboveNode.depth > cursorDepth の場合
          return aboveNode
        }
      } else {
        // nodeが既にtopのnodeだった
        return this.getSibling(above, cursorDepth)
      }
    } else {
      // 下方向へ
      if(nodeIndex <= this.children.length-2) {
        const belowNode = this.children[nodeIndex+1]
        if(belowNode.depth == cursorDepth) {
          return belowNode
        } else if(belowNode.depth < cursorDepth) {
          if(belowNode.hasVisibleChildren) {
            // belowNodeの子を探す
            return belowNode.getTopDescendant(cursorDepth)
          } else {
            return belowNode
          }
        } else {
          console.log('この場合はないはず(below)')
          // belowNode.depth > cursorDepth の場合
          return belowNode
        }
      } else {
        // nodeが既にbottomのnodeだった
        return this.getSibling(above, cursorDepth)
      }
    }
  }
  
  getSibling(above, cursorDepth) {
    if(this.parent == null) {
      return null
    }
    
    return this.parent.getSiblingOfChild(this, above, cursorDepth)
  }
  
  get depth() {
    let p = this.parent
    let depth = 0
    while(p != null) {
      p = p.parent
      depth += 1
    }
    return depth
  }

  getLatestVisibleChild() {
    if(!this.hasVisibleChildren) {
      return null
    }
    
    let latestChildNode = null
    let latestTimeStamp = -1
    
    this.children.forEach(node => {
      if(node.timeStamp >= latestTimeStamp ) {
        latestTimeStamp = node.timeStamp
        latestChildNode = node
      }
    })
    
    return latestChildNode
  }

  debugDump() {
    console.log('[node ' + this.text + ']')
    console.log('  shiftY=' + this.shiftY)
    console.log('  adjustY=' + this.adjustY)
    console.log('  isLeft=' + this.isLeft)
    const bounds = this.calcYBounds()
    console.log('  bounds.top=' + bounds.top)
    console.log('  bounds.bottom=' + bounds.bottom)
    console.log('  selected=' + this.selected)
    if(this.parentNode != null) {
      console.log('  parent=' + this.parentNode.text)
    }
  }
}
