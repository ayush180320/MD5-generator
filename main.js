const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Prevent closing the app entirely when clicking 'X'
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // Using an empty native image for the tray icon as a placeholder
  const icon = nativeImage.createEmpty(); 
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('iTunes Delivery Manager');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

// Granular Progress Hashing
ipcMain.on('hash-file', (event, filePath) => {
  const hash = crypto.createHash('md5');
  const stream = fs.createReadStream(filePath);
  const fileSize = fs.statSync(filePath).size;
  let bytesRead = 0;

  stream.on('data', (data) => {
    hash.update(data);
    bytesRead += data.length;
    
    // Calculate progress percentage
    const progress = Math.round((bytesRead / fileSize) * 100);
    event.reply('hash-progress', { filePath, progress });
  });

  stream.on('end', () => {
    const md5 = hash.digest('hex');
    event.reply('hash-complete', { filePath, md5, fileSize });
  });

  stream.on('error', (err) => {
    event.reply('hash-error', { filePath, error: err.message });
  });
});
