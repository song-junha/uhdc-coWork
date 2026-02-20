import { app, globalShortcut, BrowserWindow } from 'electron';
import { menubar } from 'menubar';
import path from 'path';
import { initDatabase, closeDatabase } from './db';
import { registerIpcHandlers } from './ipc';
import { startScheduler, stopScheduler } from './services/scheduler.service';
import { supabaseService } from './services/supabase.service';

// Handle Squirrel events (Windows installer)
if (process.platform === 'win32') {
  app.setAppUserModelId('com.menubar-utility.app');
}

const isDev = !app.isPackaged;

// IPC 핸들러를 menubar보다 먼저 등록 (preloadWindow: true이므로 윈도우가 먼저 로드됨)
app.on('ready', () => {
  initDatabase();
  registerIpcHandlers();
});

const mb = menubar({
  index: isDev
    ? 'http://localhost:5173/index.html'
    : `file://${path.join(__dirname, '../renderer/index.html')}`,
  icon: path.join(__dirname, '../../resources/iconTemplate.png'),
  browserWindow: {
    width: 420,
    height: 520,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  },
  preloadWindow: true,
  showDockIcon: false,
  showOnAllWorkspaces: false,
});

mb.on('ready', () => {
  console.log('MenuBar Utility is ready');

  // Start calendar alert scheduler
  startScheduler();

  // Register global shortcut
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mb.window?.isVisible()) {
      mb.hideWindow();
    } else {
      mb.showWindow();
    }
  });

  // Dev tools in development
  if (isDev && mb.window) {
    // mb.window.webContents.openDevTools({ mode: 'detach' });
  }
});

mb.on('after-hide', () => {
  // Optional: clear any temporary state
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopScheduler();
  supabaseService.unsubscribeRealtime();
  closeDatabase();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    mb.showWindow();
  });
}
