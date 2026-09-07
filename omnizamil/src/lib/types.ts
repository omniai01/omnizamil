export type JobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'cleaned';

export type MediaType = 'image' | 'video';

export interface ActivityItem {
  id: string;
  name: string;
  status: 'cleaned' | 'failed';
  type: MediaType;
  time: string;
  timestamp: number;
}

export interface DownloadItem {
  id: string;
  name: string;
  type: MediaType;
  time: string;
  timestamp: number;
  blobUrl: string;
  sizeLabel: string;
  /** Saved on disk so Recent downloads survive app restart */
  filePath?: string;
}

export interface QueueItem {
  id: string;
  name: string;
  sizeLabel: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  previewUrl: string;
  resultUrl?: string;
  file: File;
  error?: string;
  mediaType: MediaType;
}

export interface SingleResult {
  name: string;
  originalUrl: string;
  resultUrl: string;
  applied: boolean;
  message: string;
  mediaType: MediaType;
}

export interface AppStats {
  imagesCleaned: number;
  videosCleaned: number;
  successCount: number;
  failCount: number;
  totalProcessMs: number;
  weekly: number[];
}

export interface AppState {
  activity: ActivityItem[];
  downloads: DownloadItem[];
  queue: QueueItem[];
  single: SingleResult | null;
  stats: AppStats;
  settings: {
    autoProcess: boolean;
    losslessPng: boolean;
    /** Parallel images in Bulk (10…50) */
    imageConcurrency: number;
    /** Parallel videos in Bulk (10…50) */
    videoConcurrency: number;
  };
  profile: {
    /** Stable hardware id for this PC (backend) */
    hardwareId: string;
    deviceId: string;
    userId: string;
    displayName: string;
    /** True after first-run name save */
    nameSet: boolean;
  };
}

const STORAGE_KEY = 'omnizamil-state-v1';

const defaultWeekly = () => [0, 0, 0, 0, 0, 0, 0];

function makeId(prefix: string) {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

export function defaultState(): AppState {
  return {
    activity: [],
    downloads: [],
    queue: [],
    single: null,
    stats: {
      imagesCleaned: 0,
      videosCleaned: 0,
      successCount: 0,
      failCount: 0,
      totalProcessMs: 0,
      weekly: defaultWeekly(),
    },
    settings: {
      autoProcess: true,
      losslessPng: true,
      imageConcurrency: 10,
      videoConcurrency: 10,
    },
    profile: {
      hardwareId: '',
      deviceId: makeId('dev'),
      userId: makeId('usr'),
      displayName: '',
      nameSet: false,
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    const base = defaultState();
    const name = String(parsed.profile?.displayName || '').trim();
    const nameSet = Boolean(parsed.profile?.nameSet) || (name.length > 0 && name !== 'Omni-Removal User');
    const imageConcurrency = Math.max(1, Math.min(50, Number(parsed.settings?.imageConcurrency) || 10));
    const videoConcurrency = Math.max(1, Math.min(50, Number(parsed.settings?.videoConcurrency) || 10));
    const persistedDownloads = Array.isArray(parsed.downloads)
      ? parsed.downloads.map((d) => ({
          ...d,
          blobUrl: d.filePath ? '' : d.blobUrl || '',
        }))
      : [];
    const activityList = parsed.activity ?? [];
    // Backfill list from activity so Recent downloads isn't empty after older sessions
    const fromActivity =
      persistedDownloads.length > 0
        ? []
        : activityList
            .filter((a) => a.status === 'cleaned')
            .slice(0, 30)
            .map((a) => ({
              id: `hist-${a.id}`,
              name: a.name,
              type: a.type,
              time: a.time,
              timestamp: a.timestamp,
              blobUrl: '',
              sizeLabel: '',
            }));

    return {
      ...base,
      ...parsed,
      queue: [],
      single: null,
      downloads: persistedDownloads.length ? persistedDownloads : fromActivity,
      activity: activityList,
      stats: { ...base.stats, ...parsed.stats },
      settings: {
        ...base.settings,
        ...parsed.settings,
        imageConcurrency,
        videoConcurrency,
      },
      profile: {
        ...base.profile,
        ...parsed.profile,
        hardwareId: parsed.profile?.hardwareId || '',
        deviceId: parsed.profile?.deviceId || base.profile.deviceId,
        userId: parsed.profile?.userId || base.profile.userId,
        displayName: nameSet ? name : '',
        nameSet,
      },
    };
  } catch {
    return defaultState();
  }
}

export function persistState(state: AppState) {
  const slim: AppState = {
    ...state,
    queue: [],
    single: null,
    downloads: state.downloads.slice(0, 50).map((d) => ({
      ...d,
      blobUrl: '', // don't persist huge/invalid blob URLs
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatClock(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function weekdayIndex(ts = Date.now()) {
  const day = new Date(ts).getDay();
  return day === 0 ? 6 : day - 1;
}

export function successRate(stats: AppStats) {
  const total = stats.successCount + stats.failCount;
  if (!total) return 0;
  return Math.round((stats.successCount / total) * 100);
}

export function avgProcessSeconds(stats: AppStats) {
  if (!stats.successCount) return 0;
  return stats.totalProcessMs / stats.successCount / 1000;
}
