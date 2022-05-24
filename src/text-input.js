import {getElementDimension} from './text-utils'

const KEY_ENTER = 13
const KEY_SHIFT = 16


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
  constructor(noteManager) {
    this.noteManager = noteManager
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

  show(data, initialCaretPos=0) {
    this.data = data
    this.input.value = this.data.text

    this.textOnShown = this.data.text
    
    this.updateInputSize()

    // 先にdisplayをセットしておかないとinput.offsetWidth等が取れない
    this.foreignObject.style.display = 'block'
    
    this.foreignObject.x.baseVal.value = this.data.x
    this.foreignObject.y.baseVal.value = this.data.y
    this.updateOuterSize()
    
    this.input.focus()
    if( initialCaretPos != 0 ) {
      this.input.setSelectionRange(initialCaretPos, initialCaretPos)
    }
    
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

  updateOuterSize() {
    // foreignObjectのサイズを更新する
    const dims = getElementDimension(this.inputContainer.innerHTML)
    this.foreignObject.width.baseVal.value = dims.width
    this.foreignObject.height.baseVal.value = dims.height
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
    this.data.setText(value)
    const textChanged = this.textOnShown != value
    this.noteManager.onTextDecided(this.data, textChanged)
    this.hide()
  }

  isShown() {
    return this.shown
  }
}
