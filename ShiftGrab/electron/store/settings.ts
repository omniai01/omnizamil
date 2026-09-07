import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings } from '../youtube/types'

function storeDir() {
  const dir = join(app.getPath('userData'), 'store')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function settingsPath() {
  return join(storeDir(), 'settings.json')
}

export function defaultSettings(): AppSettings {
  return {
    defaultSaveDir: app.getPath('downloads'),
    defaultQualityId: 'best',
    concurrentFragments: 5,
    maxParallelJobs: 2,
    autoUpdateBinaries: false,
    extractTranscript: false,
    saveDescription: false,
    useBrowserCookiesFallback: true,
  }
}

export function getSettings(): AppSettings {
  const path = settingsPath()
  if (!existsSync(path)) {
    const defaults = defaultSettings()
    writeFileSync(path, JSON.stringify(defaults, null, 2), 'utf-8')
    return defaults
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<AppSettings>
    return { ...defaultSettings(), ...raw }
  } catch {
    return defaultSettings()
  }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
