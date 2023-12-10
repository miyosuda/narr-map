import { getElementDimension } from './text-utils';
import { Node } from './node';

const KEYCODE_ENTER = 13;
const KEYCODE_SHIFT = 16;

const MARGIN_Y = 1;

export type OnTextDecidedCallbackType = (node : Node, changed : boolean) => void;


// 全角を2文字としてカウントする文字列カウント
const getStringLength = (str : string) => {
  if( str == null ) {
    return 0;
  }
  
  let result = 0;
  for(let i=0; i<str.length; i++) {
    const chr = str.charCodeAt(i)
    if((chr >= 0x00 && chr < 0x81) ||
       (chr === 0xf8f0) ||
       (chr >= 0xff61 && chr < 0xffa0) ||
       (chr >= 0xf8f1 && chr < 0xf8f4)) {
      result += 1;
    } else {
      result += 2;
    }
  }
  return result;
}


const getStringLengthAndRow = (str : string, minSize=5) => {
  const texts = str.split('\n');
  const rowSize = texts.length;

  let maxLength = minSize
  for(let i=0; i<texts.length; i++) {
    const text = texts[i];
    const length = getStringLength(text);
    if(length > maxLength) {
      maxLength = length;
    }
  }

  return [maxLength, rowSize];
}


type SvgInHtml = HTMLElement & SVGElement;


export class TextInput {
  onTextDecidedCallback : OnTextDecidedCallbackType;
  input : HTMLInputElement;
  foreignObject : SvgInHtml;
  inputContainer : Element;
  node : Node | null;
  textOnShown : string | null;
  shown : boolean;
  textChanged : boolean;
  shiftOn : boolean;
  width : number | null;
  config : Config | null;

  
  constructor(onTextDecidedCallback : OnTextDecidedCallbackType) {
    this.onTextDecidedCallback = onTextDecidedCallback;
    this.foreignObject = document.getElementById('textInputObj') as SvgInHtml;
    
    this.textChanged = false;
    this.shiftOn = false;
    
    const inputContainer = document.getElementById('textInputContainer');
    this.inputContainer = inputContainer;
    
    this.node = null;
    
	this.onTextInput = this.onTextInput.bind(this);
	this.onTextChange = this.onTextChange.bind(this);
	this.onKeyDown = this.onKeyDown.bind(this);
	this.onKeyUp = this.onKeyUp.bind(this);
    
    this.hideSub();
  }

  applyConfig(config : Config) {
	this.config = config;
	this.applyConfigSub();
  }

  applyConfigSub() {
	if(this.input != null) {
	  if(this.config.darkMode) {
		this.input.className = 'with-back-dark';
	  } else {
		this.input.className = 'with-back-light';
	  }
	}
  }

  setListeners(input: HTMLInputElement) {
    input.addEventListener('input', this.onTextInput);
    input.addEventListener('change', this.onTextChange);
    input.addEventListener('blur', this.onTextChange);
    input.addEventListener('keydown', this.onKeyDown);
    input.addEventListener('keyup', this.onKeyUp);
  }

  removeListeners(input: HTMLInputElement) {
    input.removeEventListener('input', this.onTextInput);
    input.removeEventListener('change', this.onTextChange);
    input.removeEventListener('blur', this.onTextChange);
    input.removeEventListener('keydown', this.onKeyDown);
    input.removeEventListener('keyup', this.onKeyUp);
  }

  show(node : Node, selectAll=true) {
	this.input = document.createElement('textarea') as HTMLInputElement;
	this.inputContainer.appendChild(this.input);
	this.setListeners(this.input);
	
	this.applyConfigSub();
	
    this.node = node;

    if(node.isLeft) {
      this.input.classList.remove('text-input-right');
      this.input.classList.add('text-input-left');
    } else {
      this.input.classList.remove('text-input-left');
      this.input.classList.add('text-input-right');
    }

    const text = node.text;
    this.input.value = text;
    this.textOnShown = text;
    
    this.updateInputSize();

    // 先にdisplayをセットしておかないとinput.offsetWidth等が取れない
    this.foreignObject.style.display = 'block';

    let y = this.node.y - MARGIN_Y;
    if(node.isRoot) {
      y += 2;
    }
    this.foreignObject.setAttribute('y', String(y));
    
    this.updateOuterSize();

    if(selectAll) {
      // テキストをを選択状態に
      this.input.setSelectionRange(0, text.length);
    } else {
      // 先頭にキャレットを置く
      this.input.setSelectionRange(0, 0);
    }
    this.input.focus();
    
    this.textChanged = false;
    this.shown = true;
    
    this.node.startTempHide();
  }

  hide() {
	this.removeListeners(this.input);
	this.inputContainer.removeChild(this.input);
	this.input = null;
	
	this.hideSub();
  }

  hideSub() {
    this.foreignObject.style.display = 'none';
	
    this.shown = false;
    if(this.node != null) {
      this.node.stopTempHide();
      this.node = null;
    }
  }

  updateInputSize() {
    // テキストが変化した
    let [stringLength, rows] = getStringLengthAndRow(this.input.value);
    this.input.style.width = (stringLength * 11 + 10) + "px";
    this.input.setAttribute('rows', String(rows));
  }

  updatePos() {
    if(this.node.isLeft) {
      this.foreignObject.setAttribute('x', String(this.node.right - this.width));
    } else {
      this.foreignObject.setAttribute('x', String(this.node.x));
    }
  }

  updateOuterSize() {
    // foreignObjectのサイズを更新する
    const dims = getElementDimension(this.inputContainer.innerHTML);
    
    this.foreignObject.setAttribute('width', String(dims.width));
    this.foreignObject.setAttribute('height', String(dims.height));

    this.width = dims.width;

    this.updatePos();
  }

  onTextInput() {
    if(!this.shown) {
      // hide()した後に呼ばれる場合があるのでその場合をskip
      return;
    }
	  
    // テキストが変化した
    this.textChanged = true;
    this.updateInputSize();
    
    // foreignObjectのサイズも変える
    this.updateOuterSize();
  }
  
  onTextChange() {
    if(!this.shown) {
      // hide()した後に呼ばれる場合があるのでその場合をskip
      return;
    }
	
	const value = this.input.value;
    
    // テキスト入力が完了した
    this.node.setText(value);
    const textChanged = this.textOnShown != value;
    this.onTextDecidedCallback(this.node, textChanged);
    
    this.hide();
  }

  onKeyDown(event: KeyboardEvent) {
    const key = event.keyCode || event.charCode || 0;
	
    if(key == KEYCODE_ENTER) { // Enter key
      if(!this.shiftOn) {
        // シフトキーが押されていなかった場合、入力決定とする
        this.onTextChange(this.input.value);
      }
    } else if(key == KEYCODE_SHIFT) { // Shift key
      // shiftキー押下
      this.shiftOn = true;
    }
  }

  onKeyUp(event: KeyboardEvent) {
    const key = event.keyCode || event.charCode || 0;
      
    if(key == KEYCODE_SHIFT) {
      // shiftキー離した
      this.shiftOn = false;
    }
  }

  get isShown() {
    return this.shown;
  }
}
