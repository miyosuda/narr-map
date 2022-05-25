import {clone, cloneArray} from './utils'


export class NodeData {
  constructor(x, y, text) {
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
  }
}

const DATA_VERSION = 1

export class MapData {
  constructor() {
    this.version = DATA_VERSION

    this.nodes = [] // NodeData[]
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
    const clonedMapData = new MapData()
    clonedMapData.nodes = cloneArray(this.nodes)
    return clonedMapData
  }

  getCurretNodeDatas() {
    return this.nodes
  }

  toJson() {
    const json = JSON.stringify(this, null , '\t')
    return json
  }

  fromJson(json) {
    this.version = DATA_VERSION // vesionは現在のバージョンを利用する
    
    const rawData = JSON.parse(json)
    this.nodes = []
    
    const rawNodeDatas = rawData.nodes 
    rawNodeDatas.forEach(rawNodeData => {
      const nodeData = new NodeData()
      nodeData.fromRaw(rawNodeData)
      this.nodes.push(nodeData)
    })
  }
}
