import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type ListenerType = (arg: string, obj : any) => void;

contextBridge.exposeInMainWorld('nmAPI', {
  // renderer -> main
  invoke: (arg: string): Promise<any> => {
    return ipcRenderer.invoke('invoke', arg);
  },
  sendMessage: (arg : string, obj : any) => {
    ipcRenderer.send('response', arg, obj);
  },
  // main -> renderer
  onReceiveMessage: (listener : ListenerType) => {

    const func = (event: IpcRendererEvent,
                  arg : string,
                  obj : any) => {
                    listener(arg, obj);
                  };
    ipcRenderer.on('request', func);

    const offFunc = () => {
      ipcRenderer.off('request', func);
    };
    
    return offFunc
  },
});
