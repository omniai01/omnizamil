import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDeps, getDepsStatus, runFastExport, beginDepsInstall, stopDepsInstall, DepsStoppedError } from './runtime';
import { formatVideoEngineError, getHardwareId } from './ids';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, '..');

const DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL?.replace(/\/?$/, '/') || 'http://localhost:5180/';
const RENDERER_DIST = path.join(process.env.APP_ROOT!, 'dist');
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: 'Omni-Removal',
    backgroundColor: '#0a2f38',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = win;
  win.setMenuBarVisibility(false);

  const showWin = () => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  };
  win.once('ready-to-show', showWin);
  // Never leave the user staring at a forever-hidden window
  setTimeout(showWin, 2500);

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[Omni-Removal] did-fail-load', code, desc, url);
    if (isDev && code !== -3) {
      // Retry Vite after a short wait (server may still be starting)
      setTimeout(() => {
        if (!win.isDestroyed()) void win.loadURL(DEV_SERVER_URL);
      }, 800);
    }
  });

  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') {
      console.error(`[renderer] ${event.message} (${event.sourceId}:${event.line})`);
    }
  });

  const distIndex = path.join(RENDERER_DIST, 'index.html');
  if (isDev || !fs.existsSync(distIndex)) {
    console.log('[Omni-Removal] loading', DEV_SERVER_URL);
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(distIndex);
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:saveFile', async (_e, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Save cleaned file',
    defaultPath: defaultName,
    filters: [
      { name: 'PNG', extensions: ['png'] },
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('dialog:openMedia', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select images or videos',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'webm', 'mov'] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('shell:showItem', async (_e, targetPath: string) => {
  shell.showItemInFolder(targetPath);
});

ipcMain.handle('shell:openExternal', async (_e, targetUrl: string) => {
  await shell.openExternal(String(targetUrl || ''));
  return true;
});

ipcMain.handle(
  'video:remove',
  async (event, payload: { inputPath?: string; inputBase64?: string; inputName?: string }) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omnizamil-in-'));
    let inputPath = payload.inputPath;
    const originalName = payload.inputName || (inputPath ? path.basename(inputPath) : 'input.mp4');
    if (!inputPath && payload.inputBase64) {
      inputPath = path.join(tmp, 'input.mp4');
      fs.writeFileSync(inputPath, Buffer.from(payload.inputBase64, 'base64'));
    }
    if (!inputPath) throw new Error('No video input');

    // Always work from a simple temp path — spaces/parens in Downloads names break Playwright setInputFiles on Windows
    const safeIn = path.join(tmp, 'input.mp4');
    if (path.resolve(inputPath) !== path.resolve(safeIn)) {
      fs.copyFileSync(inputPath, safeIn);
      inputPath = safeIn;
    }

    const outName = originalName.replace(/\.[^.]+$/, '') + '-omnizamil-clean.mp4';
    // Encode to temp first (Videos/OneDrive folders often fail mid-write)
    const tempOut = path.join(tmp, 'output-clean.mp4');

    try {
      // Seed + ensure full video stack before cleanup (not image-only ready)
      const status = await getDepsStatus();
      if (!status.ready || !status.videoReady) {
        event.sender.send('deps:progress', {
          stage: 'Repairing system components…',
          percent: 5,
          videoStatus: 'installing',
        });
        const signal = beginDepsInstall();
        await ensureDeps((p) => event.sender.send('deps:progress', p), signal);
      }

      const runOnce = async () => {
        event.sender.send('deps:progress', {
          stage: 'Omni-Removal detecting watermark…',
          percent: 15,
          videoStatus: 'installing',
        });
        return runFastExport(inputPath, tempOut, (line) => {
          if (line.includes('DONE')) {
            event.sender.send('deps:progress', {
              stage: 'Omni-Removal finishing…',
              percent: 95,
              videoStatus: 'ready',
            });
          }
        });
      };

      let meta;
      try {
        meta = await runOnce();
      } catch (firstErr) {
        const raw = firstErr instanceof Error ? firstErr.message : String(firstErr);
        const looksLikeDeps =
          /ffmpeg|vsync|fps_mode|playwright|chromium|Executable doesn't exist|node\.exe|ENOENT|Engine packages missing|not ready|spawn/i.test(
            raw,
          ) && !/detection not confident|No clear watermark|not confident/i.test(raw);
        if (!looksLikeDeps) throw firstErr;
        // Auto-repair missing runtime pieces, then retry once — user does not reinstall
        event.sender.send('deps:progress', {
          stage: 'Repairing missing components…',
          percent: 8,
          videoStatus: 'installing',
        });
        const signal = beginDepsInstall();
        await ensureDeps((p) => event.sender.send('deps:progress', p), signal);
        meta = await runOnce();
      }

      let outputPath = path.join(app.getPath('videos'), outName);
      try {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.copyFileSync(tempOut, outputPath);
      } catch {
        outputPath = path.join(app.getPath('userData'), 'OmniDownloads', outName);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.copyFileSync(tempOut, outputPath);
      }

      const buf = fs.readFileSync(tempOut);
      return {
        ok: true as const,
        outputPath,
        frames: meta.frames,
        templateNcc: 0,
        source: 'omnizamil',
        base64: buf.toString('base64'),
        size: buf.length,
        fileName: outName,
      };
    } catch (err) {
      console.error('[Omni-Removal] video:remove', err);
      const { userMessage, technicalDetail } = formatVideoEngineError(err);
      // Keep healing in background so next retry can succeed without user action
      try {
        const signal = beginDepsInstall();
        void ensureDeps(() => undefined, signal).catch(() => undefined);
      } catch {
        /* ignore */
      }
      try {
        const logPath = path.join(app.getPath('userData'), 'last-video-error.txt');
        fs.writeFileSync(
          logPath,
          [
            `time=${new Date().toISOString()}`,
            `user=${userMessage}`,
            `technical=${technicalDetail}`,
            `raw=${err instanceof Error ? err.stack || err.message : String(err)}`,
          ].join('\n'),
          'utf8',
        );
      } catch {
        /* ignore log write */
      }
      throw new Error(`${userMessage}\n\n[TECH] ${technicalDetail}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

ipcMain.handle('fs:writeBase64', async (_e, filePath: string, base64: string) => {
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return true;
});

ipcMain.handle(
  'downloads:saveAuto',
  async (_e, payload: { fileName: string; base64: string }) => {
    const dir = path.join(app.getPath('userData'), 'OmniDownloads');
    fs.mkdirSync(dir, { recursive: true });
    const safe = String(payload.fileName || 'cleaned.bin')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .slice(0, 180);
    const stamp = Date.now();
    const filePath = path.join(dir, `${stamp}-${safe}`);
    fs.writeFileSync(filePath, Buffer.from(payload.base64, 'base64'));
    return filePath;
  },
);

ipcMain.handle('deps:status', async () => getDepsStatus());

ipcMain.handle('deps:ensure', async (event) => {
  const signal = beginDepsInstall();
  try {
    return await ensureDeps((p) => {
      event.sender.send('deps:progress', p);
    }, signal);
  } catch (err) {
    if (err instanceof DepsStoppedError || signal.aborted) {
      return { ok: false as const, stopped: true as const };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/reinstall|fresh install|engine missing/i.test(msg)) {
      throw new Error('Omni-Removal needs a fresh install. Please reinstall the setup.');
    }
    if (
      /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up|Waiting for connection/i.test(
        msg,
      )
    ) {
      throw new Error('Waiting for connection… Setup continues automatically.');
    }
    // Pass through friendly auto-continue messages; never "Internet connection failed"
    if (/Finishing setup|continues automatically/i.test(msg)) {
      throw new Error(msg);
    }
    throw new Error('Finishing setup… Omni continues automatically.');
  }
});

ipcMain.handle('deps:stop', async () => {
  stopDepsInstall();
  return { ok: true as const };
});

ipcMain.handle('app:relaunch', async () => {
  app.relaunch();
  app.exit(0);
  return true;
});

ipcMain.handle('app:getVersion', async () => app.getVersion());

ipcMain.handle('app:hardwareId', async () => getHardwareId());

/** Launch NSIS uninstall wizard for Omni-Removal (keeps AppData runtime for reinstall). */
ipcMain.handle('app:runUninstaller', async () => {
  const exeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(exeDir, 'Uninstall Omni-Removal.exe'),
    path.join(exeDir, 'Uninstall Omni-Removal.exe'),
    path.join(exeDir, '..', 'Uninstall Omni-Removal.exe'),
    path.join(exeDir, 'uninstall.exe'),
  ];
  // electron-builder NSIS often names: Uninstall <productName>.exe in install root
  try {
    for (const entry of fs.readdirSync(exeDir)) {
      if (/^uninstall/i.test(entry) && /\.exe$/i.test(entry)) {
        candidates.unshift(path.join(exeDir, entry));
      }
    }
  } catch {
    /* ignore */
  }
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) {
    spawn(found, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { ok: true as const, path: found };
  }
  await shell.openExternal('ms-settings:appsfeatures');
  return { ok: false as const, fallback: 'settings' as const };
});

ipcMain.handle('updates:check', async () => {
  const version = app.getVersion();
  return {
    ok: true as const,
    upToDate: true,
    current: version,
    latest: version,
    message: 'Omni-Removal is up to date (local build). Admin updates will appear here later.',
  };
});
