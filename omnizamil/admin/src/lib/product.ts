export type AdminProduct = 'omni' | 'omnigrab' | 'shiftvoice'

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
  if (raw === 'shiftvoice' || raw.startsWith('shiftvoice/')) return 'shiftvoice'
  return 'omni'
}

export function setProductHash(p: AdminProduct): void {
  if (p === 'omnigrab') window.location.hash = '/omnigrab'
  else if (p === 'shiftvoice') window.location.hash = '/shiftvoice'
  else window.location.hash = '/omni'
}

export function productLabel(p: AdminProduct): string {
  if (p === 'omnigrab') return 'OmniGrab'
  if (p === 'shiftvoice') return 'ShiftVoice'
  return 'Omni-Removal'
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
  if (p === 'shiftvoice') {
    return {
      devices: 'sv_devices',
      usageEvents: 'sv_usage_events',
      errorLogs: 'sv_error_logs',
      appSettings: 'sv_app_settings',
      notifications: 'sv_notifications',
      metricsRpc: 'sv_admin_device_metrics',
      countryRpc: 'sv_admin_country_rollup',
      platformRpc: 'sv_platform_rollup',
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
