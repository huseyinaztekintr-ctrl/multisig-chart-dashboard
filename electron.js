const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;
  let viteProcess;

  // Development mode check
  const isDev = process.env.NODE_ENV === 'development';

  function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true,
        // CPU optimizasyonu için ek ayarlar
        backgroundThrottling: false,
        offscreen: false,
        experimentalFeatures: false
      },
      titleBarStyle: 'default',
      show: false,
      // CPU tasarrufu için ek window ayarları
      useContentSize: true,
      thickFrame: false
    });

    // Remove default menu
    Menu.setApplicationMenu(null);

    // Load the app
    if (isDev) {
      // Development mode - start Vite dev server
      viteProcess = spawn('npm', ['run', 'dev'], {
        cwd: __dirname,
        shell: true,
        stdio: 'inherit'
      });
      
      // Wait a bit for Vite to start, then load
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:8080').catch(console.error);
        if (isDev) {
          mainWindow.webContents.openDevTools();
        }
      }, 3000);
    } else {
      // Production mode - load built files
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      mainWindow.loadFile(indexPath).catch(console.error);
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // CPU optimizasyonu için app ayarları
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-background-timer-throttling');
  app.commandLine.appendSwitch('--disable-renderer-backgrounding');
  app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('--max_old_space_size', '512');

  // This method will be called when Electron has finished initialization
  app.whenReady().then(() => {
    createWindow();
  });

  // Handle second instance
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Quit when all windows are closed
  app.on('window-all-closed', () => {
    // Kill Vite process if it's running
    if (viteProcess) {
      viteProcess.kill();
    }
    
    // On macOS it is common for applications to stay active until explicitly quit
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Security: prevent new window creation
  app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });
  });

  // Error handling
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}