import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { HistoryRecord } from '../youtube/types'

function storeDir() {
  const dir = join(app.getPath('userData'), 'store')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function historyPath() {
  return join(storeDir(), 'history.json')
}

function readAll(): HistoryRecord[] {
  const path = historyPath()
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    return Array.isArray(raw) ? (raw as HistoryRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(rows: HistoryRecord[]) {
  writeFileSync(historyPath(), JSON.stringify(rows, null, 2), 'utf-8')
}

export function listHistory(): HistoryRecord[] {
  return readAll().sort(
    (a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime(),
  )
}

export function appendHistory(
  partial: Omit<HistoryRecord, 'id'> & { id?: string },
): HistoryRecord {
  const row: HistoryRecord = {
    ...partial,
    id: partial.id || randomUUID(),
  }
  const rows = readAll()
  rows.push(row)
  writeAll(rows)
  return row
}

export function clearHistory() {
  writeAll([])
}

export function exportHistoryCsv(): string {
  const rows = listHistory()
  const header = [
    'id',
    'title',
    'kind',
    'quality',
    'status',
    'url',
    'filePath',
    'thumbnail',
    'bytes',
    'startedAt',
    'finishedAt',
    'durationMs',
    'error',
  ]
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.title,
        r.kind,
        r.quality,
        r.status,
        r.url,
        r.filePath ?? '',
        r.thumbnail ?? '',
        r.bytes ?? '',
        r.startedAt,
        r.finishedAt,
        r.durationMs,
        r.error ?? '',
      ]
        .map(escape)
        .join(','),
    )
  }
  return lines.join('\n')
}
