const { ipcRenderer } = require('electron');

const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
let currentFiles = [];

// Drag and Drop Logic
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.background = '#eef5ff';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.background = 'transparent';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.background = 'transparent';
  
  for (const f of e.dataTransfer.files) {
    // Send file path to main process for blazing fast hashing
    ipcRenderer.send('hash-file', f.path);
  }
});

// Receive Hash Data
ipcRenderer.on('hash-complete', (event, data) => {
  currentFiles.push(data);
  saveToIndexedDB(currentFiles); // Persist session
  renderTable();
});

function renderTable() {
  fileList.innerHTML = '';
  currentFiles.forEach((file, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${getFileName(file.filePath)}</td>
      <td>${file.fileSize}</td>
      <td>${file.md5}</td>
      <td>
        <button onclick="copyToClipboard('${file.md5}')">Copy MD5</button>
      </td>
    `;
    fileList.appendChild(row);
  });
}

function getFileName(path) {
  return path.split('\\').pop().split('/').pop();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert('Copied: ' + text);
}

// Basic IndexedDB setup for session persistence
function saveToIndexedDB(data) {
  const request = indexedDB.open('iTunesToolDB', 1);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('sessions')) {
      db.createObjectStore('sessions', { keyPath: 'id' });
    }
  };
  request.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put({ id: 1, files: data });
  };
}
