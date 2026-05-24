const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // Simplified for this prototype
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// Listen for hash requests from the UI
ipcMain.on('hash-file', (event, filePath) => {
  const hash = crypto.createHash('md5');
  const stream = fs.createReadStream(filePath);
  const fileSize = fs.statSync(filePath).size;

  stream.on('data', (data) => {
    hash.update(data);
    // You can emit progress here based on bytes read vs fileSize
  });

  stream.on('end', () => {
    const md5 = hash.digest('hex');
    event.reply('hash-complete', { filePath, md5, fileSize });
  });

  stream.on('error', (err) => {
    event.reply('hash-error', err.message);
  });
});

// Handle Batch Renaming
ipcMain.on('rename-file', (event, { oldPath, newPath }) => {
  fs.rename(oldPath, newPath, (err) => {
    if (err) event.reply('rename-error', err.message);
    else event.reply('rename-success', newPath);
  });
});
