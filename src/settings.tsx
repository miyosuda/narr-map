import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';
const { nmAPI } = window;

const Setting = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [openaiApiKey, setOpenAIApiKey] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const response = await nmAPI.requestSettings();
      setDarkMode(response.darkMode);
      setOpenAIApiKey(response.openaiApiKey);
    };
    
    fetchData();
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
    console.log(newOpenaiApiKey);
  };
  
  return (
	<div>
      <div>
        <input
          type="checkbox"
          checked={darkMode}
          onChange={handleDarkModeChange} 
        />
        Dark mode
      </div>
      <div>
        OPENA API KEY
        <input type="text" value={openaiApiKey} onChange={handleOpenAIApiKeyChange} />
      </div>
	</div>
  );
};

function render() {
  const root = createRoot(document.getElementById("root"));
  root.render(<Setting />);
}

render();
