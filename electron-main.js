const { app, BrowserWindow, shell } = require('electron');
const http = require('http');

// Start Express Backend + Static UI Server
require('./backend/server.js');

let mainWindow;

function waitForServer(url, callback) {
  const request = http.get(url, (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => waitForServer(url, callback), 400);
    }
  });
  request.on('error', () => {
    setTimeout(() => waitForServer(url, callback), 400);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#04070B',
    title: 'Sophia v2.0 | Omnix Global AI Lead Gen CRM',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Open external links (like WhatsApp wa.me) in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  waitForServer('http://127.0.0.1:5000/api/health', () => {
    mainWindow.loadURL('http://127.0.0.1:5000');
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});