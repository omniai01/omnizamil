import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ActiveJob } from '../youtube/types'

function storeDir() {
  const dir = join(app.getPath('userData'), 'store')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function jobsPath() {
  return join(storeDir(), 'jobs.json')
}

export function loadPersistedJobs(): ActiveJob[] {
  const path = jobsPath()
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    if (!Array.isArray(raw)) return []
    return raw as ActiveJob[]
  } catch {
    return []
  }
}

export function savePersistedJobs(jobs: ActiveJob[]) {
  writeFileSync(jobsPath(), JSON.stringify(jobs, null, 2), 'utf-8')
}
