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

- [MacOSX (Apple Silicon)](https://github.com/miyosuda/narr-map/releases/download/v0.0.7/narr-map-darwin-arm64-0.0.7.zip)
- [Windows (Experimental)](https://github.com/miyosuda/narr-map/releases/download/v0.0.7/narr-map-0.0.7.Setup.exe)

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
