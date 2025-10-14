import './css/settings-style.css'
import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'
const { nmAPI } = window

const execCommands = ['copy', 'paste', 'cut', 'undo', 'redo', 'selectall']

const Setting = () => {
  const [darkMode, setDarkMode] = useState(false)
  const [openaiApiKey, setOpenAIApiKey] = useState('')
  const [completionModel, setCompletionModel] = useState('')
  const [completionContext, setCompletionContext] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      const settingData = await nmAPI.invoke('get-settings')
      setDarkMode(settingData.darkMode)
      setOpenAIApiKey(settingData.openaiApiKey)
      setCompletionModel(settingData.completionModel)
      setCompletionContext(settingData.completionContext)
    }

    nmAPI.onReceiveMessage((arg: string, obj: any) => {
      if (execCommands.some((element) => element === arg)) {
        document.execCommand(arg)
      }
    })

    fetchSettings()
  }, [])

  const handleDarkModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDarkMode = event.target.checked
    setDarkMode(newDarkMode)
    nmAPI.sendMessage('settings-set-dark-mode', newDarkMode)
  }

  const handleOpenAIApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOpenaiApiKey = event.target.value
    setOpenAIApiKey(newOpenaiApiKey)
    nmAPI.sendMessage('settings-set-openai-api-key', newOpenaiApiKey)
  }

  const handleCompletionModelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCompletionModel = event.target.value
    setCompletionModel(newCompletionModel)
    nmAPI.sendMessage('settings-set-completion-model', newCompletionModel)
  }

  const handleCompletionContextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCompletionContext = event.target.value
    setCompletionContext(newCompletionContext)
    nmAPI.sendMessage('settings-set-completion-context', newCompletionContext)
  }

  return (
    <div>
      <div className="flex flex-col w-[600px] mx-auto my-5">
        <div className="flex items-center mb-4">
          <label htmlFor="dark-mode" className="text-base w-32">
            Dark mode
          </label>
          <input
            type="checkbox"
            id="dark-mode"
            checked={darkMode}
            onChange={handleDarkModeChange}
            className="ml-0"
          />
        </div>
        <div className="flex items-center mb-4">
          <label htmlFor="api-key" className="text-base w-32">
            OpenAI API key
          </label>
          <input
            type="text"
            id="api-key"
            value={openaiApiKey}
            onChange={handleOpenAIApiKeyChange}
            className="flex-grow p-1 text-base border border-gray-300 rounded"
          />
        </div>
        <div className="flex items-center mb-4">
          <label htmlFor="completion-model" className="text-base w-32">
            Completion model
          </label>
          <input
            type="text"
            id="completion-model"
            value={completionModel}
            onChange={handleCompletionModelChange}
            className="flex-grow p-1 text-base border border-gray-300 rounded"
          />
        </div>
        <div className="flex items-center mb-4">
          <label htmlFor="completion-context" className="text-base w-32">
            Completion context
          </label>
          <textarea id="completion-context" value={completionContext} onChange={handleCompletionContextChange} className="flex-grow p-1 text-base border border-gray-300 rounded h-40" />
        </div>
      </div>
    </div>
  )
}

function render() {
  const root = createRoot(document.getElementById('root'))
  root.render(<Setting />)
}

render()
