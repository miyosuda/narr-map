// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts


import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';


contextBridge.exposeInMainWorld('nmapi', {
  // renderer -> main
  sendMessage : (arg : string, obj : any) => {
    ipcRenderer.send('response', arg, obj)
  },
  // main -> renderer
  onReceiveMessage : (listener : (arg : string, obj : any)=>void) => {
    ipcRenderer.on('request', (event: IpcRendererEvent,
                               arg : string,
                               obj : any) => {
      listener(arg, obj)
    })
  },
})
