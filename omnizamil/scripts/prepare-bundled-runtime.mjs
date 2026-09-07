/**
 * Pre-download Node + FFmpeg + Playwright Chromium and ensure engine npm deps
 * so the installer can seed offline. Run before electron-builder.
 */
import { spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  statSync,
  copyFileSync,
} from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'bundled-runtime');
const engine = path.join(root, 'engine', 'gwr_video');

const NODE_ZIP = 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip';
const FFMPEG_ZIP =
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(dest), { recursive: true });
    const file = createWriteStream(dest);
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Omni-Removal-Prepare' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try {
          rmSync(dest, { force: true });
        } catch {
          /* ignore */
        }
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed (${res.statusCode}) ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', reject);
  });
}

function extractZip(zipPath, dest) {
  mkdirSync(dest, { recursive: true });
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
    { encoding: 'utf8', windowsHide: true },
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'unzip failed');
}

function walkFind(dir, name, depth = 0) {
  if (!existsSync(dir) || depth > 12) return '';
  for (const ent of readdirSync(dir)) {
    const full = path.join(dir, ent);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isFile() && ent.toLowerCase() === name.toLowerCase()) return full;
    if (st.isDirectory()) {
      const hit = walkFind(full, name, depth + 1);
      if (hit) return hit;
    }
  }
  return '';
}

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
  if (r.status !== 0 && r.status != null) throw new Error(`${cmd} failed (${r.status})`);
  if (r.error) throw r.error;
}

async function main() {
  mkdirSync(out, { recursive: true });

  const hasPw = existsSync(path.join(engine, 'node_modules', 'playwright'));
  if (!hasPw) {
    console.log('[prepare] engine npm install…');
    run('npm', ['install', '--omit=dev'], { cwd: engine });
  } else {
    console.log('[prepare] engine node_modules already present');
  }

  const nodeDest = path.join(out, 'node');
  if (!existsSync(path.join(nodeDest, 'node.exe'))) {
    console.log('[prepare] downloading portable Node…');
    const work = path.join(out, 'tmp-node');
    mkdirSync(work, { recursive: true });
    const zip = path.join(work, 'node.zip');
    await download(NODE_ZIP, zip);
    const unpack = path.join(work, 'unpack');
    extractZip(zip, unpack);
    const found = walkFind(unpack, 'node.exe');
    if (!found) throw new Error('node.exe not found in zip');
    if (existsSync(nodeDest)) rmSync(nodeDest, { recursive: true, force: true });
    cpSync(path.dirname(found), nodeDest, { recursive: true });
    rmSync(work, { recursive: true, force: true });
  } else {
    console.log('[prepare] Node already bundled');
  }

  const ffmpegDest = path.join(out, 'bin', 'ffmpeg.exe');
  if (!existsSync(ffmpegDest)) {
    console.log('[prepare] downloading FFmpeg…');
    const work = path.join(out, 'tmp-ffmpeg');
    mkdirSync(work, { recursive: true });
    const zip = path.join(work, 'ffmpeg.zip');
    await download(FFMPEG_ZIP, zip);
    const unpack = path.join(work, 'unpack');
    extractZip(zip, unpack);
    const found = walkFind(unpack, 'ffmpeg.exe');
    if (!found) throw new Error('ffmpeg.exe not found in zip');
    mkdirSync(path.dirname(ffmpegDest), { recursive: true });
    copyFileSync(found, ffmpegDest);
    rmSync(work, { recursive: true, force: true });
  } else {
    console.log('[prepare] FFmpeg already bundled');
  }

  const browsers = path.join(out, 'browsers');
  const hasChrome =
    existsSync(browsers) && Boolean(walkFind(browsers, 'chrome.exe') || walkFind(browsers, 'chrome-headless-shell.exe'));
  if (!hasChrome) {
    console.log('[prepare] installing Playwright Chromium…');
    mkdirSync(browsers, { recursive: true });
    const nodeBin = path.join(nodeDest, 'node.exe');
    const env = {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browsers,
    };
    const localPw = path.join(engine, 'node_modules', 'playwright', 'cli.js');
    if (existsSync(localPw) && existsSync(nodeBin)) {
      run(nodeBin, [localPw, 'install', 'chromium'], { cwd: engine, env, shell: false });
    } else {
      run('npx', ['--yes', 'playwright', 'install', 'chromium'], { cwd: engine, env });
    }
  } else {
    console.log('[prepare] Chromium already bundled');
  }

  console.log('[prepare] done →', out);
}

main().catch((err) => {
  console.error('[prepare] failed:', err);
  process.exit(1);
});
