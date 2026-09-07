export type DeviceStatus = 'active' | 'choked' | 'offline';

export interface DeviceInfo {
  hwid: string;
  userAlias: string;
  ipAddress: string;
  os: string;
  cpu: string;
  ramGb: number;
  gpu: string;
  status: DeviceStatus;
  totalActiveHours: number;
  lastPing: string;
  firstSeen: string;
  imageCount: number;
  videoCount: number;
  failCount?: number;
  totalProcessMs?: number;
  bytesProcessed?: number;
  country: string;
  countryCode: string;
  cpuLoadPercent: number;
  gpuLoadPercent: number;
  memoryLoadPercent: number;
  /** OmniGrab only: local YouTube session linked on device (boolean; no credentials). */
  youtubeLinked?: boolean;
}

export interface UserMetric {
  id: string;
  username: string;
  deviceHwid: string;
  dailyActiveMinutes: number;
  weeklyActiveHours: number;
  totalImagesCleaned: number;
  totalVideosProcessed: number;
  rank: number;
  avatarUrl: string;
  badge: 'Top Operator' | 'Power User' | 'Standard' | 'Beta Tester';
  country: string;
  firstSeen: string;
}

export interface ErrorLog {
  id: string;
  deviceId: string;
  userAlias: string;
  errorType: string;
  message: string;
  stackTrace: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'investigating' | 'resolved';
}

export interface SystemMetrics {
  totalDevices: number;
  activeDevicesCount: number;
  chokedDevicesCount: number;
  offlineDevicesCount: number;
  totalImagesCleaned: number;
  totalVideosCleaned: number;
  targetImageGoal: number;
  targetVideoGoal: number;
  avgImageProcessTimeSec: number;
  avgVideoProcessTimeSec: number;
  systemUptimePercent: number;
}

export interface CountryStat {
  country: string;
  countryCode: string;
  devices: number;
  images: number;
  videos: number;
}

export interface MaintenanceConfig {
  isEnabled: boolean;
  message: string;
  affectAllDevices: boolean;
  allowedHwids: string[];
  lockEngine: boolean;
  updatedAt: string;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
  updateMessage: string;
  /** 0 = until manually turned off */
  durationMinutes: number;
  /** ISO timestamp when maintenance was turned on */
  startedAt: string | null;
}
