import { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { cpus } from 'node:os'
import { downloadMedia, cancelJob, cancelDownload } from '../youtube/pipeline'
import { appendHistory } from '../store/history'
import { getSettings } from '../store/settings'
import { loadPersistedJobs, savePersistedJobs } from '../store/jobs'
import type { ActiveJob, DownloadRequest, JobStatus, MediaKind } from '../youtube/types'

type EnqueueInput = {
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

let jobs: ActiveJob[] = []
let running = 0
let initialized = false
const pendingRequest = new Map<string, EnqueueInput & { jobId: string }>()

function persist() {
  savePersistedJobs(jobs)
}

/** Call once after Electron app is ready (userData path is stable). */
export function initJobQueue() {
  if (initialized) return
  initialized = true
  jobs = loadPersistedJobs().map((j) => {
    if (j.status === 'queued' || j.status === 'processing') {
      return {
        ...j,
        status: 'failed' as const,
        phase: undefined,
        error: j.error || 'Interrupted when the app closed.',
        updatedAt: new Date().toISOString(),
      }
    }
    return j
  })
  persist()
}

/** Kill downloads and mark active jobs failed — used on app quit. */
export function shutdownJobs() {
  for (const job of jobs) {
    if (job.status === 'queued' || job.status === 'processing') {
      job.status = 'failed'
      job.phase = undefined
      job.error = 'Interrupted when the app closed.'
      job.updatedAt = new Date().toISOString()
    }
  }
  pendingRequest.clear()
  running = 0
  cancelDownload()
  persist()
}

function broadcast() {
  persist()
  const snapshot = listJobs()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('jobs:update', snapshot)
    }
  }
}

function touch(job: ActiveJob, patch: Partial<ActiveJob>) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() })
  broadcast()
}

export function listJobs(): ActiveJob[] {
  return [...jobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function enqueueJobs(items: EnqueueInput[]): ActiveJob[] {
  if (!items?.length) return []
  const settings = getSettings()
  const created: ActiveJob[] = []
  for (const item of items) {
    if (!item?.url || !item?.saveDir) continue
    const job: ActiveJob = {
      id: randomUUID(),
      url: item.url,
      title: item.title || item.url,
      kind: item.kind || 'video',
      qualityId: item.qualityId || 'best',
      status: 'queued',
      phase: 'queued',
      percent: 0,
      thumbnail: item.thumbnail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    jobs.unshift(job)
    pendingRequest.set(job.id, {
      url: item.url,
      title: item.title,
      kind: item.kind || 'video',
      qualityId: item.qualityId || 'best',
      height: item.height ?? null,
      audioOnly: Boolean(item.audioOnly),
      saveDir: item.saveDir,
      playlistItems: item.playlistItems,
      thumbnail: item.thumbnail,
      extractTranscript: item.extractTranscript ?? settings.extractTranscript,
      saveDescription: item.saveDescription ?? settings.saveDescription,
      jobId: job.id,
    })
    created.push(job)
  }
  broadcast()
  queueMicrotask(() => {
    void pump()
  })
  return created
}

async function pump() {
  const settings = getSettings()
  const wanted = Math.max(1, Math.min(50, settings.maxParallelJobs || 2))
  const cores = Math.max(2, cpus()?.length || 4)
  // Fast but auto-safe: never exceed cores, keep headroom so 100-job queues don't melt the PC.
  const max = Math.min(wanted, Math.max(2, cores))

  while (running < max) {
    const nextId = [...pendingRequest.keys()].find((id) => {
      const j = jobs.find((x) => x.id === id)
      return j && j.status === 'queued'
    })
    if (!nextId) break

    const req = pendingRequest.get(nextId)
    const job = jobs.find((j) => j.id === nextId)
    if (!req || !job) {
      pendingRequest.delete(nextId)
      continue
    }

    job.status = 'processing'
    job.phase = 'downloading'
    job.percent = 1
    job.updatedAt = new Date().toISOString()
    running++
    broadcast()

    void runOne(job, req).finally(() => {
      running = Math.max(0, running - 1)
      pendingRequest.delete(nextId)
      void pump()
    })
  }
}

async function runOne(job: ActiveJob, req: EnqueueInput & { jobId: string }) {
  const settings = getSettings()
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const request: DownloadRequest = {
    url: req.url,
    saveDir: req.saveDir,
    qualityId: req.qualityId,
    height: req.height,
    audioOnly: req.audioOnly,
    kind: req.kind,
    title: req.title || job.title,
    playlistItems: req.playlistItems,
    concurrentFragments: Math.min(
      16,
      Math.max(settings.concurrentFragments || 5, pendingRequest.size > 10 ? 8 : 5),
    ),
    jobId: job.id,
    extractTranscript: req.extractTranscript,
    saveDescription: req.saveDescription,
    thumbnail: req.thumbnail || job.thumbnail,
  }

  // Keep short downloads visibly moving 1→…→100 on Jobs.
  const heartbeat = setInterval(() => {
    if (job.status !== 'processing') return
    if (job.phase === 'finalizing') return
    if (job.percent > 0 && job.percent < 92) {
      touch(job, { percent: Math.min(92, job.percent + 0.4) })
    }
  }, 800)

  try {
    const result = await downloadMedia(request, (progress) => {
      if (job.status === 'cancelled') return
      const phase =
        progress.status === 'merging' || progress.percent >= 99.5
          ? ('finalizing' as const)
          : ('downloading' as const)
      const nextPercent = Math.max(job.percent, progress.percent, 1)
      touch(job, {
        percent: Math.min(99.5, nextPercent),
        speed: progress.speed,
        currentItem: progress.currentItem,
        totalItems: progress.totalItems,
        status: 'processing',
        phase,
      })
    })

    clearInterval(heartbeat)

    if (job.status === 'cancelled') return

    touch(job, {
      status: 'done',
      phase: undefined,
      percent: 100,
      filePath: result.filePath,
      error: undefined,
    })
    appendHistory({
      id: job.id,
      url: job.url,
      title: job.title,
      kind: job.kind,
      quality: job.qualityId,
      status: 'success',
      filePath: result.filePath,
      thumbnail: job.thumbnail,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
  } catch (err) {
    clearInterval(heartbeat)
    const message = err instanceof Error ? err.message : String(err)
    const cancelled = /cancelled/i.test(message) || job.status === 'cancelled'
    const status: JobStatus = cancelled ? 'cancelled' : 'failed'
    touch(job, {
      status,
      phase: undefined,
      error: message,
      percent: job.percent,
    })
    appendHistory({
      id: job.id,
      url: job.url,
      title: job.title,
      kind: job.kind,
      quality: job.qualityId,
      status: cancelled ? 'cancelled' : 'failed',
      error: message,
      thumbnail: job.thumbnail,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    })
  }
}

export function cancelJobById(jobId: string) {
  const job = jobs.find((j) => j.id === jobId)
  if (!job) return
  if (job.status === 'queued') {
    pendingRequest.delete(jobId)
    touch(job, { status: 'cancelled', phase: undefined, error: 'Cancelled.' })
    appendHistory({
      id: job.id,
      url: job.url,
      title: job.title,
      kind: job.kind,
      quality: job.qualityId,
      status: 'cancelled',
      error: 'Cancelled.',
      startedAt: job.createdAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
    })
    return
  }
  if (job.status === 'processing') {
    touch(job, { status: 'cancelled', phase: undefined, error: 'Cancelled.' })
    cancelJob(jobId)
  }
}

export function cancelAllJobs() {
  for (const job of [...jobs]) {
    if (job.status === 'queued' || job.status === 'processing') {
      cancelJobById(job.id)
    }
  }
  cancelDownload()
}

export function clearFinishedJobs() {
  jobs = jobs.filter((j) => j.status === 'queued' || j.status === 'processing')
  broadcast()
}
