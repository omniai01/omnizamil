import { createHash } from 'node:crypto'
import { cpus, hostname, networkInterfaces, userInfo } from 'node:os'

/** Stable OmniGrab / ShiftGrab hardware id for this PC (admin-facing). */
export function getHardwareId(): string {
  const nets = networkInterfaces()
  let mac = ''
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (!n.internal && n.mac && n.mac !== '00:00:00:00:00:00') {
        mac = n.mac
        break
      }
    }
    if (mac) break
  }
  let username = ''
  try {
    username = userInfo().username || ''
  } catch {
    username = ''
  }
  const cpu = cpus()[0]?.model || ''
  const raw = [hostname(), username, cpu, mac, process.platform, process.arch].join('|')
  const hex = createHash('sha256').update(raw).digest('hex').slice(0, 20)
  return `og-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}`
}

export function getOsUsername(): string {
  try {
    return userInfo().username || 'User'
  } catch {
    return 'User'
  }
}
