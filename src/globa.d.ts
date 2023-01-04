declare global {
  interface Window {
    nmapi: NMAPI;
  }
}

export interface NMAPI {
  sendMessage: (arg: string, obj : any) => void;
  // TODO: 要修正
  onReceiveMessage: (listener: (message: string) => void) => () => void;
}
