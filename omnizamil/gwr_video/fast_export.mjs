// Fast watermark export: keeps the vendored engine's exact browser-based
// detection (fast, samples ~12 frames) but replaces the slow full-video
// decode/encode loop (Chromium WebCodecs, software, no GPU in this sandbox)
// with a native ffmpeg decode/encode pipeline. Only the small watermark ROI
// (+ generous padding) is round-tripped through JS; the exact same pure
// pixel-math functions from the vendored engine (processWatermarkRoi /
// applyVideoResidualCleanup) are reused unmodified so quality matches the
// browser-only pipeline exactly.
import os from 'node:os';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { withLocalVideoPreviewPage } from './src/sdk/video.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.GWR_FFMPEG_PATH || 'ffmpeg';
const CROP_PADDING = 100;
const WORKER_COUNT = Math.max(1, Math.min(4, os.cpus().length));
const WORKER_CHUNK_SIZE = 8;
// Matches the vendored HTML page's own control defaults exactly (confirmed
// live via run_video_pipeline.mjs's actualControls echo) -- NOT the raw
// DEFAULT_* JS constants, which the page overrides with its own slider
// defaults for edgeDenoiseStrength/residualCleanupStrength/videoBitrate.
const EDGE_DENOISE_STRENGTH = 1;
const RESIDUAL_CLEANUP_STRENGTH = 1.2;
const VIDEO_BITRATE_MBPS = 12;

function run(cmd, args, { stdinPipe = false, collectStdout = false } = {}) {
    const child = spawn(cmd, args, {
        stdio: [stdinPipe ? 'pipe' : 'ignore', collectStdout ? 'pipe' : 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    return { child, getStderr: () => stderr };
}

async function detectViaBrowser(inputPath, detectOptions) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.GWR_CHROMIUM_PATH || undefined,
        args: ['--no-sandbox']
    });
    try {
        const pagePath = path.join(__dirname, 'dist/detect.html');
        return await withLocalVideoPreviewPage(pagePath, async (pageUrl) => {
            const page = await browser.newPage();
            page.setDefaultTimeout(60000);
            await page.goto(pageUrl);
            await page.waitForFunction(() => window.__gwrDetectReady === true);
            await page.locator('#fileInput').setInputFiles(inputPath);
            const result = await page.evaluate(async (opts) => {
                const file = document.getElementById('fileInput').files[0];
                return await window.__gwrDetect(file, opts);
            }, detectOptions);
            return result;
        });
    } finally {
        await browser.close();
    }
}

async function readAllFrames(stdout, frameSize, onFrame) {
    let pending = Buffer.alloc(0);
    for await (const chunk of stdout) {
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        while (pending.length >= frameSize) {
            const frame = pending.subarray(0, frameSize);
            await onFrame(frame);
            pending = pending.subarray(frameSize);
        }
    }
}

class RoiWorkerPool {
    constructor(size, workerPath) {
        // Each worker gets exactly ONE persistent message/error listener and
        // a FIFO queue of pending resolvers. worker_threads delivers replies
        // to a single-threaded worker in the same order requests were sent
        // (each message handler here runs fully synchronously with no
        // internal yielding), so matching "next reply" to "oldest pending
        // request" via FIFO is safe. Attaching a fresh once-listener per
        // call (the previous approach) is NOT safe: if a second task is
        // dispatched to the same worker before the first one's reply
        // arrives, both listeners fire on the FIRST message, silently
        // cross-wiring frame data between unrelated chunks.
        this.workers = Array.from({ length: size }, () => new Worker(workerPath));
        this.queues = this.workers.map(() => []);
        this.workers.forEach((worker, idx) => {
            worker.on('message', (msg) => {
                const resolve = this.queues[idx].shift();
                resolve?.resolve(msg.frames);
            });
            worker.on('error', (err) => {
                const pending = this.queues[idx].shift();
                pending?.reject(err);
            });
        });
        this.nextIndex = 0;
    }

    process(frames, params) {
        const idx = this.nextIndex;
        this.nextIndex = (this.nextIndex + 1) % this.workers.length;
        return new Promise((resolve, reject) => {
            this.queues[idx].push({ resolve, reject });
            this.workers[idx].postMessage({ frames, ...params }, frames);
        });
    }

    async destroy() {
        await Promise.all(this.workers.map((w) => w.terminate()));
    }
}

async function main() {
    const [, , inputPath, outputPath, denoiseBackendArg] = process.argv;
    const denoiseBackend = denoiseBackendArg || 'canvas-texture-repair';
    if (!inputPath || !outputPath) {
        console.error('Usage: fast_export.mjs <input> <output> [denoiseBackend]');
        process.exit(2);
    }

    const detected = await detectViaBrowser(inputPath, { sampleCount: 12 });
    if (!detected.ok) {
        throw new Error(`detection failed: ${detected.error}`);
    }
    const { metadata, detection } = detected;
    if (!detection.isConfident) {
        throw new Error(
            'No clear watermark found in this video (detection not confident). Try a watermarked Veo/Gemini-style clip.',
        );
    }

    const { position } = detection;
    const alphaMap = Float32Array.from(detection.alphaMap);
    const width = metadata.width;
    const height = metadata.height;
    const frameRate = metadata.frameRate > 0 ? metadata.frameRate : 30;

    const cropX = Math.max(0, position.x - CROP_PADDING);
    const cropY = Math.max(0, position.y - CROP_PADDING);
    const cropRight = Math.min(width, position.x + position.width + CROP_PADDING);
    const cropBottom = Math.min(height, position.y + position.height + CROP_PADDING);
    const cropW = cropRight - cropX;
    const cropH = cropBottom - cropY;
    const localPosition = {
        x: position.x - cropX,
        y: position.y - cropY,
        width: position.width,
        height: position.height
    };

    const seedAlphaGain = Number.isFinite(detection?.alphaSeed?.seedGain)
        ? detection.alphaSeed.seedGain
        : 1;

    // No `fps=` filter here: the source is already CFR (confirmed via
    // ffprobe r_frame_rate==avg_frame_rate) and re-stamping frame rate
    // independently in two separate ffmpeg processes risks each one
    // duplicating/dropping frames at slightly different points, which
    // silently desyncs the crop stream from the base video over time
    // (confirmed via a real repro: overlay patch showing wrong content
    // by t=5s despite matching at t=0s). Use `-vsync 0` (passthrough,
    // no frame retiming) on the extract side and plain frame-indexed
    // overlay (no `shortest`/PTS trickery) on the recombine side so both
    // ffmpeg processes walk the exact same frame sequence 1:1.
    const extract = run(FFMPEG, [
        '-y', '-i', inputPath,
        '-vsync', '0',
        '-filter:v', `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
        '-f', 'rawvideo', '-pix_fmt', 'rgba',
        'pipe:1'
    ], { collectStdout: true });

    const recombine = run(FFMPEG, [
        '-y',
        '-i', inputPath,
        '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${cropW}x${cropH}`, '-r', String(frameRate),
        '-i', 'pipe:0',
        '-filter_complex', `[0:v]setpts=PTS-STARTPTS[base];[1:v]setpts=PTS-STARTPTS[patch];[base][patch]overlay=${cropX}:${cropY}:eof_action=pass[v]`,
        '-map', '[v]', '-map', '0:a?',
        '-vsync', '0',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-maxrate', `${VIDEO_BITRATE_MBPS}M`, '-bufsize', `${VIDEO_BITRATE_MBPS * 2}M`,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'copy',
        outputPath
    ], { stdinPipe: true });

    const frameSize = cropW * cropH * 4;

    // Every frame is fully independent under this exact config: adaptiveAlpha
    // is disabled (so alphaGain is constant == seedAlphaGain every frame) and
    // canvas-texture-repair has no temporal-reuse state, so frames can be
    // processed out of order across a worker pool and just need to be
    // re-serialized in original order before hitting the recombine ffmpeg.
    const pool = new RoiWorkerPool(WORKER_COUNT, path.join(__dirname, 'roi_worker.mjs'));

    const pendingChunks = [];
    let chunkFrames = [];
    let processedFrames = 0;

    const flushChunk = () => {
        if (chunkFrames.length === 0) return;
        const frames = chunkFrames;
        chunkFrames = [];
        pendingChunks.push(pool.process(frames, {
            cropW,
            cropH,
            localPosition,
            alphaMap: Array.from(alphaMap),
            seedAlphaGain,
            denoiseBackend,
            edgeDenoiseStrength: EDGE_DENOISE_STRENGTH,
            residualCleanupStrength: RESIDUAL_CLEANUP_STRENGTH
        }));
    };

    const drainReady = async (upTo) => {
        while (pendingChunks.length > upTo) {
            const resultFrames = await pendingChunks.shift();
            for (const frameAB of resultFrames) {
                processedFrames++;
                const ok = recombine.child.stdin.write(Buffer.from(frameAB));
                if (!ok) {
                    await new Promise((resolve) => recombine.child.stdin.once('drain', resolve));
                }
            }
        }
    };

    const pump = readAllFrames(extract.child.stdout, frameSize, async (frameBuf) => {
        const copy = Uint8ClampedArray.from(frameBuf).buffer;
        chunkFrames.push(copy);
        if (chunkFrames.length >= WORKER_CHUNK_SIZE) {
            flushChunk();
            // keep at most 2x worker pool in flight so ffmpeg extract doesn't
            // race arbitrarily far ahead of recombine's stdin consumption
            await drainReady(WORKER_COUNT * 2);
        }
    });

    const extractExit = new Promise((resolve, reject) => {
        extract.child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg extract exited ${code}: ${extract.getStderr()}`)));
        extract.child.on('error', reject);
    });
    const recombineExit = new Promise((resolve, reject) => {
        recombine.child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg recombine exited ${code}: ${recombine.getStderr()}`)));
        recombine.child.on('error', reject);
    });

    await pump;
    flushChunk();
    await drainReady(0);
    await extractExit;
    recombine.child.stdin.end();
    await recombineExit;
    await pool.destroy();

    if (processedFrames === 0) {
        throw new Error('no frames processed');
    }

    console.log('DONE', JSON.stringify({ processedFrames, cropW, cropH, position, seedAlphaGain, workerCount: WORKER_COUNT }));
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});
