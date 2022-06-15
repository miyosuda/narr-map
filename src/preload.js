import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('nmapi', {
  // main -> renderer
  onReceiveMessage : (listener) => {
    ipcRenderer.on('request', (event, arg) => {
      listener(arg)
    })
  },
})
