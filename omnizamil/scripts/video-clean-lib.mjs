import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineDir = path.join(root, 'engine', 'gwr_video');
const fastExport = path.join(engineDir, 'fast_export.mjs');

function findOnPath(cmd) {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(which, [cmd], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return '';
  const line = String(r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  return line && existsSync(line) ? line : '';
}

function resolveFfmpeg() {
  const fromPath = findOnPath('ffmpeg');
  if (fromPath) return fromPath;
  const local = path.join(root, '.runtime', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (existsSync(local)) return local;
  return '';
}

function resolveChrome() {
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
  return '';
}

function resolveNode() {
  return findOnPath('node') || (existsSync('D:\\nodejs\\node.exe') ? 'D:\\nodejs\\node.exe' : 'node');
}

export function runVideoClean(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!existsSync(fastExport)) {
      reject(new Error('Omni Remover engine missing (engine/gwr_video/fast_export.mjs)'));
      return;
    }
    if (!existsSync(path.join(engineDir, 'node_modules', 'playwright'))) {
      reject(new Error('Engine packages missing. Run npm install in engine/gwr_video'));
      return;
    }
    const ffmpeg = resolveFfmpeg();
    if (!ffmpeg) {
      reject(new Error('ffmpeg not found on PATH'));
      return;
    }

    const env = { ...process.env, GWR_FFMPEG_PATH: ffmpeg };
    const chrome = resolveChrome();
    if (chrome) env.GWR_CHROMIUM_PATH = chrome;

    const child = spawn(resolveNode(), [fastExport, inputPath, outputPath], {
      cwd: engineDir,
      env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => {
      stdout += String(c);
    });
    child.stderr?.on('data', (c) => {
      stderr += String(c);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        const m = stdout.match(/processedFrames":(\d+)/);
        resolve({ frames: m ? Number(m[1]) : 0, outputPath });
        return;
      }
      reject(new Error((stderr || stdout || `exit ${code}`).trim().slice(-800) || 'Video clean failed'));
    });
  });
}

export async function cleanVideoBase64(inputBase64, inputName = 'input.mp4') {
  const tmp = path.join(os.tmpdir(), `omnizamil-api-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const safe = String(inputName).replace(/[^\w.\-]+/g, '_') || 'input.mp4';
  const inputPath = path.join(tmp, safe);
  const outputPath = path.join(tmp, safe.replace(/\.[^.]+$/, '') + '-clean.mp4');
  try {
    writeFileSync(inputPath, Buffer.from(inputBase64, 'base64'));
    const meta = await runVideoClean(inputPath, outputPath);
    const buf = readFileSync(outputPath);
    return {
      ok: true,
      frames: meta.frames,
      base64: buf.toString('base64'),
      size: buf.length,
      fileName: path.basename(outputPath),
    };
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
