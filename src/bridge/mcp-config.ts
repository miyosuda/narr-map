// MCP クライアントへ貼る設定。パスは起動中のアプリから埋める。

export function buildMcpClientConfig(command: string, scriptPath: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'narr-map': {
          command,
          args: [scriptPath],
          env: {
            ELECTRON_RUN_AS_NODE: '1'
          }
        }
      }
    },
    null,
    2
  )
}
