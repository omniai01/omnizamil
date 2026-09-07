export function displayVersion(item: {
  id: string
  version: string | null
  label: string
}) {
  if (item.id === 'ffmpeg') return 'ShiftGrab Process Studio'
  const v = item.version || ''
  if (/gyan|ffmpeg|essentials_build|copyright/i.test(v)) return 'ShiftGrab Process Studio'
  if (item.id === 'deno') {
    const m = v.match(/(\d+\.\d+\.\d+)/)
    return m ? `Runtime ${m[1]}` : 'Challenge Runtime'
  }
  if (item.id === 'yt-dlp') {
    const m = v.match(/\d{4}\.\d{2}\.\d{2}/)
    return m ? m[0] : 'Downloading Engine'
  }
  if (item.id === 'app') return v || '1.1.0'
  return v || '—'
}
