//import {TextInput} from './text-input'

import {getElementDimension} from './text-utils'


class NodeView {
  constructor(text, parentNodeView, container) {
    this.text = text
    this.parentNodeView = parentNodeView

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
      
      lineElement.setAttribute('x1', 0)
      lineElement.setAttribute('y1', 0)
      lineElement.setAttribute('x2', 0)
      lineElement.setAttribute('y2', 0)
      
      lineElement.setAttribute('stroke', '#7f7f7f')
      lineElement.setAttribute('stroke-width', 1)

      container.appendChild(lineElement)
      this.lineElement = lineElement
    }
  }
  
  addChildNodeView(nodeView) {
    this.children.push(nodeView)
  }

  updateLayout(baseX, baseY) {
    if(this.isRoot) {
      baseX = -this.width / 2
      baseY = -this.height / 2
    }
    this.updatePos(baseX, baseY)

    const shiftYPerNode = 30.0
    let childYOffset = 0.0
    if( this.children.length == 1 ) {
      childYOffset = -3.0
    }
    const childBaseX = baseX + this.width + 20
    const childBaseStartY = baseY + childYOffset - (this.children.length-1) / 2 * shiftYPerNode
    
    for(let i=0; i<this.children.length; i++) {
      const nodeView = this.children[i]
      nodeView.updateLayout(childBaseX, childBaseStartY + i * shiftYPerNode)
    }
  }

  get parent() {
    return this.parentNodeView
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

    this.foreignObject.x.baseVal.value = baseX
    this.foreignObject.y.baseVal.value = baseY

    this.x = baseX
    this.y = baseY

    if(!this.isRoot) {
      const edgeStartPos = this.parentNodeView.edgeOutPos
      this.lineElement.setAttribute('x1', edgeStartPos.x)
      this.lineElement.setAttribute('y1', edgeStartPos.y)
      this.lineElement.setAttribute('x2', this.x)
      this.lineElement.setAttribute('y2', this.y + this.height - 0.5) // lineの幅を考慮している
    }
  }

  get isRoot() {
    return this.parentNodeView == null
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
}


export class MapManager {
  constructor() {
    this.init()
  }

  init() {
    this.lastNodeView = null
    this.nodeViews = []
  }

  prepare() {
    this.svg = document.getElementById('svg')
    
    this.onResize()

    document.body.addEventListener('keydown',  event => this.onKeyDown(event))
    //this.textInput = new TextInput(this)

    this.addRootNode()
  }

  addRootNode() {
    const g = document.getElementById('nodes') 
    let nodeView = new NodeView('root', null, g)
    this.nodeViews.push(nodeView)
    this.lastNodeView = nodeView

    this.updateLayout()
  }

  onResize() {
    // なぜかmarginをつけないとスクロールバーが出てしまう
    const margin = 2
    
    this.svg.setAttribute('width', window.innerWidth - margin)
    this.svg.setAttribute('height', window.innerHeight - margin)
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
  
  addChildNode() {
    const g = document.getElementById('nodes')
    const text = 'child' + this.nodeViews.length
    
    let nodeView = new NodeView(text, this.lastNodeView, g)
    this.nodeViews.push(nodeView)
    this.lastNodeView.addChildNodeView(nodeView)
    
    this.lastNodeView = nodeView

    this.updateLayout()
  }
  
  addSiblingNode() {
    if(this.lastNodeView.isRoot) {
      this.addChildNode()
    } else {
      const g = document.getElementById('nodes')
      const text = 'child' + this.nodeViews.length

      const parentNodeView = this.lastNodeView.parent
      let nodeView = new NodeView(text, parentNodeView, g)
      this.nodeViews.push(nodeView)
      parentNodeView.addChildNodeView(nodeView)

      this.lastNodeView = nodeView

      this.updateLayout()
    }
  }
  
  updateLayout() {
    const rootNodeView = this.nodeViews[0]
    rootNodeView.updateLayout(null, null)
  }
}
