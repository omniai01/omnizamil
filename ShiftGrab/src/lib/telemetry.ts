import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null
let lastTelemetryError = ''

export function getTelemetryError() {
  return lastTelemetryError
}

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) {
    lastTelemetryError = 'Cloud not configured (missing VITE_SUPABASE_URL / key).'
    return null
  }
  if (!client) client = createClient(url, anon, { auth: { persistSession: false } })
  return client
}

export type RegisterPayload = {
  hwid: string
  displayName: string
  os?: string
  cpu?: string
  ramGb?: number
  gpu?: string
  appVersion?: string
}

async function detectCountry(): Promise<{ country: string; countryCode: string }> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || ''
  const parts = locale.split(/[-_]/)
  const fromLocale = (parts[1] || '').toUpperCase()
  let code = ''

  if (/Karachi|Pakistan/i.test(tz)) code = 'PK'
  else if (/Kolkata|Calcutta|India/i.test(tz)) code = 'IN'
  else if (/Dubai|Muscat/i.test(tz)) code = 'AE'
  else if (/Riyadh/i.test(tz)) code = 'SA'
  else if (/Dhaka/i.test(tz)) code = 'BD'
  else if (/London/i.test(tz)) code = 'GB'
  else if (/New_York|Chicago|Los_Angeles|Denver|Toronto|Vancouver/i.test(tz)) code = 'US'
  else if (fromLocale.length === 2) {
    if (!(fromLocale === 'US' && /^Asia\//i.test(tz))) code = fromLocale
  }

  const names: Record<string, string> = {
    PK: 'Pakistan',
    IN: 'India',
    US: 'United States',
    GB: 'United Kingdom',
    AE: 'United Arab Emirates',
    SA: 'Saudi Arabia',
    BD: 'Bangladesh',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
  }

  if (!code) {
    return { country: tz ? tz.split('/').pop() || 'Unknown' : 'Unknown', countryCode: '' }
  }
  return { country: names[code] || code, countryCode: code }
}

export function detectPlatform(url: string): string {
  const u = (url || '').toLowerCase()
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
  if (/tiktok\.com/.test(u)) return 'tiktok'
  if (/instagram\.com/.test(u)) return 'instagram'
  if (/facebook\.com|fb\.watch/.test(u)) return 'facebook'
  if (/twitter\.com|x\.com/.test(u)) return 'twitter'
  if (/vimeo\.com/.test(u)) return 'vimeo'
  return 'other'
}

export async function registerDevice(
  payload: RegisterPayload,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: lastTelemetryError || 'No Supabase client' }
  if (!payload.hwid) return { ok: false, error: 'Missing hardware ID' }

  const geo = await detectCountry()
  const row = {
    hwid: payload.hwid,
    display_name: payload.displayName || '',
    user_alias: payload.displayName || '',
    os: payload.os || navigator.platform || '',
    cpu: payload.cpu || `${navigator.hardwareConcurrency || 0} cores`,
    ram_gb: payload.ramGb ?? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0,
    gpu: payload.gpu || '',
    app_version: payload.appVersion || '1.1.0',
    country: geo.country,
    country_code: geo.countryCode,
    status: 'active',
    last_ping: new Date().toISOString(),
  }

  const { data: existing } = await sb
    .from('og_devices')
    .select('hwid')
    .eq('hwid', payload.hwid)
    .maybeSingle()

  const { error } = await sb.from('og_devices').upsert(row, { onConflict: 'hwid' })
  if (error) {
    lastTelemetryError = error.message
    return { ok: false, error: error.message }
  }
  lastTelemetryError = ''
  if (!existing) {
    await sb.from('og_usage_events').insert({
      hwid: payload.hwid,
      event_type: 'register',
      meta: { displayName: payload.displayName, country: geo.country },
    })
  }
  return { ok: true }
}

export async function heartbeatDevice(
  hwid: string,
  displayName?: string,
  youtubeLinked?: boolean,
) {
  const sb = getSupabase()
  if (!sb || !hwid) return
  const patch: Record<string, unknown> = {
    last_ping: new Date().toISOString(),
    status: 'active',
    ...(displayName ? { display_name: displayName, user_alias: displayName } : {}),
  }
  if (typeof youtubeLinked === 'boolean') {
    patch.youtube_linked = youtubeLinked
    if (youtubeLinked) patch.youtube_linked_at = new Date().toISOString()
  }
  const { error } = await sb.from('og_devices').update(patch).eq('hwid', hwid)
  if (error) {
    // Column not migrated yet — don't spam UI with schema cache noise
    if (/youtube_linked/i.test(error.message)) {
      if (typeof youtubeLinked === 'boolean') {
        const { error: retry } = await sb
          .from('og_devices')
          .update({
            last_ping: patch.last_ping,
            status: 'active',
            ...(displayName ? { display_name: displayName, user_alias: displayName } : {}),
          })
          .eq('hwid', hwid)
        if (retry) lastTelemetryError = retry.message
        return
      }
      return
    }
    lastTelemetryError = error.message
  }
}

/** Report only linked / not linked — never email, password, or cookies. */
export async function reportYoutubeLinked(hwid: string, linked: boolean) {
  const sb = getSupabase()
  if (!sb || !hwid) return
  const patch: Record<string, unknown> = {
    youtube_linked: linked,
    last_ping: new Date().toISOString(),
  }
  if (linked) patch.youtube_linked_at = new Date().toISOString()
  const { error } = await sb.from('og_devices').update(patch).eq('hwid', hwid)
  if (error) {
    if (/youtube_linked|schema cache/i.test(error.message)) return
    lastTelemetryError = error.message
  }
}

export async function reportDownload(opts: {
  hwid: string
  url: string
  success: boolean
  elapsedMs: number
  audioOnly?: boolean
  displayName?: string
  errorMessage?: string
}) {
  const sb = getSupabase()
  if (!sb || !opts.hwid) return
  const platform = detectPlatform(opts.url)
  const media = opts.audioOnly ? 'audio' : 'video'
  const meta = {
    platform,
    url: opts.url.slice(0, 300),
    error: opts.errorMessage?.slice(0, 400) || null,
  }

  const { error } = await sb.rpc('og_bump_download', {
    p_hwid: opts.hwid,
    p_media: media,
    p_success: opts.success,
    p_elapsed_ms: Math.round(opts.elapsedMs),
    p_bytes: 0,
    p_display_name: opts.displayName || null,
    p_platform: platform,
    p_meta: meta,
  })
  if (!error) return

  // Fallback when RPCs not applied yet
  lastTelemetryError = error.message
  console.warn('[omnigrab] reportDownload rpc', error.message)

  await sb.from('og_usage_events').insert({
    hwid: opts.hwid,
    event_type: opts.success ? 'download' : 'fail',
    media_type: media,
    success: opts.success,
    elapsed_ms: Math.round(opts.elapsedMs),
    meta,
  })

  const { data } = await sb
    .from('og_devices')
    .select('image_count, video_count, fail_count, total_process_ms, bytes_processed')
    .eq('hwid', opts.hwid)
    .maybeSingle()

  if (!data) {
    await registerDevice({
      hwid: opts.hwid,
      displayName: opts.displayName || '',
    })
  }

  const patch: Record<string, unknown> = {
    last_ping: new Date().toISOString(),
    status: 'active',
    total_process_ms: (data?.total_process_ms || 0) + Math.round(opts.elapsedMs),
  }
  if (opts.displayName) {
    patch.display_name = opts.displayName
    patch.user_alias = opts.displayName
  }
  if (opts.success) {
    patch.image_count = (data?.image_count || 0) + 1
    if (media === 'video') patch.video_count = (data?.video_count || 0) + 1
  } else {
    patch.fail_count = (data?.fail_count || 0) + 1
  }
  await sb.from('og_devices').update(patch).eq('hwid', opts.hwid)
}

export async function reportError(opts: {
  hwid: string
  displayName?: string
  errorType: string
  message: string
  stackTrace?: string
  severity?: 'critical' | 'warning' | 'info'
}) {
  const sb = getSupabase()
  if (!sb || !opts.hwid) return
  await sb.from('og_error_logs').insert({
    hwid: opts.hwid,
    user_alias: opts.displayName || '',
    error_type: opts.errorType,
    message: opts.message.slice(0, 4000),
    stack_trace: (opts.stackTrace || '').slice(0, 8000),
    severity: opts.severity || 'warning',
    status: 'open',
  })
}

export type RemoteAppSettings = {
  maintenance_enabled: boolean
  maintenance_message: string
  affect_all_devices: boolean
  allowed_hwids: string[] | null
  lock_engine: boolean
  force_update: boolean
  latest_version: string
  update_url: string
  update_message: string
  brand_website_url?: string
  brand_name?: string
  brand_tagline?: string
  brand_about?: string
  brand_logo_url?: string
  social_links?: Record<string, string> | null
  maintenance_duration_minutes?: number
  maintenance_started_at?: string | null
}

export type RemoteStatus = {
  settings: RemoteAppSettings | null
  deviceStatus?: string
  locked: boolean
  updateNeeded: boolean
  maintenanceEndsAt: string | null
}

export type ClientNotification = {
  id: string
  title: string
  body: string
  target_hwid: string | null
  created_at: string
}

function maintenanceStillActive(s: RemoteAppSettings | null, hwid: string): {
  locked: boolean
  endsAt: string | null
} {
  if (!s?.maintenance_enabled) return { locked: false, endsAt: null }
  const allowed = (s.allowed_hwids || []).includes(hwid)
  if (allowed) return { locked: false, endsAt: null }
  const mins = Number(s.maintenance_duration_minutes) || 0
  const started = s.maintenance_started_at ? new Date(s.maintenance_started_at).getTime() : 0
  if (mins > 0 && started > 0) {
    const ends = started + mins * 60_000
    if (Date.now() >= ends) return { locked: false, endsAt: new Date(ends).toISOString() }
    return { locked: true, endsAt: new Date(ends).toISOString() }
  }
  return { locked: true, endsAt: null }
}

export async function fetchRemoteStatus(hwid: string): Promise<RemoteStatus | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data: settings, error } = await sb
    .from('og_app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    lastTelemetryError = error.message
    return null
  }
  const { data: device } = await sb
    .from('og_devices')
    .select('status')
    .eq('hwid', hwid)
    .maybeSingle()
  const s = settings as RemoteAppSettings | null
  const { locked, endsAt } = maintenanceStillActive(s, hwid)
  const updateNeeded = Boolean(s?.force_update && (s.update_url || s.latest_version))
  return {
    settings: s,
    deviceStatus: device?.status as string | undefined,
    locked,
    updateNeeded,
    maintenanceEndsAt: endsAt,
  }
}

export type BrandSettings = {
  brandName: string
  brandTagline: string
  brandAbout: string
  brandWebsiteUrl: string
  brandLogoUrl: string
  social: {
    youtube: string
    twitter: string
    facebook: string
    instagram: string
    whatsapp: string
    discord: string
  }
}

export const DEFAULT_BRAND: BrandSettings = {
  brandName: 'ShiftZero',
  brandTagline: 'Zero cost. Always free.',
  brandAbout: 'Small tools. Zero cost. On-device downloads by ShiftZero.',
  brandWebsiteUrl: 'https://shiftzero.netlify.app',
  brandLogoUrl: '',
  social: {
    youtube: 'https://youtube.com',
    twitter: 'https://x.com',
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    whatsapp: 'https://whatsapp.com/channel',
    discord: 'https://discord.com',
  },
}

export async function fetchBrandSettings(): Promise<BrandSettings> {
  const sb = getSupabase()
  if (!sb) return DEFAULT_BRAND
  const { data } = await sb
    .from('og_app_settings')
    .select(
      'brand_name,brand_tagline,brand_about,brand_website_url,brand_logo_url,social_links',
    )
    .eq('id', 1)
    .maybeSingle()
  if (!data) return DEFAULT_BRAND
  const row = data as {
    brand_name?: string
    brand_tagline?: string
    brand_about?: string
    brand_website_url?: string
    brand_logo_url?: string
    social_links?: BrandSettings['social']
  }
  return {
    brandName: row.brand_name || DEFAULT_BRAND.brandName,
    brandTagline: row.brand_tagline || DEFAULT_BRAND.brandTagline,
    brandAbout: row.brand_about || DEFAULT_BRAND.brandAbout,
    brandWebsiteUrl: row.brand_website_url || DEFAULT_BRAND.brandWebsiteUrl,
    brandLogoUrl: row.brand_logo_url || '',
    social: { ...DEFAULT_BRAND.social, ...(row.social_links || {}) },
  }
}

export async function fetchClientNotifications(
  hwid: string,
): Promise<{ items: ClientNotification[]; setupNeeded: boolean }> {
  const sb = getSupabase()
  if (!sb || !hwid) return { items: [], setupNeeded: false }
  const { data, error } = await sb
    .from('og_notifications')
    .select('id, title, body, target_hwid, created_at')
    .or(`target_hwid.is.null,target_hwid.eq.${hwid}`)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    lastTelemetryError = error.message
    const setupNeeded = /og_notifications|schema cache|does not exist/i.test(error.message)
    return { items: [], setupNeeded }
  }
  return { items: (data || []) as ClientNotification[], setupNeeded: false }
}

export async function bumpAnalytics(kind: 'view' | 'download' | 'update_click') {
  const sb = getSupabase()
  if (!sb) return
  await sb.rpc('og_bump_analytics', { kind }).then(({ error }) => {
    if (error) console.warn('[omnigrab] bump_analytics', error.message)
  })
}
