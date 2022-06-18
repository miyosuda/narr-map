import {Node, SPAN_Y_PER_NODE} from './node.js'
import {GhostNode} from './ghost-node.js'
//import {TextInput} from './text-input'
const { nmapi } = window


const DRAG_NONE = 0
const DRAG_NODE = 1
const DRAG_BACK = 2


export class MapManager {
  constructor() {
    this.init()
  }

  init() {
    this.dragMode = DRAG_NONE
    this.dragStartX = 0
    this.dragStartY = 0
    this.selectedNodes = []
    this.nodes = []
  }

  prepare() {
    this.svg = document.getElementById('svg')
    
    this.onResize()

    document.onmousedown = event => this.onMouseDown(event)
    document.onmouseup   = event => this.onMouseUp(event)
    document.onmousemove = event => this.onMouseMove(event)
    document.body.addEventListener('keydown',  event => this.onKeyDown(event))
    //this.textInput = new TextInput(this)

    nmapi.onReceiveMessage((arg) => {
      if( arg == 'cut' ) {
        this.cut()
      }
    })
    
    this.addRootNode()
    this.addGhostNode()
  }

  addRootNode() {
    const g = document.getElementById('overlay') 
    let node = new Node('root', null, g)
    this.nodes.push(node)

    this.setNodeSelected(node, true)

    this.updateLayout()
  }

  addGhostNode() {
    const g = document.getElementById('overlay') 
    this.ghostNode = new GhostNode(g)
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
    const pickNode = this.findPickNode(x, y)

    //this.ghostNode.show(pickNode)
    
    let dragMode = DRAG_NONE
    const shiftDown = e.shiftKey
    
    if(pickNode != null) {
      // pickNodeがあった場合
      if(shiftDown) {
        // shift押下時
        this.setNodeSelected(pickNode, true)
        pickNode.onDragStart()
        dragMode = DRAG_NODE
      } else {
        // pickしたnode以外のselectedをクリア
        pickNode.onDragStart()
        this.clearNodeSelection(pickNode)
        dragMode = DRAG_NODE
      }
    } else {
      // 1つを除いてNode選択クリア
      const targetNode = this.selectedNodes[this.selectedNodes.length-1]
      this.clearNodeSelection(targetNode)
      dragMode = DRAG_BACK
    }

    if(dragMode != DRAG_NONE) {
      this.dragStartX = x
      this.dragStartY = y
    }
    
    this.dragMode = dragMode
  }

  onMouseUp(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }
    
    this.dragMode = DRAG_NONE
  }

  onMouseMove(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }
    
    if(this.dragMode != DRAG_NONE) {
      const pos = this.getLocalPos(e)
      const x = pos.x
      const y = pos.y
      
      const dx = x - this.dragStartX
      const dy = y - this.dragStartY

      if(this.dragMode == DRAG_NODE) {
        // 1つのノードだけを動かす
        const dragTargetNode = this.lastNode
        dragTargetNode.onDrag(dx, dy)
        this.adjustLayout(dragTargetNode)
      } else {
        // Backを移動
      }
    } else {
      const pos = this.getLocalPos(e)
      const x = pos.x
      const y = pos.y
      
      // マウスオーバーの対応
      this.nodes.forEach(node => {
        node.checkHover(x, y)
      })
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
      this.deleteSelectedNodes()
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

    this.clearNodeSelection(node)
    
    this.adjustLayout(node)
  }
  
  addSiblingNode() {
    if(this.lastNode.isRoot) {
      this.addChildNode()
    } else {
      const g = document.getElementById('nodes')
      const text = 'child' + this.nodes.length

      const oldLastNode = this.lastNode
      const parentNode = this.lastNode.parent
      
      let node = new Node(text, parentNode, g)
      this.nodes.push(node)
      parentNode.addChildNode(node)

      this.clearNodeSelection(node)
      
      // 前のsiblingをtargetとしてadjustとしている
      this.adjustLayout(oldLastNode)
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
    }

    const targetNodeBounds = targetNode.calcYBounds()
    const targetNodeOffsetY = SPAN_Y_PER_NODE * targetNodeIndex 

    let lastNodeTop    = targetNodeOffsetY + targetNode.adjustY + targetNodeBounds.top
    let lastNodeBottom = targetNodeOffsetY + targetNode.adjustY + targetNodeBounds.bottom

    // target nodeよりも上のNodeに対して
    for(let i=0; i<upNodes.length; ++i) {
      const node = upNodes[i]
      const bounds = node.calcYBounds()
      const offsetY = SPAN_Y_PER_NODE * (targetNodeIndex - 1 - i)
      
      const nodeBottom = offsetY + bounds.bottom + node.adjustY
      
      if(nodeBottom > lastNodeTop || node.adjustY < 0) {
        // a) nodeの下端が下Nodeと被っているので上げる(y値を小さくする)必要がある
        // b) nodeが上方向にadjustされているのでlastNodeの上端にnodeの下端(それぞれshiftを含む)に合わせる
        node.adjustY = lastNodeTop - (offsetY + bounds.bottom)
      }

      const newNodeTop = offsetY + bounds.top + node.adjustY
      lastNodeTop = newNodeTop
    }

    // target nodeよりも下のNodeに対して
    for(let i=0; i<downNodes.length; ++i) {
      const node = downNodes[i]
      const bounds = node.calcYBounds()
      const offsetY = SPAN_Y_PER_NODE * (targetNodeIndex + 1 + i)
      
      const nodeTop = offsetY + node.adjustY + bounds.top
      
      if(nodeTop < lastNodeBottom || node.adjustY > 0) {
        // a) nodeの上端が上Nodeに被っているので下に下げる(y値を大きくする)必要がある
        // b) nodeが下方向にadjustされているのでlastNodeの下端にnodeの上端(それぞれshiftを含む)に合わせる
        node.adjustY = lastNodeBottom - (offsetY + bounds.top)
      }
      
      const newNodeBottom = offsetY + bounds.bottom + node.adjustY
      lastNodeBottom = newNodeBottom
    }

    this.updateLayout()

    // 上の階層に上がる
    this.adjustLayout(targetParentNode)

    //this.debugDump()
  }

  adjustLayoutWithReset(targetParentNode) {
    this.updateLayout()
    
    if(targetParentNode == null) {
      return
    }
    
    let lastNodeBottom = null
    
    for(let i=0; i<targetParentNode.children.length; i++) {
      const node = targetParentNode.children[i]
      const bounds = node.calcYBounds()
      const offsetY = SPAN_Y_PER_NODE * i

      if(lastNodeBottom == null) {
        node.adjustY = 0.0
      } else {
        node.adjustY = lastNodeBottom - (offsetY + bounds.top)
      }

      const newNodeBottom = offsetY + bounds.bottom + node.adjustY
      lastNodeBottom = newNodeBottom
    }
    
    // 上の階層に上がる
    // (ここはadjustLayoutWithReset()ではなくadjustLayout()を利用)
    this.adjustLayout(targetParentNode)

    this.updateLayout()
  }

  deleteNode(node) {
    const parentNode = node.parent

    const removeNodeCallback = (node) => {
      const nodeIndex = this.nodes.indexOf(node)
      if(nodeIndex >= 0) {
        this.nodes.splice(nodeIndex, 1)
      }
    }
    
    node.remove(removeNodeCallback)
    
    this.adjustLayoutWithReset(parentNode)
  }

  get lastNode() {
    return this.selectedNodes[this.selectedNodes.length-1]
  }

  setNodeSelected(node, selected) {
    if(node.isSelected != selected) {
      node.setSelected(selected)
      
      if(selected) {
        this.selectedNodes.push(node)
      } else {
        const nodeIndex = this.selectedNodes.indexOf(node)
        if(nodeIndex >= 0) {
          this.selectedNodes.splice(nodeIndex, 1)
        }
      }
    } else if(node.isSelected) {
       // nodeを最後に持ってくる
      const nodeIndex = this.selectedNodes.indexOf(node)
      if(nodeIndex >= 0) {
        this.selectedNodes.splice(nodeIndex, 1)
      }
      this.selectedNodes.push(node)
    }
  }

  clearNodeSelection(leftNode) {
    this.selectedNodes.forEach(node => {
      node.setSelected(false)
    })
    this.selectedNodes = []
    
    this.selectedNodes.push(leftNode)
    leftNode.setSelected(true)    
  }

  deleteSelectedNodes() {
    this.selectedNodes.forEach(node => {
      // ノードを削除
      if(!node.isRoot) {
        this.deleteNode(node)
      } else {
        node.setSelected(false)
      }
    })
    
    this.selectedNodes = []
    const targetNode = this.nodes[this.nodes.length-1]
    this.setNodeSelected(targetNode, true)
    
    this.updateLayout()
    
    //this.debugDump()
  }

  cut() {
    this.deleteSelectedNodes()
  }

  debugDump() {
    console.log('---------')
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i]
      node.debugDump()
    }
  }
}
