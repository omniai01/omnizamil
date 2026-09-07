import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CountryStat,
  DeviceInfo,
  ErrorLog,
  MaintenanceConfig,
  SystemMetrics,
  UserMetric,
} from '../types';
import { tablesFor, type AdminProduct } from './product';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function adminClient(): SupabaseClient {
  const key = serviceKey || anonKey;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL / keys in admin/.env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 45) return 'Just now';
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} hours ago`;
  return `${Math.round(sec / 86400)} days ago`;
}

function deriveStatus(status: string, lastPing: string): 'active' | 'choked' | 'offline' {
  if (status === 'banned') return 'offline';
  if (status === 'choked') return 'choked';
  const age = Date.now() - new Date(lastPing).getTime();
  if (age > 10 * 60_000) return 'offline';
  return 'active';
}

function defaultMaintenanceMessage(product: AdminProduct): string {
  return product === 'omnigrab'
    ? 'OmniGrab is under maintenance. Please try again later.'
    : 'Omni-Removal is under maintenance. Please try again later.';
}

function defaultUpdateMessage(product: AdminProduct): string {
  return product === 'omnigrab'
    ? 'A new OmniGrab / ShiftGrab update is available. Download and install it to continue.'
    : 'A new Omni-Removal update is available. Download and install it to continue.';
}

type DeviceRow = {
  hwid: string;
  display_name: string;
  user_alias: string;
  os: string;
  cpu: string;
  ram_gb: number;
  gpu: string;
  status: string;
  image_count: number;
  video_count: number;
  fail_count: number;
  total_process_ms: number;
  bytes_processed?: number;
  last_ping: string;
  first_seen: string;
  country?: string;
  country_code?: string;
  youtube_linked?: boolean;
};

type ErrorRow = {
  id: string;
  hwid: string;
  user_alias: string;
  error_type: string;
  message: string;
  stack_trace: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'investigating' | 'resolved';
  created_at: string;
};

export type SocialLinks = {
  youtube: string;
  twitter: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  discord: string;
};

export type BrandConfig = {
  brandName: string;
  brandTagline: string;
  brandAbout: string;
  brandWebsiteUrl: string;
  brandLogoUrl: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  targetHwid: string | null;
  createdAt: string;
};

export type PlatformStat = {
  platform: string;
  downloads: number;
  fails: number;
};

type SettingsRow = {
  maintenance_enabled: boolean;
  maintenance_message: string;
  affect_all_devices: boolean;
  allowed_hwids: string[] | null;
  lock_engine: boolean;
  force_update?: boolean;
  latest_version?: string;
  update_url?: string;
  update_message?: string;
  maintenance_duration_minutes?: number | null;
  maintenance_started_at?: string | null;
  social_links?: SocialLinks | null;
  brand_name?: string;
  brand_tagline?: string;
  brand_about?: string;
  brand_website_url?: string;
  brand_logo_url?: string;
  image_target?: number;
  video_target?: number;
  site_views?: number;
  download_clicks?: number;
  update_clicks?: number;
  updated_at: string;
};

export type SiteAnalyticsStats = {
  siteViews: number;
  downloadClicks: number;
  updateClicks: number;
};

export type AdminSnapshot = {
  metrics: SystemMetrics;
  devices: DeviceInfo[];
  users: UserMetric[];
  errorLogs: ErrorLog[];
  maintenanceConfig: MaintenanceConfig;
  countries: CountryStat[];
  socialLinks: SocialLinks;
  brand: BrandConfig;
  siteAnalytics: SiteAnalyticsStats;
  platforms?: PlatformStat[];
  errorLoadWarning?: string;
};

export async function loadAdminSnapshot(
  product: AdminProduct = 'omni',
): Promise<AdminSnapshot> {
  const sb = adminClient();
  const t = tablesFor(product);
  const deviceSelect =
    product === 'omnigrab'
      ? 'hwid,display_name,user_alias,os,cpu,ram_gb,gpu,status,image_count,video_count,fail_count,total_process_ms,bytes_processed,last_ping,first_seen,country,country_code,youtube_linked'
      : 'hwid,display_name,user_alias,os,cpu,ram_gb,gpu,status,image_count,video_count,fail_count,total_process_ms,bytes_processed,last_ping,first_seen,country,country_code';

  // Cap UI list — full population comes from metrics RPC (100k-safe)
  let devices: unknown = null;
  let dErr: { message: string } | null = null;
  {
    const first = await sb
      .from(t.devices)
      .select(deviceSelect)
      .order('last_ping', { ascending: false })
      .limit(500);
    if (first.error && /youtube_linked/i.test(first.error.message)) {
      const fallback = await sb
        .from(t.devices)
        .select(
          'hwid,display_name,user_alias,os,cpu,ram_gb,gpu,status,image_count,video_count,fail_count,total_process_ms,bytes_processed,last_ping,first_seen,country,country_code',
        )
        .order('last_ping', { ascending: false })
        .limit(500);
      devices = fallback.data;
      dErr = fallback.error;
    } else {
      devices = first.data;
      dErr = first.error;
    }
  }

  const [
    { data: errors, error: eErr },
    { data: settings },
    metricsRpc,
    countriesRpc,
    platformsRpc,
  ] = await Promise.all([
    sb.from(t.errorLogs).select('*').order('created_at', { ascending: false }).limit(100),
    sb.from(t.appSettings).select('*').eq('id', 1).maybeSingle(),
    sb.rpc(t.metricsRpc, { online_minutes: 10 }),
    sb.rpc(t.countryRpc),
    t.platformRpc
      ? sb.rpc(t.platformRpc)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (dErr) throw new Error(dErr.message);
  const errorLoadWarning = eErr?.message || '';

  const deviceRows = (devices || []) as DeviceRow[];
  const mappedDevices: DeviceInfo[] = deviceRows
    .map((d) => {
    const status = deriveStatus(d.status, d.last_ping);
    return {
      hwid: d.hwid,
      userAlias: d.display_name || d.user_alias || 'Unknown',
      ipAddress: '—',
      os: d.os || 'Windows',
      cpu: d.cpu || '—',
      ramGb: Number(d.ram_gb) || 0,
      gpu: d.gpu || '—',
      status,
      totalActiveHours: Math.max(
        0,
        Math.round((Date.now() - new Date(d.first_seen).getTime()) / 3_600_000),
      ),
      lastPing: relTime(d.last_ping),
      firstSeen: relTime(d.first_seen),
      imageCount: Number(d.image_count) || 0,
      videoCount: Number(d.video_count) || 0,
      failCount: Number(d.fail_count) || 0,
      totalProcessMs: Number(d.total_process_ms) || 0,
      bytesProcessed: Number(d.bytes_processed) || 0,
      country: d.country || 'Unknown',
      countryCode: d.country_code || '',
      youtubeLinked: Boolean(d.youtube_linked),
      cpuLoadPercent: status === 'offline' ? 0 : status === 'choked' ? 95 : 35,
      gpuLoadPercent: status === 'offline' ? 0 : status === 'choked' ? 90 : 28,
      memoryLoadPercent: status === 'offline' ? 0 : 40,
    };
  })
    .sort((a, b) => {
      const rank = (s: string) => (s === 'active' ? 0 : s === 'choked' ? 1 : 2);
      const r = rank(a.status) - rank(b.status);
      return r !== 0 ? r : a.userAlias.localeCompare(b.userAlias);
    });

  const settingsRow = settings as SettingsRow | null;
  const targetImage =
    Number(settingsRow?.image_target) > 0 ? Number(settingsRow?.image_target) : 1_000_000;
  const targetVideo =
    Number(settingsRow?.video_target) > 0 ? Number(settingsRow?.video_target) : 1_000_000;

  type MetricsJson = {
    total?: number;
    active?: number;
    choked?: number;
    offline?: number;
    images?: number;
    videos?: number;
  };
  const m = (!metricsRpc.error && metricsRpc.data ? metricsRpc.data : null) as MetricsJson | null;
  const fallbackImages = mappedDevices.reduce((s, d) => s + d.imageCount, 0);
  const fallbackVideos = mappedDevices.reduce((s, d) => s + d.videoCount, 0);
  const fallbackActive = mappedDevices.filter((d) => d.status === 'active').length;
  const fallbackChoked = mappedDevices.filter((d) => d.status === 'choked').length;
  const fallbackOffline = mappedDevices.filter((d) => d.status === 'offline').length;

  const totalDevices = Number(m?.total) || mappedDevices.length;
  const active = Number(m?.active) || fallbackActive;
  const choked = Number(m?.choked) || fallbackChoked;
  const offline = Number(m?.offline) || fallbackOffline;
  const totalImages = Number(m?.images) || fallbackImages;
  const totalVideos = Number(m?.videos) || fallbackVideos;

  const metrics: SystemMetrics = {
    totalDevices,
    activeDevicesCount: active,
    chokedDevicesCount: choked,
    offlineDevicesCount: offline,
    totalImagesCleaned: totalImages,
    totalVideosCleaned: totalVideos,
    targetImageGoal: targetImage,
    targetVideoGoal: targetVideo,
    avgImageProcessTimeSec: 1.5,
    avgVideoProcessTimeSec: 18,
    systemUptimePercent: totalDevices
      ? Math.round((active / totalDevices) * 10000) / 100
      : 100,
  };

  const users: UserMetric[] = mappedDevices
    .map((d) => ({
      id: d.hwid,
      username: d.userAlias,
      deviceHwid: d.hwid,
      dailyActiveMinutes: d.status === 'active' ? 60 : 0,
      weeklyActiveHours: Math.max(0.1, d.totalActiveHours / 7),
      totalImagesCleaned: d.imageCount,
      totalVideosProcessed: d.videoCount,
      rank: 1,
      avatarUrl: '',
      badge:
        d.imageCount + d.videoCount > 100
          ? ('Top Operator' as const)
          : d.imageCount + d.videoCount > 20
            ? ('Power User' as const)
            : ('Standard' as const),
      country: d.country,
      firstSeen: d.firstSeen,
    }))
    .sort(
      (a, b) =>
        b.totalImagesCleaned +
        b.totalVideosProcessed -
        (a.totalImagesCleaned + a.totalVideosProcessed),
    )
    .map((u, i) => ({ ...u, rank: i + 1 }));

  type CountryJson = {
    country: string;
    country_code: string;
    devices: number;
    images: number;
    videos: number;
  };
  let countries: CountryStat[] = [];
  if (!countriesRpc.error && Array.isArray(countriesRpc.data)) {
    countries = (countriesRpc.data as CountryJson[]).map((c) => ({
      country: c.country || 'Unknown',
      countryCode: c.country_code || '',
      devices: Number(c.devices) || 0,
      images: Number(c.images) || 0,
      videos: Number(c.videos) || 0,
    }));
  } else {
    const countryMap = new Map<string, CountryStat>();
    for (const d of mappedDevices) {
      const key = d.countryCode || d.country || '??';
      const prev = countryMap.get(key) || {
        country: d.country || 'Unknown',
        countryCode: d.countryCode || '',
        devices: 0,
        images: 0,
        videos: 0,
      };
      prev.devices += 1;
      prev.images += d.imageCount;
      prev.videos += d.videoCount;
      countryMap.set(key, prev);
    }
    countries = [...countryMap.values()].sort(
      (a, b) => b.images + b.videos - (a.images + a.videos),
    );
  }

  let platforms: PlatformStat[] | undefined;
  if (platformsRpc && !platformsRpc.error && Array.isArray(platformsRpc.data)) {
    type PlatformJson = { platform?: string; downloads?: number; fails?: number };
    platforms = (platformsRpc.data as PlatformJson[]).map((p) => ({
      platform: p.platform || 'Unknown',
      downloads: Number(p.downloads) || 0,
      fails: Number(p.fails) || 0,
    }));
  }

  const errorLogs: ErrorLog[] = ((eErr ? [] : errors || []) as ErrorRow[]).map((e) => ({
    id: e.id,
    deviceId: e.hwid,
    userAlias: e.user_alias || '—',
    errorType: e.error_type || 'unknown',
    message: e.message || '(no message)',
    stackTrace: e.stack_trace || '',
    timestamp: relTime(e.created_at),
    severity: e.severity || 'error',
    status: e.status || 'open',
  }));

  const s = settingsRow;
  const maintenanceConfig: MaintenanceConfig = {
    isEnabled: Boolean(s?.maintenance_enabled),
    message: s?.maintenance_message || defaultMaintenanceMessage(product),
    affectAllDevices: s?.affect_all_devices ?? true,
    allowedHwids: s?.allowed_hwids || [],
    lockEngine: s?.lock_engine ?? true,
    updatedAt: s?.updated_at ? relTime(s.updated_at) : '—',
    forceUpdate: Boolean(s?.force_update),
    latestVersion: s?.latest_version || '1.0.0',
    updateUrl: s?.update_url || '',
    updateMessage: s?.update_message || defaultUpdateMessage(product),
    durationMinutes: Math.max(0, Number(s?.maintenance_duration_minutes) || 0),
    startedAt: s?.maintenance_started_at || null,
  };

  const socialLinks: SocialLinks = {
    youtube: 'https://youtube.com',
    twitter: 'https://x.com',
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    whatsapp: 'https://whatsapp.com/channel',
    discord: 'https://discord.com',
    ...(s?.social_links || {}),
  };

  const brand: BrandConfig = {
    brandName: s?.brand_name || 'ShiftZero',
    brandTagline: s?.brand_tagline || 'Zero cost. Always free.',
    brandAbout:
      s?.brand_about ||
      'Small tools. Zero cost. Zero telemetry. 100% on-device local AI.',
    brandWebsiteUrl: s?.brand_website_url || 'https://shiftzero.dev',
    brandLogoUrl: s?.brand_logo_url || '',
  };

  const siteAnalytics: SiteAnalyticsStats = {
    siteViews: Number(s?.site_views) || 0,
    downloadClicks: Number(s?.download_clicks) || 0,
    updateClicks: Number(s?.update_clicks) || 0,
  };

  return {
    metrics,
    devices: mappedDevices,
    users,
    errorLogs,
    maintenanceConfig,
    countries,
    socialLinks,
    brand,
    siteAnalytics,
    platforms,
    errorLoadWarning: errorLoadWarning || undefined,
  };
}

export async function resolveErrorLog(product: AdminProduct, id: string) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.errorLogs).update({ status: 'resolved' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function saveMaintenance(product: AdminProduct, config: MaintenanceConfig) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.appSettings).upsert({
    id: 1,
    maintenance_enabled: config.isEnabled,
    maintenance_message: config.message,
    affect_all_devices: config.affectAllDevices,
    allowed_hwids: config.allowedHwids,
    lock_engine: config.lockEngine,
    force_update: config.forceUpdate,
    latest_version: config.latestVersion,
    update_url: config.updateUrl,
    update_message: config.updateMessage,
    maintenance_duration_minutes: Math.max(0, Number(config.durationMinutes) || 0),
    maintenance_started_at: config.isEnabled ? config.startedAt : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteDevice(product: AdminProduct, hwid: string) {
  const sb = adminClient();
  const t = tablesFor(product);
  await sb.from(t.usageEvents).delete().eq('hwid', hwid);
  await sb.from(t.errorLogs).delete().eq('hwid', hwid);
  const { error } = await sb.from(t.devices).delete().eq('hwid', hwid);
  if (error) throw new Error(error.message);
}

export async function deleteSmokeDevices(product: AdminProduct = 'omni') {
  const sb = adminClient();
  const t = tablesFor(product);
  // Indexed filter delete — never SELECT * all devices
  const { data, error } = await sb
    .from(t.devices)
    .delete()
    .or('display_name.ilike.%smoke%,user_alias.ilike.%smoke%')
    .select('hwid');
  if (error) throw new Error(error.message);
  return (data || []).length;
}

export async function saveSocialLinks(product: AdminProduct, links: SocialLinks) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.appSettings).upsert({
    id: 1,
    social_links: links,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function saveBrandSettings(
  product: AdminProduct,
  brand: BrandConfig,
  links: SocialLinks,
) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.appSettings).upsert({
    id: 1,
    brand_name: brand.brandName,
    brand_tagline: brand.brandTagline,
    brand_about: brand.brandAbout,
    brand_website_url: brand.brandWebsiteUrl,
    brand_logo_url: brand.brandLogoUrl,
    social_links: links,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function loadNotifications(
  product: AdminProduct = 'omni',
): Promise<AdminNotification[]> {
  const sb = adminClient();
  const t = tablesFor(product);
  const { data, error } = await sb
    .from(t.notifications)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data || []) as { id: string; title: string; body: string; target_hwid: string | null; created_at: string }[]).map(
    (n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      targetHwid: n.target_hwid,
      createdAt: relTime(n.created_at),
    }),
  );
}

export async function sendNotification(
  product: AdminProduct,
  opts: {
    title: string;
    body: string;
    targetHwid?: string | null;
  },
) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.notifications).insert({
    title: opts.title.trim(),
    body: opts.body.trim(),
    target_hwid: opts.targetHwid?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteNotification(product: AdminProduct, id: string) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.notifications).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function saveSiteAnalytics(product: AdminProduct, stats: SiteAnalyticsStats) {
  const sb = adminClient();
  const t = tablesFor(product);
  const { error } = await sb.from(t.appSettings).upsert({
    id: 1,
    site_views: stats.siteViews,
    download_clicks: stats.downloadClicks,
    update_clicks: stats.updateClicks,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
