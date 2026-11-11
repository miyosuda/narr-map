# MCP ブリッジ実装計画

Cursor のチャットから、開いているマップの話題ノードを読み、子ノードを足す。narr-map は MCP を話さない。Cursor が起動する中継プロセスが MCP サーバになり、Unix ドメインソケットで narr-map の main プロセスと JSON を1往復する。

## 構成

```text
Cursor（MCP クライアント）
  │ stdio / MCP
  ▼
mcp/（MCP サーバ。Electron にはバンドルしない）
  │ Unix socket、1行1JSON、呼び出しごとに接続して閉じる
  ▼
Electron main（bridge.sock を listen）
  │ 既存の request / response IPC。ウィンドウ単位で直列
  ▼
renderer（話題セット、キャンバス、undo）
```

ソケットのパスは `path.join(app.getPath('appData'), 'narr-map', 'bridge.sock')` に固定する。macOS では `~/Library/Application Support/narr-map/bridge.sock` になる。`userData` は開発時にアプリ名が `Electron` になることがあり、中継とずれる。

## この計画で作るもの

- 選択とは別の話題セット。右クリックで追加し、画面端のチップで外す
- main プロセスのソケットサーバ
- ツール3つ。`get_topic`、`find_nodes`、`add_children`
- Cursor から起動する中継プロセス

## この計画のあと

名前だけで話題を推測する処理、関係ノードの自動生成、話題が変わったときの push、アプリ内チャット、Windows / Linux のソケット。子を足す先は、チャットが `find_nodes` で得た id を `add_children` に渡して決める。

## プロトコル

要求と応答はそれぞれ1行の JSON。末尾は `\n`。1行の上限は 1 MiB。接続はツール呼び出し1回につき1回。

```json
{"id":1,"method":"get_topic"}
```

```json
{"id":1,"ok":true,"result":{"filePath":"/tmp/a.nm","rootText":"小説","nodes":[]}}
```

```json
{"id":2,"ok":false,"error":"narr-map has no document window"}
```

`id` はそのまま返す。メソッド名が未知、JSON でない、ノードが無い、追加が空、は `ok: false`。話題が空の `get_topic` は `nodes: []` で成功する。

ソケットファイルのモードは `0600`。起動時にファイルが残っていれば接続を試み、拒否されたら削除して listen する。すでに別の narr-map が listen していれば、このプロセスはサーバを立てない。終了時に自分 listen したソケットだけ削除する。

対象ウィンドウは `getFocusedDocumentWindow()`。設定画面が前面でも、この関数が文書ウィンドウへ戻す。文書ウィンドウが無ければエラー。同一ウィンドウへの呼び出しは main でキューに積み、renderer の状態更新が終わってから次を送る。待ちは 5 秒で打ち切る。

## ツール

`symbol` は種類のラベルとしてそのまま返す。話題の指定には使わない。ノード id は実行中のキャンバスのもので、`.nm` には保存されない。

### get_topic

話題セットを、追加した順で返す。チャットが「この2人」「話題のノード」と言ったときはこれを使う。

各要素は `id`、`text`、`symbol`、`path`（根に近い順のテキスト。ダミーの左ルートは除く。自身を含む）、`children`（直下の `{ text }` のみ）。

話題が空なら `nodes: []` で成功にする。エラーにすると、空であることがチャットに伝わらない。

### find_nodes

`params.text` とノードの `text` が完全一致するものを返す。`symbol` や経路は検索しない。戻りは `id`、`text`、`symbol`、`path`。0件でも成功で、配列は空。同名はすべて返し、中継側で一つに決めない。

### add_children

`params.nodeId` の子として `params.children` を足す。要素の形は既存の `PluginChildSpec`（`text` と、任意の `children`）。適用は `applyPluginAddChildren` を通し、`setRootStateWithHistory` で undo と dirty が付く。

戻りには足したノードの `id` と `text` を、木の先行順で含める。このために `applyPluginAddChildren` の成功結果へ `added` を足す。ノードが無いときは `ok: false`。追加が空なら `ok: false`。

## renderer

話題セットは `number[]`。マップの state には入れない。読み込みと新規作成で id が振り直されるので、そのとき配列を空にする。削除された id は描画前に木から消す。

右クリックは、プラグインが無くてもメニューを開く。先頭に「話題に追加」を置き、既に入っていれば「話題から外す」。その下に既存のプラグイン項目を続ける。追加のとき右クリック先は、いま通り `selectOnly` で選択される。話題の枠とは別に、選択の背景色はそのまま残す。

話題に入っているノードは、選択の塗り（`bg-zinc-300` / `bg-zinc-600`）とは別に、下線をアンバーにする。`Node` に `topicIds` を渡し、`Text` の border クラスを切り替える。

チップはキャンバスの上端に固定する。テキストをクリックすると `selectOnly`。`×` で話題から外す。チップが0個のときはバーを出さない。

main からの `bridge-request` は、テキスト入力中でも `plugin-action-result` と同じ経路で処理する。いまの `handleMessage` は入力中のコマンドを捨てるため、ブリッジだけは先に分岐する。

renderer は `bridge-result` を `sendMessage` で返す。

```text
main → request / bridge-request { requestId, method, params }
renderer → response / bridge-result { requestId, ok, result | error }
```

`get_topic` と `find_nodes` は renderer が木と話題配列から組み立てる。`add_children` は `addPluginChildren` の戻りを `added` 付きで返す。

## main

`src/bridge/protocol.ts` に、行の encode / decode と型を置く。Node API は入れない。テストと main の両方から使う。

`src/bridge/server.ts` が `net.createServer` で listen する。接続ごとに1行読んで、キュー経由で renderer へ渡し、1行書いて閉じる。`app.on('ready')` で開始し、`will-quit` で閉じる。

## 中継

`mcp/` に独立した package を置く。依存は `@modelcontextprotocol/sdk` と、そのツール定義に必要な `zod`。Electron の webpack からは import しない。stdio で MCP サーバになり、ツール呼び出しのたびにソケットへ1往復する。ソケットが無い、接続できない、5秒で返らない、行が JSON でない、ときはツールエラーにする。

ツール説明文に次を書く。

- 「この2人」「話題」は `get_topic` の結果を指す。名前から id を作らない
- 子を足す `nodeId` は `get_topic` か `find_nodes` の戻りだけを使う
- `symbol` は種類であり、話題の指定ではない
- `get_topic` が空なら、話題にノードを載せるようユーザーに伝える

Cursor の設定例:

```json
{
  "mcpServers": {
    "narr-map": {
      "command": "node",
      "args": ["<repo>/mcp/index.js"]
    }
  }
}
```

## 実装順

1. 話題セット、右クリック、チップ、話題ノードの下線。読み込みと新規作成でクリアする。ソケットはまだ無い。
2. `protocol.ts` と、行の拒否（空、JSON でない、上限超過、`id` と `method` の型）の vitest。
3. ソケット、main の直列キュー、renderer の `bridge-request`。3メソッドを繋ぎ、`add_children` が undo できることを手元で確認する。
4. `mcp/` を足し、Cursor から `get_topic` と `add_children` を呼ぶ。

## 確認

自動テストはプロトコルのパーサ、話題 id の剪定、`applyPluginAddChildren` が `added` を返すこと。

手元では narr-map を起動し、二人のノードを話題に載せる。別プロセスからソケットへ `get_topic` を送り、二人の `id` と `path` が返ることを見る。`find_nodes` で関係ノードの id を取り、`add_children` で子がキャンバスに出て、undo で戻ることを見る。そのあと Cursor のチャットで「この2人の出会いの場を3つ、関係の子として足して」と送り、同じ結果になることを見る。
