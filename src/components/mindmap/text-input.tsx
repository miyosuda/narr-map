import { useState, useEffect, useRef } from 'react'
import { getTextWithSymbol } from '@/utils/node-utils'
import { getElementDimension } from '@/utils/node-draw-utils'
const { nmAPI } = window

const getStringWidthAndRow = (str: string) => {
  const texts = str.split('\n')
  const rowSize = texts.length

  let maxWidth = 80

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]

    const innerHTML = '<span>' + text + '</span>'
    const classForCalcDim = 'p-0 px-1 font-custom'
    const { width, height } = getElementDimension(innerHTML, classForCalcDim)

    if (width > maxWidth) {
      maxWidth = width
    }
  }

  return {
    width: maxWidth,
    row: rowSize
  }
}

interface TextInputProps {
  text: string
  symbol: string | null
  x: number
  y: number
  width: number
  height: number
  isRoot: boolean
  isLeft: boolean
  textSelected: boolean
  handleDecidedText: (text: string) => void
  darkMode: boolean
}

const MARGIN_Y = 1

// TextInputを開いている時にdocumentに実行させるコマンド
const execCommands = ['copy', 'paste', 'cut', 'undo', 'redo', 'selectall']

export const TextInput = (props: TextInputProps) => {
  const displayText = getTextWithSymbol(props.text, props.symbol)

  const { handleDecidedText } = props
  const [text, setText] = useState(displayText)
  const [composing, setComposing] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const handlerRef = useRef<(arg: string, obj: any) => void>(() => {})

  handlerRef.current = (arg: string, obj: any) => {
    if (arg === 'paste' && obj?.text !== undefined) {
      // pasteコマンドの場合は、クリップボードの内容をtextareaに挿入
      const ta = textareaRef.current
      if (ta) {
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const newText = text.substring(0, start) + obj.text + text.substring(end)
        setText(newText)
        // カーソル位置を更新
        setTimeout(() => {
          ta.setSelectionRange(start + obj.text.length, start + obj.text.length)
        }, 0)
      }
    } else if (execCommands.some((element) => element === arg)) {
      // copy, cut, undo, redo, selectAllの場合は、
      // textareaにフォーカスしてからコマンドを実行する.
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        document.execCommand(arg)
        if (arg === 'cut') {
          setText(ta.value)
        }
      }
    } else {
      handleDecidedText(text)
    }
  }

  useEffect(() => {
    return nmAPI.onReceiveMessage((arg: string, obj: any) => {
      handlerRef.current(arg, obj)
    })
  }, [])

  useEffect(() => {
    setText(displayText)

    focus()

    if (props.textSelected) {
      // テキストをを選択状態に
      textareaRef.current!.setSelectionRange(0, displayText.length)
    } else {
      textareaRef.current!.setSelectionRange(0, 0)
    }
  }, [displayText, props.textSelected])

  function focus() {
    textareaRef.current!.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const key = e.code
    if ((key === 'Enter' || key === 'Tab') && !e.shiftKey && !composing) {
      handleDecidedText(text)
      e.preventDefault()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
  }

  function handleBlur(e: React.ChangeEvent<HTMLTextAreaElement>) {
    handleDecidedText(e.target.value)
  }

  function handleCompositionStart(e: React.CompositionEvent<HTMLTextAreaElement>) {
    setComposing(true)
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLTextAreaElement>) {
    setComposing(false)
  }

  let className =
    'p-0 px-1 block border border-zinc-400 w-full resize-none focus:outline-none font-custom'
  if (props.isLeft) {
    className = className + ' text-right'
  } else {
    className = className + ' text-left'
  }

  if (props.darkMode) {
    className = className + ' bg-black text-white'
  } else {
    className = className + ' bg-white text-black'
  }

  // textareaの取る幅
  let { width, row } = getStringWidthAndRow(text)
  width = width + 18
  const height = row * 24 + 6

  const x = props.isLeft ? props.x + props.width - width : props.x
  const y = props.isRoot ? props.y - MARGIN_Y + 2 : props.y - MARGIN_Y

  return (
    <foreignObject x={x} y={y} width={width} height={height} style={{ display: 'block' }}>
      <textarea
        ref={textareaRef}
        value={text}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        className={className}
        style={{ width: `${width}px` }}
        rows={row}
      ></textarea>
    </foreignObject>
  )
}
