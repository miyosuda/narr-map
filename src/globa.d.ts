declare global {
  interface Window {
    nmAPI: NMAPI
  }
}

type ListenerType = (arg: string, obj: any) => void

export interface NMAPI {
  invoke: (arg: string) => Promise<any>
  sendMessage: (arg: string, obj: any) => void
  onReceiveMessage: (listener: ListenerType) => () => void
}
