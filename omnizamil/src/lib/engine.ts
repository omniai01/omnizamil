export interface ProcessImageResult {
  blob: Blob;
  blobUrl: string;
  applied: boolean;
  confidence: number;
  decisionTier?: string;
  skipReason?: string | null;
  width: number;
  height: number;
  elapsedMs: number;
}

async function decodeExactPixels(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, {
    colorSpaceConversion: 'none',
    imageOrientation: 'from-image',
  });
}

/** Image removal via omnizamil gwr_video SDK (embedded alpha maps). */
export async function processImageFile(file: File): Promise<ProcessImageResult> {
  const started = performance.now();
  const bitmap = await decodeExactPixels(file);
  const width = bitmap.width;
  const height = bitmap.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D unavailable');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const { removeWatermarkFromImageDataSync } = await import(
    /* @vite-ignore */ '../../engine/gwr_video/src/sdk/image-data.js'
  );

  // Must match official SDK defaults; force full adaptive search to avoid wrong ROI blur
  const result = removeWatermarkFromImageDataSync(imageData, {
    adaptiveMode: 'always',
    aggressiveLocatedFallback: true,
  }) as {
    imageData?: ImageData;
    meta?: {
      detection?: { adaptiveConfidence?: number };
      applied?: boolean;
      skipReason?: string | null;
    };
  };

  const applied = result.meta?.applied === true;
  // Only write cleaned pixels when removal actually applied — never ship a bad blur ROI
  if (applied && result.imageData) {
    ctx.putImageData(result.imageData, 0, 0);
  }

  const confidence = Number(
    result.meta?.detection?.adaptiveConfidence ?? (applied ? 0.85 : 0),
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });

  return {
    blob,
    blobUrl: URL.createObjectURL(blob),
    applied,
    confidence,
    decisionTier: applied ? 'omnizamil/gwr' : undefined,
    skipReason: applied
      ? null
      : result.meta?.skipReason || 'No watermark detected by Omni-Removal',
    width,
    height,
    elapsedMs: performance.now() - started,
  };
}

export async function warmEngine() {}

export function cleanedName(name: string, ext = 'png') {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}-omnizamil-clean.${ext}`;
}

export function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      resolve(dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function bytesFromBase64(base64: string) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Always works: Electron IPC if present, else local Vite /api/video-remove. */
export async function processVideoFile(file: File): Promise<{
  blob: Blob;
  blobUrl: string;
  applied: boolean;
  message: string;
  elapsedMs: number;
  outputPath?: string;
}> {
  const started = performance.now();

  if (window.omni?.removeVideo) {
    try {
      const localPath = window.omni.getPathForFile?.(file) || '';
      let result;
      if (localPath) {
        result = await window.omni.removeVideo({
          inputPath: localPath,
          inputName: file.name,
        });
      } else {
        result = await window.omni.removeVideo({
          inputBase64: await fileToBase64(file),
          inputName: file.name,
        });
      }
      const blob = new Blob([bytesFromBase64(result.base64)], { type: 'video/mp4' });
      return {
        blob,
        blobUrl: URL.createObjectURL(blob),
        applied: true,
        message: `Omni-Removal cleaned ${result.frames || ''} frames`.trim(),
        elapsedMs: performance.now() - started,
        outputPath: result.outputPath,
      };
    } catch (err) {
      let raw = err instanceof Error ? err.message : String(err);
      raw = raw
        .replace(/^Error invoking remote method '[^']+':\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .trim();
      console.error('[Omni-Removal] video engine:', raw);
      // Keep [TECH] block so admin/reportError can store the real cause
      throw new Error(
        raw ||
          'Video cleanup could not finish. Omni is repairing system components automatically — wait a moment, then retry.',
      );
    }
  }

  const res = await fetch('/api/video-remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      base64: await fileToBase64(file),
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    base64?: string;
    frames?: number;
    error?: string;
  };
  if (!res.ok || !data.base64) {
    const raw = data.error || 'Omni-Removal video cleanup failed';
    console.error('[Omni-Removal] video api:', raw);
    throw new Error(
      raw.slice(0, 220) ||
        'Video cleanup could not finish. Open Settings → Check dependencies, then retry.',
    );
  }

  const blob = new Blob([bytesFromBase64(data.base64)], { type: 'video/mp4' });
  return {
    blob,
    blobUrl: URL.createObjectURL(blob),
    applied: true,
    message: `Omni-Removal cleaned ${data.frames || ''} frames`.trim(),
    elapsedMs: performance.now() - started,
  };
}
