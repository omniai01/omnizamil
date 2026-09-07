import { removeVideoWatermarkFromFile } from './src/sdk/video.js';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const input = process.argv[2];
const output = process.argv[3];
const denoiseBackend = process.argv[4] || 'canvas-texture-repair';

const result = await removeVideoWatermarkFromFile(input, {
  outputPath: output,
  pagePath: path.join(__dirname, 'dist/video-preview.html'),
  timeoutMs: 5 * 60 * 1000,
  denoiseBackend
});
console.log('DONE', JSON.stringify(result.meta));
