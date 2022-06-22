import {getElementDimension} from './text-utils'

export const SPAN_Y_PER_NODE = 30.0       // 1ノードの取る縦幅

export const HOVER_NONE  = 0
export const HOVER_TOP   = 1
export const HOVER_RIGHT = 2

const OFFSET_Y_FOR_SINGLE_CHILD = -3.0
const GAP_X = 20
const HANDLE_WIDTH  = 10
const HANDLE_HEIGHT = 18

const NAME_SPACE = 'http://www.w3.org/2000/svg'

const TEXT_COMPONENT_STYLE_NONE        = 0
const TEXT_COMPONENT_STYLE_HOVER_TOP   = 1
const TEXT_COMPONENT_STYLE_HOVER_RIGHT = 2
const TEXT_COMPONENT_STYLE_SELECTED    = 3


class TextComponent {
  constructor(container, isRoot) {
    const foreignObject = document.createElementNS(NAME_SPACE, 'foreignObject')
    this.foreignObject = foreignObject

    foreignObject.classList.add('node')
    if(isRoot) {
      foreignObject.classList.add('root-node')
    }

    container.appendChild(foreignObject)

    const span = document.createElement('span')
    this.span = span
    
    // テキスト選択無効のクラスを指定
    span.className = 'disable-select';
    foreignObject.appendChild(span)
  }

  setText(text) {
    this.text = text
    this.span.textContent = text

    // TODO: classの指定が他にも考慮必要か？
    const className = 'node'
    const dims = getElementDimension(this.foreignObject.innerHTML, className)

    this.foreignObject.width.baseVal.value = dims.width
    this.foreignObject.height.baseVal.value = dims.height
    
    this.width = dims.width
    this.height = dims.height
  }

  setPos(x, y) {
    this.foreignObject.x.baseVal.value = x
    this.foreignObject.y.baseVal.value = y
    
    this.x = x
    this.y = y
  }

  remove() {
    this.foreignObject.remove()
  }
  
  setStyle(style) {
    if(style == TEXT_COMPONENT_STYLE_SELECTED) {
      this.foreignObject.classList.add('node_selected')
      this.foreignObject.classList.remove('node_top_overlapped')
      this.foreignObject.classList.remove('node_right_overlapped')
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_TOP) {
      this.foreignObject.classList.remove('node_selected')
      this.foreignObject.classList.add('node_top_overlapped')
      this.foreignObject.classList.remove('node_right_overlapped')
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_RIGHT) {
      this.foreignObject.classList.remove('node_selected')
      this.foreignObject.classList.remove('node_top_overlapped')
      this.foreignObject.classList.add('node_right_overlapped')
    } else {
      this.foreignObject.classList.remove('node_selected')
      this.foreignObject.classList.remove('node_top_overlapped')
      this.foreignObject.classList.remove('node_right_overlapped')
    }
  }
}


class LineComponent {
  constructor(container) {
    const lineElement = document.createElementNS(NAME_SPACE, 'line')
    this.lineElement = lineElement
    
    // ラインの位置後ほどupdateLayout()時に設定
    this.setPos(0, 0, 0, 0)
    
    lineElement.setAttribute('stroke', '#7f7f7f')
    lineElement.setAttribute('stroke-width', 1)
    
    container.appendChild(lineElement)
  }

  setPos(sx, sy, ex, ey) {
    this.lineElement.setAttribute('x1', sx)
    this.lineElement.setAttribute('y1', sy)
    this.lineElement.setAttribute('x2', ex)
    this.lineElement.setAttribute('y2', ey)
  }

  remove() {
    this.lineElement.remove()
  }
}


class HandleComponent {
  constructor(container) {
    const handleElement = document.createElementNS(NAME_SPACE, 'ellipse')
    this.handleElement = handleElement
    
    handleElement.setAttribute('stroke', '#7f7f7f')
    handleElement.setAttribute('stroke-width', 1)
    handleElement.setAttribute('fill', 'none')
    
    handleElement.setAttribute('cx', 0)
    handleElement.setAttribute('cy', 0)
    handleElement.setAttribute('rx', HANDLE_WIDTH/2)
    handleElement.setAttribute('ry', HANDLE_HEIGHT/2+1)
    container.appendChild(handleElement)

    this.setVisible(false)
  }

  setVisible(visible) {
    if(visible) {
      this.handleElement.setAttribute('visibility', 'visible')
    } else {
      this.handleElement.setAttribute('visibility', 'hidden')
    }
  }

  setPos(x, y) {
    // Handleの右上をx,yとして指定する
    this.handleElement.setAttribute('cx', x-HANDLE_WIDTH/2)
    this.handleElement.setAttribute('cy', y+HANDLE_HEIGHT/2)
  }

  remove() {
    this.handleElement.remove()
  }
}


export class Node {
  constructor(text, parentNode, container) {
    this.parentNode = parentNode
    this.children = []    
    
    this.textComponent = new TextComponent(container, this.isRoot)
    
    if(!this.isRoot) {
      this.lineComponent = new LineComponent(container)
      this.handleComponent = new HandleComponent(container)
    } else {
      this.lineComponent = null
      this.handleCompnent = null
    }
    
    this.setText(text)
    
    this.shiftX = 0
    this.shiftY = 0
    this.adjustY = 0
    
    this.selected = false
    this.hoverState = HOVER_NONE
    this.handleShown = false
  }
  
  addChildNode(node) {
    this.children.push(node)
  }
  
  updateLayout(baseX, baseY) {
    if(this.isRoot) {
      // baseX,Yが原点(0,0)なのでbaseX,Yを左上に変更しておく
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
    
    const childBaseX = this.x + this.width + GAP_X
    
    // 子ノードのY方向の開始位置
    const childDefaultStartY = this.y + childYOffset -
          (this.children.length-1) / 2 * SPAN_Y_PER_NODE

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
  }

  updatePos(baseX, baseY) {
    this.x = baseX + this.shiftX 
    this.y = baseY + this.shiftY + this.adjustY
    
    this.textComponent.setPos(this.x, this.y)
    
    if(!this.isRoot) {
      const edgeStartPos = this.parentNode.edgeOutPos
      
      this.lineComponent.setPos(edgeStartPos.x,
                                edgeStartPos.y,
                                this.x,
                                this.y + this.height - 0.5) // lineの幅を考慮している
      this.handleComponent.setPos(this.x, this.y)
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
      return (x >= this.left-HANDLE_WIDTH) && (x <= this.left) &&
        (y >= this.top) && (y <= this.bottom)
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

  setHoverState(hoverState) {
    if(hoverState != this.hoverState) {
      if(hoverState == HOVER_TOP) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_TOP)
      } else if( hoverState == HOVER_RIGHT ) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_RIGHT)
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
    if(selected != this.selected) {
      if(selected) {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED)
      } else {
        this.textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE)
      }
      this.selected = selected
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
    if(this.containsPosHalf(x, y, true) && !this.isRoot) {
      // 左半分
      this.setHoverState(HOVER_TOP)
      return HOVER_TOP
    } else if(this.containsPosHalf(x, y, false)) {
      // 右半分
      this.setHoverState(HOVER_RIGHT)
      return HOVER_RIGHT
    } else {
      this.setHoverState(HOVER_NONE)
      return HOVER_NONE
    }
  }

  clearGhostHover() {
    this.setHoverState(HOVER_NONE)
  }

  get isSelected() {
    return this.selected
  }

  remove(removeNodeCallback) {
    for(let i=this.children.length-1; i>=0; i-=1) {
      this.children[i].remove(removeNodeCallback)
    }
    
    if( this.parent != null ) {
      this.parent.removeChild(this)
    }

    this.textComponent.remove()
    this.lineComponent.remove()
    this.handleComponent.remove()
    
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
    console.log('  selected=' + this.selected)
    if(this.parentNode != null) {
      console.log('  parent=' + this.parentNode.text)
    }
  }
}
