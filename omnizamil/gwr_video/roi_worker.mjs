import { parentPort } from 'node:worker_threads';
import { processWatermarkRoi } from './src/video/videoExport.js';

function createFakeCtx(width, height, buffer) {
    return {
        canvas: { width, height },
        getImageData(sx, sy, w, h) {
            const data = new Uint8ClampedArray(w * h * 4);
            for (let ry = 0; ry < h; ry++) {
                const py = sy + ry;
                if (py < 0 || py >= height) continue;
                const rowBase = py * width;
                for (let rx = 0; rx < w; rx++) {
                    const px = sx + rx;
                    if (px < 0 || px >= width) continue;
                    const srcIdx = (rowBase + px) * 4;
                    const dstIdx = (ry * w + rx) * 4;
                    data[dstIdx] = buffer[srcIdx];
                    data[dstIdx + 1] = buffer[srcIdx + 1];
                    data[dstIdx + 2] = buffer[srcIdx + 2];
                    data[dstIdx + 3] = buffer[srcIdx + 3];
                }
            }
            return { width: w, height: h, data };
        },
        putImageData(imageData, dx, dy) {
            const { width: w, height: h, data } = imageData;
            for (let ry = 0; ry < h; ry++) {
                const py = dy + ry;
                if (py < 0 || py >= height) continue;
                const rowBase = py * width;
                for (let rx = 0; rx < w; rx++) {
                    const px = dx + rx;
                    if (px < 0 || px >= width) continue;
                    const srcIdx = (ry * w + rx) * 4;
                    const dstIdx = (rowBase + px) * 4;
                    buffer[dstIdx] = data[srcIdx];
                    buffer[dstIdx + 1] = data[srcIdx + 1];
                    buffer[dstIdx + 2] = data[srcIdx + 2];
                    buffer[dstIdx + 3] = data[srcIdx + 3];
                }
            }
        }
    };
}

parentPort.on('message', (msg) => {
    const {
        frames, cropW, cropH, localPosition, alphaMap, seedAlphaGain, denoiseBackend,
        edgeDenoiseStrength, residualCleanupStrength
    } = msg;
    const alphaMapArr = new Float32Array(alphaMap);
    for (const frameAB of frames) {
        const buffer = new Uint8ClampedArray(frameAB);
        const ctx = createFakeCtx(cropW, cropH, buffer);
        processWatermarkRoi(ctx, { position: localPosition, alphaMap: alphaMapArr }, {
            seedAlphaGain,
            previousAlphaGain: null,
            adaptiveAlpha: false,
            denoiseBackend,
            edgeDenoiseStrength,
            residualCleanupStrength,
            highConfidenceThreshold: 0.14,
            lowConfidenceThreshold: 0.035
        });
    }
    parentPort.postMessage({ frames }, frames);
});
