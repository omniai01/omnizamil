import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import {
  cancelAllJobs,
  cancelJobById,
  clearFinishedJobs,
  enqueueJobs,
  initJobQueue,
  listJobs,
  shutdownJobs,
} from './jobs/queue'
import {
  cancelDownload,
  checkDependencies,
  downloadMedia,
  ensureBinaries,
  fetchChannelLibrary,
  fetchMediaInfo,
  fetchPlaylistItems,
  fetchSocialProfile,
  repairDependencies,
  toUserError,
} from './youtube/pipeline'
import type { DownloadRequest, MediaInfo, SocialPlatform, SocialProfileMode } from './youtube/types'
import { appendHistory, clearHistory, exportHistoryCsv, listHistory } from './store/history'
import { getSettings, setSettings } from './store/settings'
import { getHardwareId, getOsUsername } from './ids'
import {
  clearYouTubeLogin,
  openYouTubeLogin,
  youtubeAuthStatus,
} from './youtube/cookies'

let mainWindow: BrowserWindow | null = null

function resolveAppIcon(): string | undefined {
  const candidates = [
    process.resourcesPath ? join(process.resourcesPath, 'icon.ico') : '',
    join(__dirname, '../../resources/icon.ico'),
    join(process.cwd(), 'resources/icon.ico'),
    join(__dirname, '../../resources/icon.png'),
    join(process.cwd(), 'resources/icon.png'),
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p))
}

function createWindow() {
  const iconPath = resolveAppIcon()
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f2f9f9',
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  if (iconPath && process.platform === 'win32') {
    try {
      mainWindow.setIcon(iconPath)
    } catch {
      /* ignore */
    }
  }

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  initJobQueue()
  createWindow()
  const settings = getSettings()
  void ensureBinaries(settings.autoUpdateBinaries).catch((err) => {
    console.error('Binary warm-up failed:', err)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  shutdownJobs()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('app:get-version', () => app.getVersion())
ipcMain.handle('app:hardware-id', () => getHardwareId())
ipcMain.handle('app:os-username', () => getOsUsername())

ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('settings:set', (_event, patch) => setSettings(patch))

ipcMain.handle('auth:youtube-status', () => youtubeAuthStatus())
ipcMain.handle('auth:youtube-login', async () => openYouTubeLogin(mainWindow))
ipcMain.handle('auth:youtube-logout', async () => {
  await clearYouTubeLogin()
  return youtubeAuthStatus()
})

ipcMain.handle('history:list', () => listHistory())
ipcMain.handle('history:clear', () => {
  clearHistory()
  return listHistory()
})
ipcMain.handle('history:export-csv', async () => {
  const csv = exportHistoryCsv()
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: join(app.getPath('documents'), 'shiftgrab-report.csv'),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, csv, 'utf-8')
  return result.filePath
})

ipcMain.handle('deps:check', () => checkDependencies())
ipcMain.handle('deps:repair', () => repairDependencies())

ipcMain.handle('jobs:list', () => listJobs())
ipcMain.handle('jobs:enqueue', (_event, items) => enqueueJobs(items))
ipcMain.handle('jobs:cancel', (_event, jobId: string) => {
  cancelJobById(jobId)
  return listJobs()
})
ipcMain.handle('jobs:cancel-all', () => {
  cancelAllJobs()
  return listJobs()
})
ipcMain.handle('jobs:clear-finished', () => {
  clearFinishedJobs()
  return listJobs()
})

ipcMain.handle(
  'media:get-info',
  async (_event, url: string, opts?: { social?: boolean }): Promise<MediaInfo> => {
    try {
      return await fetchMediaInfo(url, opts)
    } catch (err) {
      throw new Error(toUserError(err))
    }
  },
)

ipcMain.handle('media:playlist-items', async (_event, url: string) => {
  try {
    return await fetchPlaylistItems(url)
  } catch (err) {
    throw new Error(toUserError(err))
  }
})

ipcMain.handle('media:channel-library', async (_event, url: string) => {
  try {
    return await fetchChannelLibrary(url)
  } catch (err) {
    throw new Error(toUserError(err))
  }
})

ipcMain.handle(
  'media:social-profile',
  async (
    _event,
    url: string,
    opts: { platform: SocialPlatform; mode?: SocialProfileMode },
  ) => {
    try {
      return await fetchSocialProfile(url, opts)
    } catch (err) {
      throw new Error(toUserError(err))
    }
  },
)

ipcMain.handle('media:choose-directory', async (): Promise<string | null> => {
  const settings = getSettings()
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: settings.defaultSaveDir || app.getPath('downloads'),
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('media:default-dir', () => {
  const settings = getSettings()
  return settings.defaultSaveDir || app.getPath('downloads')
})

ipcMain.handle(
  'media:download',
  async (event, request: DownloadRequest): Promise<{ filePath: string }> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const settings = getSettings()
    const startedAt = new Date().toISOString()
    const startMs = Date.now()
    const merged: DownloadRequest = {
      ...request,
      concurrentFragments: request.concurrentFragments ?? settings.concurrentFragments,
      extractTranscript: request.extractTranscript ?? settings.extractTranscript,
      saveDescription: request.saveDescription ?? settings.saveDescription,
    }

    try {
      const result = await downloadMedia(merged, (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('media:progress', progress)
        }
      })
      appendHistory({
        url: request.url,
        title: request.title || request.url,
        kind: request.kind,
        quality: request.qualityId,
        status: 'success',
        filePath: result.filePath,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const cancelled = /cancelled/i.test(message)
      appendHistory({
        url: request.url,
        title: request.title || request.url,
        kind: request.kind,
        quality: request.qualityId,
        status: cancelled ? 'cancelled' : 'failed',
        error: toUserError(message),
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      })
      throw new Error(toUserError(err))
    }
  },
)

ipcMain.handle('media:cancel', () => {
  cancelDownload()
})

ipcMain.handle('shell:reveal', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('shell:open-external', async (_event, url: string) => {
  await shell.openExternal(url)
})
