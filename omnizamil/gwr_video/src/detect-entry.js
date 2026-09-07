import { detectGeminiVideoWatermark } from './video/videoExport.js';

function serializeDetection(detection) {
    if (!detection) return detection;
    const out = { ...detection };
    if (detection.alphaMap) {
        out.alphaMap = Array.from(detection.alphaMap);
    }
    if (detection.alphaSeed) {
        out.alphaSeed = { ...detection.alphaSeed };
    }
    return out;
}

window.__gwrDetect = async function gwrDetect(file, options = {}) {
    try {
        const result = await detectGeminiVideoWatermark(file, options);
        return {
            ok: true,
            metadata: result.metadata,
            detection: serializeDetection(result.detection)
        };
    } catch (error) {
        return {
            ok: false,
            error: error && error.message ? error.message : String(error)
        };
    }
};

window.__gwrDetectReady = true;
