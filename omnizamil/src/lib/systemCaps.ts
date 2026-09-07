/** Bulk concurrency: user can pick 1…50 (lower = gentler on small PCs). */
export const CONCURRENCY_MIN = 1;
export const CONCURRENCY_MAX = 50;

export type GpuTier = 'low' | 'mid' | 'high';

export type SystemCaps = {
  cores: number;
  ramGb: number;
  gpuTier: GpuTier;
  gpuLabel: string;
  maxImages: number;
  maxVideos: number;
  recommendedImages: number;
  recommendedVideos: number;
  minConcurrency: number;
  summary: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function detectGpu(): { tier: GpuTier; label: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return { tier: 'low', label: 'Unknown GPU' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');
    const label = raw.replace(/\s+/g, ' ').trim() || 'GPU';
    const low = /intel|uhd|iris|mali|adreno|apple gpu|swiftshader|llvmpipe|microsoft basic/i.test(
      label,
    );
    const high = /rtx|radeon rx|nvidia geForce|geforce rtx|arc a|apple m[2-9]|apple m1 (pro|max|ultra)/i.test(
      label,
    );
    if (high) return { tier: 'high', label };
    if (low) return { tier: 'low', label };
    return { tier: 'mid', label };
  } catch {
    return { tier: 'mid', label: 'GPU unavailable' };
  }
}

/** Detect PC and recommend concurrency within fixed 1…50 range. */
export function detectSystemCaps(): SystemCaps {
  const cores = Math.max(1, navigator.hardwareConcurrency || 4);
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ramGb = Math.max(1, Number(nav.deviceMemory) || 4);
  const { tier: gpuTier, label: gpuLabel } = detectGpu();

  // Always allow 1–50; recommend from hardware (small PCs can go lower)
  let recommendedImages = 4;
  if (ramGb >= 8 && cores >= 6) recommendedImages = 10;
  if (ramGb >= 16 && cores >= 8) recommendedImages = 16;
  if (gpuTier === 'high' && ramGb >= 16) recommendedImages = 20;
  if (ramGb <= 4 || cores <= 2) recommendedImages = 2;
  recommendedImages = clamp(recommendedImages, CONCURRENCY_MIN, CONCURRENCY_MAX);

  let recommendedVideos = 2;
  if (ramGb >= 8 && cores >= 4) recommendedVideos = 4;
  if (ramGb >= 16 && cores >= 8 && gpuTier !== 'low') recommendedVideos = 8;
  if (ramGb >= 24 && cores >= 12 && gpuTier === 'high') recommendedVideos = 12;
  if (ramGb <= 4 || cores <= 2 || gpuTier === 'low') recommendedVideos = 1;
  recommendedVideos = clamp(recommendedVideos, CONCURRENCY_MIN, CONCURRENCY_MAX);

  const summary = `${cores} CPU cores · ~${ramGb} GB RAM · ${gpuTier.toUpperCase()} GPU`;

  return {
    cores,
    ramGb,
    gpuTier,
    gpuLabel,
    maxImages: CONCURRENCY_MAX,
    maxVideos: CONCURRENCY_MAX,
    recommendedImages,
    recommendedVideos,
    minConcurrency: CONCURRENCY_MIN,
    summary,
  };
}
