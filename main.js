const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;

// Store active read streams so we can pause/resume them
const activeStreams = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#181818', // Pro media tool dark background
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// Handle Open File Dialog
ipcMain.on('open-file-dialog', (event) => {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  }).then(result => {
    if (!result.canceled) {
      event.reply('selected-files', result.filePaths);
    }
  });
});

// Process Hash with Granular Control
ipcMain.on('hash-file', (event, { id, filePath }) => {
  try {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }); // 1MB chunks for speed
    const fileSize = fs.statSync(filePath).size;
    let bytesRead = 0;

    activeStreams[id] = stream;

    stream.on('data', (data) => {
      hash.update(data);
      bytesRead += data.length;
      const progress = Math.round((bytesRead / fileSize) * 100);
      event.reply('hash-progress', { id, progress });
    });

    stream.on('end', () => {
      const md5 = hash.digest('hex');
      delete activeStreams[id];
      event.reply('hash-complete', { id, md5, fileSize });
    });

    stream.on('error', (err) => {
      delete activeStreams[id];
      event.reply('hash-error', { id, error: err.message });
    });
  } catch (error) {
    event.reply('hash-error', { id, error: error.message });
  }
});

// Stream Controls
ipcMain.on('pause-hash', (event, id) => {
  if (activeStreams[id]) activeStreams[id].pause();
});

ipcMain.on('resume-hash', (event, id) => {
  if (activeStreams[id]) activeStreams[id].resume();
});

ipcMain.on('cancel-hash', (event, id) => {
  if (activeStreams[id]) {
    activeStreams[id].destroy(); // Kill the stream completely
    delete activeStreams[id];
  }
});
