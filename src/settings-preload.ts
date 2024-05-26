import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('nmAPI', {
  requestSettings: async () => ipcRenderer.invoke('request-settings'),
  sendMessage: (arg : string, obj : any) => {
    ipcRenderer.send('settings-response', arg, obj);
  },
});
