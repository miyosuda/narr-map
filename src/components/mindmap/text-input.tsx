import { useState, useEffect, useRef } from 'react';
import { getTextWithSymbol } from '@/utils/node-utils'


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

  return {
    length: maxLength,
    row: rowSize
  }
}


interface TextInputProps {
  text: string;
  symbol: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  isRoot: boolean;
  isLeft: boolean;
  textSelected: boolean;
  handleDecidedText: (text: string) => void;
}

const MARGIN_Y = 1;

export const TextInput = (props: TextInputProps) => {
  const displayText = getTextWithSymbol(props.text, props.symbol)
  
  const { handleDecidedText } = props;
  const [text, setText] = useState(displayText);
  const [composing, setComposing] = useState(false);

  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(displayText);

    focus();
    
    if(props.textSelected) {
      // テキストをを選択状態に
      textarea.current!.setSelectionRange(0, displayText.length);
    } else {
      textarea.current!.setSelectionRange(0, 0);
    }
  }, [displayText, props.textSelected]);

  function focus() {
    textarea.current!.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const key = e.code;
    if((key === 'Enter' || key ==='Tab') && !e.shiftKey && !composing) {
      handleDecidedText(text);
      e.preventDefault();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  function handleBlur(e: React.ChangeEvent<HTMLTextAreaElement>) {
    handleDecidedText(e.target.value);
  }

  function handleCompositionStart(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setComposing(true);
  }

  function handleCompositionEnd(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setComposing(false);
  }
  
  let className = 'p-0 px-1 block border border-gray-400 w-full resize-none focus:outline-none font-custom';
  if(props.isLeft) {
    className = className + ' text-right';
  } else {
    className = className + ' text-left';
  }

  const {length, row} = getStringLengthAndRow(text);
  // textareaの取る幅
  const textAreaWidth = 11 * length + 10;
  const width = textAreaWidth;
  const height = row * 24 + 6;

  const x = props.isLeft ? props.x + props.width - width : props.x;
  const y = props.isRoot ? props.y - MARGIN_Y + 2 : props.y - MARGIN_Y;

  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      style={{display:'block'}}>
      <textarea
        ref={textarea}
        defaultValue={text}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        className={className}
        style={{width:`${textAreaWidth}px`}}
        rows={row}>
      </textarea>
    </foreignObject>
  )
}
