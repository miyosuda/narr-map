import {getElementDimension} from './text-utils'

// 1ノードの取る縦幅
export const SPAN_Y_PER_NODE = 30.0


export class Node {
  constructor(text, parentNode, container) {
    this.text = text
    this.parentNode = parentNode

    let ns = 'http://www.w3.org/2000/svg'
    let foreignObject = document.createElementNS(ns, 'foreignObject')
    
    foreignObject.classList.add('node')
    if(this.isRoot) {
      foreignObject.classList.add('root-node')
    }

    container.appendChild(foreignObject)
    
    this.foreignObject = foreignObject

    let span = document.createElement('span')
    // テキスト選択無効のクラスを指定
    span.className = 'disable-select';
    this.foreignObject.appendChild(span)
    this.span = span
    
    this.setText(this.text)

    this.children = []

    // edge line

    if( !this.isRoot ) {
      let lineElement = document.createElementNS(ns, 'line')
      this.lineElement = lineElement

      // ラインの位置後ほどupdateLayout()で設定
      lineElement.setAttribute('x1', 0)
      lineElement.setAttribute('y1', 0)
      lineElement.setAttribute('x2', 0)
      lineElement.setAttribute('y2', 0)
      
      lineElement.setAttribute('stroke', '#7f7f7f')
      lineElement.setAttribute('stroke-width', 1)

      container.appendChild(lineElement)
      this.lineElement = lineElement
    }

    this.selected = false
    
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
      childYOffset = -3.0
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
    // TODO: 共通化
    
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
        childYOffset = -3.0
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
    this.span.textContent = text
    this.updateWidthHeight()
  }

  updateWidthHeight() {
    let className = 'node'
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

  setSelected(selected) {
    if(selected) {
      this.foreignObject.classList.add("node_selected")
    } else {
      this.foreignObject.classList.remove("node_selected")
    }
    this.selected = selected
  }

  isSelected() {
    return this.selected
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
    
    removeNodeCallback(this)
  }

  removeChild(node) {
    const nodeIndex = this.children.indexOf(node)
    if(nodeIndex >= 0) {
      this.children.splice(nodeIndex, 1)
    }
  }

  debugDump() {
    console.log('[node ' + this.text + ']')
    console.log('  shiftY=' + this.shiftY)
    console.log('  adjustY=' + this.adjustY)
    const bounds = this.calcYBounds()
    console.log('  bounds.top=' + bounds.top)
    console.log('  bounds.bottom=' + bounds.bottom)
    console.log('  selected=' + this.selected)
  }
}
