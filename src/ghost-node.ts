import { RectComponent } from './components'
import { Node } from './node'


export class GhostNode {
  rectComponent : RectComponent;
  node : Node | null;
  startElementX : number | null;
  startElementY : number | null;
  shown : boolean | null;
  
  constructor(container : Element) {
    this.rectComponent = new RectComponent(container)
    this.hide()
  }

  prepare(node : Node) {
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

  onDrag(dx : number, dy : number) {
    const x = this.startElementX + dx
    const y = this.startElementY + dy
    
    this.rectComponent.setPos(x, y)
  }
}
