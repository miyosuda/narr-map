import {getElementDimension} from './text-utils';
import { Config } from './config';

const NAME_SPACE = 'http://www.w3.org/2000/svg';

export const HANDLE_WIDTH  = 10;
export const HANDLE_HEIGHT = 21;

export const TEXT_COMPONENT_STYLE_NONE        = 0;
export const TEXT_COMPONENT_STYLE_HOVER_TOP   = 1;
export const TEXT_COMPONENT_STYLE_HOVER_RIGHT = 2;
export const TEXT_COMPONENT_STYLE_HOVER_LEFT  = 3;
export const TEXT_COMPONENT_STYLE_SELECTED    = 4;

const FOLD_MARK_RADIUS = 3;

const REGEX_RED_CIRCLE     = /^\(r\)/i;
const REGEX_GREEN_CIRCLE   = /^\(g\)/i;
const REGEX_BLUE_CIRCLE    = /^\(b\)/i;
const REGEX_YELLOW_CIRCLE  = /^\(y\)/i;

const RED_CIRCLE_EMOJI    = String.fromCodePoint(0x1F534);
const GREEN_CIRCLE_EMOJI  = String.fromCodePoint(0x1F7E2);
const BLUE_CIRCLE_EMOJI   = String.fromCodePoint(0x1F535);
const YELLOW_CIRCLE_EMOJI = String.fromCodePoint(0x1F7E1);


type ForeignObjectType = HTMLElement & SVGForeignObjectElement;


// ElementのsetAttribute()ラップするためのProxy
function createProxyElementNS(qualifiedName: string) : any {
  const proxyHandler = {
    set: function(target: any, prop: string, value: any) {
      // '_'は'-'に置き換える.
      prop = prop.replace(/_/g, '-');
      
      if(typeof(value) != 'string') {
        target.setAttribute(prop, String(value));
      } else {
        target.setAttribute(prop, value);
      } 
      return true;
    },
    
    get(target: any, prop: string) {
      if(prop === 'target') {
        return target;
      }
      return Reflect.get(target, prop);
    }
  };
  
  const element : Element = document.createElementNS(NAME_SPACE, qualifiedName);
  const proxy = new Proxy<Element>(element, proxyHandler);
  return proxy;
}


function setElementClasses(element: ForeignObjectType, classes: Array<String>) {
  const classListStr = classes.join(' ');
  element.setAttribute('class', classListStr);
}


export class TextComponent {
  isRoot : boolean;
  foreignObject : ForeignObjectType;
  config : Config;
  text : string | null;
  span : Element;
  width : number | null;
  height : number | null;
  x : number | null;
  y : number | null;
  visible : boolean | null;
  
  constructor(container : Element,
              isRoot : boolean,
              config : Config) {
    this.isRoot = isRoot;
    
    const foreignObject = document.createElementNS(
      NAME_SPACE, 'foreignObject') as ForeignObjectType;
    this.foreignObject = foreignObject
    
    this.applyConfig(config);
    
    container.appendChild(foreignObject);

    const span = document.createElement('span');
    this.span = span;
    
    // テキスト選択無効のクラスを指定
    span.className = 'disable-select';
    foreignObject.appendChild(span);

    this.setVisible(true);
  }

  applyConfig(config : Config) {
    this.config = config;
    // TODO:
    this.setStyle(TEXT_COMPONENT_STYLE_NONE);
  }

  formatEmoji(text : string) {
    text = text.replace(REGEX_RED_CIRCLE,    RED_CIRCLE_EMOJI);
    text = text.replace(REGEX_GREEN_CIRCLE,  GREEN_CIRCLE_EMOJI);
    text = text.replace(REGEX_BLUE_CIRCLE,   BLUE_CIRCLE_EMOJI);
    text = text.replace(REGEX_YELLOW_CIRCLE, YELLOW_CIRCLE_EMOJI);
    return text;
  }

  setText(text : string) {
    this.text = text;
    this.span.textContent = this.formatEmoji(text);
    
    let className = 'node';
    if(this.isRoot) {
      className = 'root-node';
    }
    const dims = getElementDimension(this.foreignObject.innerHTML, className);

    // ADHOC: 以前はみ出ていたのでサイズの調整をした
    let width = dims.width + 3;
    let height = dims.height + 2;

    if(text.trim().length == 0) {
      // 空文字の時文字(16pt)の高さが反映されず3+3+1+2となってしまうので対処を入れる.
      height = 4 + 1 + 1 + 16 + 2;
      // 空文字のデフォルトの幅だとクリックしにくいので広げておく
      width = 13;
    }
    
    this.foreignObject.setAttribute('width', String(width));
    this.foreignObject.setAttribute('height', String(height));
    
    this.width = width;
    this.height = height;
  }

  setVisible(visible : boolean) {
    if(visible) {
      this.foreignObject.setAttribute('visibility', 'visible');
    } else {
      this.foreignObject.setAttribute('visibility', 'hidden');
    }
    this.visible = visible;
  }

  get isVisible() {
    return this.visible;
  }

  setPos(x : number, y : number) {
    this.foreignObject.setAttribute('x', String(x));
    this.foreignObject.setAttribute('y', String(y));
    
    this.x = x;
    this.y = y;
  }

  remove() {
    this.foreignObject.remove();
  }
  
  setStyle(style : number) {
    const classList : Array<String> = [];

    if(this.isRoot) {
      classList.push('root-node');
      if(this.config.darkMode) {
        classList.push('with-back-dark');
      } else {
        classList.push('with-back-light');
      }
    } else {
      classList.push('node');
    }

    let styleClass : String = null;

    if(style == TEXT_COMPONENT_STYLE_SELECTED) {
      styleClass = 'node-selected';
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_TOP) {
      styleClass = 'node-top-overlapped';
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_LEFT) {
      styleClass = 'node-left-overlapped';
    } else if(style == TEXT_COMPONENT_STYLE_HOVER_RIGHT) {
      styleClass = 'node-right-overlapped';
    }

    if(styleClass != null) {
      if(this.config.darkMode) {
        classList.push(styleClass + '-dark');
      } else {
        classList.push(styleClass + '-light');
      }
    }
    
    setElementClasses(this.foreignObject, classList);
  }
}


export class LineComponent {
  lineElement : any;
  
  constructor(container : Element) {
    const lineElement = createProxyElementNS('line');
    this.lineElement = lineElement;
    
    // ラインの位置後ほどupdateLayout()時に設定
    this.setPos(0, 0, 0, 0);
    
    lineElement.stroke = '#7f7f7f';
    lineElement.stroke_width = 1;
    
    container.appendChild(lineElement.target);
  }

  setVisible(visible : boolean) {
    if(visible) {
      this.lineElement.visibility = 'visible';
    } else {
      this.lineElement.visibility = 'hidden';
    }
  }

  setPos(sx : number,
         sy : number,
         ex : number,
         ey : number) {
    this.lineElement.x1 = sx;
    this.lineElement.y1 = sy;
    this.lineElement.x2 = ex;
    this.lineElement.y2 = ey;
  }

  remove() {
    this.lineElement.target.remove();
  }
}


export class FoldMarkComponent {
  markElement : any;
  
  constructor(container : Element,
              config : Config) {
    const markElement = createProxyElementNS('circle');
    this.markElement = markElement;

    this.applyConfig(config);
    
    markElement.stroke = '#7f7f7f';
    markElement.stroke_width = 1;
    
    markElement.cx = 0;
    markElement.cy = 0;
    markElement.r = FOLD_MARK_RADIUS;
    container.appendChild(markElement.target);
  
    this.setVisible(false);
  }

  applyConfig(config : Config) {
    if(config.darkMode) {
      this.markElement.fill = '#000000'; // dark-mode
    } else {
      this.markElement.fill = '#ffffff'; // light-mode
    }
  }

  setVisible(visible : boolean) {
    if(visible) {
      this.markElement.visibility = 'visible';
    } else {
      this.markElement.visibility = 'hidden';
    }
  }

  setPos(x : number,
         y : number) {
    this.markElement.cx = x;
    this.markElement.cy = y;
  }

  remove() {
    this.markElement.target.remove();
  }
}


export class HandleComponent {
  handleElement : any;
  x : number | null;
  y : number | null;
  
  constructor(container : Element,
              config : Config) {
    
    const handleElement = createProxyElementNS('ellipse');
    this.handleElement = handleElement;
    
    this.applyConfig(config);
    
    handleElement.stroke = '#7f7f7f';
    handleElement.stroke_width = 1;
  
    handleElement.cx = 0;
    handleElement.cy = 0;
    handleElement.rx = HANDLE_WIDTH/2;
    handleElement.ry = HANDLE_HEIGHT/2+1;
    container.appendChild(handleElement.target);
  
    this.setVisible(false);
  }

  applyConfig(config : Config) {
    if(config.darkMode) {
      this.handleElement.fill = '#000000'; // dark-mode
    } else {
      this.handleElement.fill = '#ffffff'; // light-mode
    }    
  }

  setVisible(visible : boolean) {
    if(visible) {
      this.handleElement.visibility = 'visible';
    } else {
      this.handleElement.visibility = 'hidden';
    }
  }

  setPos(x : number,
         y : number) {
    this.handleElement.cx = x + HANDLE_WIDTH/2;
    this.handleElement.cy = y + HANDLE_HEIGHT/2;

    this.x = x;
    this.y = y;
  }

  remove() {
    this.handleElement.target.remove();
  }

  containsPos(x : number,
              y : number) {
    return (x >= this.x - 2) && // 2pxだけ広げてtouchしやすくしている
      (x <= this.x + HANDLE_WIDTH + 2) &&
      (y >= this.y) && (y <= this.y + HANDLE_HEIGHT);
  }
}


export class RectComponent {
  rectElement : any;
  
  constructor(container : Element) {
    const rectElement = createProxyElementNS('rect');

    rectElement.x = 0;
    rectElement.y =  0;
    rectElement.width = 100;
    rectElement.height = 30;
    rectElement.fill = 'none';
    rectElement.stroke = '#7f7f7f';
    rectElement.stroke_width = 2;
    
    container.appendChild(rectElement.target);
    this.rectElement = rectElement;
  }

  setWidth(width : number) {
    this.rectElement.width = width;
  }
  
  setHeight(height : number) {
    this.rectElement.height = height;
  }

  setPos(x : number, y : number) {
    this.rectElement.x = x;
    this.rectElement.y = y;
  }

  setVisible(visible : boolean) {
    if(visible) {
      this.rectElement.visibility = 'visible';
    } else {
      this.rectElement.visibility = 'hidden';
    }
  }
}
