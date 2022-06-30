import {getElementDimension} from './text-utils'

const NAME_SPACE = 'http://www.w3.org/2000/svg'

export const HANDLE_WIDTH  = 10
export const HANDLE_HEIGHT = 18

export const TEXT_COMPONENT_STYLE_NONE        = 0
export const TEXT_COMPONENT_STYLE_HOVER_TOP   = 1
export const TEXT_COMPONENT_STYLE_HOVER_RIGHT = 2
export const TEXT_COMPONENT_STYLE_HOVER_LEFT  = 3
export const TEXT_COMPONENT_STYLE_SELECTED    = 4

const FOLD_MARK_RADIUS = 3

const REGEX_RED_CIRCLE     = /^\(r\)/i
const REGEX_GREEN_CIRCLE   = /^\(g\)/i
const REGEX_BLUE_CIRCLE    = /^\(b\)/i
const REGEX_YELLOW_CIRCLE  = /^\(y\)/i

const RED_CIRCLE_EMOJI    = String.fromCodePoint(0x1F534)
const GREEN_CIRCLE_EMOJI  = String.fromCodePoint(0x1F7E2)
const BLUE_CIRCLE_EMOJI   = String.fromCodePoint(0x1F535)
const YELLOW_CIRCLE_EMOJI = String.fromCodePoint(0x1F7E1)

export class TextComponent {
  constructor(container, isRoot) {
    const foreignObject = document.createElementNS(NAME_SPACE, 'foreignObject')
    this.foreignObject = foreignObject

    foreignObject.classList.add('node')
    if(isRoot) {
      foreignObject.classList.add('root-node')
    }

    container.appendChild(foreignObject)

    const span = document.createElement('span')
    this.span = span
    
    // テキスト選択無効のクラスを指定
    span.className = 'disable-select';
    foreignObject.appendChild(span)
    
    this.setVisible(true)
  }

  formatEmoji(text) {
    text = text.replace(REGEX_RED_CIRCLE,    RED_CIRCLE_EMOJI)
    text = text.replace(REGEX_GREEN_CIRCLE,  GREEN_CIRCLE_EMOJI)
    text = text.replace(REGEX_BLUE_CIRCLE,   BLUE_CIRCLE_EMOJI)
    text = text.replace(REGEX_YELLOW_CIRCLE, YELLOW_CIRCLE_EMOJI)
    return text
  }

  setText(text) {
    this.text = text
    this.span.textContent = this.formatEmoji(text)
    
    const className = 'node'
    const dims = getElementDimension(this.foreignObject.innerHTML, className)

    // ADHOCで1.02倍している
    const width = dims.width * 1.02
    this.foreignObject.width.baseVal.value = width
    this.foreignObject.height.baseVal.value = dims.height
    
    this.width = width
    this.height = dims.height
  }

  setVisible(visible) {
    if(visible) {
      this.foreignObject.setAttribute('visibility', 'visible')
    } else {
      this.foreignObject.setAttribute('visibility', 'hidden')
    }
    this.visible = visible
  }

  get isVisible() {
    return this.visible
  }

  setPos(x, y) {
    this.foreignObject.x.baseVal.value = x
    this.foreignObject.y.baseVal.value = y
    
    this.x = x
    this.y = y
  }

  remove() {
    this.foreignObject.remove()
  }
  
  setStyle(style) {
    if(style == TEXT_COMPONENT_STYLE_SELECTED) {
      this.foreignObject.classList.add('node-selected')
      this.foreignObject.classList.remove('node-top-overlapped')
      this.foreignObject.classList.remove('node-right-overlapped')
      this.foreignObject.classList.remove('node-left-overlapped')
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_TOP) {
      this.foreignObject.classList.remove('node-selected')
      this.foreignObject.classList.add('node-top-overlapped')
      this.foreignObject.classList.remove('node-right-overlapped')
      this.foreignObject.classList.remove('node-left-overlapped')
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_RIGHT) {
      this.foreignObject.classList.remove('node-selected')
      this.foreignObject.classList.remove('node-top-overlapped')
      this.foreignObject.classList.add('node-right-overlapped')
      this.foreignObject.classList.remove('node-left-overlapped')
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_LEFT) {
      this.foreignObject.classList.remove('node-selected')
      this.foreignObject.classList.remove('node-top-overlapped')
      this.foreignObject.classList.remove('node-right-overlapped')
      this.foreignObject.classList.add('node-left-overlapped')
    } else {
      this.foreignObject.classList.remove('node-selected')
      this.foreignObject.classList.remove('node-top-overlapped')
      this.foreignObject.classList.remove('node-right-overlapped')
      this.foreignObject.classList.remove('node-left-overlapped')
    }
  }
}


export class LineComponent {
  constructor(container) {
    const lineElement = document.createElementNS(NAME_SPACE, 'line')
    this.lineElement = lineElement
    
    // ラインの位置後ほどupdateLayout()時に設定
    this.setPos(0, 0, 0, 0)
    
    lineElement.setAttribute('stroke', '#7f7f7f')
    lineElement.setAttribute('stroke-width', 1)
    
    container.appendChild(lineElement)
  }

  setVisible(visible) {
    if(visible) {
      this.lineElement.setAttribute('visibility', 'visible')
    } else {
      this.lineElement.setAttribute('visibility', 'hidden')
    }
  }

  setPos(sx, sy, ex, ey) {
    this.lineElement.setAttribute('x1', sx)
    this.lineElement.setAttribute('y1', sy)
    this.lineElement.setAttribute('x2', ex)
    this.lineElement.setAttribute('y2', ey)
  }

  remove() {
    this.lineElement.remove()
  }
}


export class FoldMarkComponent {
  constructor(container) {
    const markElement = document.createElementNS(NAME_SPACE, 'circle')
    this.markElement = markElement
    
    markElement.setAttribute('stroke', '#7f7f7f')
    markElement.setAttribute('stroke-width', 1)
    markElement.setAttribute('fill', '#ffffff')
    
    markElement.setAttribute('cx', 0)
    markElement.setAttribute('cy', 0)
    markElement.setAttribute('r', FOLD_MARK_RADIUS)
    container.appendChild(markElement)
  
    this.setVisible(false)
  }

  setVisible(visible) {
    if(visible) {
      this.markElement.setAttribute('visibility', 'visible')
    } else {
      this.markElement.setAttribute('visibility', 'hidden')
    }
  }

  setPos(x, y) {
    this.markElement.setAttribute('cx', x)
    this.markElement.setAttribute('cy', y)
  }

  remove() {
    this.markElement.remove()
  }
}


export class HandleComponent {
  constructor(container) {
    const handleElement = document.createElementNS(NAME_SPACE, 'ellipse')
    this.handleElement = handleElement
    
    handleElement.setAttribute('stroke', '#7f7f7f')
    handleElement.setAttribute('stroke-width', 1)
    handleElement.setAttribute('fill', 'none')
    
    handleElement.setAttribute('cx', 0)
    handleElement.setAttribute('cy', 0)
    handleElement.setAttribute('rx', HANDLE_WIDTH/2)
    handleElement.setAttribute('ry', HANDLE_HEIGHT/2+1)
    container.appendChild(handleElement)

    this.setVisible(false)
  }

  setVisible(visible) {
    if(visible) {
      this.handleElement.setAttribute('visibility', 'visible')
    } else {
      this.handleElement.setAttribute('visibility', 'hidden')
    }
  }

  setPos(x, y) {
    this.handleElement.setAttribute('cx', x + HANDLE_WIDTH/2)
    this.handleElement.setAttribute('cy', y + HANDLE_HEIGHT/2)

    this.x = x
    this.y = y
  }

  remove() {
    this.handleElement.remove()
  }

  containsPos(x, y) {
    return (x >= this.x - 2) && // 2pxだけ広げてtouchしやすくしている
      (x <= this.x + HANDLE_WIDTH + 2) &&
      (y >= this.y) && (y <= this.y + HANDLE_HEIGHT)
  }
}


export class RectComponent {
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
