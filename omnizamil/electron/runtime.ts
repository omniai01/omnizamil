import { app } from 'electron';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  cpSync,
  rmSync,
  createWriteStream,
  statSync,
} from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { friendlyEngineError, playwrightBrowserInstalled } from './ids';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FFMPEG_ZIP_URL =
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const NODE_ZIP_URL = 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip';

export type SetupComponentStatus = 'ready' | 'installing' | 'needed';

export type SetupComponent = {
  id: string;
  name: string;
  status: SetupComponentStatus;
};

export type DepsProgress = {
  stage: string;
  percent: number;
  etaSeconds?: number | null;
  imageStatus?: 'ready' | 'missing' | 'installing';
  videoStatus?: 'ready' | 'missing' | 'installing';
  components?: SetupComponent[];
};

/** User-facing setup steps â€” NFC codes only (never expose engine names). */
export const SETUP_COMPONENTS: { id: string; name: string }[] = [
  { id: 'runtime', name: 'NFC-01' },
  { id: 'packages', name: 'NFC-02' },
  { id: 'media', name: 'NFC-03' },
  { id: 'video', name: 'NFC-04' },
];

function componentStates(
  statuses: Partial<Record<string, SetupComponentStatus>>,
): SetupComponent[] {
  return SETUP_COMPONENTS.map((c) => ({
    ...c,
    status: statuses[c.id] || 'needed',
  }));
}

const activeChildren = new Set<ChildProcess>();
let depsAbort: AbortController | null = null;

export class DepsStoppedError extends Error {
  constructor() {
    super('Setup stopped.');
    this.name = 'DepsStoppedError';
  }
}

function assertNotStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new DepsStoppedError();
}

function killChild(child: ChildProcess) {
  try {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      child.kill('SIGKILL');
    }
  } catch {
    /* ignore */
  }
}

function trackChild(child: ChildProcess, signal?: AbortSignal) {
  activeChildren.add(child);
  const onAbort = () => killChild(child);
  if (signal) {
    if (signal.aborted) killChild(child);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  child.on('exit', () => {
    activeChildren.delete(child);
    signal?.removeEventListener('abort', onAbort);
  });
  return child;
}

/** Kill any in-flight Omni setup (npm / browser / downloads). */
export function stopDepsInstall() {
  depsAbort?.abort();
  for (const c of [...activeChildren]) killChild(c);
  activeChildren.clear();
}

export function beginDepsInstall(): AbortSignal {
  // Reuse in-flight controller so a 10s heal tick never aborts an active install
  if (depsAbort && !depsAbort.signal.aborted) {
    return depsAbort.signal;
  }
  depsAbort = new AbortController();
  return depsAbort.signal;
}

function appRoot() {
  // Packaged: resources/app (or asar root). Dev: project root (parent of dist-electron).
  if (app.isPackaged) {
    return app.getAppPath();
  }
  return path.join(__dirname, '..');
}

function runtimeRoot() {
  return path.join(app.getPath('userData'), '.omnizamil-runtime');
}

/** Stable Playwright browsers home â€” same path for install, check, and video run. */
function browsersDir() {
  return path.join(runtimeRoot(), 'browsers');
}

function packagedSeedEngine() {
  return path.join(process.resourcesPath, 'engine', 'gwr_video');
}

function bundledRuntimeRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bundled-runtime');
  }
  return path.join(appRoot(), 'bundled-runtime');
}

/** Copy bundled Node / Chromium / ffmpeg into AppData once â€” no download when present. */
function seedBundledRuntime() {
  const src = bundledRuntimeRoot();
  if (!existsSync(src)) return;

  try {
    mkdirSync(runtimeRoot(), { recursive: true });
  } catch {
    /* ignore */
  }

  const srcNodeDir = path.join(src, 'node');
  const srcNode = path.join(srcNodeDir, 'node.exe');
  const destNodeDir = path.join(runtimeRoot(), 'node');
  const destNode = path.join(destNodeDir, 'node.exe');
  if (existsSync(srcNode) && !existsSync(destNode)) {
    try {
      cpSync(srcNodeDir, destNodeDir, { recursive: true });
    } catch (err) {
      console.error('[Omni-Removal] seed node failed:', err);
    }
  }

  const srcFfmpeg = path.join(src, 'bin', 'ffmpeg.exe');
  if (existsSync(srcFfmpeg) && !probeFfmpeg(runtimeFfmpegPath())) {
    try {
      mkdirSync(binDir(), { recursive: true });
      copyFileSync(srcFfmpeg, runtimeFfmpegPath());
    } catch (err) {
      console.error('[Omni-Removal] seed ffmpeg failed:', err);
    }
  }

  const srcBrowsers = path.join(src, 'browsers');
  if (existsSync(srcBrowsers) && !playwrightBrowsersReady()) {
    try {
      mkdirSync(browsersDir(), { recursive: true });
      cpSync(srcBrowsers, browsersDir(), { recursive: true });
    } catch (err) {
      console.error('[Omni-Removal] seed browsers failed:', err);
    }
  }
}

function runtimeEngineDir() {
  return path.join(runtimeRoot(), 'engine', 'gwr_video');
}

/** Seed scripts live in install resources; heavy deps install into hidden AppData. */
export function engineDir() {
  if (app.isPackaged) {
    return runtimeEngineDir();
  }
  return path.join(appRoot(), 'engine', 'gwr_video');
}

function ensureEngineSeeded() {
  if (!app.isPackaged) return;
  const dest = runtimeEngineDir();
  const seed = packagedSeedEngine();
  if (!existsSync(path.join(seed, 'fast_export.mjs'))) {
    throw new Error('Omni-Removal engine missing from install. Please reinstall.');
  }

  mkdirSync(dest, { recursive: true });

  // Always refresh scripts/dist from install seed â€” never wipe node_modules
  const syncFiles = ['fast_export.mjs', 'roi_worker.mjs', 'run_video_pipeline.mjs', 'package.json'];
  for (const name of syncFiles) {
    const from = path.join(seed, name);
    const to = path.join(dest, name);
    if (existsSync(from)) {
      try {
        cpSync(from, to);
      } catch {
        /* ignore locked */
      }
    }
  }
  const seedDist = path.join(seed, 'dist');
  const destDist = path.join(dest, 'dist');
  if (existsSync(seedDist)) {
    mkdirSync(destDist, { recursive: true });
    try {
      cpSync(seedDist, destDist, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  // First install: copy src if missing (some helpers import from src)
  const seedSrc = path.join(seed, 'src');
  const destSrc = path.join(dest, 'src');
  if (existsSync(seedSrc) && !existsSync(path.join(destSrc, 'sdk', 'video.js'))) {
    try {
      cpSync(seedSrc, destSrc, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(path.join(dest, 'package-lock.json')) && existsSync(path.join(seed, 'package-lock.json'))) {
    try {
      cpSync(path.join(seed, 'package-lock.json'), path.join(dest, 'package-lock.json'));
    } catch {
      /* ignore */
    }
  }

  // First install: copy prebundled node_modules from installer (offline)
  const seedNm = path.join(seed, 'node_modules');
  const destNm = path.join(dest, 'node_modules');
  if (existsSync(path.join(seedNm, 'playwright')) && !existsSync(path.join(destNm, 'playwright'))) {
    try {
      cpSync(seedNm, destNm, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  hideRuntimeFolder();
}

export function fastExportScript() {
  return path.join(engineDir(), 'fast_export.mjs');
}

function detectPagePath() {
  return path.join(engineDir(), 'dist', 'detect.html');
}

function engineScriptsReady() {
  return (
    existsSync(fastExportScript()) &&
    existsSync(detectPagePath()) &&
    existsSync(path.join(engineDir(), 'dist', 'detect-entry.bundle.js'))
  );
}

function binDir() {
  return path.join(runtimeRoot(), 'bin');
}

export function runtimeFfmpegPath() {
  return path.join(binDir(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}

function hideRuntimeFolder() {
  if (process.platform !== 'win32') return;
  try {
    const root = runtimeRoot();
    // Hidden + system on the runtime root and everything under it (user should not browse these files)
    spawnSync('attrib', ['+H', '+S', root], { windowsHide: true });
    spawnSync('cmd.exe', ['/d', '/s', '/c', `attrib +H +S /S /D "${root}\\*"`], {
      windowsHide: true,
    });
  } catch {
    /* ignore */
  }
}

function probeFfmpeg(bin: string) {
  if (!bin || !existsSync(bin)) return false;
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0;
}

function findOnPath(cmd: string): string {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(which, [cmd], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return '';
  const line = String(r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  return line && existsSync(line) ? line : '';
}

export function resolveFfmpegBin() {
  const runtime = runtimeFfmpegPath();
  if (probeFfmpeg(runtime)) return runtime;
  const pathBin = findOnPath('ffmpeg');
  if (probeFfmpeg(pathBin)) return pathBin;
  return '';
}

export function resolveChromePath() {
  if (process.env.GWR_CHROMIUM_PATH && existsSync(process.env.GWR_CHROMIUM_PATH)) {
    return process.env.GWR_CHROMIUM_PATH;
  }
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const c of candidates) {
      if (c && existsSync(c)) return c;
    }
  }
  return findOnPath('chrome') || findOnPath('google-chrome') || findOnPath('chromium');
}

function playwrightReady() {
  return existsSync(path.join(engineDir(), 'node_modules', 'playwright'));
}

function playwrightBrowsersReady() {
  return Boolean(resolveChromiumExecutable());
}

/** Prefer full Chromium (video codecs) over headless-shell. */
function resolveChromiumExecutable(): string {
  if (process.env.GWR_CHROMIUM_PATH && existsSync(process.env.GWR_CHROMIUM_PATH)) {
    return process.env.GWR_CHROMIUM_PATH;
  }
  const roots = [
    browsersDir(),
    path.join(engineDir(), 'node_modules', 'playwright'),
    path.join(engineDir(), 'node_modules', 'playwright-core'),
  ];
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    const fullChrome = walkFind(root, process.platform === 'win32' ? 'chrome.exe' : 'chrome');
    // Prefer real chrome-win build (codecs) over helper proxies
    if (fullChrome && /chrome-win|chromium-\d+/i.test(fullChrome) && !/proxy|pwa_launcher|headless/i.test(fullChrome)) {
      return fullChrome;
    }
    if (fullChrome && !/proxy|pwa_launcher|headless/i.test(fullChrome)) return fullChrome;
  }
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    const shell = walkFind(
      root,
      process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell',
    );
    if (shell) return shell;
  }
  const system = resolveChromePath();
  return system && existsSync(system) ? system : '';
}

function playwrightEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browsersDir(),
  };
}

function walkFind(dir: string, name: string): string {
  if (!existsSync(dir)) return '';
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        const hit = walkFind(full, name);
        if (hit) return hit;
      } else if (entry.toLowerCase() === name.toLowerCase()) {
        return full;
      }
    } catch {
      /* skip */
    }
  }
  return '';
}

function downloadFile(
  url: string,
  dest: string,
  onProgress?: (pct: number, etaSeconds: number | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    assertNotStopped(signal);
    const get = (target: string, redirects = 0) => {
      if (redirects > 8) {
        reject(new Error('Download redirect limit'));
        return;
      }
      const lib = target.startsWith('https') ? https : http;
      const req = lib
        .get(target, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            get(res.headers.location, redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed (${res.statusCode})`));
            return;
          }
          const total = Number(res.headers['content-length'] || 0);
          let received = 0;
          const started = Date.now();
          const out = createWriteStream(dest);
          const onAbort = () => {
            req.destroy();
            res.destroy();
            try {
              out.close();
            } catch {
              /* ignore */
            }
            reject(new DepsStoppedError());
          };
          if (signal) {
            if (signal.aborted) {
              onAbort();
              return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
          }
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (total > 0 && onProgress) {
              const pct = Math.min(95, Math.round((received / total) * 90));
              const elapsed = (Date.now() - started) / 1000;
              const speed = elapsed > 0.2 ? received / elapsed : 0;
              const remaining = speed > 0 ? Math.round((total - received) / speed) : null;
              onProgress(pct, remaining);
            }
          });
          res.pipe(out);
          out.on('finish', () => {
            out.close();
            signal?.removeEventListener('abort', onAbort);
            resolve();
          });
          out.on('error', reject);
        })
        .on('error', reject);
    };
    get(url);
  });
}

function extractZipWindows(zipPath: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  const ps = `
$ErrorActionPreference = 'Stop'
Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force
`;
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error('Could not unpack ffmpeg package');
}

function isNetworkErrno(err: unknown): boolean {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code || '') : '';
  if (/^(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH)$/i.test(code)) {
    return true;
  }
  const raw = err instanceof Error ? err.message : String(err || '');
  return /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up|network is unreachable|Waiting for connection/i.test(
    raw,
  );
}

function friendlySetupError(err: unknown): Error {
  if (err instanceof DepsStoppedError) return err;
  const raw = err instanceof Error ? err.message : String(err || '');
  if (/stopped/i.test(raw)) return new DepsStoppedError();
  if (/reinstall|engine missing|fresh install/i.test(raw)) {
    return new Error('Omni-Removal needs a fresh install. Please reinstall the setup.');
  }
  if (isNetworkErrno(err) || /CERT_|TLS|UNABLE_TO_VERIFY/i.test(raw)) {
    // Never blame Wiâ€‘Fi to the user â€” UI waits and auto-retries
    return new Error('Waiting for connectionâ€¦ Setup continues automatically.');
  }
  return new Error('Finishing setupâ€¦ Omni continues automatically.');
}

async function withRetries<T>(
  label: string,
  attempts: number,
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    assertNotStopped(signal);
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (err instanceof DepsStoppedError || signal?.aborted) throw err;
      if (i >= attempts) break;
      // Brief pause before retry (helps flaky Wiâ€‘Fi / CDN)
      await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
  throw friendlySetupError(last ?? new Error(`${label} failed`));
}

/** Soft percent climb so UI never looks frozen on a long first-time step. */
function startProgressPulse(
  onProgress: ((p: DepsProgress) => void) | undefined,
  from: number,
  to: number,
  base: Omit<DepsProgress, 'percent'>,
  signal?: AbortSignal,
) {
  let current = from;
  onProgress?.({ ...base, percent: current });
  const timer = setInterval(() => {
    if (signal?.aborted) {
      clearInterval(timer);
      return;
    }
    if (current >= to - 0.5) return;
    // ~1% every ~900ms â€” feels alive during long downloads without jumping ahead
    current = Math.min(to - 0.5, current + 0.9);
    onProgress?.({ ...base, percent: Math.round(current) });
  }, 900);
  return () => clearInterval(timer);
}

function runNpmInstall(onProgress?: (p: DepsProgress) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      assertNotStopped(signal);
    } catch (e) {
      reject(e);
      return;
    }
    const base = {
      stage: 'Setting up Omniâ€¦ first time can take a little while',
      imageStatus: 'installing' as const,
      videoStatus: 'installing' as const,
    };
    const stopPulse = startProgressPulse(onProgress, 20, 38, base, signal);
    const nodeBin = resolveNodeBin();
    const npmCli = path.join(path.dirname(nodeBin), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const useBundledNpm = existsSync(npmCli);
    const child = trackChild(
      useBundledNpm
        ? spawn(nodeBin, [npmCli, 'install', '--prefer-offline'], {
            cwd: engineDir(),
            windowsHide: true,
            env: { ...process.env, PATH: `${path.dirname(nodeBin)}${path.delimiter}${process.env.PATH || ''}` },
          })
        : spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--prefer-offline'], {
            cwd: engineDir(),
            windowsHide: true,
            shell: true,
          }),
      signal,
    );
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
      if (err.length > 4000) err = err.slice(-4000);
    });
    child.on('error', (e) => {
      stopPulse();
      reject(friendlySetupError(e));
    });
    child.on('exit', (code) => {
      stopPulse();
      if (signal?.aborted) {
        reject(new DepsStoppedError());
        return;
      }
      if (code === 0) {
        onProgress?.({ ...base, percent: 40, imageStatus: 'ready', videoStatus: 'missing' });
        resolve();
      } else reject(friendlySetupError(new Error(err || 'setup failed')));
    });
  });
}

function runPlaywrightInstall(onProgress?: (p: DepsProgress) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      assertNotStopped(signal);
    } catch (e) {
      reject(e);
      return;
    }
    if (playwrightBrowsersReady()) {
      resolve();
      return;
    }
    const base = {
      stage: 'Setting up Omniâ€¦ first time can take a little while',
      imageStatus: 'ready' as const,
      videoStatus: 'installing' as const,
    };
    const stopPulse = startProgressPulse(onProgress, 55, 78, base, signal);
    mkdirSync(browsersDir(), { recursive: true });
    const nodeBin = resolveNodeBin();
    const playwrightCli = path.join(engineDir(), 'node_modules', 'playwright', 'cli.js');
    const useCli = existsSync(playwrightCli);
    const child = trackChild(
      useCli
        ? spawn(nodeBin, [playwrightCli, 'install', 'chromium'], {
            cwd: engineDir(),
            windowsHide: true,
            env: playwrightEnv(),
          })
        : spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'install', 'chromium'], {
            cwd: engineDir(),
            windowsHide: true,
            shell: true,
            env: {
              ...playwrightEnv(),
              PATH: `${path.dirname(nodeBin)}${path.delimiter}${process.env.PATH || ''}`,
            },
          }),
      signal,
    );
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
      if (err.length > 4000) err = err.slice(-4000);
    });
    child.stdout?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => {
      stopPulse();
      reject(friendlySetupError(e));
    });
    child.on('exit', (code) => {
      stopPulse();
      hideRuntimeFolder();
      if (signal?.aborted) {
        reject(new DepsStoppedError());
        return;
      }
      if (playwrightBrowsersReady()) {
        onProgress?.({ ...base, percent: 80 });
        resolve();
      } else reject(friendlySetupError(new Error(err || 'setup failed')));
    });
  });
}

export type DepCheckItem = {
  id: string;
  name: string;
  ready: boolean;
  label: string;
  detail: string;
};

export async function getDepsStatus() {
  try {
    ensureEngineSeeded();
    seedBundledRuntime();
  } catch {
    /* reported below via missing engine check */
  }
  const scriptOk = engineScriptsReady();
  const npmOk = playwrightReady();
  const ffmpegOk = Boolean(resolveFfmpegBin());
  const magicOk = playwrightBrowsersReady();
  const resolvedNode = resolveNodeBin();
  const nodePath = resolvedNode === 'node' ? findOnPath('node') : resolvedNode;
  const nodeOk = Boolean(nodePath && existsSync(nodePath));
  const imageReady = true;
  // Full stack required before unlock â€” no partial / image-only open
  const videoReady = scriptOk && npmOk && ffmpegOk && magicOk && nodeOk;
  const ready = videoReady;

  const components = componentStates({
    runtime: nodeOk ? 'ready' : 'needed',
    packages: npmOk ? 'ready' : 'needed',
    media: magicOk ? 'ready' : 'needed',
    video: ffmpegOk ? 'ready' : 'needed',
  });

  const checks: DepCheckItem[] = [
    {
      id: 'image',
      name: 'Image cleanup',
      ready: imageReady && ready,
      label: ready ? 'Ready' : 'Setup needed',
      detail: ready ? 'Ready to clean images' : 'One-time setup required',
    },
    {
      id: 'video',
      name: 'Video cleanup',
      ready: videoReady,
      label: videoReady ? 'Ready' : 'Setup needed',
      detail: videoReady ? 'Ready to clean videos' : 'One-time setup required',
    },
    ...components.map((c) => ({
      id: c.id,
      name: c.name,
      ready: c.status === 'ready',
      label: c.status === 'ready' ? 'Ready' : 'Setup needed',
      detail: c.status === 'ready' ? 'Installed' : 'One-time setup required',
    })),
  ];

  let message = 'Omni-Removal is ready on this PC.';
  if (!ready) {
    message = 'One-time setup in progress. Omni continues automatically â€” no action needed.';
  }

  return {
    ready,
    videoReady,
    message,
    checks,
    components,
    image: {
      ready: imageReady && ready,
      label: ready ? 'Ready' : 'Setup needed',
    },
    video: {
      ready: videoReady,
      label: videoReady ? 'Ready' : 'Setup needed',
    },
  };
}

let ensureInFlight: Promise<{ ok: true; restartedNeeded: boolean; videoReady: boolean }> | null = null;

async function sleepMs(ms: number, signal?: AbortSignal) {
  const step = 500;
  let left = ms;
  while (left > 0) {
    assertNotStopped(signal);
    await new Promise((r) => setTimeout(r, Math.min(step, left)));
    left -= step;
  }
}

export async function ensureDeps(onProgress?: (p: DepsProgress) => void, signal?: AbortSignal) {
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = (async () => {
    try {
      return await ensureDepsInner(onProgress, signal);
    } finally {
      ensureInFlight = null;
    }
  })();
  return ensureInFlight;
}

async function ensureDepsInner(onProgress?: (p: DepsProgress) => void, signal?: AbortSignal) {
  const report = (partial: DepsProgress) => {
    assertNotStopped(signal);
    onProgress?.(partial);
  };

  for (;;) {
    assertNotStopped(signal);
    try {
      const result = await ensureDepsOnce(report, signal);
      if (result.videoReady) return result;
      report({
        stage: 'Finishing remaining componentsâ€¦',
        percent: 92,
        imageStatus: 'installing',
        videoStatus: 'installing',
      });
      await sleepMs(10_000, signal);
    } catch (err) {
      if (err instanceof DepsStoppedError || signal?.aborted) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (isNetworkErrno(err) || /Waiting for connection/i.test(msg)) {
        report({
          stage: 'Waiting for connectionâ€¦ Setup continues automatically.',
          percent: 35,
          imageStatus: 'installing',
          videoStatus: 'installing',
        });
        await sleepMs(10_000, signal);
        continue;
      }
      report({
        stage: 'Finishing setupâ€¦ Omni continues automatically.',
        percent: 40,
        imageStatus: 'installing',
        videoStatus: 'installing',
      });
      await sleepMs(10_000, signal);
    }
  }
}

async function ensureDepsOnce(
  report: (partial: DepsProgress) => void,
  signal?: AbortSignal,
) {
  mkdirSync(binDir(), { recursive: true });
  ensureEngineSeeded();
  seedBundledRuntime();
  assertNotStopped(signal);

  if (!engineScriptsReady()) {
    throw new Error('Omni-Removal needs a fresh install. Please reinstall the setup.');
  }

  const early = await getDepsStatus();
  if (early.ready && early.videoReady) {
    report({
      stage: 'Omni-Removal is ready',
      percent: 100,
      etaSeconds: 0,
      imageStatus: 'ready',
      videoStatus: 'ready',
      components: early.components,
    });
    return { ok: true as const, restartedNeeded: false, videoReady: true };
  }

  let comps = componentStates({
    runtime: 'installing',
    packages: 'needed',
    media: 'needed',
    video: 'needed',
  });

  report({
    stage: 'Preparing NFC components…',
    percent: 4,
    imageStatus: 'installing',
    videoStatus: 'installing',
    components: comps,
  });

  report({
    stage: 'NFC-01',
    percent: 8,
    imageStatus: 'installing',
    videoStatus: 'installing',
    components: comps,
  });
  await ensurePortableNode(
    (p) =>
      report({
        ...p,
        stage: 'NFC-01',
        components: comps,
      }),
    signal,
  );
  assertNotStopped(signal);
  comps = componentStates({
    runtime: 'ready',
    packages: playwrightReady() ? 'ready' : 'installing',
    media: 'needed',
    video: 'needed',
  });

  if (!playwrightReady()) {
    report({
      stage: 'NFC-02',
      percent: 22,
      imageStatus: 'installing',
      videoStatus: 'installing',
      components: comps,
    });
    await withRetries(
      'packages',
      3,
      () =>
        runNpmInstall(
          (p) =>
            report({
              ...p,
              stage: 'NFC-02',
              components: comps,
            }),
          signal,
        ),
      signal,
    );
  }
  assertNotStopped(signal);
  comps = componentStates({
    runtime: 'ready',
    packages: 'ready',
    media: playwrightBrowsersReady() ? 'ready' : 'installing',
    video: 'needed',
  });

  report({
    stage: 'NFC-03',
    percent: 48,
    imageStatus: 'ready',
    videoStatus: 'installing',
    components: comps,
  });
  if (!playwrightBrowsersReady()) {
    await withRetries(
      'media',
      3,
      () =>
        runPlaywrightInstall(
          (p) =>
            report({
              ...p,
              stage: 'NFC-03',
              components: comps,
            }),
          signal,
        ),
      signal,
    );
  }
  assertNotStopped(signal);
  comps = componentStates({
    runtime: 'ready',
    packages: 'ready',
    media: 'ready',
    video: resolveFfmpegBin() ? 'ready' : 'installing',
  });

  let ffmpeg = resolveFfmpegBin();
  if (!ffmpeg) {
    report({
      stage: 'NFC-04',
      percent: 62,
      imageStatus: 'ready',
      videoStatus: 'installing',
      components: comps,
    });
    await withRetries(
      'video-tools',
      3,
      async () => {
        const work = path.join(runtimeRoot(), 'tmp');
        mkdirSync(work, { recursive: true });
        const zipPath = path.join(work, 'ffmpeg.zip');
        try {
          await downloadFile(
            FFMPEG_ZIP_URL,
            zipPath,
            (pct, eta) =>
              report({
                stage: 'NFC-04',
                percent: Math.max(62, Math.min(88, 62 + Math.round(pct * 0.26))),
                etaSeconds: eta,
                imageStatus: 'ready',
                videoStatus: 'installing',
                components: comps,
              }),
            signal,
          );
          assertNotStopped(signal);
          report({
            stage: 'Finishing NFC components…',
            percent: 90,
            imageStatus: 'ready',
            videoStatus: 'installing',
            components: comps,
          });
          const unpack = path.join(work, 'unpack');
          if (existsSync(unpack)) rmSync(unpack, { recursive: true, force: true });
          extractZipWindows(zipPath, unpack);
          const found = walkFind(unpack, 'ffmpeg.exe');
          if (!found) throw new Error('Omni setup incomplete.');
          copyFileSync(found, runtimeFfmpegPath());
          if (!probeFfmpeg(runtimeFfmpegPath())) throw new Error('Omni setup incomplete.');
          hideRuntimeFolder();
        } finally {
          try {
            rmSync(work, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }
      },
      signal,
    );
    ffmpeg = resolveFfmpegBin();
  }

  const pathBin = findOnPath('ffmpeg');
  if (!probeFfmpeg(runtimeFfmpegPath()) && probeFfmpeg(pathBin)) {
    copyFileSync(pathBin, runtimeFfmpegPath());
    hideRuntimeFolder();
  }

  comps = componentStates({
    runtime: 'ready',
    packages: playwrightReady() ? 'ready' : 'needed',
    media: playwrightBrowsersReady() ? 'ready' : 'needed',
    video: resolveFfmpegBin() ? 'ready' : 'needed',
  });

  report({
    stage: 'Double-checking NFC components…',
    percent: 96,
    etaSeconds: 0,
    imageStatus: 'ready',
    videoStatus: playwrightBrowsersReady() && resolveFfmpegBin() ? 'ready' : 'installing',
    components: comps,
  });

  let final = await getDepsStatus();
  if (!final.videoReady) {
    if (!playwrightReady()) {
      await withRetries('packages-recheck', 2, () => runNpmInstall(undefined, signal), signal);
    }
    if (!playwrightBrowsersReady()) {
      await withRetries('media-recheck', 2, () => runPlaywrightInstall(undefined, signal), signal);
    }
    if (!resolveFfmpegBin()) {
      await withRetries(
        'video-recheck',
        2,
        async () => {
          const work = path.join(runtimeRoot(), 'tmp');
          mkdirSync(work, { recursive: true });
          const zipPath = path.join(work, 'ffmpeg.zip');
          try {
            await downloadFile(FFMPEG_ZIP_URL, zipPath, undefined, signal);
            const unpack = path.join(work, 'unpack');
            if (existsSync(unpack)) rmSync(unpack, { recursive: true, force: true });
            extractZipWindows(zipPath, unpack);
            const found = walkFind(unpack, 'ffmpeg.exe');
            if (!found) throw new Error('incomplete');
            copyFileSync(found, runtimeFfmpegPath());
            if (!probeFfmpeg(runtimeFfmpegPath())) throw new Error('incomplete');
            hideRuntimeFolder();
          } finally {
            try {
              rmSync(work, { recursive: true, force: true });
            } catch {
              /* ignore */
            }
          }
        },
        signal,
      );
    }
    final = await getDepsStatus();
  }

  comps = componentStates({
    runtime: 'ready',
    packages: playwrightReady() ? 'ready' : 'needed',
    media: playwrightBrowsersReady() ? 'ready' : 'needed',
    video: resolveFfmpegBin() ? 'ready' : 'needed',
  });

  report({
    stage: final.videoReady ? 'Omni-Removal is ready' : 'Finishing remaining componentsâ€¦',
    percent: 100,
    etaSeconds: 0,
    imageStatus: 'ready',
    videoStatus: final.videoReady ? 'ready' : 'missing',
    components: comps,
  });

  if (!final.ready || !final.videoReady) {
    throw new Error('Finishing setupâ€¦ Omni continues automatically.');
  }

  return { ok: true as const, restartedNeeded: false, videoReady: true };
}

export function resolveNodeBin() {
  // Always prefer AppData portable Node (matches bundled Playwright/Chromium)
  const runtimeNode = path.join(runtimeRoot(), 'node', 'node.exe');
  if (existsSync(runtimeNode)) return runtimeNode;

  // Packaged install: try seed from resources before falling back to PATH
  try {
    seedBundledRuntime();
  } catch {
    /* ignore */
  }
  if (existsSync(runtimeNode)) return runtimeNode;

  const fromPath = findOnPath('node');
  if (fromPath) return fromPath;
  if (process.platform === 'win32' && existsSync('D:\\nodejs\\node.exe')) return 'D:\\nodejs\\node.exe';
  return 'node';
}

async function ensurePortableNode(onProgress?: (p: DepsProgress) => void, signal?: AbortSignal) {
  if (process.platform !== 'win32') return;
  const existing = resolveNodeBin();
  if (existing !== 'node' && existsSync(existing)) {
    const probe = spawnSync(existing, ['-v'], { encoding: 'utf8', windowsHide: true });
    if (probe.status === 0) return;
  }
  assertNotStopped(signal);
  onProgress?.({
    stage: 'Setting up Omniâ€¦',
    percent: 8,
    imageStatus: 'installing',
    videoStatus: 'installing',
  });
  const work = path.join(runtimeRoot(), 'tmp-node');
  mkdirSync(work, { recursive: true });
  const zipPath = path.join(work, 'node.zip');
  try {
    await downloadFile(
      NODE_ZIP_URL,
      zipPath,
      (pct, eta) =>
        onProgress?.({
          stage: 'Setting up Omniâ€¦',
          percent: Math.max(8, Math.min(18, Math.round(pct * 0.18))),
          etaSeconds: eta,
          imageStatus: 'installing',
          videoStatus: 'installing',
        }),
      signal,
    );
    assertNotStopped(signal);
    const unpack = path.join(work, 'unpack');
    if (existsSync(unpack)) rmSync(unpack, { recursive: true, force: true });
    extractZipWindows(zipPath, unpack);
    const found = walkFind(unpack, 'node.exe');
    if (!found) throw new Error('Omni setup incomplete. Tap Resume.');
    const nodeHome = path.dirname(found);
    const dest = path.join(runtimeRoot(), 'node');
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(nodeHome, dest, { recursive: true });
    hideRuntimeFolder();
  } finally {
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export function runFastExport(
  inputPath: string,
  outputPath: string,
  onLog?: (line: string) => void,
): Promise<{ ok: true; frames: number }> {
  return new Promise((resolve, reject) => {
    try {
      ensureEngineSeeded();
    } catch (err) {
      reject(new Error(friendlyEngineError(err instanceof Error ? err : new Error(String(err)))));
      return;
    }
    if (!engineScriptsReady()) {
      reject(new Error(friendlyEngineError(new Error('engine missing'))));
      return;
    }
    const ffmpeg = resolveFfmpegBin();
    if (!ffmpeg) {
      reject(new Error(friendlyEngineError(new Error('ffmpeg missing'))));
      return;
    }
    if (!playwrightReady()) {
      reject(new Error(friendlyEngineError(new Error('Engine packages missing'))));
      return;
    }
    const chromiumPath = resolveChromiumExecutable();
    if (!chromiumPath) {
      reject(new Error(friendlyEngineError(new Error('playwright browser missing'))));
      return;
    }

    const nodeBin = resolveNodeBin();
    const nodePath = nodeBin === 'node' ? findOnPath('node') : nodeBin;
    if (!nodePath || !existsSync(nodePath)) {
      reject(new Error(friendlyEngineError(new Error('node not found'))));
      return;
    }
    mkdirSync(browsersDir(), { recursive: true });
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...playwrightEnv(),
      GWR_FFMPEG_PATH: ffmpeg,
      GWR_CHROMIUM_PATH: chromiumPath,
      PATH: `${path.dirname(nodePath)}${path.delimiter}${process.env.PATH || ''}`,
    };

    const child = spawn(nodePath, [fastExportScript(), inputPath, outputPath], {
      cwd: engineDir(),
      env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => {
      const s = String(c);
      stdout += s;
      onLog?.(s);
    });
    child.stderr?.on('data', (c) => {
      const s = String(c);
      stderr += s;
      onLog?.(s);
    });
    child.on('error', (err) => reject(new Error(friendlyEngineError(err))));
    child.on('exit', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        const m = stdout.match(/processedFrames":(\d+)/);
        resolve({ ok: true, frames: m ? Number(m[1]) : 0 });
        return;
      }
      const msg = (stderr || stdout || `exit ${code}`).trim().slice(-800);
      console.error('[Omni-Removal] video engine error:', msg);
      reject(new Error(friendlyEngineError(new Error(msg))));
    });
  });
}
