const { app, Menu, BrowserWindow } = require('electron')
const ipc = require('electron').ipcMain
const dialog = require('electron').dialog
const fs = require('fs')
const path = require('path')
const Store = require('electron-store');

const schema = {
  darkMode: {
	type: 'boolean',
	default: false
  },
}

const store = new Store({schema})


const setDarkMode = (darkMode) => {
  globalMainWindow.webContents.send('request', 'dark-mode', darkMode)
}

const onDarkModeChanged = (newValue, oldValue) => {
  setDarkMode(newValue)
}

store.onDidChange('darkMode', onDarkModeChanged)


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit()
}

let globalMainWindow = null

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    }
  })

  mainWindow.on('close', (event) => {
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
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  mainWindow.setTitle(DEFAULT_TITLE)

  // Open the DevTools.
  //mainWindow.webContents.openDevTools()

  globalMainWindow = mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  //if (process.platform !== 'darwin') {
  app.quit()
  //}
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('open-file', (event, path_) => {
  // Open recently used file
  load(globalMainWindow, path_)
})


const CONFIRM_ANSWER_SAVE   = 0
const CONFIRM_ANSWER_DELETE = 1
const CONFIRM_ANSWER_CANCEL = 2

let editDirty = false
let filePath = null

const DEFAULT_TITLE = 'Unnamed'

ipc.on('response', (event, arg, obj) => {
  if( arg == 'set-dirty' ) {
    editDirty = obj
  } else if( arg == 'response-save' ) {
    const json = JSON.stringify(obj, null , '  ')

    fs.writeFile(filePath, json, (error) => {
      if(error != null) {
        console.log('save error')
      }
    })
    
    editDirty = false

    onSaveFinished()
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

let onSavedFunction = null

const saveOptions = {
  title: 'Save',
  filters: [
    {
      name: 'Data',
      extensions: ['.nm']
    }
  ]
}

const save = (browserWindow, onSavedHook=null) => {
  if(filePath == null) {
    const path_ = dialog.showSaveDialogSync(saveOptions)
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

const saveAs = (browserWindow) => {
  const path_ = dialog.showSaveDialogSync(saveOptions)
  if(path_ != null) {
    // filePathの設定
    filePath = path_
    const fileName = path.basename(filePath)
    browserWindow.setTitle(fileName)
    browserWindow.webContents.send('request', 'save')
  }
}

const onSaveFinished = () => {
  if( onSavedFunction != null ) {
    onSavedFunction()
  }
}

const load = (browserWindow, path_) => {
  fs.readFile(path_, (error, json) => {
    if(error != null) {
      console.log('file open error')
    }
    if(json != null) {
      const mapData = JSON.parse(json)
      browserWindow.webContents.send('request', 'load', mapData)

      editDirty = false

      // Add to recently used file
      app.addRecentDocument(path_)
              
      // filePathの設定
      filePath = path_
      const fileName = path.basename(filePath)
      browserWindow.setTitle(fileName)
    }
  })
}

// ElectronのMenuの設定
const templateMenu = [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        click: (menuItem, browserWindow, event) => {
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
        click: (menuItem, browserWindow, event) => {
          const requestNewFile = () => {
            browserWindow.webContents.send('request', 'new-file')
            // filePathの設定
            filePath = null
            browserWindow.setTitle(DEFAULT_TITLE)
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
        click: (menuItem, browserWindow, event) => {
          const requestOpen = () => {
            const options = {
              properties: ['openFile']
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
        "role":"recentdocuments",
        "submenu":[
          {
            "label":"Clear Recent",
            "role":"clearrecentdocuments"
          }
        ]
      },
      {
        type: 'separator',
      },      
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: (menuItem, browserWindow, event) => {
          save(browserWindow)
        }
      },
      {
        label: 'Save As',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: (menuItem, browserWindow, event) => {
          saveAs(browserWindow)
        }
      },      
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        click: (menuItem, browserWindow, event) => {
          browserWindow.webContents.send(
            'request', 'undo'
          )
        }
      },
      {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        click: (menuItem, browserWindow, event) => {
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
        click: (menuItem, browserWindow, event) => {
          browserWindow.webContents.send(
            'request', 'cut'
          )
        }
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        click: (menuItem, browserWindow, event) => {
          browserWindow.webContents.send(
            'request', 'copy'
          )
        }
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: (menuItem, browserWindow, event) => {
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
        click: (menuItem, browserWindow, event) => {
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
        click: (menuItem, browserWindow, event) => {
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
        role: 'resetzoom',
      },
      {
        role: 'zoomin',
      },
      {
        role: 'zoomout',
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
