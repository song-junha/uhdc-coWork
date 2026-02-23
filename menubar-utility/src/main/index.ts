import { app, globalShortcut, session, BrowserWindow } from 'electron';
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

  // Content Security Policy 설정 (프로덕션만 - 개발 모드는 Vite HMR이 필요)
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
            "img-src 'self' data: https:; " +
            "font-src 'self';"
          ],
        },
      });
    });
  }
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
      sandbox: true,
    },
  },
  preloadWindow: true,
  showDockIcon: false,
  showOnAllWorkspaces: false,
});

mb.on('ready', () => {
  console.log('MenuBar Utility is ready');

  // 예기치 않은 페이지 이동 및 새 창 차단
  if (mb.window) {
    mb.window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost:') && !url.startsWith('file://')) {
        event.preventDefault();
      }
    });
    mb.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }

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
  supabaseService.unsubscribePersonalRealtime();
  closeDatabase();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mb.window) {
      mb.showWindow();
    }
  });
}
