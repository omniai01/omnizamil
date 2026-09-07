import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActiveJob,
  AppSettings,
  ChannelLibrary,
  DepsReport,
  DownloadProgress,
  DownloadRequest,
  HistoryRecord,
  MediaInfo,
  MediaKind,
  PlaylistPage,
  SocialPlatform,
  SocialProfile,
  SocialProfileMode,
} from './youtube/types'

export type EnqueueJobInput = {
  url: string
  title?: string
  kind: MediaKind
  qualityId: string
  height: number | null
  audioOnly: boolean
  saveDir: string
  playlistItems?: string
  thumbnail?: string
  extractTranscript?: boolean
  saveDescription?: boolean
}

export type ShiftGrabApi = {
  getVersion: () => Promise<string>
  getHardwareId: () => Promise<string>
  getOsUsername: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  youtubeAuthStatus: () => Promise<{ signedIn: boolean }>
  youtubeLogin: () => Promise<{ signedIn: boolean }>
  youtubeLogout: () => Promise<{ signedIn: boolean }>
  listHistory: () => Promise<HistoryRecord[]>
  clearHistory: () => Promise<HistoryRecord[]>
  exportHistoryCsv: () => Promise<string | null>
  checkDeps: () => Promise<DepsReport>
  repairDeps: () => Promise<DepsReport>
  listJobs: () => Promise<ActiveJob[]>
  enqueueJobs: (items: EnqueueJobInput[]) => Promise<ActiveJob[]>
  cancelJob: (jobId: string) => Promise<ActiveJob[]>
  cancelAllJobs: () => Promise<ActiveJob[]>
  clearFinishedJobs: () => Promise<ActiveJob[]>
  onJobsUpdate: (handler: (jobs: ActiveJob[]) => void) => () => void
  getInfo: (url: string, opts?: { social?: boolean }) => Promise<MediaInfo>
  getPlaylistItems: (url: string) => Promise<PlaylistPage>
  getChannelLibrary: (url: string) => Promise<ChannelLibrary>
  getSocialProfile: (
    url: string,
    opts: { platform: SocialPlatform; mode?: SocialProfileMode },
  ) => Promise<SocialProfile>
  chooseDirectory: () => Promise<string | null>
  defaultDir: () => Promise<string>
  download: (request: DownloadRequest) => Promise<{ filePath: string }>
  cancel: () => Promise<void>
  reveal: (filePath: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  onProgress: (handler: (progress: DownloadProgress) => void) => () => void
}

const api: ShiftGrabApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getHardwareId: () => ipcRenderer.invoke('app:hardware-id'),
  getOsUsername: () => ipcRenderer.invoke('app:os-username'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  youtubeAuthStatus: () => ipcRenderer.invoke('auth:youtube-status'),
  youtubeLogin: () => ipcRenderer.invoke('auth:youtube-login'),
  youtubeLogout: () => ipcRenderer.invoke('auth:youtube-logout'),
  listHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  exportHistoryCsv: () => ipcRenderer.invoke('history:export-csv'),
  checkDeps: () => ipcRenderer.invoke('deps:check'),
  repairDeps: () => ipcRenderer.invoke('deps:repair'),
  listJobs: () => ipcRenderer.invoke('jobs:list'),
  enqueueJobs: (items) => ipcRenderer.invoke('jobs:enqueue', items),
  cancelJob: (jobId) => ipcRenderer.invoke('jobs:cancel', jobId),
  cancelAllJobs: () => ipcRenderer.invoke('jobs:cancel-all'),
  clearFinishedJobs: () => ipcRenderer.invoke('jobs:clear-finished'),
  onJobsUpdate: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, jobs: ActiveJob[]) => handler(jobs)
    ipcRenderer.on('jobs:update', listener)
    return () => ipcRenderer.removeListener('jobs:update', listener)
  },
  getInfo: (url, opts) => ipcRenderer.invoke('media:get-info', url, opts),
  getPlaylistItems: (url) => ipcRenderer.invoke('media:playlist-items', url),
  getChannelLibrary: (url) => ipcRenderer.invoke('media:channel-library', url),
  getSocialProfile: (url, opts) => ipcRenderer.invoke('media:social-profile', url, opts),
  chooseDirectory: () => ipcRenderer.invoke('media:choose-directory'),
  defaultDir: () => ipcRenderer.invoke('media:default-dir'),
  download: (request) => ipcRenderer.invoke('media:download', request),
  cancel: () => ipcRenderer.invoke('media:cancel'),
  reveal: (filePath) => ipcRenderer.invoke('shell:reveal', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  onProgress: (handler) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: DownloadProgress,
    ) => {
      handler(progress)
    }
    ipcRenderer.on('media:progress', listener)
    return () => ipcRenderer.removeListener('media:progress', listener)
  },
}

contextBridge.exposeInMainWorld('shiftgrab', api)
