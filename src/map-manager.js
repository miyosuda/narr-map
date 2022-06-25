import {
  Node,
  SPAN_Y_PER_NODE,
  HOVER_HIT_NONE,
  HOVER_HIT_SIBLING,
  HOVER_HIT_CHILD,
  HOVER_HIT_OTHER_CHILD,
} from './node.js'

import {GhostNode} from './ghost-node.js'
import {TextInput} from './text-input'
import {EditHistory} from './edit-history'
const { nmapi } = window


const DRAG_NONE  = 0
const DRAG_NODE  = 1
const DRAG_GHOST = 2
const DRAG_BACK  = 3

const MOVE_UP    = 1
const MOVE_DOWN  = 2
const MOVE_RIGHT = 3
const MOVE_LEFT  = 4


export class MapManager {
  constructor() {
  }

  init() {
    this.dragMode = DRAG_NONE
    this.dragStartX = 0
    this.dragStartY = 0
    this.nodes = []
    this.selectedNodes = []
    this.handleDraggingNode = null
    this.nodeEdited = false
    this.cursorDepth = 0
    
    this.ghostNode.hide()
    
    this.setDirty(false)
  }

  prepare() {
    this.svg = document.getElementById('svg')
    this.canvas = document.getElementById('canvas')

    const width = this.svg.width.baseVal.value
    const height = this.svg.height.baseVal.value
    this.setCanvasTranslate(width/2, height/2)
    
    this.onResize()
    
    document.onmousedown = event => this.onMouseDown(event)
    document.onmouseup   = event => this.onMouseUp(event)
    document.onmousemove = event => this.onMouseMove(event)
    document.body.addEventListener('keydown',  event => this.onKeyDown(event))
    this.textInput = new TextInput(this)

    nmapi.onReceiveMessage((arg, obj) => {
      if( this.textInput.isShown() ) {
        this.textInput.hide()
      }
      
      if( arg == 'cut' ) {
        this.cut()
      } else if( arg == 'undo' ) {
        this.undo()
      } else if( arg == 'redo' ) {
        this.redo()
      } else if( arg == 'save' ) {
        this.save()
      } else if( arg == 'load' ) {
        this.load(obj)
      } else if( arg == 'new-file' ) {
        this.newFile(obj)
      }
    })
    this.addGhostNode()
    
    this.init()
    
    const rootNode = this.addRootNode()
    this.editHistory = new EditHistory(rootNode.getState())
  }

  setCanvasTranslate(translateX, translateY) {
    this.canvasTranslateX = translateX
    this.canvasTranslateY = translateY
    
    this.canvas.setAttribute('transform', 'translate(' +
                             this.canvasTranslateX + ',' +
                             this.canvasTranslateY + ')')
  }
  
  onBackDragStart() {
    this.startCanvasTranslateX = this.canvasTranslateX
    this.startCanvasTranslateY = this.canvasTranslateY
  }

  onBackDrag(dx, dy) {
    const translateX = this.startCanvasTranslateX + dx
    const translateY = this.startCanvasTranslateY + dy

    this.setCanvasTranslate(translateX, translateY)
  }

  addRootNode() {
    const g = document.getElementById('overlay') 
    const node = new Node(null, g)
    node.setText('root')
    this.nodes.push(node)
    
    this.setNodeSelected(node, true)

    this.updateLayout()

    return node
  }

  get rootNode() {
    return this.nodes[0]
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

  findPickNode(x, y, forHandle) {
    let pickNode = null
    
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i]
      let hit = false
      if(forHandle) {
        hit = node.containsPosForHandle(x, y)
      } else {
        hit = node.containsPos(x, y)
      }
      if(hit) {
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

    this.nodeEdited = false
    
    const localPos = this.getLocalPos(e)
    const x = localPos.x
    const y = localPos.y
    
    // マウスが乗ったnodeをpick対象として選ぶ
    const pickNodeForHandle = this.findPickNode(x, y, true)
    const pickNode = this.findPickNode(x, y, false)

    let dragMode = DRAG_NONE
    const shiftDown = e.shiftKey

    if(pickNodeForHandle != null) {
      pickNodeForHandle.onDragStart()
      this.handleDraggingNode = pickNodeForHandle
      dragMode = DRAG_NODE
    } else if(pickNode != null) {
      // pickNodeがあった場合
      if(shiftDown) {
        // shift押下時
        this.setNodeSelected(pickNode, true)
        if(!pickNode.isRoot) {
          dragMode = DRAG_GHOST
          this.ghostNode.prepare(pickNode)
        } else {
          dragMode = DRAG_NONE
        }
      } else {
        // pickしたnode以外のselectedをクリア
        this.clearNodeSelection(pickNode)
        if(!pickNode.isRoot) {
          dragMode = DRAG_GHOST
          this.ghostNode.prepare(pickNode)
        } else {
          dragMode = DRAG_NONE
        }        
      }
    } else {
      // 1つを除いてNode選択クリア
      const targetNode = this.selectedNodes[this.selectedNodes.length-1]
      this.clearNodeSelection(targetNode)
      dragMode = DRAG_BACK
      this.onBackDragStart()
    }

    if(dragMode == DRAG_NODE || dragMode == DRAG_GHOST ) {
      this.dragStartX = x
      this.dragStartY = y
    } else if( dragMode == DRAG_BACK ) {
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
    }
    
    this.dragMode = dragMode
  }

  onMouseMove(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }
    
    if(this.dragMode != DRAG_NONE) {
      const localPos = this.getLocalPos(e)
      const x = localPos.x
      const y = localPos.y
      
      const dx = x - this.dragStartX
      const dy = y - this.dragStartY

      if(this.dragMode == DRAG_NODE) {
        // 1つのノードだけを動かす
        const dragTargetNode = this.handleDraggingNode
        dragTargetNode.onDrag(dx, dy)
        this.nodeEdited = true
        this.adjustLayout(dragTargetNode)
      } else if(this.dragMode == DRAG_GHOST) {
        // Ghostを移動
        if(!this.ghostNode.isShown) {
          const targetNode = this.lastNode
          //this.ghostNode.show(targetNode)
          this.ghostNode.show()
        }
        this.ghostNode.onDrag(dx, dy)
        // マウスオーバーの対応
        this.nodes.forEach(node => {
          if(node != this.ghostNode.node) {
            node.checkGhostHover(x, y)
          }
        })
      } else {
        // Backを移動
        const globalDx = e.clientX - this.dragStartX
        const globalDy = e.clientY - this.dragStartY
        this.onBackDrag(globalDx, globalDy)
      }
    } else {
      const localPos = this.getLocalPos(e)
      const x = localPos.x
      const y = localPos.y
      
      // マウスオーバーの対応
      this.nodes.forEach(node => {
        node.checkHover(x, y)
      })
    }
  }

  onMouseUp(e) {
    if(e.which == 3) {
      // 右クリックの場合
      return
    }
    
    this.handleDraggingNode = null
    if(this.dragMode == DRAG_GHOST) {
      const localPos = this.getLocalPos(e)
      const x = localPos.x
      const y = localPos.y

      let hoverHit = HOVER_HIT_NONE
      let hoverHitNode = null

      for(let i=0; i<this.nodes.length; i++) {
        const node = this.nodes[i]

        const ret = node.checkGhostHover(x, y)
        if(ret != HOVER_HIT_NONE) {
          hoverHit = ret
          hoverHitNode = node
        }
        
        node.clearGhostHover()
      }
      
      if(hoverHit != HOVER_HIT_NONE) {
        if(this.ghostNode.node === hoverHitNode) {
          // 同じノードの上で離した場合
          this.textInput.show(hoverHitNode)
        } else {
          if(hoverHit == HOVER_HIT_CHILD) {
            const newChildNode = this.ghostNode.node

            if(!hoverHitNode.hasNodeInAncestor(newChildNode)) {
              // hoverHitNodeがnewChildNodeの子孫だったらNG
              const oldParentNode = newChildNode.detachFromParent()

              // TODO: 要整理
              if(newChildNode.isLeft != oldParentNode.isLeft) {
                newChildNode.changeSideRecursive(oldParentNode.isLeft)
              }
              
              hoverHitNode.attachChildNodeToTail(newChildNode)
              this.nodeEdited = true
              
              if(newChildNode != oldParentNode) {
                this.adjustLayoutWithReset(oldParentNode)
              }
              this.adjustLayoutWithReset(hoverHitNode)
            }
          } else if(hoverHit == HOVER_HIT_OTHER_CHILD) {
            // rootの左側にhitした場合
            const newChildNode = this.ghostNode.node

            // TODO: 要整理
            if(!newChildNode.isLeft) {
              // 右から左へ持ってきた場合
              newChildNode.changeSideRecursive(true)
            }
            
            const oldParentNode = newChildNode.detachFromParent()
            hoverHitNode.attachChildNodeToTail(newChildNode)
            this.nodeEdited = true
              
            if(newChildNode != oldParentNode) {
              this.adjustLayoutWithReset(oldParentNode)
            }
            this.adjustLayoutWithReset(hoverHitNode)
          } else if(hoverHit == HOVER_HIT_SIBLING) {
            const newChildNode = this.ghostNode.node
            
            if(!hoverHitNode.hasNodeInAncestor(newChildNode)) {
              const newParentNode = hoverHitNode.parentNode
              const oldParentNode = newChildNode.detachFromParent()
              // hoverHitNodeがnewChildNodeの子孫だったら何もしない
              newParentNode.attachChildNodeAboveSibling(newChildNode, hoverHitNode)
              this.nodeEdited = true
              if(newChildNode != oldParentNode) {
                this.adjustLayoutWithReset(oldParentNode)
              }
              this.adjustLayoutWithReset(newParentNode)
            }
          }
        }
      }
      this.ghostNode.hide()
    }
    
    this.dragMode = DRAG_NONE

    if(this.nodeEdited) {
      // undoバッファ対応
      this.storeState()
      this.nodeEdited = false
    }
  }
  
  onKeyDown(e) {
    if( e.target != document.body ) {
      // input入力時のkey押下は無視する
      return
    }

    const shiftDown = e.shiftKey

    if(e.key === 'Tab' ) {
      this.addChildNode()
      e.preventDefault()
    } else if(e.key === 'Enter' ) {
      if(!e.ctrlKey) {
        this.addSiblingNode()
      } else {
        this.editText()
      }
      e.preventDefault()
    } else if(e.key === 'Backspace' ) {
      this.deleteSelectedNodes()
    } else if(e.key === 'ArrowUp' ) {
      this.move(MOVE_UP, shiftDown)
    } else if(e.key === 'ArrowDown' ) {
      this.move(MOVE_DOWN, shiftDown)
    } else if(e.key === 'ArrowRight' ) {
      this.move(MOVE_RIGHT, shiftDown)
    } else if(e.key === 'ArrowLeft' ) {
      this.move(MOVE_LEFT, shiftDown)
    } else if(e.key === 'F2') {
      this.editText()
    } else if(e.key === ' ') {
      this.toggleFold()
      e.preventDefault()
    } else if(e.key === 'F12') {
      // TODO: デバッグ中
      this.debug()
    } else if(
      (e.key >= 'a' && e.key <= 'z') ||
        (e.key >= 'A' && e.key <= 'Z') ||
        (e.key >= '1' && e.key <= '0')) {
      if(!e.ctrlKey && !e.metaKey) {
        // 文字列入力なら
        //this.editText()
        // TODO: shiftキーでも反応してしまっている.
      }
    } else if(e.key === 'F2') {
      this.editText()
    }
  }

  editText() {
    this.textInput.show(this.lastNode)
  }
  
  move(direction, shiftDown) {
    let node = null

    if(direction == MOVE_RIGHT) {
      if(!this.lastNode.isLeft) {
        node = this.lastNode.getLatestVisibleChild()
      } else {
        node = this.lastNode.parentNode
      }
      if(node != null) {
        this.cursorDepth = node.depth
      }
    } else if(direction == MOVE_LEFT) {
      if(!this.lastNode.isLeft) {
        if(this.lastNode.isRoot) {
          node = this.lastNode.getLatestOtherChild()
        } else {
          node = this.lastNode.parentNode
        }
      } else {
        node = this.lastNode.getLatestVisibleChild()
      }
      if(node != null) {
        this.cursorDepth = node.depth
      }
    } else if(direction == MOVE_UP) {
      node = this.lastNode.getSibling(true, this.cursorDepth)
    } else {
      node = this.lastNode.getSibling(false, this.cursorDepth)
    }

    if(node != null) {
      if(!shiftDown) {
        this.clearNodeSelection(node, false) // cursorDepthを更新しない
      } else {
        this.setNodeSelected(node, true, false) // cursorDepthを更新しない
      }
    }
  }

  toggleFold() {
    if(!this.lastNode.isRoot) {
      this.lastNode.toggleFolded()
      this.clearNodeSelection(this.lastNode) //..
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
    
    let isLeft;
    if(this.lastNode.isRoot && this.lastNode.hasChildren) {
      isLeft = true
    } else {
      isLeft = this.lastNode.isLeft
    }

    const node = new Node(this.lastNode, g, isLeft)
    this.nodes.push(node)
    this.lastNode.addChildNode(node)
    
    this.clearNodeSelection(node)
    
    this.adjustLayout(node)
    
    this.textInput.show(node)
  }
  
  addSiblingNode() {
    if(this.lastNode.isRoot) {
      this.addChildNode()
    } else {
      const g = document.getElementById('nodes')
      const oldLastNode = this.lastNode
      const parentNode = this.lastNode.parent

      const node = new Node(parentNode, g, oldLastNode.isLeft)
      this.nodes.push(node)
      parentNode.addChildNode(node)

      this.clearNodeSelection(node)
      
      // 前のsiblingをtargetとしてadjustとしている
      this.adjustLayout(oldLastNode)
      
      this.textInput.show(node)
    }
  }

  updateLayout() {
    this.rootNode.updateLayout(null, null)
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

    let targetSiblingChildren = targetParentNode.children
    if(targetNode.isOther) {
      // targetNodeがrootのother children内のものだった場合
      targetSiblingChildren = targetParentNode.otherChildren
      console.log(targetSiblingChildren)
    }
    
    for(let i=0; i<targetSiblingChildren.length; i++) {
      const child = targetSiblingChildren[i]
      
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
  }

  adjustLayoutWithReset(targetParentNode) {
    // targetParentNodeで指定したNodeの子が削除されたり子枝が追加された場合の対処
    this.updateLayout()
    
    if(targetParentNode == null) {
      return
    }
    
    let lastNodeBottom = null

    // TODO: FIX: ここのotherChildernの考慮が必要
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
      // nodes[]から削除する
      const nodeIndex = this.nodes.indexOf(node)
      if(nodeIndex >= 0) {
        this.nodes.splice(nodeIndex, 1)
      }
    }
    
    node.remove(removeNodeCallback)

    if(parentNode != null) {
      this.adjustLayoutWithReset(parentNode)
    }
  }

  get lastNode() {
    return this.selectedNodes[this.selectedNodes.length-1]
  }

  setNodeSelected(node, selected, updateCursorDepth=true) {
    if(node.isSelected != selected) {
      node.setSelected(selected)
      
      if(selected) {
        // selectedにしたのでselectedNodes[]に追加
        this.selectedNodes.push(node)
      } else {
        // selectedを外したのでselectedNodesから削除
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

    if(selected && updateCursorDepth) {
      this.cursorDepth = node.depth
    }
  }

  clearNodeSelection(leftNode, updateCursorDepth=true) {
    this.selectedNodes.forEach(node => {
      node.setSelected(false)
    })
    this.selectedNodes = []
    
    this.selectedNodes.push(leftNode)
    leftNode.setSelected(true)

    if(updateCursorDepth) {
      this.cursorDepth = leftNode.depth
    }
  }

  deleteSelectedNodes() {
    let modified = false
    
    this.selectedNodes.forEach(node => {
      // ノードを削除
      if(!node.isRoot) {
        this.deleteNode(node)
        modified = true
      } else {
        if(!node.isSelected) {
          node.setSelected(false)
        }
      }
    })
    
    this.selectedNodes = []
    const targetNode = this.nodes[this.nodes.length-1]
    this.setNodeSelected(targetNode, true)
    
    this.updateLayout()

    if(modified) {
      this.storeState()
    }
  }

  cut() {
    this.deleteSelectedNodes()
  }

  onTextDecided(node, changed) {
    this.cursorDepth = node.depth
    if( changed ) {
      // 文字列が変更された場合
      this.updateLayout()
      
      // undoバッファ対応
      this.storeState()
    }
  }

  clearAllNodes() {
    const oldRootNode = this.rootNode
    this.deleteNode(oldRootNode)
  }

  storeState() {
    const state = this.rootNode.getState()
    this.editHistory.addHistory(state)
    
    this.setDirty(true)
  }

  applyNodeState(state, parentNode) {
    let node = null
    if(parentNode == null) {
      // TODO: 共通化
      const g = document.getElementById('overlay') 
      node = new Node(null, g)
      // ここではまだapplyState(state)しない
      this.nodes.push(node)
    } else {
      // TODO: 共通化
      const g = document.getElementById('nodes')
      node = new Node(parentNode, g)
      // ここではまだapplyState(state)しない
      this.nodes.push(node)
      parentNode.addChildNode(node)
    }
    
    state.children.forEach(childState => {
      this.applyNodeState(childState, node)
    })

    if(node.isRoot) {
      state.otherChildren.forEach(childState => {
        this.applyNodeState(childState, node)
      })
    }
    
    // folded反映の関係でchildrendにstateを適用した後にこのnodeのstateを適用する
    node.applyState(state)
    
    if(node.isSelected) {
      this.selectedNodes.push(node)
    }    
  }

  applyMapState(state) {
    this.clearAllNodes()
    
    this.init()
    
    this.applyNodeState(state, null)

    this.cursorDepth = this.lastNode.depth    
    
    this.updateLayout()
  }
  
  newFile() {
    this.clearAllNodes()
    
    this.init()
    
    const rootNode = this.addRootNode()
    this.editHistory = new EditHistory(rootNode.getState())
  }

  load(mapData) {
    const version = mapData['version']
    const state = mapData['state']
    
    this.applyMapState(state)
    
    this.editHistory = new EditHistory(state)
  }

  save() {
    const DATA_VERSION = 1
    
    const state = this.rootNode.getState()
    
    const mapData = {
      'version' : DATA_VERSION,
      'state' : state,
    }
    
    nmapi.sendMessage('response-save', mapData)
  }
  
  undo() {
    if( this.textInput.isShown() ) {
      document.execCommand('undo')
      return
    }
    
    const state = this.editHistory.undo()
    if( state != null ) {
      this.applyMapState(state)
    }
  }

  redo() {
    if( this.textInput.isShown() ) {
      document.execCommand('redo')
      return
    }
    
    const state = this.editHistory.redo()
    if( state != null ) {
      this.applyMapState(state)
    }
  }

  setDirty(dirty) {
    nmapi.sendMessage('set-dirty', dirty)
  }

  debugDump() {
    console.log('---------')
    for(let i=0; i<this.nodes.length; i++) {
      const node = this.nodes[i]
      node.debugDump()
    }
  }

  debug() {
    this.debugDump()
  }
}
