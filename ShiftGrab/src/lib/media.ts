export function youtubeThumb(urlOrId: string | undefined | null): string {
  if (!urlOrId) return ''
  if (/^https?:\/\/i\.ytimg\.com\//i.test(urlOrId)) return urlOrId
  if (/^https?:\/\/.*\.(jpg|jpeg|png|webp)/i.test(urlOrId)) return urlOrId
  const idMatch = urlOrId.match(
    /(?:v=|youtu\.be\/|shorts\/|embed\/|\/vi\/)([a-zA-Z0-9_-]{6,})/,
  )
  const bare = /^[a-zA-Z0-9_-]{6,}$/.test(urlOrId) ? urlOrId : idMatch?.[1]
  if (bare) return `https://i.ytimg.com/vi/${bare}/hqdefault.jpg`
  return ''
}
