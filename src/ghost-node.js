export class GhostNode {
  constructor(container) {
    let ns = 'http://www.w3.org/2000/svg'    
    const rectElement = document.createElementNS(ns, 'rect')

    rectElement.setAttribute('x', 0)
    rectElement.setAttribute('y', 0)
    rectElement.setAttribute('width', 100)
    rectElement.setAttribute('height', 30)
    rectElement.setAttribute('fill', 'none')
    rectElement.setAttribute('stroke', '#7f7f7f')
    rectElement.setAttribute('stroke-width', 2)

    container.appendChild(rectElement)

    this.rectElement = rectElement
    this.hide()    
  }

  show(node) {
    const x = node.left
    const y = node.top

    this.updatePos(x, y)
    this.rectElement.setAttribute('width', node.width)
    this.rectElement.setAttribute('height', node.height)
    
    this.rectElement.setAttribute('visibility', 'visible')

    this.startElementX = x
    this.startElementY = y
    
    this.node = node
  }
  
  updatePos(x, y) {
    this.rectElement.setAttribute('x', x)
    this.rectElement.setAttribute('y', y)
  }

  hide() {
    this.rectElement.setAttribute('visibility', 'hidden')
    
    this.node = null
  }

  onDrag(dx, dy) {
    const x = this.startElementX + dx
    const y = this.startElementY + dy
    
    this.rectElement.setAttribute('x', x)
    this.rectElement.setAttribute('y', y)
  }
}
