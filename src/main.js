const { app, Menu, BrowserWindow } = require('electron')
const path = require('path')

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit()
}

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

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.


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
        label: 'Duplicate',
        accelerator: 'CmdOrCtrl+D',
        click: (menuItem, browserWindow, event) => {
          browserWindow.webContents.send(
            'request', 'duplicate'
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
Menu.setApplicationMenu(menu)
