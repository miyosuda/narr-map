import { app, BrowserWindow, Menu, MenuItem, IpcMainEvent, Event, Input } from 'electron';
import { ipcMain as ipc } from 'electron';
import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import Store, { Schema } from 'electron-store';
import { convertStateToPlantUML, convertPlantUMLToState } from './conversion/uml';
import { convertStateToYAML } from './conversion/yaml'
import { completeState } from './completion'
import { migrateState1to2 } from './conversion/migrate'
import { SavingNodeState } from './types';

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

declare const SETTINGS_WEBPACK_ENTRY: string;
declare const SETTINGS_PRELOAD_WEBPACK_ENTRY: string;

const CONFIRM_ANSWER_SAVE   = 0;
const CONFIRM_ANSWER_DELETE = 1;
const CONFIRM_ANSWER_CANCEL = 2;

const DEFAULT_TITLE = 'Unnamed';
const DATA_VERSION = 2;


let editDirty = false;
let filePath : string;
let rootText : string;
let exportFilePath : string;

let completionAbortController : AbortController | null = null;


// quit(), requestNewFile(), requestOpen(), requestImport()
let onSavedFunction : (() => void);

const cancelCompletion = () => {
  if(completionAbortController != null) {
    completionAbortController.abort();
  }
}

interface StoreSchema {
  darkMode : boolean;
  openaiApiKey: string;
}

const schema : Schema<StoreSchema> = {
  darkMode: {
	type: 'boolean',
	default: false
  },
  openaiApiKey: {
	type: 'string',
	default: '',
  },
};

const store = new Store({schema});

const setDarkMode = (darkMode : boolean) => {
  // TODO: ここは送るのはmain windowだけで良い
  // TODO: BrowserWindow.fromId()を利用する
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    window.webContents.send('request', 'dark-mode', darkMode);
  });
};

const onDarkModeChanged = (newValue : boolean, oldValue : boolean) => {
  setDarkMode(newValue)
};

store.onDidChange('darkMode', onDarkModeChanged);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

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
  });

  mainWindow.webContents.on('did-finish-load', ()=>{
    setDarkMode(store.get('darkMode'));
  });

  mainWindow.webContents.on('before-input-event',
                            (event : Event,
                             input : Input) => {
   if(input.key === 'Escape') {
     // EscキーにてCompletionをキャンセル
     cancelCompletion();
     event.preventDefault();
   }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.setTitle(DEFAULT_TITLE);
};

const openSettings = () => {
  const settingsWindow = new BrowserWindow({
    width: 640,
    height: 160,
    title: 'Settings',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: SETTINGS_PRELOAD_WEBPACK_ENTRY,
    },
  });
  
  // Load the settings.html of the app.
  settingsWindow.loadURL(SETTINGS_WEBPACK_ENTRY);
}


ipc.handle('invoke', async (event: IpcMainEvent, arg: string): Promise<any> => {
  if( arg === 'get-settings' ) {
    const settings = {
      darkMode: store.get('darkMode'),
      openaiApiKey: store.get('openaiApiKey'),
    };
    return settings;
  } else {
    return null;
  }
});


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

app.on('open-file', (event : Event, path_ : string) => {
  // TODO: BrowserWindow.fromId()を利用する
  const windows = BrowserWindow.getAllWindows();
  if(windows.length > 0) {
    // TODO: 複数のwindowが出てきた時は要対応
    load(windows[0], path_);
  }
});

ipc.on('response', (event : IpcMainEvent,
                    arg : string,
                    obj : any) => {
  if( arg == 'settings-set-dark-mode' ) {
    const darkMode = obj as boolean;
    store.set('darkMode', darkMode);
  } else if( arg == 'settings-set-openai-api-key' ) {
    const openaiApiKey = obj as string;
    store.set('openaiApiKey', openaiApiKey);
    
  } else if( arg == 'set-dirty' ) {
    editDirty = true;
  } else if( arg == 'set-root-text' ) {
    rootText = obj;
  } else if( arg == 'response-save' ) {
    const mapData = {
      'version' : DATA_VERSION,
      'state' : obj,
    };
    
    const json = JSON.stringify(mapData, null , '  ');
    
    fs.writeFile(filePath, json, (error : NodeJS.ErrnoException) => {
      if(error != null) {
        console.log('save error')
      }
    });
    
    editDirty = false;

    onSaveFinished()
  } else if( arg == 'response-export' ) {
    const [state, format] = obj as [SavingNodeState, string];
    const content = format == 'uml' ? convertStateToPlantUML(state) : convertStateToYAML(state);
    
    fs.writeFile(exportFilePath, content, (error : NodeJS.ErrnoException) => {
      if(error != null) {
        console.log('save error');
      }
    });

    exportFilePath = null;
  } else if( arg == 'response-complete' ) {
    const state = obj;

    const sender = event.sender;

    completionAbortController = new AbortController();

    const openaiApiKey = store.get('openaiApiKey');
    
    completeState(openaiApiKey, state, completionAbortController)
      .then(completedState => {
        if(completedState != null) {
          sender.send('request', 'completed', completedState);
        } else {
          sender.send('request', 'completed', state);
        }
        completionAbortController = null;
      })
      .catch(error => {
        sender.send('request', 'completed', state);
        console.error(error);
        completionAbortController = null;
      });
  }
})

const showSaveConfirmDialog = () => {
  const ret = dialog.showMessageBoxSync({
    type: 'info',
    buttons: ['Save', 'Delete', 'Cancel'],
    message: 'File not saved. Save?'
  });
  
  return ret;
}


const saveOptions = {
  title: 'Save',
  filters: [
    {
      name: 'Data',
      extensions: ['nm']
    }
  ]
};

const exportOptionsUML = {
  title: 'Export (PlantUML)',
  filters: [
    {
      name: 'Data',
      extensions: ['pu']
    }
  ]
};

const exportOptionsYAML = {
  title: 'Export (YAML)',
  filters: [
    {
      name: 'Data',
      extensions: ['yaml', 'yml']
    }
  ]
};

const save = (browserWindow : BrowserWindow,
              onSavedHook : (()=>void)|null=null) => {
  if(filePath == null) {
    // rootTextを使ってデフォルトファイル名表示
    const saveOptions_ = Object.create(saveOptions);
    
    if(rootText != null) {
      saveOptions_['defaultPath'] = rootText;
    }
    
    const path_ = dialog.showSaveDialogSync(saveOptions_);
    if(path_ != null) {
      onSavedFunction = onSavedHook;
      // filePathの設定
      filePath = path_;
      const fileName = path.basename(filePath);
      browserWindow.setTitle(fileName);
      browserWindow.webContents.send('request', 'save');
    }
  } else {
    onSavedFunction = onSavedHook;
    browserWindow.webContents.send('request', 'save');
  }
}

const saveAs = (browserWindow : BrowserWindow) => {
  // rootTextを使ってデフォルトファイル名表示
  const saveOptions_ = Object.create(saveOptions);
  if(rootText != null) {
    saveOptions_['defaultPath'] = rootText;
  }
  const path_ = dialog.showSaveDialogSync(saveOptions_);
  if(path_ != null) {
    // filePathの設定
    filePath = path_;
    const fileName = path.basename(filePath);
    browserWindow.setTitle(fileName);
    browserWindow.webContents.send('request', 'save');
  }
}

const exportAs = (browserWindow : BrowserWindow,
                  format : 'uml' | 'yaml') => {
  const exportOptions_ = Object.create(format == 'uml' ? exportOptionsUML : exportOptionsYAML);

  if(filePath != null) {
    const baseName = path.basename(filePath, '.nm');
    exportOptions_['defaultPath'] = baseName;
  } else {
    if(rootText != null) {
      exportOptions_['defaultPath'] = rootText;
    }
  }

  const path_ = dialog.showSaveDialogSync(exportOptions_);  

  if(path_ != null) {
    // exportFilePathの設定
    exportFilePath = path_;
    const fileName = path.basename(exportFilePath);
    browserWindow.setTitle(fileName);
    browserWindow.webContents.send('request', 'export', format);
  }
}

const onSaveFinished = () => {
  // Add to recently used file
  // (addRecentDocument() should be called after file was created)
  app.addRecentDocument(filePath);
   
  if( onSavedFunction != null ) {
    onSavedFunction();
  }
}

const load = (browserWindow : BrowserWindow,
              path_ : string) => {
  fs.readFile(path_, (error : NodeJS.ErrnoException, buffer : Buffer) => {
    if(error != null) {
      console.log('file open error');
    }
    
    if(buffer != null) {
      const json = buffer.toString('utf8');
      const mapData = JSON.parse(json);
      const version = mapData['version'];
      let state = mapData['state'];

      if(version == 1) {
        state = migrateState1to2(state);
      }
      
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
      console.log('file open error');
    }
    
    if(buffer != null) {
      const uml = buffer.toString('utf8');
      const state = convertPlantUMLToState(uml);
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
      {
        label: 'Settings',
        accelerator: 'CmdOrCtrl+,',
        click: (menuItem : MenuItem,
                browserWindow : BrowserWindow,
                event : KeyboardEvent) => {
          openSettings();
        },
      },
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
            app.quit();
          }
          
          quit();
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
              requestNewFile();
            }
          } else {
            requestNewFile();
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
            const pathes = dialog.showOpenDialogSync(options);
            if(pathes != null && pathes.length > 0) {
              const path_ = pathes[0];
              load(browserWindow, path_);
            }
          }
          
          if( editDirty ) {
            const ret = showSaveConfirmDialog()
            if( ret == CONFIRM_ANSWER_SAVE ) {
              // save後にopenする
              save(browserWindow, requestOpen);
            } else if( ret == CONFIRM_ANSWER_DELETE ) {
              requestOpen();
            }
          } else {
            requestOpen();
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
          save(browserWindow);
        }
      },
      {
        label: 'Save As',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          saveAs(browserWindow);
        }
      },
      {
        label: 'Export',
        "submenu":[
          {
            label: 'YAML',
            accelerator: 'CmdOrCtrl+Shift+Y',
            click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
              exportAs(browserWindow, 'yaml');
            }
          },          
          {
            label: 'PlantUML',
            accelerator: 'CmdOrCtrl+Shift+E',
            click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
              exportAs(browserWindow, 'uml');
            }
          }
        ]
      },
      {
        label: 'Import',
        "submenu":[
          {
            label: 'PlantUML',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: (menuItem : MenuItem,
                    browserWindow : BrowserWindow,
                    event : Event) => {
                      const requestImport = () => {
                        const options : Electron.OpenDialogSyncOptions = {
                          properties: ['openFile'],
                          filters: [
                            { name: 'PlantUML',
                              extensions: ['pu', 'wsd', 'puml', 'plantuml', 'iuml'] },
                          ]
                        }
                        const pathes = dialog.showOpenDialogSync(options)
                        if(pathes != null && pathes.length > 0) {
                          const path_ = pathes[0];
                          importUML(browserWindow, path_);
                        }
                      }
                      
                      if( editDirty ) {
                        const ret = showSaveConfirmDialog()
                        if( ret == CONFIRM_ANSWER_SAVE ) {
                          // save後にopenする
                          save(browserWindow, requestImport)
                        } else if( ret == CONFIRM_ANSWER_DELETE ) {
                          requestImport();
                        }
                      } else {
                        requestImport();
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
          );
        }
      },
      {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'redo'
          );
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
          );
        }
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'copy'
          );
        }
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'paste'
          );
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
          );
        }
      },
      {
        type: 'separator',
      },
      {
        label: 'Complete With AI',
        accelerator: 'CmdOrCtrl+M',
        click: (menuItem : MenuItem, browserWindow : BrowserWindow, event : KeyboardEvent) => {
          browserWindow.webContents.send(
            'request', 'complete'
          );
        }
      },
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

const menu = Menu.buildFromTemplate(templateMenu);

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu);
});
