const NAME_SPACE = 'http://www.w3.org/2000/svg'


class RectComponent {
  constructor(container) {
    const rectElement = document.createElementNS(NAME_SPACE, 'rect')

    rectElement.setAttribute('x', 0)
    rectElement.setAttribute('y', 0)
    rectElement.setAttribute('width', 100)
    rectElement.setAttribute('height', 30)
    rectElement.setAttribute('fill', 'none')
    rectElement.setAttribute('stroke', '#7f7f7f')
    rectElement.setAttribute('stroke-width', 2)

    container.appendChild(rectElement)
    this.rectElement = rectElement
  }

  setWidth(width) {
    this.rectElement.setAttribute('width', width)
  }
  
  setHeight(height) {
    this.rectElement.setAttribute('height', height)
  }

  setPos(x, y) {
    this.rectElement.setAttribute('x', x)
    this.rectElement.setAttribute('y', y)    
  }

  setVisible(visible) {
    if(visible) {
      this.rectElement.setAttribute('visibility', 'visible')
    } else {
      this.rectElement.setAttribute('visibility', 'hidden')
    }
  }
}


export class GhostNode {
  constructor(container) {
    this.rectComponent = new RectComponent(container)
    this.hide()
  }

  prepare(node) {
    this.node = node
  }

  show() {
    const x = this.node.left
    const y = this.node.top

    this.rectComponent.setPos(x, y)
    this.rectComponent.setWidth(this.node.width)
    this.rectComponent.setHeight(this.node.height)
    this.rectComponent.setVisible(true)
    
    this.startElementX = x
    this.startElementY = y

    this.shown = true
  }
  
  hide() {
    this.rectComponent.setVisible(false)
    
    this.shown = false
    this.node = null
  }

  get isShown() {
    return this.shown
  }

  onDrag(dx, dy) {
    const x = this.startElementX + dx
    const y = this.startElementY + dy
    
    this.rectComponent.setPos(x, y)
  }
}
