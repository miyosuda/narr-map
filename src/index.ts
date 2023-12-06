import { app, BrowserWindow, Menu, MenuItem } from 'electron';
import { ipcMain as ipc } from 'electron';
import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import Store, { Schema } from 'electron-store';
import { convertStateToPlanetUML, convertPlanetUMLToState } from './uml';

interface StoreSchema {
  darkMode : boolean;
}

const schema : Schema<StoreSchema> = {
  darkMode: {
	type: 'boolean',
	default: false
  },
}

const store = new Store({schema})

const setDarkMode = (darkMode : boolean) => {
  globalMainWindow.webContents.send('request', 'dark-mode', darkMode)
}

const onDarkModeChanged = (newValue : boolean, oldValue : boolean) => {
  setDarkMode(newValue)
}

store.onDidChange('darkMode', onDarkModeChanged)


// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let globalMainWindow : BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.on('close', (event : Event) => {
    if( editDirty ) {
      const quit = () => {
        app.quit()
      }
      
      const ret = showSaveConfirmDialog()
      if( ret == CONFIRM_ANSWER_SAVE ) {
        // save後にquitを実行する
        event.preventDefault()
        save(mainWindow, quit)
      } else if( ret == CONFIRM_ANSWER_DELETE ) {
        editDirty = false
      } else {
        event.preventDefault()
      }
    }
  })

  mainWindow.webContents.on('did-finish-load', ()=>{
    setDarkMode(store.get('darkMode'))
  })

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.setTitle(DEFAULT_TITLE);

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  globalMainWindow = mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  //if (process.platform !== 'darwin') {
  app.quit();
  //}
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.


app.on('open-file', (event, path_) => {
  // Open recently used file
  load(globalMainWindow, path_)
});

const CONFIRM_ANSWER_SAVE   = 0;
const CONFIRM_ANSWER_DELETE = 1;
const CONFIRM_ANSWER_CANCEL = 2;

let editDirty = false;
let filePath : string = null;
let rootText : string = null;
let exportFilePath : string = null;

const DEFAULT_TITLE = 'Unnamed';
const DATA_VERSION = 1;


ipc.on('response', (event : Event,
                    arg : string,
                    obj : any) => {
  if( arg == 'set-dirty' ) {
    editDirty = true
  } else if( arg == 'set-root-text' ) {
    rootText = obj
  } else if( arg == 'response-save' ) {
    const mapData = {
      'version' : DATA_VERSION,
      'state' : obj,
    }
    
    const json = JSON.stringify(mapData, null , '  ')
    
    fs.writeFile(filePath, json, (error : NodeJS.ErrnoException) => {
      if(error != null) {
        console.log('save error')
      }
    })
    
    editDirty = false

    onSaveFinished()
  } else if( arg == 'response-export' ) {
    const uml = convertStateToPlanetUML(obj);
    
    fs.writeFile(exportFilePath, uml, (error : NodeJS.ErrnoException) => {
      if(error != null) {
        console.log('save error')
      }
    })

    exportFilePath = null;
  }
})

const showSaveConfirmDialog = () => {
  const options = {
    type: 'info',
    buttons: ['Save', 'Delete', 'Cancel'],
    message: 'File not saved. Save?',
  }
  
  const ret = dialog.showMessageBoxSync(options)
  return ret
}

let onSavedFunction : ()=>void = null

const saveOptions = {
  title: 'Save',
  filters: [
    {
      name: 'Data',
      extensions: ['nm']
    }
  ]
}

const exportOptions = {
  title: 'Export (PlanetUML)',
  filters: [
    {
      name: 'Data',
      extensions: ['pu']
    }
  ]
}

const save = (browserWindow : BrowserWindow,
              onSavedHook : (()=>void)|null=null) => {
  if(filePath == null) {
    // rootTextを使ってデフォルトファイル名表示
    const saveOptions_ = Object.create(saveOptions);
    if(rootText != null) {
      saveOptions_['defaultPath'] = rootText;
    }
    const path_ = dialog.showSaveDialogSync(saveOptions_)
    if(path_ != null) {
      onSavedFunction = onSavedHook
      // filePathの設定
      filePath = path_
      const fileName = path.basename(filePath)
      browserWindow.setTitle(fileName)
      browserWindow.webContents.send('request', 'save')
    }
  } else {
    onSavedFunction = onSavedHook
    browserWindow.webContents.send('request', 'save')
  }
}

const saveAs = (browserWindow : BrowserWindow) => {
  // rootTextを使ってデフォルトファイル名表示
  const saveOptions_ = Object.create(saveOptions);
  if(rootText != null) {
    saveOptions_['defaultPath'] = rootText;
  }
  const path_ = dialog.showSaveDialogSync(saveOptions_)
  if(path_ != null) {
    // filePathの設定
    filePath = path_
    const fileName = path.basename(filePath)
    browserWindow.setTitle(fileName)
    browserWindow.webContents.send('request', 'save')
  }
}

const exportAs = (browserWindow : BrowserWindow) => {
  const exportOptions_ = Object.create(exportOptions);

  if(filePath != null) {
    const baseName = path.basename(filePath, '.nm');
    exportOptions_['defaultPath'] = baseName;
  } else {
    if(rootText != null) {
      exportOptions_['defaultPath'] = rootText;
    }
  }
  const path_ = dialog.showSaveDialogSync(exportOptions_)
  if(path_ != null) {
    // exportFilePathの設定
    exportFilePath = path_
    const fileName = path.basename(exportFilePath)
    browserWindow.setTitle(fileName)
    browserWindow.webContents.send('request', 'export')
  }
}

const onSaveFinished = () => {
  // Add to recently used file
  // (addRecentDocument() should be called after file was created)
  app.addRecentDocument(filePath)
  
  if( onSavedFunction != null ) {
    onSavedFunction()
  }
}

const load = (browserWindow : BrowserWindow,
              path_ : string) => {
  fs.readFile(path_, (error : NodeJS.ErrnoException, buffer : Buffer) => {
    if(error != null) {
      console.log('file open error')
    }
    
    if(buffer != null) {
      const json = buffer.toString('utf8')
      const mapData = JSON.parse(json)
      const version = mapData['version']
      const state = mapData['state']
      
      browserWindow.webContents.send('request', 'load', state);
      
      editDirty = false;
      
      // Add to recently used file
      app.addRecentDocument(path_);
      
      // filePathの設定
      filePath = path_;
      const fileName = path.basename(filePath);
      browserWindow.setTitle(fileName);
    }
  })
}

const importUML = (browserWindow : BrowserWindow,
                   path_ : string) => {
  fs.readFile(path_, (error : NodeJS.ErrnoException, buffer : Buffer) => {
    if(error != null) {
      console.log('file open error')
    }
    
    if(buffer != null) {
      const uml = buffer.toString('utf8');
      const state = convertPlanetUMLToState(uml);
      browserWindow.webContents.send('request', 'load', state);

      editDirty = true;
      
      filePath = null;
      rootText = null;
      browserWindow.setTitle(DEFAULT_TITLE);
    }
  })
}

// ElectronのMenuの設定
const templateMenu : Electron.MenuItemConstructorOptions[] = [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        click: (menuItem : MenuItem,
                browserWindow : BrowserWindow,
                event : KeyboardEvent) => {
          const quit = () => {
            app.quit()
          }
          
          quit()
        },
      },
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: (menuItem : MenuItem,
                browserWindow : BrowserWindow,
                event : KeyboardEvent) => {
          const requestNewFile = () => {
            browserWindow.webContents.send('request', 'new-file');
            // filePathの設定
            filePath = null;
            rootText = null;
            editDirty = false;
            browserWindow.setTitle(DEFAULT_TITLE);
          }
          
          if( editDirty ) {
            const ret = showSaveConfirmDialog()
            if( ret == CONFIRM_ANSWER_SAVE ) {
              // save後にnew fileを実行する
              save(browserWindow, requestNewFile)
            } else if( ret == CONFIRM_ANSWER_DELETE ) {
              requestNewFile()
            }
          } else {
            requestNewFile()
          }
        },
      },
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click: (menuItem : MenuItem,
                browserWindow : BrowserWindow,
                event : Event) => {
          const requestOpen = () => {
            const options : Electron.OpenDialogSyncOptions = {
              properties: ['openFile'],
              filters: [
                {
                  name: 'narr-map',
                  extensions: ['nm', 'json']
                },
              ]
            }
            const pathes = dialog.showOpenDialogSync(options)
            if(pathes != null && pathes.length > 0) {
              const path_ = pathes[0]
              load(browserWindow, path_)
            }
          }
          
          if( editDirty ) {
            const ret = showSaveConfirmDialog()
            if( ret == CONFIRM_ANSWER_SAVE ) {
              // save後にopenする
              save(browserWindow, requestOpen)
            } else if( ret == CONFIRM_ANSWER_DELETE ) {
              requestOpen()
            }
          } else {
            requestOpen()
          }
        },
      },
      {
        "label":"Open Recent",
        "role":"recentDocuments",
        "submenu":[
          {
            "label":"Clear Recent",
            "role":"clearRecentDocuments"
          }
        ]
      },
      {
        type: 'separator',
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          save(browserWindow)
        }
      },
      {
        label: 'Save As',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          saveAs(browserWindow)
        }
      },
      {
        label: 'Export',
        "submenu":[
          {
            label: 'PlanetUML',
            accelerator: 'CmdOrCtrl+Shift+E',
            click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
              exportAs(browserWindow)
            }
          }
        ]
      },
      {
        label: 'Import',
        "submenu":[
          {
            label: 'PlanetUML',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: (menuItem : MenuItem,
                    browserWindow : BrowserWindow,
                    event : Event) => {
                      const requestImport = () => {
                        const options : Electron.OpenDialogSyncOptions = {
                          properties: ['openFile'],
                          filters: [
                            { name: 'PlanetUML',
                              extensions: ['pu', 'wsd', 'puml', 'planetuml', 'iuml'] },
                          ]
                        }
                        const pathes = dialog.showOpenDialogSync(options)
                        if(pathes != null && pathes.length > 0) {
                          const path_ = pathes[0]
                          importUML(browserWindow, path_)
                        }
                      }
                      
                      if( editDirty ) {
                        const ret = showSaveConfirmDialog()
                        if( ret == CONFIRM_ANSWER_SAVE ) {
                          // save後にopenする
                          save(browserWindow, requestImport)
                        } else if( ret == CONFIRM_ANSWER_DELETE ) {
                          requestImport()
                        }
                      } else {
                        requestImport()
                      }
                    },
          }
        ]
      },      
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'undo'
          )
        }
      },
      {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'redo'
          )
        }
      },
      {
        type: 'separator',
      },
      {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'cut'
          )
        }
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'copy'
          )
        }
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'paste'
          )
        }
      },
      {
        type: 'separator',
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'selectall'
          )
        }
      },
    ]
  },
  {
    label: 'Setting',
    submenu: [
      {
        label: 'Dark mode',
        type: "checkbox",
        checked: store.get('darkMode'),
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          const newDarkMode = !store.get('darkMode')
          store.set('darkMode', newDarkMode)
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        role: 'reload',
      },
      {
        type: 'separator',
      },
      {
        role: 'resetZoom',
      },
      {
        role: 'zoomIn',
      },
      {
        role: 'zoomOut',
      },
      {
        type: 'separator',
      },
      {
        role: 'togglefullscreen',
      },
      {
        role:
        'toggleDevTools'
      },      
    ]
  }
]

const menu = Menu.buildFromTemplate(templateMenu)

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu)
})
