const path = require('path')
const fs = require('fs')

/** Embed claw icon into ShiftGrab.exe when signAndEditExecutable is false. */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const exe = path.join(context.appOutDir, 'ShiftGrab.exe')
  const icon = path.join(context.packager.projectDir, 'resources', 'icon.ico')
  if (!fs.existsSync(exe) || !fs.existsSync(icon)) return

  let rcedit
  try {
    rcedit = require('rcedit')
  } catch {
    try {
      rcedit = require('@electron/rcedit')
    } catch {
      console.warn('[afterPack] rcedit not found — skipping icon embed')
      return
    }
  }

  const run = typeof rcedit === 'function' ? rcedit : rcedit.rcedit || rcedit.default
  if (typeof run !== 'function') {
    console.warn('[afterPack] rcedit API missing')
    return
  }

  await run(exe, {
    icon,
    'version-string': {
      CompanyName: 'ShiftZero',
      FileDescription: 'ShiftGrab',
      ProductName: 'ShiftGrab',
      LegalCopyright: 'Copyright © ShiftZero',
    },
    'product-version': context.packager.appInfo.version,
    'file-version': context.packager.appInfo.version,
  })
  console.log('[afterPack] Applied ShiftGrab icon to ShiftGrab.exe')
}
