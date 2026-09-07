import { app } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, chmodSync, readFileSync } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import ffmpegStatic from 'ffmpeg-static'
import { cookiesArgs, cookiesFilePath } from './cookies'
import type {
  ChannelLibrary,
  DepsReport,
  DepStatus,
  DownloadProgress,
  DownloadRequest,
  MediaInfo,
  PlaylistItem,
  PlaylistPage,
  QualityOption,
  SocialPlatform,
  SocialProfile,
  SocialProfileMode,
} from './types'

const YTDLP_STALE_MS = 24 * 60 * 60 * 1000

const activeChildren = new Map<string, ReturnType<typeof spawn>>()
const cancelFlags = new Set<string>()
const DEFAULT_JOB = '__default__'

function killProc(proc: ReturnType<typeof spawn>) {
  if (!proc.pid) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { windowsHide: true })
  } else {
    try {
      proc.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }
}

function binDir() {
  const dir = join(app.getPath('userData'), 'bin')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Hidden work folder — keeps .part / merge temps out of Explorer Downloads (avoids WinError 32). */
function downloadCacheRoot() {
  const dir = join(app.getPath('userData'), '.download-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (process.platform === 'win32') {
    execFile('attrib', ['+H', dir], { windowsHide: true }, () => undefined)
  }
  return dir
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

async function moveFileWithRetry(src: string, dest: string, tries = 8) {
  await mkdir(dirname(dest), { recursive: true })
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      await rename(src, dest)
      return
    } catch (err) {
      lastErr = err
      try {
        await copyFile(src, dest)
        await unlink(src).catch(() => undefined)
        return
      } catch (err2) {
        lastErr = err2
      }
      await sleep(250 * (i + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function promoteCacheToSaveDir(workDir: string, saveDir: string) {
  await mkdir(saveDir, { recursive: true })
  const names = await readdir(workDir)
  const moved: string[] = []
  for (const name of names) {
    if (name.endsWith('.part') || name.endsWith('.ytdl') || name.endsWith('.temp')) continue
    const src = join(workDir, name)
    let st
    try {
      st = await stat(src)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    const dest = join(saveDir, name)
    await moveFileWithRetry(src, dest)
    moved.push(dest)
  }
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  return moved
}

function ytDlpName() {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
}

function denoName() {
  return process.platform === 'win32' ? 'deno.exe' : 'deno'
}

function ytDlpPath() {
  return join(binDir(), ytDlpName())
}

function denoPath() {
  if (app.isPackaged && process.resourcesPath) {
    const bundled = join(process.resourcesPath, 'deno', denoName())
    if (existsSync(bundled)) return bundled
  }
  return join(binDir(), denoName())
}

function resolveFfmpeg(): string | null {
  if (app.isPackaged && process.resourcesPath) {
    const bundled = join(
      process.resourcesPath,
      'ffmpeg',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    )
    if (existsSync(bundled)) return bundled
  }
  if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic
  return null
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status} for ${url}`)
  }
  await mkdir(dirname(dest), { recursive: true })
  const tmp = `${dest}.partial`
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp))
  await rename(tmp, dest)
}

async function ensureYtDlp(autoUpdate = false): Promise<string> {
  const dest = ytDlpPath()
  let needs = !existsSync(dest)
  if (!needs) {
    try {
      const s = await stat(dest)
      if (s.size < 1000) needs = true
      else if (autoUpdate && Date.now() - s.mtimeMs > YTDLP_STALE_MS) needs = true
    } catch {
      needs = true
    }
  }
  if (needs) {
    const url =
      process.platform === 'win32'
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : process.platform === 'darwin'
          ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
          : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
    await downloadFile(url, dest)
    if (process.platform !== 'win32') chmodSync(dest, 0o755)
  }
  return dest
}

async function ensureDeno(): Promise<string | null> {
  const dest = denoPath()
  if (existsSync(dest)) return dest

  if (process.platform !== 'win32' || process.arch !== 'x64') {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('deno', ['--version'], (err) => (err ? reject(err) : resolve()))
      })
      return 'deno'
    } catch {
      return null
    }
  }

  const zipUrl =
    'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip'
  const zipPath = join(binDir(), 'deno.zip')
  await downloadFile(zipUrl, zipPath)

  await new Promise<void>((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Force -Path "${zipPath}" -DestinationPath "${binDir()}"`,
      ],
      (err) => (err ? reject(err) : resolve()),
    )
  })
  await rm(zipPath, { force: true }).catch(() => undefined)
  if (existsSync(dest)) return dest
  return null
}

export async function ensureBinaries(autoUpdate = false) {
  await Promise.all([ensureYtDlp(autoUpdate), ensureDeno()])
}

function runYtDlp(
  binary: string,
  args: string[],
  jobKey = DEFAULT_JOB,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    activeChildren.set(jobKey, proc)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (activeChildren.get(jobKey) === proc) activeChildren.delete(jobKey)
      resolve({ code, stdout, stderr })
    })
  })
}

function jsRuntimeArgs(deno: string | null): string[] {
  if (!deno) return []
  return ['--js-runtimes', deno === 'deno' ? 'deno' : `deno:${deno}`]
}

function baseArgs(
  deno: string | null,
  ffmpeg: string | null,
  isDownload: boolean,
  concurrentFragments = 5,
): string[] {
  const args = [
    '--newline',
    '--no-mtime',
    '--socket-timeout',
    '15',
    '--retries',
    '5',
    ...jsRuntimeArgs(deno),
    ...cookiesArgs(),
  ]
  if (ffmpeg) args.push('--ffmpeg-location', ffmpeg)
  if (isDownload) {
    const n = Math.max(1, Math.min(16, concurrentFragments || 5))
    args.push('--fragment-retries', '5', '--concurrent-fragments', String(n))
  }
  return args
}

function buildQualities(): QualityOption[] {
  return [
    { id: 'best', label: 'Best', height: null, audioOnly: false },
    { id: '1080', label: '1080p', height: 1080, audioOnly: false },
    { id: '720', label: '720p', height: 720, audioOnly: false },
    { id: '480', label: '480p', height: 480, audioOnly: false },
    { id: 'audio', label: 'Audio (MP3)', height: null, audioOnly: true },
  ]
}

function formatSelector(
  height: number | null,
  audioOnly: boolean,
  canMerge: boolean,
  social = false,
): string {
  if (audioOnly) return 'bestaudio/best'
  const h = height ? `[height<=${height}]` : ''
  // TikTok / IG / FB are mostly progressive — soft ladder ends with best / bv*+ba / b.
  if (social || !canMerge) {
    return height
      ? `best[height<=${height}]/bestvideo${h}+bestaudio/best/bv*+ba/b`
      : 'best/bv*+ba/b'
  }
  return [
    `bestvideo${h}[ext=mp4]+bestaudio[ext=m4a]`,
    `bestvideo${h}+bestaudio[ext=m4a]`,
    `bestvideo${h}+bestaudio`,
    height ? `best[height<=${height}]/best` : 'best',
  ].join('/')
}

function looksLikePlaylist(url: string): boolean {
  return (
    /[?&]list=/.test(url) ||
    /\/playlist\b/.test(url) ||
    /\/@/.test(url) ||
    /\/channel\//.test(url) ||
    /\/c\//.test(url) ||
    /\/user\//.test(url)
  )
}

function probeVersion(bin: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(bin, args, { windowsHide: true, timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(null)
        return
      }
      const text = `${stdout}\n${stderr}`.trim()
      const line = text.split(/\r?\n/).find(Boolean) || null
      resolve(line)
    })
  })
}

function shortEngineVersion(raw: string | null): string | null {
  if (!raw) return null
  const line = raw.split(/\r?\n/).find(Boolean)?.trim() || ''
  // yt-dlp prints date like 2026.08.19
  const date = line.match(/\d{4}\.\d{2}\.\d{2}/)
  if (date) return date[0]
  return line.slice(0, 24) || null
}

function shortRuntimeVersion(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/(?:deno\s+)?(\d+\.\d+\.\d+)/i)
  return m ? `Runtime ${m[1]}` : 'Runtime ready'
}

export async function checkDependencies(): Promise<DepsReport> {
  const items: DepStatus[] = []

  const ytPath = existsSync(ytDlpPath()) ? ytDlpPath() : null
  let ytVersion: string | null = null
  if (ytPath) ytVersion = await probeVersion(ytPath, ['--version'])
  const ytOk = Boolean(ytPath && ytVersion)
  items.push({
    id: 'yt-dlp',
    label: 'Downloading Engine',
    ok: ytOk,
    path: null,
    locationHint: ytOk ? 'Local · ready' : 'Needs repair',
    version: shortEngineVersion(ytVersion),
    detail: ytOk ? 'Running' : 'Invalid — reinstall recommended',
  })

  const ffPath = resolveFfmpeg()
  let ffVersion: string | null = null
  if (ffPath) ffVersion = await probeVersion(ffPath, ['-version'])
  const ffOk = Boolean(ffPath && ffVersion)
  items.push({
    id: 'ffmpeg',
    label: 'Processing Studio',
    ok: ffOk,
    path: null,
    locationHint: ffOk ? 'Local · ready' : 'Needs repair',
    version: ffOk ? 'ShiftGrab Process Studio' : null,
    detail: ffOk ? 'Running' : 'Invalid — reinstall recommended',
  })

  let denoBin: string | null = existsSync(denoPath()) ? denoPath() : null
  if (!denoBin) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('deno', ['--version'], { windowsHide: true }, (err) =>
          err ? reject(err) : resolve(),
        )
      })
      denoBin = 'deno'
    } catch {
      denoBin = null
    }
  }
  let denoVersion: string | null = null
  if (denoBin) denoVersion = await probeVersion(denoBin, ['--version'])
  const denoOk = Boolean(denoBin && denoVersion)
  items.push({
    id: 'deno',
    label: 'Challenge Runtime',
    ok: denoOk,
    path: null,
    locationHint: denoOk ? 'Local · ready' : 'Needs repair',
    version: shortRuntimeVersion(denoVersion),
    detail: denoOk ? 'Running' : 'Invalid — reinstall recommended',
  })

  items.push({
    id: 'app',
    label: 'App Core',
    ok: true,
    path: null,
    locationHint: 'Local · ready',
    version: app.getVersion(),
    detail: 'Running',
  })

  return { checkedAt: new Date().toISOString(), items }
}

export async function repairDependencies(): Promise<DepsReport> {
  await ensureYtDlp(true)
  await ensureDeno()
  return checkDependencies()
}

function isYoutube(url: string) {
  return /youtube\.com|youtu\.be/i.test(url)
}

export async function fetchMediaInfo(
  url: string,
  opts?: { social?: boolean },
): Promise<MediaInfo> {
  const clean = url.trim()
  if (!clean) throw new Error('Paste a media URL first.')

  const [yt, deno] = await Promise.all([ensureYtDlp(), ensureDeno()])
  const ffmpeg = resolveFfmpeg()
  const playlist = !opts?.social && isYoutube(clean) && looksLikePlaylist(clean)
  const platform = detectSocialPlatform(clean)

  const args = [
    ...baseArgs(deno, ffmpeg, false),
    ...(opts?.social || platform ? socialExtraArgsFromUrl(clean) : []),
    '--dump-single-json',
    ...(playlist ? ['--flat-playlist'] : ['--no-playlist']),
    clean,
  ]

  const { code, stdout, stderr } = await runYtDlp(yt, args)
  if (code !== 0) {
    const raw = stderr || ''
    if (/Unsupported URL|Falling back on generic/i.test(raw)) {
      throw new Error(
        'This link format is not supported yet. Paste a direct public video/reel URL and try again.',
      )
    }
    if (/ERROR:.*\b(This account is private|Private video)\b/i.test(raw)) {
      throw new Error('This media looks private. Use a public link and try again.')
    }
    if (/HTTP Error (401|403)/i.test(raw) || /login required/i.test(raw)) {
      throw new Error(
        'Platform blocked the public request. Confirm the link is public and try again.',
      )
    }
    throw new Error(friendlyError(raw || `Engine exited with ${code}`))
  }

  const data = JSON.parse(stdout)
  const isPlaylist =
    data._type === 'playlist' || Array.isArray(data.entries) || Boolean(data.playlist_count)

  if (isPlaylist && !opts?.social) {
    const entries = Array.isArray(data.entries) ? data.entries : []
    const kind: MediaInfo['kind'] =
      /\/@|\/channel\/|\/c\/|\/user\//.test(clean) && !/[?&]list=/.test(clean)
        ? 'channel'
        : 'playlist'
    return {
      kind,
      title: data.title || data.playlist_title || 'Playlist',
      author: data.uploader || data.channel || data.extractor || 'Unknown',
      thumbnail:
        data.thumbnails?.[data.thumbnails.length - 1]?.url ||
        entries[0]?.thumbnails?.at(-1)?.url ||
        '',
      durationSeconds: null,
      itemCount: data.playlist_count || entries.length || null,
      url: data.webpage_url || clean,
      qualities: buildQualities(),
    }
  }

  const id = data.id
  const isImage =
    data.ext === 'jpg' ||
    data.ext === 'jpeg' ||
    data.ext === 'png' ||
    data.ext === 'webp' ||
    (data.vcodec === 'none' && data.acodec === 'none')

  const kind: MediaInfo['kind'] = opts?.social
    ? 'social'
    : isYoutube(clean)
      ? 'video'
      : 'social'

  return {
    kind,
    title: data.title || data.fulltitle || 'Media',
    author: data.uploader || data.channel || data.extractor || 'Unknown',
    thumbnail:
      data.thumbnail ||
      (isYoutube(clean) && id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
    durationSeconds: data.duration != null ? Math.round(data.duration) : null,
    itemCount: null,
    url: data.webpage_url || clean,
    qualities: buildQualities(),
    isImage,
  }
}

export async function fetchPlaylistItems(url: string): Promise<PlaylistPage> {
  const clean = url.trim()
  if (!clean) throw new Error('Paste a channel or playlist URL first.')

  const [yt, deno] = await Promise.all([ensureYtDlp(), ensureDeno()])
  const ffmpeg = resolveFfmpeg()
  const args = [
    ...baseArgs(deno, ffmpeg, false),
    '--dump-single-json',
    '--flat-playlist',
    clean,
  ]

  const { code, stdout, stderr } = await runYtDlp(yt, args)
  if (code !== 0) {
    throw new Error(friendlyError(stderr || `Engine exited with ${code}`))
  }

  const data = JSON.parse(stdout)
  const items = mapFlatEntries(data)

  let avatar =
    pickChannelAvatar(data.thumbnails) ||
    pickChannelAvatar(data.channel_thumbnails) ||
    ''
  let banner =
    pickChannelBanner(data.thumbnails) ||
    pickChannelBanner(data.channel_thumbnails) ||
    ''

  const channelUrl =
    (typeof data.channel_url === 'string' && data.channel_url) ||
    (typeof data.uploader_url === 'string' && data.uploader_url) ||
    ''
  if ((!avatar || !banner) && channelUrl) {
    const art = await scrapeYouTubeChannelArt(channelUrl)
    if (!avatar && art.avatar) avatar = art.avatar
    if (!banner && art.banner) banner = art.banner
  }

  // Playlist art fallback: largest playlist thumb, then first video maxres
  if (!banner && Array.isArray(data.thumbnails) && data.thumbnails.length) {
    const sorted = [...data.thumbnails]
      .filter((t: any) => t?.url)
      .sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0))
    if (sorted[0]?.url) banner = String(sorted[0].url)
  }
  if (!banner && items[0]?.thumbnail) {
    banner = String(items[0].thumbnail)
      .replace(/\/(hq|mq|sd)default\.jpg/i, '/maxresdefault.jpg')
      .replace(/\/hq720\.jpg/i, '/maxresdefault.jpg')
  }
  if (!avatar) {
    avatar =
      (typeof data.thumbnail === 'string' ? data.thumbnail : '') ||
      items[0]?.thumbnail ||
      ''
  }

  return {
    title: data.title || data.uploader || 'Channel / Playlist',
    author: data.uploader || data.channel || 'YouTube',
    url: data.webpage_url || clean,
    thumbnail: avatar || items[0]?.thumbnail || '',
    items,
    banner,
    avatar,
  }
}

function mapFlatEntries(data: any): PlaylistItem[] {
  const rawEntries = Array.isArray(data.entries) ? data.entries : []
  return rawEntries
    .map((e: any, i: number) => {
      const videoId = e.id || e.url?.replace(/.*v=/, '') || ''
      if (!videoId) return null
      // Skip nested tab playlists (Videos / Shorts / Live)
      if (e._type === 'playlist' || e.ie_key === 'YoutubeTab') return null
      if (/^(videos|shorts|live|podcasts)$/i.test(String(e.title || '').trim())) return null
      let thumb = ''
      if (Array.isArray(e.thumbnails) && e.thumbnails.length > 0) {
        thumb = e.thumbnails[e.thumbnails.length - 1].url
      }
      if (!thumb && videoId) {
        thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }
      const videoUrl = e.url
        ? e.url.startsWith('http')
          ? e.url
          : `https://www.youtube.com/watch?v=${e.url}`
        : `https://www.youtube.com/watch?v=${videoId}`
      return {
        id: String(videoId),
        title: e.title || 'Untitled',
        url: videoUrl,
        thumbnail: thumb,
        durationSeconds: e.duration != null ? Math.round(e.duration) : null,
        author: e.uploader || e.channel || data.uploader || data.channel || 'YouTube',
        index: i + 1,
      } satisfies PlaylistItem
    })
    .filter(Boolean) as PlaylistItem[]
}

function normalizeChannelBase(url: string): string | null {
  const clean = url.trim()
  const m = clean.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/i,
  )
  if (!m) return null
  return `https://www.youtube.com/${m[1].replace(/\/$/, '')}`
}

function pickChannelAvatar(thumbs: any[] | undefined): string {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return ''
  // Prefer known YouTube channel avatar hosts
  const yt3 = thumbs
    .filter((t) => /yt3\.(ggpht|googleusercontent)\.com/i.test(String(t.url || '')))
    .filter((t) => !/banner|backdrop|tv_/i.test(String(t.id || '') + String(t.url || '')))
  yt3.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))
  if (yt3[0]?.url) return String(yt3[0].url)

  const square = thumbs.filter((t) => {
    const w = Number(t.width) || 0
    const h = Number(t.height) || 0
    const url = String(t.url || '')
    const id = String(t.id || '')
    if (!url) return false
    if (/i\.ytimg\.com|img\.youtube\.com/i.test(url)) return false
    if (/banner|backdrop|tv_|banner_uncropped/i.test(url + id)) return false
    if (w && h && w / Math.max(h, 1) > 1.35) return false
    if (w && (w < 48 || w > 1200)) return false
    return true
  })
  square.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))
  if (square[0]?.url) return square[0].url
  const rest = [...thumbs]
    .filter(
      (t) =>
        t.url &&
        !/banner|backdrop|i\.ytimg/i.test(String(t.url) + String(t.id || '')),
    )
    .sort((a, b) => (Number(a.width) || 9999) - (Number(b.width) || 9999))
  return rest[0]?.url || ''
}

function pickChannelBanner(thumbs: any[] | undefined): string {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return ''
  const wide = thumbs.filter((t) => {
    const w = Number(t.width) || 0
    const h = Number(t.height) || 0
    const url = String(t.url || '')
    const id = String(t.id || '')
    if (!url) return false
    if (/banner|backdrop|tv_/i.test(url + id)) return true
    if (w >= 1000 && h > 0 && w / h >= 2) return true
    return false
  })
  wide.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))
  return wide[0]?.url || ''
}

async function scrapeYouTubeChannelArt(
  channelUrl: string,
): Promise<{ avatar: string; banner: string }> {
  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    }
    // Local cookies only — never uploaded; helps YouTube return full channel HTML.
    try {
      const jar = cookiesFilePath()
      if (existsSync(jar)) {
        const text = readFileSync(jar, 'utf-8')
        const parts: string[] = []
        for (const line of text.split(/\r?\n/)) {
          if (!line || line.startsWith('#')) continue
          const cols = line.split('\t')
          if (cols.length < 7) continue
          parts.push(`${cols[5]}=${cols[6]}`)
        }
        if (parts.length) headers.Cookie = parts.slice(0, 40).join('; ')
      }
    } catch {
      /* ignore */
    }

    const targets = [
      channelUrl.replace(/\/$/, ''),
      `${channelUrl.replace(/\/$/, '')}/about`,
    ]
    let html = ''
    for (const target of targets) {
      const res = await fetch(target, { headers, redirect: 'follow' })
      if (!res.ok) continue
      html = await res.text()
      if (html.length > 5000) break
    }
    if (!html) return { avatar: '', banner: '' }

    const unescape = (s: string) =>
      s
        .replace(/\\u0026/g, '&')
        .replace(/\\u003d/g, '=')
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/&amp;/g, '&')

    const avatarMatch =
      html.match(/"avatar":\{"thumbnails":\s*\[\s*\{"url":\s*"([^"]+)"/) ||
      html.match(/"channelAvatarEditor":\{[^}]*"avatar":\{"thumbnails":\s*\[\s*\{"url":\s*"([^"]+)"/) ||
      html.match(/"channelMetadataRenderer":\{[^}]*"avatar":\{"thumbnails":\s*\[\s*\{"url":\s*"([^"]+)"/) ||
      html.match(/property="og:image"\s+content="([^"]+)"/i)

    const bannerMatch =
      html.match(/"banner":\{"thumbnails":\s*\[[^\]]*"url":\s*"([^"]+)"/) ||
      html.match(/"headerBanner"[^]*?"thumbnails":\s*\[[^\]]*"url":\s*"([^"]+)"/) ||
      html.match(/"tvBanner":\{"thumbnails":\s*\[[^\]]*"url":\s*"([^"]+)"/)

    let avatar = avatarMatch?.[1] ? unescape(avatarMatch[1]) : ''
    let banner = bannerMatch?.[1] ? unescape(bannerMatch[1]) : ''

    // Harvest all yt3 URLs from the page and classify
    const yt3 = new Set<string>()
    const reEsc = /https:\\\/\\\/yt3\.(?:ggpht|googleusercontent)\.com\\\/[^"\\]+/g
    const rePlain = /https:\/\/yt3\.(?:ggpht|googleusercontent)\.com\/[^\s"'\\<>]+/g
    for (const m of html.matchAll(reEsc)) yt3.add(unescape(m[0]))
    for (const m of html.matchAll(rePlain)) yt3.add(m[0].replace(/&amp;/g, '&'))

    const isBannerUrl = (u: string) =>
      /fcrop64|banner|backdrop|w\d{3,4}-fcrop|w2560|w1280|w1060/i.test(u)
    const isAvatarUrl = (u: string) =>
      !isBannerUrl(u) && (/=s\d{2,4}-/i.test(u) || /\/s\d{2,4}-/i.test(u) || /yt3\./i.test(u))

    if (!banner) {
      const banners = [...yt3].filter(isBannerUrl)
      banners.sort((a, b) => b.length - a.length)
      if (banners[0]) banner = banners[0]
    }
    if (!avatar) {
      const avatars = [...yt3].filter(isAvatarUrl)
      // Prefer larger =sNNN
      avatars.sort((a, b) => {
        const sa = Number((a.match(/=s(\d+)/) || a.match(/\/s(\d+)/) || [])[1] || 0)
        const sb = Number((b.match(/=s(\d+)/) || b.match(/\/s(\d+)/) || [])[1] || 0)
        return sb - sa
      })
      if (avatars[0]) avatar = avatars[0]
    }

    if (avatar && /yt3\./i.test(avatar)) {
      avatar = avatar.replace(/=s\d+-/, '=s800-').replace(/\/s\d+-c?/, '/s800-c')
    }
    if (avatar && isBannerUrl(avatar) && !banner) {
      banner = avatar
      avatar = ''
    }
    if (avatar && banner && avatar === banner) avatar = ''
    return { avatar, banner }
  } catch {
    return { avatar: '', banner: '' }
  }
}

function pickThumb(thumbs: any[] | undefined, preferWide = false): string {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return ''
  if (preferWide) return pickChannelBanner(thumbs)
  return pickChannelAvatar(thumbs)
}

export async function fetchChannelLibrary(url: string): Promise<ChannelLibrary> {
  const clean = url.trim()
  if (!clean) throw new Error('Paste a channel or playlist URL first.')

  const [yt, deno] = await Promise.all([ensureYtDlp(), ensureDeno()])
  const ffmpeg = resolveFfmpeg()

  // Playlist URL → single list in Videos tab
  if (/[?&]list=/.test(clean) || /\/playlist\b/i.test(clean)) {
    const page = await fetchPlaylistItems(clean)
    return {
      title: page.title,
      author: page.author,
      url: page.url,
      description: '',
      banner: page.banner || page.thumbnail || '',
      avatar: page.avatar || page.thumbnail || '',
      followerCount: null,
      videos: page.items,
      shorts: [],
      isPlaylist: true,
    }
  }

  const base = normalizeChannelBase(clean) || clean.replace(/\/(videos|shorts|streams|featured)\/?$/i, '')

  async function dumpFlat(target: string) {
    const args = [
      ...baseArgs(deno, ffmpeg, false),
      '--dump-single-json',
      '--flat-playlist',
      target,
    ]
    const { code, stdout, stderr } = await runYtDlp(yt, args)
    if (code !== 0) {
      throw new Error(friendlyError(stderr || `Engine exited with ${code}`))
    }
    return JSON.parse(stdout)
  }

  async function dumpChannelMeta(target: string) {
    // Prefer /about or a single non-flat item so real avatar + banner thumbs exist.
    const tries = [`${target}/about`, target]
    for (const u of tries) {
      const args = [
        ...baseArgs(deno, ffmpeg, false),
        '--dump-single-json',
        '--playlist-items',
        '1',
        u,
      ]
      const { code, stdout } = await runYtDlp(yt, args)
      if (code !== 0 || !stdout.trim()) continue
      try {
        return JSON.parse(stdout)
      } catch {
        continue
      }
    }
    return dumpFlat(target)
  }

  const meta = await dumpChannelMeta(base)
  let videos: PlaylistItem[] = []
  let shorts: PlaylistItem[] = []
  let videosMeta: any = null
  try {
    videosMeta = await dumpFlat(`${base}/videos`)
    videos = mapFlatEntries(videosMeta).map((item, i) => ({ ...item, index: i + 1 }))
  } catch {
    videos = mapFlatEntries(meta)
  }
  try {
    const sData = await dumpFlat(`${base}/shorts`)
    shorts = mapFlatEntries(sData).map((item, i) => ({ ...item, index: i + 1 }))
  } catch {
    shorts = []
  }

  const thumbPools = [
    meta.thumbnails,
    meta.channel_thumbnails,
    videosMeta?.thumbnails,
    videosMeta?.channel_thumbnails,
  ]
  let banner =
    pickChannelBanner(meta.thumbnails) ||
    pickChannelBanner(meta.channel_thumbnails) ||
    pickChannelBanner(videosMeta?.thumbnails) ||
    (typeof meta.channel_banner === 'string' ? meta.channel_banner : '') ||
    ''
  let avatar =
    pickChannelAvatar(meta.thumbnails) ||
    pickChannelAvatar(meta.channel_thumbnails) ||
    pickChannelAvatar(videosMeta?.thumbnails) ||
    ''

  if (!avatar && videos[0]?.url) {
    try {
      const args = [
        ...baseArgs(deno, ffmpeg, false),
        '--dump-single-json',
        '--no-playlist',
        videos[0].url,
      ]
      const { code, stdout } = await runYtDlp(yt, args)
      if (code === 0 && stdout.trim()) {
        const vid = JSON.parse(stdout)
        avatar =
          pickChannelAvatar(vid.channel_thumbnails) ||
          pickChannelAvatar(vid.thumbnails?.filter((t: any) =>
            /yt3\.|googleusercontent/i.test(String(t.url || '')),
          )) ||
          avatar
      }
    } catch {
      /* ignore */
    }
  }

  for (const pool of thumbPools) {
    if (!avatar) avatar = pickChannelAvatar(pool)
    if (!banner) banner = pickChannelBanner(pool)
  }

  if (!avatar || !banner) {
    const art = await scrapeYouTubeChannelArt(base)
    if (!avatar && art.avatar) avatar = art.avatar
    if (!banner && art.banner) banner = art.banner
  }

  if (typeof meta.thumbnail === 'string' && !avatar && !/banner/i.test(meta.thumbnail)) {
    avatar = meta.thumbnail
  }
  // Widest leftover thumb as banner fallback
  if (!banner) {
    const all = [...(meta.thumbnails || []), ...(videosMeta?.thumbnails || [])]
    const widest = [...all].sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0]
    if (widest?.url && widest.url !== avatar) banner = widest.url
  }
  if (avatar && banner && avatar === banner) avatar = ''

  const channelWatchUrl =
    meta.channel_url ||
    meta.uploader_url ||
    videosMeta?.channel_url ||
    videosMeta?.uploader_url ||
    meta.webpage_url ||
    base
  const youtubeUrl = /^https?:\/\//i.test(channelWatchUrl)
    ? channelWatchUrl
    : `https://www.youtube.com/${String(channelWatchUrl).replace(/^\//, '')}`

  return {
    title: meta.channel || meta.uploader || videosMeta?.channel || meta.title || 'Channel',
    author: meta.uploader || meta.channel || videosMeta?.uploader || 'YouTube',
    url: youtubeUrl,
    description: meta.description || meta.channel_description || '',
    banner,
    avatar,
    followerCount:
      meta.channel_follower_count != null
        ? Number(meta.channel_follower_count)
        : meta.subscriber_count != null
          ? Number(meta.subscriber_count)
          : videosMeta?.channel_follower_count != null
            ? Number(videosMeta.channel_follower_count)
            : null,
    videos,
    shorts,
    isPlaylist: false,
  }
}

function sanitizeSocialUrl(url: string): string {
  let clean = url.trim()
  // Fix glued paths like .../reelsfacebook from bad paste/concat
  clean = clean.replace(/\/reels(?=[a-z])/i, '/')
  clean = clean.replace(/\/+/g, '/').replace(/^(https?:\/)(?!\/)/i, '$1/')
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`
  clean = clean.replace(/^http:\/\//i, 'https://')
  return clean.replace(/\/+$/, '')
}

function normalizeSocialTarget(
  url: string,
  platform: SocialPlatform,
  mode: SocialProfileMode,
): string[] {
  const clean = sanitizeSocialUrl(url)
  const out: string[] = []
  const push = (u: string) => {
    const t = u.replace(/\/+$/, '') || u
    if (t && !out.includes(t) && !out.includes(`${t}/`)) out.push(t)
  }

  if (platform === 'facebook') {
    // /reels tab is unsupported by the engine — never lead with it.
    let path = clean
      .replace(/^https?:\/\/(www\.|m\.|web\.)?facebook\.com/i, '')
      .replace(/\/+$/, '')
    path = path.replace(/\/(reels|videos|photos|about|posts|reel)\/?$/i, '')
    const slug = path.replace(/^\//, '').split('/')[0] || ''
    if (slug && !['watch', 'reel', 'share', 'groups', 'events'].includes(slug.toLowerCase())) {
      push(`https://www.facebook.com/${slug}`)
      push(`https://www.facebook.com/${slug}/videos`)
      push(`https://m.facebook.com/${slug}`)
      push(`https://www.facebook.com/${slug}/videos/?ref=page_internal`)
    } else {
      push(clean.replace(/\/(reels|reel)\/?$/i, ''))
      push(clean)
    }
    return out
  }

  if (platform === 'tiktok') {
    const at = clean.match(/tiktok\.com\/(@[\w.-]+)/i)
    if (at) {
      push(`https://www.tiktok.com/${at[1]}`)
      push(`https://www.tiktok.com/${at[1]}/video`)
      return out
    }
    const bare = clean.match(/tiktok\.com\/([\w.-]+)/i)
    if (bare && !['foryou', 'following', 'live', 'explore', 'tag'].includes(bare[1].toLowerCase())) {
      push(`https://www.tiktok.com/@${bare[1]}`)
      return out
    }
    if (clean.startsWith('@')) {
      push(`https://www.tiktok.com/${clean}`)
      return out
    }
    push(clean)
    return out
  }

  // Instagram — profile root first; /reels/ often falls to generic extractor
  const ig = clean.match(/instagram\.com\/([^/?#]+)/i)
  if (ig) {
    const user = ig[1].replace(/^@/, '')
    if (['reels', 'explore', 'stories', 'direct', 'accounts', 'p', 'reel'].includes(user.toLowerCase())) {
      push(clean)
      return out
    }
    const root = `https://www.instagram.com/${user}/`
    push(root)
    if (mode === 'reels') push(`${root}reels/`)
    if (mode === 'images') push(root)
    return out
  }
  push(clean)
  return out
}

function socialExtraArgs(platform: SocialPlatform): string[] {
  const chrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  if (platform === 'tiktok') {
    return ['--user-agent', chrome, '--referer', 'https://www.tiktok.com/']
  }
  if (platform === 'instagram') {
    return [
      '--user-agent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      '--referer',
      'https://www.instagram.com/',
    ]
  }
  if (platform === 'facebook') {
    return ['--user-agent', chrome, '--referer', 'https://www.facebook.com/']
  }
  return []
}

function detectSocialPlatform(url: string): SocialPlatform | null {
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/instagram\.com/i.test(url)) return 'instagram'
  if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook'
  return null
}

function socialExtraArgsFromUrl(url: string): string[] {
  const p = detectSocialPlatform(url)
  return p ? socialExtraArgs(p) : []
}

function isHardAuthBlock(stderr: string): boolean {
  // Only real private/login walls — not WARNING cookie hints or generic 403 bot blocks.
  return /ERROR:.*\b(This account is private|Private video|login required|sign in to (continue|confirm)|You must (be )?log(ged)? ?in)\b/i.test(
    stderr,
  )
}

export async function fetchSocialProfile(
  url: string,
  opts: { platform: SocialPlatform; mode?: SocialProfileMode },
): Promise<SocialProfile> {
  const platform = opts.platform
  const mode: SocialProfileMode =
    opts.mode ||
    (platform === 'instagram' ? 'reels' : platform === 'facebook' ? 'videos' : 'videos')

  const clean = url.trim()
  if (!clean) throw new Error('Paste a profile URL first.')

  const candidates = normalizeSocialTarget(clean, platform, mode)
  const [yt, deno] = await Promise.all([ensureYtDlp(), ensureDeno()])
  const ffmpeg = resolveFfmpeg()

  let data: any = null
  let lastError = 'Could not read this profile.'
  let usedTarget = candidates[0]
  let sawAuthHint = false

  for (const target of candidates) {
    usedTarget = target
    const args = [
      ...baseArgs(deno, ffmpeg, false),
      ...socialExtraArgs(platform),
      '--dump-single-json',
      '--flat-playlist',
      '--yes-playlist',
      '--playlist-end',
      '200',
      target,
    ]
    const { code, stdout, stderr } = await runYtDlp(yt, args)
    if (code === 0) {
      try {
        data = JSON.parse(stdout)
        break
      } catch {
        lastError = 'Could not read profile library.'
        continue
      }
    }
    const raw = stderr || ''
    if (isHardAuthBlock(raw)) {
      sawAuthHint = true
      lastError =
        'This profile looks private. Use a public page/profile URL and try again.'
      continue
    }
    if (/Unsupported URL|Falling back on generic/i.test(raw)) {
      lastError = `Use the main public ${platform} profile URL (not a /reels tab).`
      continue
    }
    if (/HTTP Error (401|403)/i.test(raw)) {
      lastError = `${platform} blocked the public request. Confirm the profile is public and try again.`
      continue
    }
    lastError = friendlyError(raw || `Engine exited with ${code}`)
  }

  if (!data) {
    if (sawAuthHint && candidates.length <= 1) throw new Error(lastError)
    throw new Error(lastError)
  }

  let items = mapFlatEntries(data).map((item, i) => ({ ...item, index: i + 1 }))

  if (platform === 'instagram' && mode === 'images') {
    const filtered = items.filter((it) => {
      const t = `${it.title} ${it.url}`.toLowerCase()
      return !/\/reel\//i.test(it.url) && !/\breel\b/i.test(t)
    })
    if (filtered.length) items = filtered.map((item, i) => ({ ...item, index: i + 1 }))
  }
  if (platform === 'instagram' && mode === 'reels') {
    const filtered = items.filter((it) => /\/reel\//i.test(it.url) || /reel/i.test(it.title))
    // If filter empties (profile dump mixes types), keep all rather than fail
    if (filtered.length) items = filtered.map((item, i) => ({ ...item, index: i + 1 }))
  }

  if (items.length === 0) {
    throw new Error(
      'No items found. Confirm the profile is public and paste the main profile URL.',
    )
  }

  const avatar =
    pickChannelAvatar(data.thumbnails) ||
    (typeof data.thumbnail === 'string' ? data.thumbnail : '') ||
    items[0]?.thumbnail ||
    ''

  return {
    platform,
    mode,
    title: data.channel || data.uploader || data.title || data.playlist_title || 'Profile',
    author: data.uploader || data.channel || data.creator || platform,
    url: data.webpage_url || data.channel_url || usedTarget,
    avatar,
    description: data.description || '',
    items,
  }
}

function friendlyError(raw: string): string {
  const scrubbed = raw
    .replace(/Error invoking remote method '[^']+':\s*/gi, '')
    .replace(/^Error:\s*/i, '')
    .replace(/yt-?dlp/gi, 'engine')
    .replace(/ffmpeg/gi, 'studio')
    .replace(/\bdeno\b/gi, 'runtime')
  if (
    /getaddrinfo failed|ENOTFOUND|EAI_AGAIN|Failed to resolve|Name or service not known|Temporary failure in name resolution/i.test(
      scrubbed,
    )
  ) {
    return 'No internet (DNS failed). Connect Wi‑Fi/Ethernet and try again.'
  }
  if (/ENETUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network is unreachable|Offline/i.test(scrubbed)) {
    return 'No internet connection. ShiftGrab needs the web to fetch video info.'
  }
  if (/Sign in to confirm you(?:'re| are) not a bot/i.test(scrubbed)) {
    return 'YouTube wants a login. Open Settings → Sign in to YouTube.'
  }
  if (
    /Playlists that require authentication|successful webpage download|Unable to download webpage|channel does not exist|does not exist|HTTP Error 404|Unsupported URL|Unable to extract|youtube:tab|No video formats|not a valid URL|Incomplete YouTube ID/i.test(
      scrubbed,
    )
  ) {
    return 'Wrong link or this channel isn’t available. Check the URL and try again.'
  }
  if (/Requested format is not available/i.test(scrubbed)) {
    return 'This quality isn’t available. Try Best quality or another link.'
  }
  if (/HTTP Error 429/i.test(scrubbed)) {
    return 'YouTube rate-limited the request. Wait a few minutes and retry.'
  }
  if (/n challenge|JS runtime|challenge solver/i.test(scrubbed)) {
    return 'YouTube challenge solver failed. Repair Challenge Runtime in Dependencies.'
  }
  if (/Unable to rename|WinError 32|being used by another process|EBUSY|EPERM/i.test(scrubbed)) {
    return 'File was still locked while finishing. Close any preview of the file and try again.'
  }
  const cleaned = scrubbed
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const last = lines.slice(-1)[0] || 'Something went wrong.'
  return last.length > 120 ? `${last.slice(0, 117)}…` : last
}

/** Export for IPC wrappers / renderer scrubbing */
export function toUserError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '')
  return friendlyError(raw)
}

function parsePercent(line: string): number | null {
  const m = line.match(/\[download\]\s+([\d.]+)%/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

function parseSpeed(line: string): string | undefined {
  const m = line.match(/\[download\]\s+[\d.]+%\s+of\s+\S+\s+at\s+(\S+)/i)
  return m?.[1]
}

export function cancelJob(jobId: string) {
  cancelFlags.add(jobId)
  const proc = activeChildren.get(jobId)
  if (proc) killProc(proc)
  activeChildren.delete(jobId)
}

export function cancelDownload() {
  cancelFlags.add(DEFAULT_JOB)
  for (const [id, proc] of activeChildren) {
    cancelFlags.add(id)
    killProc(proc)
  }
  activeChildren.clear()
}

export async function downloadMedia(
  request: DownloadRequest,
  onProgress: (p: DownloadProgress) => void,
): Promise<{ filePath: string }> {
  const jobKey = request.jobId || DEFAULT_JOB
  cancelFlags.delete(jobKey)

  const [yt, deno] = await Promise.all([ensureYtDlp(), ensureDeno()])
  const ffmpeg = resolveFfmpeg()
  const canMerge = Boolean(ffmpeg)
  const fragments = request.concurrentFragments ?? 5

  await access(request.saveDir).catch(async () => {
    await mkdir(request.saveDir, { recursive: true })
  })

  const workDir = join(
    downloadCacheRoot(),
    `${(request.jobId || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'job'}`,
  )
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  await mkdir(workDir, { recursive: true })

  // Short ASCII names in hidden cache — final pretty names restored after promote when possible
  const isCollection = request.kind === 'playlist' || request.kind === 'channel'
  const outTemplate = isCollection
    ? join(workDir, '%(playlist_index)03d-%(id)s.%(ext)s')
    : join(workDir, '%(id)s.%(ext)s')

  const isSocial = request.kind === 'social' || request.kind === 'bulk'
  const format = formatSelector(request.height, request.audioOnly, canMerge, isSocial)
  const args = [
    ...baseArgs(deno, ffmpeg, true, fragments),
    ...(isSocial ? socialExtraArgsFromUrl(request.url) : []),
    '--force-overwrites',
    '-f',
    format
  ]

  if (request.audioOnly && canMerge) {
    args.push('-x', '--audio-format', 'mp3')
  } else if (!request.audioOnly && canMerge && !request.kind) {
    args.push('--merge-output-format', 'mp4')
  } else if (!request.audioOnly && canMerge) {
    args.push('--merge-output-format', 'mp4')
  }

  if (request.kind === 'video' || request.kind === 'social' || request.kind === 'bulk') {
    args.push('--no-playlist')
  }

  if (request.playlistItems) {
    args.push('--playlist-items', request.playlistItems)
  }

  if (request.saveDescription) {
    args.push('--write-description')
  }
  if (request.extractTranscript) {
    args.push(
      '--write-auto-subs',
      '--write-subs',
      '--sub-langs',
      'en.*,en',
      '--convert-subs',
      'vtt',
      '--skip-unavailable-fragments',
    )
  }

  // After download percent hits high, report finalizing before exit.
  onProgress({ percent: 0, status: 'downloading', jobId: request.jobId })

  const attempts: string[][] = [
    [...args, '-o', outTemplate, request.url],
    [
      ...args,
      '--extractor-args',
      'youtube:player_client=tv,web_embedded',
      '-o',
      outTemplate,
      request.url,
    ],
  ]

  let lastError = 'Download failed.'
  let softBestAdded = false

  try {
    for (let i = 0; i < attempts.length; i++) {
      const attemptArgs = attempts[i]
      if (cancelFlags.has(jobKey)) throw new Error('Cancelled.')

      const result = await new Promise<{ ok: boolean; error?: string; rawStderr?: string }>((resolve) => {
        const proc = spawn(yt, attemptArgs, {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        activeChildren.set(jobKey, proc)
        const stderr: string[] = []
        let maxPercent = 0

        proc.stdout.on('data', (buf: Buffer) => {
          for (const line of buf.toString().split('\n')) {
            if (
              line.includes('[Merger]') ||
              line.includes('[ExtractAudio]') ||
              /\[ffmpeg\]/i.test(line) ||
              /Deleting original/i.test(line)
            ) {
              onProgress({
                percent: Math.max(maxPercent, 98),
                status: 'merging',
                message: 'Finalizing',
                jobId: request.jobId,
              })
              continue
            }
            const item = line.match(
              /\[download\]\s+Downloading\s+(?:item|video)\s+(\d+)\s+of\s+(\d+)/i,
            )
            const speed = parseSpeed(line)
            const percent = parsePercent(line)
            if (percent != null) {
              maxPercent = Math.max(maxPercent, percent)
              const finalizing = maxPercent >= 99.5
              onProgress({
                percent: maxPercent,
                speed,
                status: finalizing ? 'merging' : 'downloading',
                message: finalizing ? 'Finalizing' : undefined,
                currentItem: item ? parseInt(item[1], 10) : undefined,
                totalItems: item ? parseInt(item[2], 10) : undefined,
                jobId: request.jobId,
              })
            } else if (item) {
              onProgress({
                percent: maxPercent,
                status: 'downloading',
                currentItem: parseInt(item[1], 10),
                totalItems: parseInt(item[2], 10),
                jobId: request.jobId,
              })
            }
          }
        })

        proc.stderr.on('data', (buf: Buffer) => {
          stderr.push(buf.toString())
        })

        proc.on('error', (err) => {
          if (activeChildren.get(jobKey) === proc) activeChildren.delete(jobKey)
          resolve({ ok: false, error: err.message, rawStderr: stderr.join('\n') })
        })

        proc.on('close', (code) => {
          if (activeChildren.get(jobKey) === proc) activeChildren.delete(jobKey)
          if (cancelFlags.has(jobKey)) {
            resolve({ ok: false, error: 'Cancelled.', rawStderr: stderr.join('\n') })
            return
          }
          if (code === 0) {
            resolve({ ok: true, rawStderr: stderr.join('\n') })
          } else {
            const raw = stderr.join('\n')
            resolve({ ok: false, error: friendlyError(raw), rawStderr: raw })
          }
        })
      })

      if (result.ok) {
        onProgress({
          percent: 99,
          status: 'merging',
          message: 'Saving to Downloads',
          jobId: request.jobId,
        })
        try {
          const moved = await promoteCacheToSaveDir(workDir, request.saveDir)
          onProgress({ percent: 100, status: 'done', jobId: request.jobId })
          return { filePath: moved[0] || request.saveDir }
        } catch (err) {
          lastError = friendlyError(err instanceof Error ? err.message : String(err))
          throw new Error(lastError)
        }
      }
      lastError = result.error || lastError
      if (lastError === 'Cancelled.') throw new Error(lastError)

      const rawBlob = `${result.rawStderr || ''}\n${result.error || ''}`
      if (!softBestAdded && /Requested format is not available/i.test(rawBlob)) {
        softBestAdded = true
        const softArgs = [...args]
        const fi = softArgs.indexOf('-f')
        if (fi >= 0) softArgs[fi + 1] = 'best'
        else softArgs.push('-f', 'best')
        attempts.push([...softArgs, '-o', outTemplate, request.url])
      }
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }

  throw new Error(lastError)
}
