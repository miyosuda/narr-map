import React, { useState, useEffect, useRef } from 'react'

interface TextImportModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (text: string) => void
  isGenerating: boolean
  darkMode: boolean
}

export const TextImportModal: React.FC<TextImportModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
  darkMode
}) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isGenerating) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose])

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

  const bgColor = darkMode ? 'bg-zinc-900' : 'bg-white'
  const textColor = darkMode ? 'text-white' : 'text-gray-900'
  const borderColor = darkMode ? 'border-zinc-700' : 'border-gray-300'
  const textareaBg = darkMode ? 'bg-zinc-800' : 'bg-white'
  const placeholderColor = darkMode ? 'placeholder-zinc-500' : 'placeholder-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={!isGenerating ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className={`relative ${bgColor} ${textColor} rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderColor}`}>
          <h2 className="text-lg font-semibold">Generate MindMap from Text</h2>
          <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
            テキストを入力してMindMapを自動生成します
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-auto">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="MindMapに変換したいテキストを入力してください..."
            className={`w-full h-64 p-3 border ${borderColor} ${textareaBg} ${textColor} ${placeholderColor} rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500`}
            disabled={isGenerating}
          />
          <p className={`text-xs mt-2 ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
            Ctrl+Enter または Cmd+Enter で生成
          </p>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${borderColor} flex justify-end gap-3`}>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className={`px-4 py-2 rounded-md transition-colors ${
              darkMode
                ? 'bg-zinc-700 hover:bg-zinc-600 text-white disabled:bg-zinc-800 disabled:text-zinc-600'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || text.trim() === ''}
            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
              isGenerating || text.trim() === ''
                ? 'bg-blue-400 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
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

