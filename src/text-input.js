import {getElementDimension} from './text-utils'

const KEY_ENTER = 13
const KEY_SHIFT = 16

const MARGIN_Y = 1


// 全角を2文字としてカウントする文字列カウント
const getStringLength = (str) => {
  if( str == null ) {
    return 0
  }
  
  let result = 0
  for(let i=0; i<str.length; i++) {
    const chr = str.charCodeAt(i)
    if((chr >= 0x00 && chr < 0x81) ||
       (chr === 0xf8f0) ||
       (chr >= 0xff61 && chr < 0xffa0) ||
       (chr >= 0xf8f1 && chr < 0xf8f4)) {
      result += 1
    } else {
      result += 2
    }
  }
  return result
}


const getStringLengthAndRow = (str, minSize=5) => {
  const texts = str.split('\n')
  const rowSize = texts.length

  let maxLength = minSize
  for(let i=0; i<texts.length; i++) {
    const text = texts[i]
    const length = getStringLength(text)
    if(length > maxLength) {
      maxLength = length
    }
  }

  return [maxLength, rowSize]
}


export class TextInput {
  constructor(mapManager) {
    this.mapManager = mapManager
    this.foreignObject = document.getElementById('textInputObj')
    
    const input = document.getElementById('textInput')
    this.input = input
    
    this.textChanged = false
    this.shiftOn = false
    
    const inputContainer = document.getElementById('textInputContainer')
    this.inputContainer = inputContainer
    
    input.addEventListener('input', () => {
      this.onTextInput()
    })

    input.addEventListener('change', () => {
      this.onTextChange(input.value)
    })

    input.addEventListener('blur', (event) => {
      this.onTextChange(input.value)
    })
    
    input.addEventListener('keydown', (event) => {
      const key = event.keyCode || event.charCode || 0
      
      if(key == KEY_ENTER) { // Enter key
        if(!this.shiftOn) {
          // シフトキーが押されていなかった場合、入力決定とする
          this.onTextChange(input.value)
        }
      } else if(key == KEY_SHIFT) { // Shift key
        // shiftキー押下
        this.shiftOn = true
      }
    })

    input.addEventListener('keyup', (event) => {
      const key = event.keyCode || event.charCode || 0
      
      if(key == KEY_SHIFT) {
        // shiftキー離した
        this.shiftOn = false
      }
    })
    
    this.hide()
  }

  show(node) {
    this.node = node

    if(node.isLeft) {
      this.input.classList.remove('text-input-right')
      this.input.classList.add('text-input-left')
    } else {
      this.input.classList.remove('text-input-left')
      this.input.classList.add('text-input-right')
    }

    const text = node.text
    this.input.value = text
    this.textOnShown = text
    
    this.updateInputSize()

    // 先にdisplayをセットしておかないとinput.offsetWidth等が取れない
    this.foreignObject.style.display = 'block'

    let y = this.node.y - MARGIN_Y
    if(node.isRoot) {
      y += 2
    }
    this.foreignObject.y.baseVal.value = y
    
    this.updateOuterSize()

    // テキストをを選択状態に
    this.input.setSelectionRange(0, text.length)
    this.input.focus()
    
    this.textChanged = false
    this.shown = true
  }

  hide() {
    this.foreignObject.style.display = 'none'
    this.shown = false
  }

  updateInputSize() {
    // テキストが変化した
    let [stringLength, rows] = getStringLengthAndRow(this.input.value)
    this.input.style.width = (stringLength * 11 + 10) + "px"
    this.input.setAttribute('rows', rows)
  }

  updatePos() {
    if(this.node.isLeft) {
      this.foreignObject.x.baseVal.value = this.node.right - this.width
    } else {
      this.foreignObject.x.baseVal.value = this.node.x
    }
  }

  updateOuterSize() {
    // foreignObjectのサイズを更新する
    const dims = getElementDimension(this.inputContainer.innerHTML)
    this.foreignObject.width.baseVal.value = dims.width
    this.foreignObject.height.baseVal.value = dims.height

    this.width = dims.width

    this.updatePos()
  }

  onTextInput() {
    // テキストが変化した
    this.textChanged = true
    this.updateInputSize()
    
    // foreignObjectのサイズも変える
    this.updateOuterSize()
  }
  
  onTextChange(value) {
    if(!this.shown) {
      // hide()した後に呼ばれる場合があるのでその場合をskip
      return
    }
    
    // テキスト入力が完了した
    this.node.setText(value)
    const textChanged = this.textOnShown != value
    this.mapManager.onTextDecided(this.node, textChanged)
    this.hide()
  }

  get isShown() {
    return this.shown
  }
}
