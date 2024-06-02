import './css/settings-style.css';
import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';
const { nmAPI } = window;

const execCommands = [
  'copy',
  'paste',
  'cut',
  'undo',
  'redo',
  'selectall'
];


const Setting = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [openaiApiKey, setOpenAIApiKey] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      const response = await nmAPI.requestSettings();
      setDarkMode(response.darkMode);
      setOpenAIApiKey(response.openaiApiKey);
    };

    nmAPI.onReceiveMessage((arg : string, obj : any) => {
      if( execCommands.some(element => element === arg) ) {
        document.execCommand(arg);
      }
    });
  
    fetchSettings();
  }, []);
    
  const handleDarkModeChange = (event) => {
    const newDarkMode = event.target.checked;
    setDarkMode(newDarkMode);
    nmAPI.sendMessage('set-dark-mode', newDarkMode);
  };

  const handleOpenAIApiKeyChange = (event) => {
    const newOpenaiApiKey = event.target.value;
    setOpenAIApiKey(newOpenaiApiKey);
    nmAPI.sendMessage('set-openai-api-key', newOpenaiApiKey);
  };
  
  return (
	<div>
      <div className="settings-container">
        <div className="setting-item">
          <div className="setting-item">
            <label htmlFor="dark-mode">Dark mode</label>
            <input type="checkbox" id="dark-mode"
                   checked={darkMode}
                   onChange={handleDarkModeChange} 
            />
          </div>
        </div>
        <div className="setting-item">
          <label htmlFor="api-key">OpenAI API key</label>
          <input type="text" id="api-key" value={openaiApiKey} onChange={handleOpenAIApiKeyChange} />
        </div>        
      </div>
	</div>
  );
};

function render() {
  const root = createRoot(document.getElementById("root"));
  root.render(<Setting />);
}

render();
