import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let lastTelemetryError = '';

export function getTelemetryError() {
  return lastTelemetryError;
}

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) {
    lastTelemetryError = 'Cloud not configured (missing VITE_SUPABASE_URL / key).';
    return null;
  }
  if (!client) client = createClient(url, anon, { auth: { persistSession: false } });
  return client;
}

export type RegisterPayload = {
  hwid: string;
  displayName: string;
  os?: string;
  cpu?: string;
  ramGb?: number;
  gpu?: string;
  appVersion?: string;
};

async function detectCountry(): Promise<{ country: string; countryCode: string }> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  const parts = locale.split(/[-_]/);
  const fromLocale = (parts[1] || '').toUpperCase();
  let code = '';

  // Timezone first — Windows often reports en-US even in Pakistan
  if (/Karachi|Pakistan/i.test(tz)) code = 'PK';
  else if (/Kolkata|Calcutta|India/i.test(tz)) code = 'IN';
  else if (/Dubai|Muscat/i.test(tz)) code = 'AE';
  else if (/Riyadh/i.test(tz)) code = 'SA';
  else if (/Dhaka/i.test(tz)) code = 'BD';
  else if (/London/i.test(tz)) code = 'GB';
  else if (/New_York|Chicago|Los_Angeles|Denver|Toronto|Vancouver/i.test(tz)) code = 'US';
  else if (fromLocale.length === 2) {
    // Ignore misleading en-US when the clock is in Asia
    if (!(fromLocale === 'US' && /^Asia\//i.test(tz))) code = fromLocale;
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
  };

  if (!code) {
    return { country: tz ? tz.split('/').pop() || 'Unknown' : 'Unknown', countryCode: '' };
  }
  return { country: names[code] || code, countryCode: code };
}

export async function registerDevice(payload: RegisterPayload): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: lastTelemetryError || 'No Supabase client' };
  if (!payload.hwid) return { ok: false, error: 'Missing hardware ID' };

  const geo = await detectCountry();
  const base = {
    hwid: payload.hwid,
    display_name: payload.displayName || '',
    user_alias: payload.displayName || '',
    os: payload.os || navigator.platform || '',
    cpu: payload.cpu || `${navigator.hardwareConcurrency || 0} cores`,
    ram_gb: payload.ramGb ?? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0,
    gpu: payload.gpu || '',
    app_version: payload.appVersion || '1.0.0',
    status: 'active',
    last_ping: new Date().toISOString(),
  };

  const withCountry = {
    ...base,
    country: geo.country,
    country_code: geo.countryCode,
  };

  const { data: existing } = await sb
    .from('devices')
    .select('hwid')
    .eq('hwid', payload.hwid)
    .maybeSingle();

  let { error } = await sb.from('devices').upsert(withCountry, { onConflict: 'hwid' });
  if (error && /country/i.test(error.message)) {
    // Schema delta not applied yet — still register the device
    ({ error } = await sb.from('devices').upsert(base, { onConflict: 'hwid' }));
  }
  if (error) {
    lastTelemetryError = error.message;
    console.warn('[telemetry] register', error.message);
    return { ok: false, error: error.message };
  }
  lastTelemetryError = '';
  // Register event once per device lifetime (not on every app open)
  if (!existing) {
    await sb.from('usage_events').insert({
      hwid: payload.hwid,
      event_type: 'register',
      meta: { displayName: payload.displayName, country: geo.country },
    });
  }
  return { ok: true };
}

export async function heartbeatDevice(hwid: string, displayName?: string) {
  const sb = getSupabase();
  if (!sb || !hwid) return;
  // Slim ping only — no usage_events (100k-safe)
  const { error } = await sb
    .from('devices')
    .update({
      last_ping: new Date().toISOString(),
      status: 'active',
      ...(displayName ? { display_name: displayName, user_alias: displayName } : {}),
    })
    .eq('hwid', hwid);
  if (error) {
    lastTelemetryError = error.message;
  }
}

export async function reportClean(opts: {
  hwid: string;
  mediaType: 'image' | 'video';
  success: boolean;
  elapsedMs: number;
  bytes?: number;
  displayName?: string;
}) {
  const sb = getSupabase();
  if (!sb || !opts.hwid) return;

  const eventType = opts.success
    ? opts.mediaType === 'video'
      ? 'video_clean'
      : 'image_clean'
    : 'fail';

  // Prefer atomic RPC (race-safe at scale); fall back to legacy path
  const { error: rpcErr } = await sb.rpc('bump_device_clean', {
    p_hwid: opts.hwid,
    p_media: opts.mediaType,
    p_success: opts.success,
    p_elapsed_ms: Math.round(opts.elapsedMs),
    p_bytes: Math.max(0, Math.round(opts.bytes || 0)),
    p_display_name: opts.displayName || null,
    p_event_type: eventType,
  });
  if (!rpcErr) return;

  await sb.from('usage_events').insert({
    hwid: opts.hwid,
    event_type: eventType,
    media_type: opts.mediaType,
    success: opts.success,
    elapsed_ms: Math.round(opts.elapsedMs),
    meta: { bytes: opts.bytes || 0 },
  });

  const { data } = await sb
    .from('devices')
    .select('image_count, video_count, fail_count, total_process_ms, bytes_processed')
    .eq('hwid', opts.hwid)
    .maybeSingle();

  if (!data) {
    await registerDevice({
      hwid: opts.hwid,
      displayName: opts.displayName || '',
    });
  }

  const patch: Record<string, unknown> = {
    last_ping: new Date().toISOString(),
    status: 'active',
    total_process_ms: (data?.total_process_ms || 0) + Math.round(opts.elapsedMs),
    bytes_processed: (Number(data?.bytes_processed) || 0) + Math.max(0, Math.round(opts.bytes || 0)),
  };
  if (opts.displayName) {
    patch.display_name = opts.displayName;
    patch.user_alias = opts.displayName;
  }
  if (opts.success && opts.mediaType === 'image') {
    patch.image_count = (data?.image_count || 0) + 1;
  } else if (opts.success && opts.mediaType === 'video') {
    patch.video_count = (data?.video_count || 0) + 1;
  } else if (!opts.success) {
    patch.fail_count = (data?.fail_count || 0) + 1;
  }
  const { error } = await sb.from('devices').update(patch).eq('hwid', opts.hwid);
  if (error && /bytes_processed/i.test(error.message)) {
    delete patch.bytes_processed;
    await sb.from('devices').update(patch).eq('hwid', opts.hwid);
  }
}

export async function reportError(opts: {
  hwid: string;
  displayName?: string;
  errorType: string;
  message: string;
  stackTrace?: string;
  severity?: 'critical' | 'warning' | 'info';
}) {
  const sb = getSupabase();
  if (!sb || !opts.hwid) return;
  await sb.from('error_logs').insert({
    hwid: opts.hwid,
    user_alias: opts.displayName || '',
    error_type: opts.errorType,
    message: opts.message.slice(0, 4000),
    stack_trace: (opts.stackTrace || '').slice(0, 8000),
    severity: opts.severity || 'warning',
    status: 'open',
  });
}

export type SocialLinks = {
  youtube: string;
  twitter: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  discord: string;
};

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  youtube: 'https://youtube.com',
  twitter: 'https://x.com',
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  whatsapp: 'https://whatsapp.com/channel',
  discord: 'https://discord.com',
};

export type RemoteAppSettings = {
  maintenance_enabled: boolean;
  maintenance_message: string;
  affect_all_devices: boolean;
  allowed_hwids: string[] | null;
  lock_engine: boolean;
  force_update: boolean;
  latest_version: string;
  update_url: string;
  update_message: string;
  social_links?: SocialLinks | null;
};

export type RemoteStatus = {
  settings: RemoteAppSettings | null;
  deviceStatus?: string;
  locked: boolean;
  updateNeeded: boolean;
};

export type ClientNotification = {
  id: string;
  title: string;
  body: string;
  target_hwid: string | null;
  created_at: string;
};

export async function fetchRemoteStatus(hwid: string): Promise<RemoteStatus | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: settings, error } = await sb.from('app_settings').select('*').eq('id', 1).maybeSingle();
  if (error) {
    lastTelemetryError = error.message;
    return null;
  }
  const { data: device } = await sb.from('devices').select('status').eq('hwid', hwid).maybeSingle();
  const s = settings as RemoteAppSettings | null;
  const allowed = (s?.allowed_hwids || []).includes(hwid);
  // Maintenance ON locks every client except allow-listed HWIDs (lock_engine stays for admin clarity)
  const locked = Boolean(s?.maintenance_enabled && !allowed);
  const updateNeeded = Boolean(s?.force_update && (s.update_url || s.latest_version));
  return {
    settings: s,
    deviceStatus: device?.status as string | undefined,
    locked,
    updateNeeded,
  };
}

export async function fetchSocialLinks(): Promise<SocialLinks> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_SOCIAL_LINKS;
  const { data } = await sb.from('app_settings').select('social_links').eq('id', 1).maybeSingle();
  const links = (data as { social_links?: SocialLinks } | null)?.social_links;
  return { ...DEFAULT_SOCIAL_LINKS, ...(links || {}) };
}

export type BrandSettings = {
  brandName: string;
  brandTagline: string;
  brandAbout: string;
  brandWebsiteUrl: string;
  brandLogoUrl: string;
  social: SocialLinks;
};

export const DEFAULT_BRAND: BrandSettings = {
  brandName: 'ShiftZero',
  brandTagline: 'Zero cost. Always free.',
  brandAbout: 'Small tools. Zero cost. Zero telemetry. 100% on-device local AI.',
  brandWebsiteUrl: 'https://shiftzero.dev',
  brandLogoUrl: '',
  social: DEFAULT_SOCIAL_LINKS,
};

export async function fetchBrandSettings(): Promise<BrandSettings> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_BRAND;
  const { data } = await sb
    .from('app_settings')
    .select('brand_name,brand_tagline,brand_about,brand_website_url,brand_logo_url,social_links')
    .eq('id', 1)
    .maybeSingle();
  if (!data) return DEFAULT_BRAND;
  const row = data as {
    brand_name?: string;
    brand_tagline?: string;
    brand_about?: string;
    brand_website_url?: string;
    brand_logo_url?: string;
    social_links?: SocialLinks;
  };
  return {
    brandName: row.brand_name || DEFAULT_BRAND.brandName,
    brandTagline: row.brand_tagline || DEFAULT_BRAND.brandTagline,
    brandAbout: row.brand_about || DEFAULT_BRAND.brandAbout,
    brandWebsiteUrl: row.brand_website_url || DEFAULT_BRAND.brandWebsiteUrl,
    brandLogoUrl: row.brand_logo_url || '',
    social: { ...DEFAULT_SOCIAL_LINKS, ...(row.social_links || {}) },
  };
}

export async function fetchClientNotifications(
  hwid: string,
): Promise<{ items: ClientNotification[]; setupNeeded: boolean }> {
  const sb = getSupabase();
  if (!sb || !hwid) return { items: [], setupNeeded: false };
  const { data, error } = await sb
    .from('notifications')
    .select('id, title, body, target_hwid, created_at')
    .or(`target_hwid.is.null,target_hwid.eq.${hwid}`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    lastTelemetryError = error.message;
    const setupNeeded = /notifications|schema cache|does not exist/i.test(error.message);
    return { items: [], setupNeeded };
  }
  const items = ((data || []) as ClientNotification[]).filter((n) => {
    const blob = `${n.title} ${n.body}`;
    if (/schema cache|Could not find the table/i.test(blob)) return false;
    return Boolean(n.title?.trim() || n.body?.trim());
  });
  return { items, setupNeeded: false };
}

export async function bumpAnalytics(kind: 'view' | 'download' | 'update_click') {
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc('bump_analytics', { kind }).then(({ error }) => {
    if (error) console.warn('[telemetry] bump_analytics', error.message);
  });
}
