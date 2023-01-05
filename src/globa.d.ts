declare global {
  interface Window {
    nmAPI: NMAPI;
  }
}

type ListenerType = (arg: string, obj : any) => void;

export interface NMAPI {
  sendMessage: (arg: string, obj : any) => void;
  onReceiveMessage: (listener: ListenerType) => () => void;
}
