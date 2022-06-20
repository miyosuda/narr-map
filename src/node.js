import {getElementDimension} from './text-utils'

// 1ノードの取る縦幅
export const SPAN_Y_PER_NODE = 30.0

export const OFFSET_Y_FOR_SINGLE_CHILD = -3.0

export const HOVER_NONE  = 0
export const HOVER_TOP   = 1
export const HOVER_RIGHT = 2


class States {
  constructor(foreignObject, handleElement, isRoot) {
    this.foreignObject = foreignObject
    this.handleElement = handleElement
    
    this.selected = false
    this.hoverState = HOVER_NONE
    this.handleShown = false

    foreignObject.classList.add('node')
    if(this.isRoot) {
      foreignObject.classList.add('root-node')
    }
  }

  setHoverState(hoverState) {
    if(hoverState != this.hoverState) {
      if(hoverState == HOVER_TOP) {
        this.foreignObject.classList.remove("node_selected")
        this.foreignObject.classList.remove("node_right_overlapped")
        this.foreignObject.classList.add("node_top_overlapped")
      } else if( hoverState == HOVER_RIGHT ) {
        this.foreignObject.classList.remove("node_selected")
        this.foreignObject.classList.remove("node_top_overlapped")
        this.foreignObject.classList.add("node_right_overlapped")
      } else {
        this.foreignObject.classList.remove("node_top_overlapped")
        this.foreignObject.classList.remove("node_right_overlapped")
        if(this.selected) {
          this.foreignObject.classList.add("node_selected")
        }
      }
      this.hoverState = hoverState
    }
  }

  setSelected(selected) {
    if(selected != this.selected) {
      if(selected) {
        this.foreignObject.classList.add("node_selected")
      } else {
        this.foreignObject.classList.remove("node_selected")
      }
      this.selected = selected
    }
  }

  setHandleShown(handleShown) {
    if(handleShown != this.handleShown) {
      if(handleShown) {
        this.handleElement.setAttribute('visibility', 'visible')
      } else {
        this.handleElement.setAttribute('visibility', 'hidden')
      }
      this.handleShown = handleShown
    }
  }
}


export class Node {
  constructor(text, parentNode, container) {
    this.parentNode = parentNode

    const ns = 'http://www.w3.org/2000/svg'
    const foreignObject = document.createElementNS(ns, 'foreignObject')
    
    foreignObject.classList.add('node')
    if(this.isRoot) {
      foreignObject.classList.add('root-node')
    }

    container.appendChild(foreignObject)
    
    this.foreignObject = foreignObject

    const span = document.createElement('span')
    // テキスト選択無効のクラスを指定
    span.className = 'disable-select';
    this.foreignObject.appendChild(span)
    this.span = span
    
    this.setText(text)

    this.children = []

    if( !this.isRoot ) {
      // Edge line
      const lineElement = document.createElementNS(ns, 'line')
      this.lineElement = lineElement

      // ラインの位置後ほどupdateLayout()で設定
      lineElement.setAttribute('x1', 0)
      lineElement.setAttribute('y1', 0)
      lineElement.setAttribute('x2', 0)
      lineElement.setAttribute('y2', 0)
      
      lineElement.setAttribute('stroke', '#7f7f7f')
      lineElement.setAttribute('stroke-width', 1)
      container.appendChild(lineElement)

      // Handle
      const handleElement = document.createElementNS(ns, 'ellipse')
      this.handleElement = handleElement
      
      handleElement.setAttribute('stroke', '#7f7f7f')
      handleElement.setAttribute('stroke-width', 1)
      handleElement.setAttribute('fill', 'none')

      // TODO: 定数指定
      handleElement.setAttribute('cx', 0)
      handleElement.setAttribute('cy', 0)
      handleElement.setAttribute('rx', 5)
      handleElement.setAttribute('ry', 10)
      handleElement.setAttribute('visibility', 'hidden')
      container.appendChild(handleElement)
      
      this.states = new States(foreignObject, handleElement, false)
    } else {
      this.states = new States(foreignObject, null, true)
    }

    this.shiftX = 0
    this.shiftY = 0

    this.adjustY = 0
  }
  
  addChildNode(node) {
    this.children.push(node)
  }

  updateLayout(baseX, baseY) {
    if(this.isRoot) {
      // baseX,Yが原点(0,0)なのでbaseX,Yを左上に変更しておく.
      baseX = -this.width / 2
      baseY = -this.height / 2
    }
    // baseX,YにshirtX,Yを足してx,yとする
    this.updatePos(baseX, baseY)

    let childYOffset = 0.0
    if( this.children.length == 1 ) {
      // 子が1ノードしかない場合は少し上に上げておく
      childYOffset = OFFSET_Y_FOR_SINGLE_CHILD
    }

    const childBaseX = this.x + this.width + 20
    // 子ノードのY方向の開始位置
    const childDefaultStartY = this.y + childYOffset - (this.children.length-1) / 2 * SPAN_Y_PER_NODE

    for(let i=0; i<this.children.length; i++) {
      const node = this.children[i]
      // 各ノードのx,yを更新する
      const nodeDefaultY = childDefaultStartY + i * SPAN_Y_PER_NODE
      node.updateLayout(childBaseX, nodeDefaultY)
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

  get parent() {
    return this.parentNode
  }
  
  setText(text) {
    this.text = text
    this.span.textContent = text
    this.updateWidthHeight()
  }

  updateWidthHeight() {
    const className = 'node'
    const dims = getElementDimension(this.foreignObject.innerHTML, className)

    this.width = dims.width
    this.height = dims.height
  }

  updatePos(baseX, baseY) {
    this.foreignObject.width.baseVal.value = this.width
    this.foreignObject.height.baseVal.value = this.height

    this.x = baseX + this.shiftX 
    this.y = baseY + this.shiftY + this.adjustY

    this.foreignObject.x.baseVal.value = this.x
    this.foreignObject.y.baseVal.value = this.y

    if(!this.isRoot) {
      const edgeStartPos = this.parentNode.edgeOutPos
      this.lineElement.setAttribute('x1', edgeStartPos.x)
      this.lineElement.setAttribute('y1', edgeStartPos.y)
      this.lineElement.setAttribute('x2', this.x)
      this.lineElement.setAttribute('y2', this.y + this.height - 0.5) // lineの幅を考慮している
      // TODO: 定数指定
      this.handleElement.setAttribute('cx', this.x-5)
      this.handleElement.setAttribute('cy', this.y+9)
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
    return (x >= this.left) && (x <= this.right) && (y >= this.top) && (y <= this.bottom)
  }

  containsPosForHandle(x, y) {
    if(this.isRoot) {
      return false
    } else {
      return (x >= this.left-10) && (x <= this.left) && (y >= this.top) && (y <= this.bottom)
    }
  }

  containsPosHalf(x, y, leftHalf) {
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

  checkHover(x, y) {
    if(this.containsPosForHandle(x, y)) {
      this.states.setHandleShown(true)
    } else {
      this.states.setHandleShown(false)
    }
  }

  checkGhostHover(x, y) {
    if(this.containsPosHalf(x, y, true) && !this.isRoot) {
      // 左半分
      this.states.setHoverState(HOVER_TOP)
      return HOVER_TOP
    } else if(this.containsPosHalf(x, y, false)) {
      // 右半分
      this.states.setHoverState(HOVER_RIGHT)
      return HOVER_RIGHT
    } else {
      this.states.setHoverState(HOVER_NONE)
      return HOVER_NONE
    }
  }

  clearGhostHover() {
    this.states.setHoverState(HOVER_NONE)
  }

  setHandleShown(handleShown) {
    this.states.setHandleShown(handleShown)
  }

  setSelected(selected) {
    this.states.setSelected(selected)
  }

  get isSelected() {
    return this.states.selected
  }

  remove(removeNodeCallback) {
    for(let i=this.children.length-1; i>=0; i-=1) {
      this.children[i].remove(removeNodeCallback)
    }
    
    if( this.parent != null ) {
      this.parent.removeChild(this)
    }
    
    this.foreignObject.remove()
    this.lineElement.remove()

    // MapManager # nodes[]からこのnodeを削除する
    removeNodeCallback(this)
  }

  removeChild(node) {
    const nodeIndex = this.children.indexOf(node)
    if(nodeIndex >= 0) {
      this.children.splice(nodeIndex, 1)
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
    node.parentNode = this
    this.addChildNode(node)
  }

  attachChildNodeAboveSibling(node, siblingNode) {
    node.parentNode = this
    const nodeIndex = this.children.indexOf(siblingNode)
    if(nodeIndex >= 0) {
      this.children.splice(nodeIndex, 0, node)
    }
  }

  hasNodeInAncestor(node) {
    let tmpNode = this.parent
    
    while(tmpNode != null) {
      if(tmpNode == node) {
        return true
      }
      tmpNode = tmpNode.parent
    }
    return false
  }

  debugDump() {
    console.log('[node ' + this.text + ']')
    console.log('  shiftY=' + this.shiftY)
    console.log('  adjustY=' + this.adjustY)
    const bounds = this.calcYBounds()
    console.log('  bounds.top=' + bounds.top)
    console.log('  bounds.bottom=' + bounds.bottom)
    console.log('  selected=' + this.states.selected)
    if(this.parentNode != null) {
      console.log('  parent=' + this.parentNode.text)
    }
  }
}
