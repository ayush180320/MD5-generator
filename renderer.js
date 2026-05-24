const { ipcRenderer } = require('electron');

const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const btnBrowse = document.getElementById('btn-browse');
const btnReset = document.getElementById('btn-reset');

let filesData = {};

// Helper: Format EXACT Bytes nicely (e.g. 1,024,500 Bytes)
function formatExactBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 Bytes';
  return new Intl.NumberFormat('en-US').format(bytes) + ' Bytes';
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Global Controls
btnBrowse.addEventListener('click', () => { ipcRenderer.send('open-file-dialog'); });
btnReset.addEventListener('click', () => {
  Object.keys(filesData).forEach(id => ipcRenderer.send('cancel-hash', id));
  filesData = {};
  renderTable();
});
ipcRenderer.on('selected-files', (event, paths) => { paths.forEach(processNewFile); });

// Drag & Drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  for (const f of e.dataTransfer.files) { processNewFile(f.path); }
});

function processNewFile(filePath) {
  const id = generateId();
  const name = filePath.split('\\').pop().split('/').pop();
  
  filesData[id] = { 
    id, filePath, name, 
    progress: 0, state: 'hashing', 
    sizeRaw: null, md5: null, 
    expectedMd5: '' 
  };
  renderTable();
  ipcRenderer.send('hash-file', { id, filePath });
}

// IPC Listeners
ipcRenderer.on('hash-progress', (event, { id, progress }) => {
  if (!filesData[id]) return;
  filesData[id].progress = progress;
  
  const progBar = document.getElementById(`prog-${id}`);
  const statusTxt = document.getElementById(`status-pct-${id}`);
  if (progBar && statusTxt && filesData[id].state === 'hashing') {
    progBar.style.width = `${progress}%`;
    statusTxt.innerText = `${progress}%`;
  }
});

ipcRenderer.on('hash-complete', (event, { id, md5, fileSize }) => {
  if (!filesData[id]) return;
  filesData[id].state = 'complete';
  filesData[id].progress = 100;
  filesData[id].md5 = md5;
  filesData[id].sizeRaw = fileSize;
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

window.copyValue = (value) => { navigator.clipboard.writeText(value); };

// Real-time Checksum Validation
window.updateExpectedMd5 = (id, value) => {
  filesData[id].expectedMd5 = value.trim().toLowerCase();
  
  const badge = document.getElementById(`match-badge-${id}`);
  if (!filesData[id].expectedMd5 || !filesData[id].md5) {
    badge.className = 'match-badge neutral';
    badge.innerText = 'WAITING';
    return;
  }
  
  if (filesData[id].expectedMd5 === filesData[id].md5) {
    badge.className = 'match-badge success';
    badge.innerText = 'MATCH';
  } else {
    badge.className = 'match-badge fail';
    badge.innerText = 'MISMATCH';
  }
};

// Render Loop for Card UI
function renderTable() {
  fileList.innerHTML = '';
  Object.values(filesData).forEach(file => {
    const isComplete = file.state === 'complete';
    const isPaused = file.state === 'paused';
    
    // Determine Validation State for rendering
    let badgeClass = 'neutral';
    let badgeText = 'WAITING';
    if (isComplete && file.expectedMd5) {
      if (file.expectedMd5 === file.md5) { badgeClass = 'success'; badgeText = 'MATCH'; } 
      else { badgeClass = 'fail'; badgeText = 'MISMATCH'; }
    }

    const card = document.createElement('div');
    card.className = 'file-card';
    
    card.innerHTML = `
      <div class="file-data">
        <div>
          <div class="file-name">${file.name}</div>
          <div class="file-path">${file.filePath}</div>
        </div>
        
        <div class="file-size">${formatExactBytes(file.sizeRaw)}</div>
        
        <div class="progress-section">
          <div class="status-text">
            <span id="status-text-${file.id}">${isComplete ? 'Calculation Complete' : (isPaused ? 'Paused' : 'Calculating MD5...')}</span>
            <span id="status-pct-${file.id}">${isComplete ? '100%' : file.progress + '%'}</span>
          </div>
          <div class="progress-track">
            <div id="prog-${file.id}" class="progress-fill ${isPaused ? 'paused' : ''}" style="width: ${file.progress}%"></div>
          </div>
          <div class="hash-display" style="color: ${isComplete ? 'var(--text-main)' : 'var(--text-muted)'}">
            ${file.md5 || '--------------------------------'}
          </div>
        </div>
      </div>

      <div class="action-bar">
        <div class="matcher-group">
          <span style="font-size:12px; color:var(--text-muted);">Compare Hash:</span>
          <input type="text" class="matcher-input" id="expected-${file.id}" placeholder="Paste expected MD5 here..." value="${file.expectedMd5}" oninput="updateExpectedMd5('${file.id}', this.value)">
          <span class="match-badge ${badgeClass}" id="match-badge-${file.id}">${badgeText}</span>
        </div>
        
        <div class="action-group">
          ${!isComplete ? `<button onclick="togglePause('${file.id}')">${isPaused ? 'Resume Processing' : 'Pause Processing'}</button>` : ''}
          ${isComplete ? `
            <button onclick="copyValue('${file.md5}')">Copy MD5</button>
            <button onclick="copyValue('${file.sizeRaw}')">Copy Exact Bytes</button>
          ` : ''}
        </div>
      </div>
    `;
    fileList.appendChild(card);
  });
}
