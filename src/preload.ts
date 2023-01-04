// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts


import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('nmapi', {
  // renderer -> main
  sendMessage : (arg, obj) => {
    ipcRenderer.send('response', arg, obj)
  },  
  // main -> renderer
  onReceiveMessage : (listener) => {
    ipcRenderer.on('request', (event, arg, obj) => {
      listener(arg, obj)
    })
  },
})
