import {NODE_TYPE_NONE, NODE_TYPE_TEXT, NodeData, MapData} from './data'
import {clone} from './utils'
import {TextInput} from './text-input'
import {TextNode} from './node/text'


const createNode = (data, container) => {
  if( data.type == NODE_TYPE_TEXT ) {
    return new TextNode(data, container)
  } else {
    return null
  }
}

const DRAG_NONE = 0
const DRAG_NODE = 1
const DRAG_AREA = 2


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
    this.mapData = new MapData()
    this.nodeEdited = false
    this.lastNode = null
  }

  prepare() {
    this.svg = document.getElementById('svg')
    
    this.onResize()
    
    document.onmousedown = event => this.onMouseDown(event)
    document.onmouseup   = event => this.onMouseUp(event)
    document.onmousemove = event => this.onMouseMove(event)
    document.body.addEventListener('keydown',  event => this.onKeyDown(event))
    document.body.addEventListener('dblclick', evenet => this.onDoubleClick(event))

    document.ondragover = document.ondrop = event => {
      event.preventDefault()
    }

    this.textInput = new TextInput(this)
  }

  showInputAt(x, y) {
    this.clearSelection()
    let initialText = ""
    let initialCaretPos = 0
    const data = new NodeData(x, y, initialText)
    this.textInput.show(data, initialCaretPos)
  }

  showInput(asSibling) {
    let x = 10
    let y = 10
    
    if(this.lastNode != null) {
      if(asSibling) {
        x = this.lastNode.right + 30
        y = this.lastNode.top
      } else {
        x = this.lastNode.left
        y = this.lastNode.bottom + 10
      }
    }
    
    this.showInputAt(x, y)
  }

  forceSetLastNode() {
    // 一番下のnodeをlastNodeとする
    this.lastNode = null

    this.nodes.forEach(node => {
      if( this.lastNode == null ) {
        this.lastNode = node
      } else {
        // bottomではなくtopで比較している
        if( node.top > this.lastNode.top ) {
          this.lastNode = node
        }
      }
    })
  }

  deleteSelectedNodes() {
    let deleted = false
    let lastNodeDeleted = false
    
    this.selectedNodes.forEach(node => {
      // ノードを削除
      this.removeNode(node)
      deleted = true
      if( node == this.lastNode ) {
        lastNodeDeleted = true
      }
    })
    this.seletedNodes = []

    if( lastNodeDeleted ) {
      this.forceSetLastNode()
    }
  }

  onKeyDown(e) {
    if( e.target != document.body ) {
      // input入力時のkey押下は無視する
      return
    }

    if(e.key === 'Tab' ) {
      this.showInput(true)
      e.preventDefault()
    } else if(e.key === 'Enter' ) {
      this.showInput(false)
      e.preventDefault()
    } else if(e.key === 'Backspace' ) {
      this.deleteSelectedNodes()
    }
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
    
    if( this.textInput.isShown() ) {
      // textInput表示中なら何もしない
      return
    }
    
    const pos = this.getLocalPos(e)
    const x = pos.x
    const y = pos.y
    
    this.nodeEdited = false

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
      // pickNodeがない場合
      if(shitDown) {
        dragMode = DRAG_AREA
        // Nodeドラッグは開始しない.
        // エリア選択も開始.
        // 全nodeのselected状態はそのままキープ
      } else {
        dragMode = DRAG_AREA
        // エリア選択開始
        // 全nodeのselected状態はクリア
        clearSelection = true
      }
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
      const pos = this.getLocalPos(e)
      const x = pos.x
      const y = pos.y
      this.showInputAt(x, y)
      return
    }
    
    this.isDragging = false

    if( this.nodeEdited ) {
      this.nodeEdited = false
    }
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

      this.selectedNodes.forEach(node => {
        // ノードを移動
        node.onDrag(dx, dy)
        // mouseUp時にundoバッファ対応
        this.nodeEdited = true
      })
    }
  }

  onDoubleClick(e) {
    const pos = this.getLocalPos(e)
    const x = pos.x
    const y = pos.y
    
    const pickNode = this.findPickNode (x, y)
    if( pickNode != null ) {
      // text input表示
      this.textInput.show(pickNode.data)
      // ノードを削除
      this.removeNode(pickNode)
      // ここではundoバッファに反映しない
    }
  }
  
  onTextDecided(data, changed=true) {
    // テキストが空文字ならばノードを追加しない
    if( data.text != "" ) {
      // TODO: 要refactor
      this.addNode(data)
    }
  }

  onResize() {
    // なぜかmarginをつけないとスクロールバーが出てしまう
    const margin = 2
    
    this.svg.setAttribute('width', window.innerWidth - margin)
    this.svg.setAttribute('height', window.innerHeight - margin)
  }

  getLocalPos(e) {
    const rect = document.getElementById('svg').getBoundingClientRect()
    
    const x = e.clientX
    const y = e.clientY

    const pos = {}
    pos.x = x - rect.left
    pos.y = y - rect.top
    return pos
  }

  addNode(nodeData, applyToNote=true) {
    // TODO: 整理
    const g = document.getElementById('nodes')
    const node = createNode(nodeData, g)
    this.nodes.push(node)
    this.lastNode = node
    if( applyToNote ) {
      this.mapData.addNode(nodeData)
    }
    return node
  }

  removeNode(node, applyToNote=true) {
    // TODO: 整理
    const nodeIndex = this.nodes.indexOf(node)
    if(nodeIndex >= 0) {
      this.nodes.splice(nodeIndex, 1)
    }
    node.remove()
    if( applyToNote ) {
      this.mapData.removeNode(node.data)
    }
  }

  clearSelection() {
    this.selectedNodes.forEach(node => {
      node.setSelected(false)
    })
    this.selectedNodes = []
  }

  /*
  clearAllNodes() {
    for(let i=this.nodes.length-1; i>=0; i--) {
      const node = this.nodes[i]
      // TODO: 整理
      this.removeNode(node, false) // noteにはremoveを反映しない
    }
    this.lastNode = null
  }  

  applyMapData(mapData) {
    this.clearAllNodes()
    const nodeDatas = mapData.getCurretNodeDatas()
    nodeDatas.forEach(nodeData => {
      // TODO: 整理
      this.addNode(nodeData, false)
    })
    this.mapData = mapData

    this.forceSetLastNode()
  }

  newFile() {
    // TODO: loadSub()と共通化
    const mapData = new MapData()
    this.clearAllNodes()
    this.init()
    this.applyMapData(mapData)
  }
  */
}
