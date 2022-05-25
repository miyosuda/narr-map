//import {TextInput} from './text-input'

import {getElementDimension} from './text-utils'


class NodeData {
  constructor(text, parent) {
    this.text = text
    this.parent = parent
  }

  isRoot() {
    return parent == null
  }
}

class NodeView {
  constructor(data, container) {
    this.data = data

    let ns = 'http://www.w3.org/2000/svg'
    let foreignObject = document.createElementNS(ns, 'foreignObject')
    
    foreignObject.classList.add("node-text")

    container.appendChild(foreignObject)
    
    this.foreignObject = foreignObject

    this.prepare()
  }

  prepare() {
    let span = document.createElement('span')
    // テキスト選択無効のクラスを指定
    span.className = 'disable-select';
    span.textContent = this.data.text
    this.foreignObject.appendChild(span)
    
    // TODO: refactor
    let className = 'node-text'
    const dims = getElementDimension(this.foreignObject.innerHTML, className)
    this.foreignObject.width.baseVal.value = dims.width
    this.foreignObject.height.baseVal.value = dims.height

    this.foreignObject.x.baseVal.value = this.x - dims.width / 2
    this.foreignObject.y.baseVal.value = this.x - dims.width / 2
  }

  get x() {
    if(this.data.isRoot()) {
      return 0
    } else {
      return 0 //..
    }
  }

  get y() {
    if(this.data.isRoot()) {
      return 0
    } else {
      return 0 //..
    }
  }
}

export class MapManager {
  constructor() {
    this.init()
  }

  init() {
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
    let rootNodeData = new NodeData('root', null)
    const g = document.getElementById('nodes')    
    let nodeView = new NodeView(rootNodeData, g)
    this.nodeViews.push(nodeView)
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

    /*
    if(e.key === 'Tab' ) {
      this.showInput(true)
      e.preventDefault()
    } else if(e.key === 'Enter' ) {
      this.showInput(false)
      e.preventDefault()
    } else if(e.key === 'Backspace' ) {
      this.deleteSelectedNodes()
    }
    */
  }  
}
