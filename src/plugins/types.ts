// プラグインとホストのあいだでやり取りする、保存用の木とは別の型.
// NodeState は parent が循環しているので、プラグインには渡さない.

export type PluginMenuEntry = {
  pluginId: string
  actionId: string
  label: string
}

export type PluginNodeContext = {
  id: number
  text: string
  symbol: string | null
  // このアクションで子を足す場所に、既にある子のテキスト
  children: { text: string }[]
  // 根に近い順。右クリックしたノード自身は含まない
  ancestors: { text: string }[]
}

export type PluginChildSpec = {
  text: string
  children?: PluginChildSpec[]
}

export type PluginActionResult = {
  addChildren: PluginChildSpec[]
}

export type PluginAI = {
  complete: (prompt: string) => Promise<string>
}

export type PluginActionContext = {
  node: PluginNodeContext
  ai: PluginAI
}

export type PluginAction = (ctx: PluginActionContext) => Promise<unknown> | unknown

export type PluginActionRequest = {
  requestId: number
  pluginId: string
  actionId: string
  node: PluginNodeContext
}

export type PluginActionResponse =
  | {
      ok: true
      requestId: number
      nodeId: number
      addChildren: PluginChildSpec[]
    }
  | {
      ok: false
      requestId: number
      aborted?: boolean
      error?: string
    }
