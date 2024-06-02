import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type ListenerType = (arg: string, obj : any) => void;

contextBridge.exposeInMainWorld('nmAPI', {
  // renderer -> main
  requestSettings: async () => {
    return ipcRenderer.invoke('request-settings');
  },
  sendMessage: (arg : string, obj : any) => {
    ipcRenderer.send('settings-response', arg, obj);
  },
  // main -> renderer
  onReceiveMessage : (listener : ListenerType) => {
    ipcRenderer.on('request', (event: IpcRendererEvent,
                               arg : string,
                               obj : any) => {
        listener(arg, obj);
    })
  },
});
