# narr-map

An intuitive and user-friendly mind map editor with a FreeMind-compatible interface.

<img src="./docs/screen0.png" width="400px">

## Key Features

- 🎯 **Intuitive Operation**
  - Drag & drop node movement
  - Easy selection and editing with mouse and keys

- ⌨️ **Rich Shortcuts**
  - Add nodes (Enter, Tab)
  - Toggle node folding (Space)
  - Cursor movement (Ctrl+n/p/f/b)
  - Text editing (Ctrl+i, F2)

- 🚀 **Advanced Features**
  - AI-powered auto-completion (Cmd+m, requires OpenAI API key)
  - PlantUML/YAML export
  - Copy mind map content to clipboard as YAML (Ideal for ChatGPT prompts)
  - Dark mode support

- 🎨 **Customization**
  - Icon support (red, green, blue, yellow circles)
  - Node folding functionality
  - Drag-based node positioning



## Downloads

- [MacOSX (Apple Silicon)](https://github.com/miyosuda/narr-map/releases/download/v0.1.1/narr-map-darwin-arm64-0.1.1.zip)

## Icons

| Text | Icon    |
| ---- | ----  |
| (r)  | :red_circle:   |
| (g)  | :green_circle:  |
| (b)  | :large_blue_circle:   |
| (y)  | :yellow_circle:  |



## Shortcuts

| Key | Function |
| ---- | ----  |
| Enter   | Add sibling node |
| Tab     | Add child node |
| Space   | Toggle fold |
| Ctrl+i  | Edit text |
| Ctrl+n  | Move down |
| Ctrl+p  | Move up |
| Ctrl+f  | Move right |
| Ctrl+b  | Move left |
| F2      | Edit text |
| Cmd+m | Auto-complete blank node (requires OpenAI API key) |
| Ctrl+Y | Copy mind map content to clipboard as YAML |



## Use from an MCP client

The app includes an MCP server. Keep narr-map open, copy its connection settings, and paste them into your MCP client. You do not install Node.js or clone this repository. The open map is what the client reads and edits.

### Connect

1. Start narr-map and leave it running.
2. In the narr-map menu, choose **Copy MCP Configuration**.
3. Paste the copied JSON into your MCP client's server settings.

The paths in the JSON are filled in for the app you are running. They look like this:

```json
{
  "mcpServers": {
    "narr-map": {
      "command": "/Applications/narr-map.app/Contents/MacOS/narr-map",
      "args": ["/Applications/narr-map.app/Contents/Resources/mcp.cjs"],
      "env": {
        "ELECTRON_RUN_AS_NODE": "1"
      }
    }
  }
}
```

### Pin nodes, then ask

1. Right-click a node and choose **Add to topic**. The node's underline turns red, and a chip appears at the top of the window. Click a chip to select that node. **×** removes it from the topic.
2. In the MCP client, refer to the pinned nodes as "these two" or "the topic". To add children under a heading that is already on the map, name that heading.

Example: pin "Budget" and "Schedule", then ask "Add three decisions to make first for these two, as children of Review."

Added nodes can be undone in narr-map.


## Plugins

A plugin adds commands to the node context menu. Each plugin is a directory with `manifest.json` and `index.js`. narr-map reads them when it starts. A plugin that fails to load is skipped.

See `plugins/story-ideas` for a working example.

### Where to put a plugin

Put the plugin directory here. The folder name can differ from the `id` in the manifest.

| How you run narr-map | Plugin directory |
| ---- | ---- |
| Installed app on macOS | `~/Library/Application Support/narr-map/plugins/<name>/` |
| `npm start` from this repository | `plugins/<name>/` |

The installed app does not ship plugins inside the `.app` bundle. On first launch it creates `~/Library/Application Support/narr-map/plugins`. On Windows that directory is `%APPDATA%\narr-map\plugins`, and on Linux it is `~/.config/narr-map/plugins`.

If two plugins share the same manifest `id`, the one in the user data directory is the one that runs.

### manifest.json

```json
{
  "id": "my-plugin",
  "actions": [
    {
      "id": "propose",
      "label": "案を出す",
      "placement": "node-context-menu"
    }
  ]
}
```

- `id` is a non-empty string that identifies the plugin.
- `actions` lists the commands. Each entry needs a non-empty `id`, a non-empty `label`, and `"placement": "node-context-menu"`. Other placements are ignored.
- The menu shows `label`. The action `id` must be the name of a function exported from `index.js`.

### index.js

`index.js` is loaded with Node's `require`. Export an object whose keys are the action ids:

```js
module.exports = {
  async propose(ctx) {
    const answer = await ctx.ai.complete('Write three short headings.')
    return {
      addChildren: answer
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((text) => ({ text }))
    }
  }
}
```

`ctx.node` is the node that was right-clicked:

| Field | Meaning |
| ---- | ---- |
| `id` | Node id |
| `text` | Node text |
| `symbol` | Symbol string, or `null` |
| `children` | `{ text }` of the children this action would add next to |
| `ancestors` | `{ text }` from the root down to the parent. The clicked node is not included |

`ctx.ai.complete(prompt)` returns the model's text. It uses the OpenAI API key and completion model already set in narr-map. It rejects when the API key is missing.

Return `{ addChildren: [...] }`. Each item is `{ text, children? }`. `text` is trimmed, and blank items are dropped. `children` is the same shape, so a plugin can add a small tree. The new nodes are appended under the right-clicked node. On the root, when it already has children, they are added on the left, the same place as Tab. Any other return value adds nothing. A thrown error is reported and adds nothing.


## Development

### Initial Setup

```bash
$ npm install
```

### Debug

```bash
$ npm start
```

### Build

MacOSX arm64

```bash
$ npm run make -- --arch=arm64
```

MacOSX intel

```bash
$ npm run make -- --arch=x64
```

### Test

```bash
$ npm run test
```
