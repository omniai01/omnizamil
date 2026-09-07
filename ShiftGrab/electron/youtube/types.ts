export type MediaKind = 'video' | 'playlist' | 'channel' | 'social' | 'bulk'

export type QualityOption = {
  id: string
  label: string
  height: number | null
  audioOnly: boolean
}

export type MediaInfo = {
  kind: MediaKind
  title: string
  author: string
  thumbnail: string
  durationSeconds: number | null
  itemCount: number | null
  url: string
  qualities: QualityOption[]
  isImage?: boolean
}

export type PlaylistItem = {
  id: string
  title: string
  url: string
  thumbnail: string
  durationSeconds: number | null
  author: string
  index: number
}

export type PlaylistPage = {
  title: string
  author: string
  url: string
  thumbnail: string
  items: PlaylistItem[]
  banner?: string
  avatar?: string
}

export type ChannelLibrary = {
  title: string
  author: string
  url: string
  description: string
  banner: string
  avatar: string
  followerCount: number | null
  videos: PlaylistItem[]
  shorts: PlaylistItem[]
  isPlaylist: boolean
}

export type SocialPlatform = 'facebook' | 'tiktok' | 'instagram'

export type SocialProfileMode = 'reels' | 'images' | 'videos'

export type SocialProfile = {
  platform: SocialPlatform
  mode: SocialProfileMode
  title: string
  author: string
  url: string
  avatar: string
  description: string
  items: PlaylistItem[]
}

export type DownloadRequest = {
  url: string
  saveDir: string
  qualityId: string
  height: number | null
  audioOnly: boolean
  kind: MediaKind
  title?: string
  playlistItems?: string
  concurrentFragments?: number
  jobId?: string
  extractTranscript?: boolean
  saveDescription?: boolean
  thumbnail?: string
}

export type DownloadProgress = {
  percent: number
  speed?: string
  status: 'downloading' | 'merging' | 'done' | 'error'
  message?: string
  currentItem?: number
  totalItems?: number
  jobId?: string
}

export type HistoryStatus = 'success' | 'failed' | 'cancelled'

export type HistoryRecord = {
  id: string
  url: string
  title: string
  kind: MediaKind
  quality: string
  status: HistoryStatus
  bytes?: number
  filePath?: string
  error?: string
  startedAt: string
  finishedAt: string
  durationMs: number
  thumbnail?: string
  mediaDurationSeconds?: number | null
}

export type AppSettings = {
  defaultSaveDir: string
  defaultQualityId: string
  concurrentFragments: number
  maxParallelJobs: number
  autoUpdateBinaries: boolean
  extractTranscript: boolean
  saveDescription: boolean
  /** If no in-app YouTube cookie jar, pass Chrome cookies to yt-dlp. */
  useBrowserCookiesFallback: boolean
}

export type DepStatus = {
  id: 'yt-dlp' | 'ffmpeg' | 'deno' | 'app'
  label: string
  ok: boolean
  path: string | null
  locationHint: string
  version: string | null
  detail?: string
}

export type DepsReport = {
  checkedAt: string
  items: DepStatus[]
}

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'cancelled'

export type JobPhase = 'queued' | 'downloading' | 'finalizing'

export type ActiveJob = {
  id: string
  url: string
  title: string
  kind: MediaKind
  qualityId: string
  status: JobStatus
  phase?: JobPhase
  percent: number
  speed?: string
  error?: string
  filePath?: string
  thumbnail?: string
  createdAt: string
  updatedAt: string
  currentItem?: number
  totalItems?: number
}
