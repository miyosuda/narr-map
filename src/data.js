import {clone, cloneArray} from './utils'

export const NODE_TYPE_NONE  = 0
export const NODE_TYPE_TEXT  = 1


export class NodeData {
  constructor(x, y, text) {
    this.type = NODE_TYPE_NONE
    this.x = x
    this.y = y
    this.text = text
  }

  fromRaw(rawData) {
    const rawDataEntries = Object.entries(rawData)
    rawDataEntries.map( e => {
      this[e[0]] = e[1]
    } )
  }

  setText(text) {
    this.text = text
    this.type = NODE_TYPE_TEXT
  }
}


class PageData {
  constructor() {
    this.nodes = [] // NodeData[]
  }

  getNodeDatas() {
    return this.nodes
  }

  fromRaw(rawData) {
    this.nodes = []
    const rawNodeDatas = rawData.nodes 
    rawNodeDatas.forEach(rawNodeData => {
      const nodeData = new NodeData()
      nodeData.fromRaw(rawNodeData)
      this.nodes.push(nodeData)
    })
  }

  addNode(nodeData) {
    this.nodes.push(nodeData)
  }

  removeNode(nodeData) {
    const nodeIndex = this.nodes.indexOf(nodeData)
    if(nodeIndex >= 0) {
      this.nodes.splice(nodeIndex, 1)
    } else {
      console.log('node data not found')
    }
  }

  clone() {
    const clonedPageData = new PageData()
    clonedPageData.nodes = cloneArray(this.nodes)
    return clonedPageData
  }
}


const DATA_VERSION = 1

export class MapData {
  constructor() {
    this.version = DATA_VERSION
    
    this.pages = []
    const pageData = new PageData()
    this.pages.push(pageData)
    this.currentPage = 0
  }

  addNode(nodeData) {
    const pageData = this.pages[this.currentPage]
    pageData.addNode(nodeData)
  }

  removeNode(nodeData) {
    const pageData = this.pages[this.currentPage]
    pageData.removeNode(nodeData)
  }

  clone() {
    const clonedMapData = new MapData()
    
    clonedMapData.currentPage = this.currentPage
    clonedMapData.pages = []
    
    this.pages.forEach(pageData => {
      clonedMapData.pages.push(pageData.clone())
    })
    return clonedMapData
  }

  getCurretNodeDatas() {
    return this.getNodeDatas(this.currentPage)
  }

  getNodeDatas(page) {
    const pageData = this.pages[page]
    return pageData.getNodeDatas()
  }

  toJson() {
    const json = JSON.stringify(this, null , '\t')
    return json
  }

  fromJson(json) {
    this.version = DATA_VERSION // vesionは現在のバージョンを利用する
    
    const rawData = JSON.parse(json)
    this.currentPage = rawData.currentPage
    
    const rawPageDatas = rawData.pages
    this.pages = []
    
    rawPageDatas.forEach(rawPageData => {
      const pageData = new PageData()
      pageData.fromRaw(rawPageData)
      this.pages.push(pageData)
    })
  }
}
