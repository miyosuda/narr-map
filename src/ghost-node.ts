import { RectComponent } from './components'


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
