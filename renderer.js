const { ipcRenderer } = require('electron');

const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const themeToggle = document.getElementById('theme-toggle');
const playerSection = document.getElementById('player-section');
const mediaPlayer = document.getElementById('media-player');

let currentFiles = {}; // Using object for easier progress tracking

// Theme Toggle Logic
themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  html.setAttribute('data-theme', currentTheme === 'light' ? 'dark' : 'light');
});

// Drag and Drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  
  for (const f of e.dataTransfer.files) {
    const id = f.path.replace(/[^a-zA-Z0-9]/g, '');
    
    // Check if it's a video to load into the manual review player
    if (f.type.startsWith('video/') || f.name.endsWith('.mov')) {
      playerSection.style.display = 'block';
      mediaPlayer.src = f.path;
    }

    currentFiles[id] = { path: f.path, name: f.name, progress: 0, md5: 'Pending...' };
    renderTable();
    ipcRenderer.send('hash-file', f.path);
  }
});

// Listen for granular progress
ipcRenderer.on('hash-progress', (event, { filePath, progress }) => {
  const id = filePath.replace(/[^a-zA-Z0-9]/g, '');
  if (currentFiles[id]) {
    currentFiles[id].progress = progress;
    
    // Only update the specific progress bar to save UI performance
    const progressBar = document.getElementById(`prog-${id}`);
    const progressText = document.getElementById(`text-${id}`);
    if (progressBar && progressText) {
      progressBar.style.width = `${progress}%`;
      progressText.innerText = `${progress}%`;
    }
  }
});

// Listen for completion
ipcRenderer.on('hash-complete', (event, { filePath, md5 }) => {
  const id = filePath.replace(/[^a-zA-Z0-9]/g, '');
  if (currentFiles[id]) {
    currentFiles[id].progress = 100;
    currentFiles[id].md5 = md5;
    renderTable(); // Full re-render to show the hash and copy button
  }
});

function renderTable() {
  fileList.innerHTML = '';
  Object.keys(currentFiles).forEach(key => {
    const file = currentFiles[key];
    const isComplete = file.progress === 100;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${file.name}</td>
      <td>
        <span id="text-${key}">${isComplete ? 'Complete' : file.progress + '%'}</span>
        ${!isComplete ? `<div class="progress-bar-container"><div id="prog-${key}" class="progress-bar" style="width: ${file.progress}%"></div></div>` : ''}
      </td>
      <td>${file.md5}</td>
      <td>
        ${isComplete ? `<button onclick="copyToClipboard('${file.md5}')">Copy MD5</button>` : 'Processing...'}
      </td>
    `;
    fileList.appendChild(row);
  });
}

window.copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  alert('Copied: ' + text);
};
