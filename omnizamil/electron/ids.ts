import { createHash } from 'node:crypto';
import { cpus, hostname, networkInterfaces, userInfo } from 'node:os';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Stable Omni hardware id for this PC (backend-facing). */
export function getHardwareId(): string {
  const nets = networkInterfaces();
  let mac = '';
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (!n.internal && n.mac && n.mac !== '00:00:00:00:00:00') {
        mac = n.mac;
        break;
      }
    }
    if (mac) break;
  }
  let username = '';
  try {
    username = userInfo().username || '';
  } catch {
    username = '';
  }
  const cpu = cpus()[0]?.model || '';
  const raw = [hostname(), username, cpu, mac, process.platform, process.arch].join('|');
  const hex = createHash('sha256').update(raw).digest('hex').slice(0, 20);
  // omni-xxxx-xxxx-xxxx-xxxx
  return `omni-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}`;
}

export function walkFindName(dir: string, name: string, depth = 0): string {
  if (!existsSync(dir) || depth > 8) return '';
  try {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        const hit = walkFindName(full, name, depth + 1);
        if (hit) return hit;
      } else if (entry.toLowerCase() === name.toLowerCase()) {
        return full;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

/** True when Chromium used by Omni video engine is present in the given browsers root. */
export function playwrightBrowserInstalled(browsersRootOrEngineDir: string): boolean {
  const exe =
    process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  const chromeExe = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
  const roots = [
    browsersRootOrEngineDir,
    path.join(browsersRootOrEngineDir, 'node_modules', 'playwright-core', '.local-browsers'),
    path.join(browsersRootOrEngineDir, 'node_modules', 'playwright', '.local-browsers'),
  ];
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    if (walkFindName(root, exe) || walkFindName(root, chromeExe)) return true;
  }
  return false;
}

/** User-facing error — actionable, no stack dumps. */
export function friendlyEngineError(err: unknown): string {
  return formatVideoEngineError(err).userMessage;
}

/** Clear user text + raw technical cause (for UI + admin error feed). */
export function formatVideoEngineError(err: unknown): { userMessage: string; technicalDetail: string } {
  const raw = err instanceof Error ? err.message : String(err || '');
  const technicalDetail = raw.replace(/\s+/g, ' ').trim().slice(0, 4000) || '(no technical detail)';

  let userMessage =
    'Video cleanup could not finish. Omni repairs missing components automatically — wait a moment, then retry the same video.';
  if (/detection not confident|No clear watermark|no watermark|not confident|detection failed/i.test(raw)) {
    userMessage =
      'No clear watermark found in this video. Try another clip or a clearer Gemini/Veo export.';
  } else if (/ENOENT|not found|spawn/i.test(raw) && /node/i.test(raw)) {
    userMessage =
      'Runtime was missing. Omni is repairing it automatically — wait for setup progress, then retry.';
  } else if (/playwright|chromium|headless|browser|Target closed|Executable doesn't exist/i.test(raw)) {
    userMessage =
      'Media engine was missing. Omni is repairing Chromium automatically — wait, then retry.';
  } else if (/ffmpeg|vsync|fps_mode|Unrecognized option/i.test(raw)) {
    userMessage =
      'Video tools need a repair. Omni is restoring FFmpeg automatically — wait, then retry.';
  } else if (/Engine packages missing|ffmpeg missing|engine missing|not ready|Setup not finished|Finishing setup/i.test(raw)) {
    userMessage = 'Omni is repairing system components automatically. Wait a moment, then retry.';
  } else if (/EACCES|permission|EPERM/i.test(raw)) {
    userMessage = 'Could not write output. Try another folder or run Omni-Removal as Administrator once.';
  } else if (/ENOTFOUND|ECONN|ETIMEDOUT|Waiting for connection/i.test(raw)) {
    userMessage = 'Waiting for connection… repair continues automatically.';
  } else if (technicalDetail && technicalDetail !== '(no technical detail)') {
    userMessage = `Video cleanup could not finish. Cause: ${technicalDetail.slice(0, 180)}`;
  }

  return { userMessage, technicalDetail };
}
