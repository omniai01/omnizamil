export type AdminProduct = 'omni' | 'omnigrab'

export type ProductTables = {
  devices: string
  usageEvents: string
  errorLogs: string
  appSettings: string
  notifications: string
  metricsRpc: string
  countryRpc: string
  platformRpc?: string
}

export function productFromHash(): AdminProduct {
  const raw = (window.location.hash || '').replace(/^#/, '').replace(/^\//, '').toLowerCase()
  if (raw === 'omnigrab' || raw.startsWith('omnigrab/')) return 'omnigrab'
  return 'omni'
}

export function setProductHash(p: AdminProduct): void {
  window.location.hash = p === 'omnigrab' ? '/omnigrab' : '/omni'
}

export function tablesFor(p: AdminProduct): ProductTables {
  if (p === 'omnigrab') {
    return {
      devices: 'og_devices',
      usageEvents: 'og_usage_events',
      errorLogs: 'og_error_logs',
      appSettings: 'og_app_settings',
      notifications: 'og_notifications',
      metricsRpc: 'og_admin_device_metrics',
      countryRpc: 'og_admin_country_rollup',
      platformRpc: 'og_platform_rollup',
    }
  }
  return {
    devices: 'devices',
    usageEvents: 'usage_events',
    errorLogs: 'error_logs',
    appSettings: 'app_settings',
    notifications: 'notifications',
    metricsRpc: 'admin_device_metrics',
    countryRpc: 'admin_country_rollup',
  }
}
