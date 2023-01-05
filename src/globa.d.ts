declare global {
  interface Window {
    nmapi: NMAPI;
  }
}

export interface NMAPI {
  sendMessage: (arg: string, obj : any) => void;
  onReceiveMessage: (listener: (arg: string, obj : any) => void) => () => void;
}
