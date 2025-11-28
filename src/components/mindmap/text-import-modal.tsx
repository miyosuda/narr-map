import { useState, useEffect, useRef } from 'react'
const { nmAPI } = window

// TextImportModalを開いている時にdocumentに実行させるコマンド
const execCommands = ['copy', 'paste', 'cut', 'undo', 'redo', 'selectall']

interface TextImportModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (text: string) => void
  onCancel: () => void
  isGenerating: boolean
  darkMode: boolean
}

export const TextImportModal = (props: TextImportModalProps) => {
  const { isOpen, onClose, onGenerate, onCancel, isGenerating, darkMode } = props
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // メニューからのcopy/paste/cut/undo/redo/selectallコマンドを処理
  useEffect(() => {
    if (!isOpen) return

    const offFunc = nmAPI.onReceiveMessage((arg: string, obj: any) => {
      if (execCommands.some((element) => element === arg)) {
        // copy, paste, cut, undo, redo, selectAllのいずれかだった場合は、
        // documentにコマンドを実行させてtextarea内のundo,redoに対処.
        document.execCommand(arg)
      }
    })
    return offFunc
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isGenerating) {
          onCancel()
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose, onCancel])

  const handleGenerate = () => {
    if (text.trim() && !isGenerating) {
      onGenerate(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  if (!isOpen) return null

  // New York style colors
  const bgColor = darkMode ? 'bg-zinc-950' : 'bg-white'
  const textColor = darkMode ? 'text-zinc-50' : 'text-zinc-950'
  const borderColor = darkMode ? 'border-zinc-800' : 'border-zinc-200'
  const mutedTextColor = darkMode ? 'text-zinc-400' : 'text-zinc-500'
  const textareaBg = darkMode ? 'bg-zinc-900' : 'bg-white'
  const placeholderColor = darkMode ? 'placeholder-zinc-500' : 'placeholder-zinc-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - New York style with subtle blur */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={isGenerating ? onCancel : onClose}
      />

      {/* Modal - New York style with smaller radius and refined shadow */}
      <div
        className={`relative ${bgColor} ${textColor} rounded-lg shadow-lg border ${borderColor} w-[640px] max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200`}
      >
        {/* Header - New York style with tighter spacing */}
        <div className={`px-6 py-4 border-b ${borderColor}`}>
          <h2 className="text-lg font-semibold tracking-tight">Generate MindMap from Text</h2>
          <p className={`text-sm mt-1 ${mutedTextColor}`}>
            Enter text to automatically generate a MindMap
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-auto">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter text to convert into a MindMap..."
            className={`w-full h-64 px-3 py-2 text-sm border ${borderColor} ${textareaBg} ${textColor} ${placeholderColor} rounded-md resize-none transition-colors focus:outline-none focus:ring-1 ${darkMode ? 'focus:ring-zinc-300' : 'focus:ring-zinc-950'} focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={isGenerating}
          />
          <p className={`text-xs mt-2 ${mutedTextColor}`}>
            Press Ctrl+Enter or Cmd+Enter to generate
          </p>
        </div>

        {/* Footer - New York style buttons */}
        <div className={`px-6 py-4 border-t ${borderColor} flex justify-end gap-2`}>
          <button
            onClick={isGenerating ? onCancel : onClose}
            className={`inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-1 focus:ring-offset-0 ${
              darkMode
                ? 'bg-zinc-900 border-zinc-800 text-zinc-50 hover:bg-zinc-800 hover:text-zinc-50 focus:ring-zinc-300'
                : 'bg-white border-zinc-200 text-zinc-950 hover:bg-zinc-100 hover:text-zinc-900 focus:ring-zinc-950'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || text.trim() === ''}
            className={`inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-offset-0 gap-2 ${
              isGenerating || text.trim() === ''
                ? darkMode
                  ? 'bg-zinc-50/50 text-zinc-900/50 cursor-not-allowed'
                  : 'bg-zinc-900/50 text-zinc-50/50 cursor-not-allowed'
                : darkMode
                  ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-50/90 focus:ring-zinc-300'
                  : 'bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 focus:ring-zinc-950'
            }`}
          >
            {isGenerating && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

