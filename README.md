# narr-map

A minimal mind map editor made with Electron. The interface is almost compatible with Free-mind.

<img src="./docs/screen0.png" width="400px">

## Binaries

https://github.com/miyosuda/narr-map/releases

The binaries are not signed yet. Recent MacOSX does not allow running an app without signing and notarization. To run them without signining, use xattr to remove extended attributes.

```
$ xattr -rc narr-map.app
```



## Icons

| Text | Icon    |
| ---- | ----  |
| (r)  | :red_circle:   |
| (g)  | :green_circle:  |
| (b)  | :large_blue_circle:   |
| (y)  | :yellow_circle:  |



## Shortcuts

| Key |     |
| ---- | ----  |
| Enter   | Add sibling node |
| Tab     | Add child node |
| Space   | Toggle fold   |
| Ctrl+i  | Edit text  |
| Ctrl+n  | Move down  |
| Ctrl+p  | Move up  |
| Ctrl+f  | Move right |
| Ctrl+b  | Move left |
| F2      | Edit text  |



## Development

### Initial setup

```
$ npm install
```


### Debug

```
$ npm start
```


### Build

```
$ npm run make
```
