const { ipcRenderer } = require('electron');

const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const btnBrowse = document.getElementById('btn-browse');
const btnReset = document.getElementById('btn-reset');

let filesData = {};

// Helper: Format Bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Generate Unique ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Global Controls
btnBrowse.addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});

btnReset.addEventListener('click', () => {
  // Cancel all active backend streams
  Object.keys(filesData).forEach(id => ipcRenderer.send('cancel-hash', id));
  filesData = {};
  renderTable();
});

ipcRenderer.on('selected-files', (event, paths) => {
  paths.forEach(processNewFile);
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  for (const f of e.dataTransfer.files) {
    processNewFile(f.path);
  }
});

function processNewFile(filePath) {
  const id = generateId();
  const name = filePath.split('\\').pop().split('/').pop();
  
  filesData[id] = { id, filePath, name, progress: 0, state: 'hashing', sizeRaw: 0, sizeFormatted: 'Calculating...', md5: null };
  renderTable();
  ipcRenderer.send('hash-file', { id, filePath });
}

// IPC Listeners for Progress
ipcRenderer.on('hash-progress', (event, { id, progress }) => {
  if (!filesData[id]) return;
  filesData[id].progress = progress;
  
  const progBar = document.getElementById(`prog-${id}`);
  const statusTxt = document.getElementById(`status-${id}`);
  if (progBar && statusTxt && filesData[id].state === 'hashing') {
    progBar.style.width = `${progress}%`;
    statusTxt.innerText = `Hashing... ${progress}%`;
  }
});

ipcRenderer.on('hash-complete', (event, { id, md5, fileSize }) => {
  if (!filesData[id]) return;
  filesData[id].state = 'complete';
  filesData[id].progress = 100;
  filesData[id].md5 = md5;
  filesData[id].sizeRaw = fileSize;
  filesData[id].sizeFormatted = formatBytes(fileSize);
  renderTable();
});

// UI Actions
window.togglePause = (id) => {
  if (filesData[id].state === 'hashing') {
    filesData[id].state = 'paused';
    ipcRenderer.send('pause-hash', id);
  } else if (filesData[id].state === 'paused') {
    filesData[id].state = 'hashing';
    ipcRenderer.send('resume-hash', id);
  }
  renderTable();
};

window.copyValue = (value) => {
  navigator.clipboard.writeText(value);
};

// Render Loop
function renderTable() {
  fileList.innerHTML = '';
  Object.values(filesData).forEach(file => {
    const isComplete = file.state === 'complete';
    const isPaused = file.state === 'paused';
    
    const row = document.createElement('tr');
    
    let controlsHtml = '';
    if (isComplete) {
      controlsHtml = `<button onclick="copyValue('${file.md5}')">Copy MD5</button>`;
    } else {
      controlsHtml = `<button onclick="togglePause('${file.id}')">${isPaused ? 'Resume' : 'Pause'}</button>`;
    }

    let sizeHtml = file.sizeFormatted;
    if (isComplete) {
      sizeHtml += `<br><a href="#" style="color:var(--accent); font-size:11px; text-decoration:none;" onclick="copyValue('${file.sizeRaw}')">Copy Bytes</a>`;
    }

    row.innerHTML = `
      <td><strong>${file.name}</strong><br><span style="font-size:11px; color:var(--text-muted);">${file.filePath}</span></td>
      <td>${sizeHtml}</td>
      <td>
        <div class="status-text" id="status-${file.id}">
          ${isComplete ? 'Complete' : (isPaused ? `Paused at ${file.progress}%` : `Hashing... ${file.progress}%`)}
        </div>
        ${!isComplete ? `<div class="progress-container"><div id="prog-${file.id}" class="progress-bar ${isPaused ? 'paused' : ''}" style="width: ${file.progress}%"></div></div>` : ''}
      </td>
      <td style="font-family: monospace; color: ${isComplete ? 'var(--accent)' : 'var(--text-muted)'};">
        ${file.md5 || 'Pending...'}
      </td>
      <td class="actions">
        ${controlsHtml}
      </td>
    `;
    fileList.appendChild(row);
  });
}
