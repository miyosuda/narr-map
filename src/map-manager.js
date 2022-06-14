//import {TextInput} from './text-input'

import {getElementDimension} from './text-utils'


class Node {
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

    // 1ノードの高さは30とする
    const spanYPerNode = 30.0
    let childYOffset = 0.0
    if( this.children.length == 1 ) {
      // 子が1ノードしかない場合は少し上に上げておく
      childYOffset = -3.0
    }

    const childBaseX = this.x + this.width + 20
    // 子ノードのY方向の開始位置
    const childDefaultStartY = this.y + childYOffset - (this.children.length-1) / 2 * spanYPerNode

    for(let i=0; i<this.children.length; i++) {
      const node = this.children[i]
      // 各ノードのx,yを更新する
      const nodeDefaultY = childDefaultStartY + i * spanYPerNode
      node.updateLayout(childBaseX, nodeDefaultY)
    }
  }

  calcYBounds() {
    // TODO: 共通化
    
    // 1ノードの高さは30とする
    const spanYPerNode = 30.0

    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY

    if(this.children.length == 0) {
      // 子Nodeが無い場合
      top = 0
      bottom = spanYPerNode
    } else {
      // 子Nodeがある場合      
      let childYOffset = 0.0
      if( this.children.length == 1 ) {
        // 子が1ノードしかない場合は少し上に上げておく
        childYOffset = -3.0
      }
      
      // 子ノードのY方向の開始位置
      let offsetY = childYOffset - (this.children.length-1) / 2 * spanYPerNode
      
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
        
        offsetY += spanYPerNode
      }
    }
    
    const bounds = {}

    if(top > 0) {
      top = 0
    }
    if(bottom < spanYPerNode) {
      bottom = spanYPerNode
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

  /*
  remove() {
    this.foreignObject.remove()
  }
  */

  debugDump() {
    console.log('[node ' + this.text + ']')
    console.log('  shiftY=' + this.shiftY)
    console.log('  adjustY=' + this.adjustY)
    const bounds = this.calcYBounds()
    console.log('  bounds.top=' + bounds.top)
    console.log('  bounds.bottom=' + bounds.bottom)
  }
}


const DRAG_NONE = 0
const DRAG_NODE = 1
const DRAG_BACK = 1


export class MapManager {
  constructor() {
    this.init()
  }

  init() {
    this.isDragging = false
    this.dragStartX = 0
    this.dragStartY = 0
    this.selectedNodes = []
    this.nodes = []
    this.lastNode = null    
  }

  prepare() {
    this.svg = document.getElementById('svg')
    
    this.onResize()

    document.onmousedown = event => this.onMouseDown(event)
    document.onmouseup   = event => this.onMouseUp(event)
    document.onmousemove = event => this.onMouseMove(event)
    document.body.addEventListener('keydown',  event => this.onKeyDown(event))
    //this.textInput = new TextInput(this)

    this.addRootNode()
  }

  addRootNode() {
    const g = document.getElementById('nodes') 
    let node = new Node('root', null, g)
    this.nodes.push(node)
    this.lastNode = node

    this.updateLayout()
  }

  onResize() {
    // なぜかmarginをつけないとスクロールバーが出てしまう
    const margin = 2
    
    this.svg.setAttribute('width', window.innerWidth - margin)
    this.svg.setAttribute('height', window.innerHeight - margin)
  }

  findPickNode(x, y) {
    let pickNode = null
    
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i]
      if( node.containsPos(x, y) ) {
        pickNode = node
        break
      }
    }
    return pickNode
  }

  onMouseDown(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }

    /*
    if( this.textInput.isShown() ) {
      // textInput表示中なら何もしない
      return
    }
    */
    
    const pos = this.getLocalPos(e)
    const x = pos.x
    const y = pos.y
    
    // マウスが乗ったnodeをpick対象として選ぶ
    let pickNode = this.findPickNode(x, y)

    let dragMode = DRAG_NONE
    const shitDown = e.shiftKey
    let clearSelection = false
    
    // selected nodesを一旦クリア
    this.selectedNodes = []
    
    if(pickNode != null) {
      // pickNodeがあった場合
      if(shitDown) {
        if(pickNode.isSelected()) {
          // shift押下でselectedなnodeをpick.
          // pickNodeを選択済みでなくす.
          pickNode.setSelected(false)
          // ドラッグは開始しない. エリア選択も開始しない.
          // 他のnodeのselected状態はそのままキープ.
          dragMode = DRAG_NONE
        } else {
          // shift押下で、pickNodeがselectedでなかった場合
          // pickNodeをselectedにして、
          // 他のselectedの物も含めて全selected nodeをdrag
          pickNode.setSelected(true)
          pickNode.onDragStart()
          this.lastNode = pickNode
          this.selectedNodes.push(pickNode)
          dragMode = DRAG_NODE
          // 他のnodeのselected状態はそのままキープ
        }
      } else {
        if(pickNode.isSelected()) {
          // 他のselectedの物も含めて全selected nodeをdrag
          pickNode.onDragStart()
          this.lastNode = pickNode
          this.selectedNodes.push(pickNode)
          dragMode = DRAG_NODE
          // 他のnodeのselected状態はそのままキープ
        } else {
          pickNode.setSelected(true)
          pickNode.onDragStart()
          this.lastNode = pickNode
          this.selectedNodes.push(pickNode)
          dragMode = DRAG_NODE
          // 他のnodeのselected状態はクリア
          clearSelection = true
        }
      }
    } else {
      dragMode = DRAG_BACK
      // エリア選択開始
      // 全nodeのselected状態はクリア
      clearSelection = true
    }
    
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i]
      if( node != pickNode ) {
        if( node.isSelected() ) {
          if(clearSelection) {
            node.setSelected(false)
          } else {
            node.onDragStart()
            this.selectedNodes.push(node)
          }
        }
      }
    }

    if( dragMode == DRAG_NODE ) {
      this.isDragging = true
      this.dragStartX = x
      this.dragStartY = y
    }
  }

  onMouseUp(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }
    
    this.isDragging = false
  }

  onMouseMove(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }
    
    if(this.isDragging == true) {
      const pos = this.getLocalPos(e)
      const x = pos.x
      const y = pos.y
      
      const dx = x - this.dragStartX
      const dy = y - this.dragStartY

      // 1つのノードだけを動かす
      const dragTargetNode = this.selectedNodes[0]
      dragTargetNode.onDrag(dx, dy)

      this.adjustLayout(dragTargetNode)
    }
  }  
  
  onKeyDown(e) {
    if( e.target != document.body ) {
      // input入力時のkey押下は無視する
      return
    }
    
    if(e.key === 'Tab' ) {
      this.addChildNode()
      e.preventDefault()
    } else if(e.key === 'Enter' ) {
      this.addSiblingNode()
      e.preventDefault()
    } else if(e.key === 'Backspace' ) {
      //this.deleteSelectedNodes()
    }
  }

  getLocalPos(e) {
    const rect = this.svg.getBoundingClientRect()
    const pos = this.svg.createSVGPoint()
    pos.x = e.clientX - rect.left
    pos.y = e.clientY - rect.top
    const canvasLocalPos = pos.matrixTransform(canvas.getScreenCTM().inverse())
    return canvasLocalPos
  }
  
  addChildNode() {
    const g = document.getElementById('nodes')
    const text = 'child' + this.nodes.length
    
    let node = new Node(text, this.lastNode, g)
    this.nodes.push(node)
    this.lastNode.addChildNode(node)
    
    this.lastNode = node

    this.adjustLayout(node)
  }
  
  addSiblingNode() {
    if(this.lastNode.isRoot) {
      this.addChildNode()
    } else {
      const g = document.getElementById('nodes')
      const text = 'child' + this.nodes.length

      const parentNode = this.lastNode.parent
      let node = new Node(text, parentNode, g)
      this.nodes.push(node)
      parentNode.addChildNode(node)

      this.lastNode = node

      this.adjustLayout(node)
    }
  }
  
  updateLayout() {
    const rootNode = this.nodes[0]
    rootNode.updateLayout(null, null)
  }
  
  adjustLayout(targetNode) {
    // targetNodeで指定されたNodeの兄弟ノードに関して、重なりがない様にY方向の位置を調整する.
    // 現在は重なりをなくす様にshiftYを調整している.
    
    this.updateLayout()
    
    const targetParentNode = targetNode.parentNode
    
    if(targetParentNode == null) {
      return
    }
    
    const upNodes = []
    const downNodes = []
    let targetNodeIndex = -1

    // 1ノードの高さは30とする
    const spanYPerNode = 30.0

    const defaultYs = []
    
    for(let i=0; i<targetParentNode.children.length; i++) {
      const child = targetParentNode.children[i]
      
      if(child == targetNode) {
        targetNodeIndex = i
      } else {
        if(targetNodeIndex == -1) {
          // 先頭に追加していく
          upNodes.unshift(child)
        } else {
          downNodes.push(child)
        }
      }
      
      defaultYs.push(spanYPerNode * i)
    }

    const targetNodeBounds = targetNode.calcYBounds()
    const targetNodeOffsetY = defaultYs[targetNodeIndex]

    let lastNodeTop    = targetNodeOffsetY + targetNode.adjustY + targetNodeBounds.top
    let lastNodeBottom = targetNodeOffsetY + targetNode.adjustY + targetNodeBounds.bottom

    // 上方向に持ち上げ
    for(let i=0; i<upNodes.length; ++i) {
      const node = upNodes[i]
      const bounds = node.calcYBounds()
      const offsetY = defaultYs[targetNodeIndex - 1 - i]

      const nodeBottom = offsetY + bounds.bottom + node.adjustY
      
      if(nodeBottom > lastNodeTop) {
        // nodeの下端が下Nodeと被っているので上げる(y値を小さくする)必要がある
        node.adjustY = lastNodeTop - (offsetY + bounds.bottom)
      } else {
        // TODO: 整理可能
        if(node.adjustY < 0) {
            node.adjustY = lastNodeTop - (offsetY + bounds.bottom)
        }
      }

      const newNodeTop = offsetY + bounds.top + node.adjustY
      lastNodeTop = newNodeTop
    }

    // 下方向に持ち下げ
    for(let i=0; i<downNodes.length; ++i) {
      const node = downNodes[i]
      const bounds = node.calcYBounds()
      const offsetY = defaultYs[targetNodeIndex + 1 + i]

      const nodeTop = offsetY + node.adjustY + bounds.top
      
      if(nodeTop < lastNodeBottom) {
        // nodeの上端が上Nodeに被っているので下に下げる(y値を大きくする)必要がある
        node.adjustY = lastNodeBottom - (offsetY + bounds.top)
      } else {
        // TODO: 整理可能
        if(node.adjustY > 0) {
          node.adjustY = lastNodeBottom - (offsetY + bounds.top)
        }
      }
      
      const newNodeBottom = offsetY + bounds.bottom + node.adjustY
      lastNodeBottom = newNodeBottom
    }

    this.updateLayout()

    // 上の階層に上がる
    this.adjustLayout(targetParentNode)

    //..
    this.debugDump()
    //..
  }

  debugDump() {
    console.log('---------')
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i]
      node.debugDump()
    }
  }
}
