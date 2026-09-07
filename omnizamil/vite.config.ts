import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';
import { cleanVideoBase64 } from './scripts/video-clean-lib.mjs';

function videoApiPlugin() {
  return {
    name: 'omnizamil-video-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/video-remove' || req.method !== 'POST') {
          next();
          return;
        }
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            if (!body.base64) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'base64 required' }));
              return;
            }
            const result = await cleanVideoBase64(body.base64, body.name || 'input.mp4');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    videoApiPlugin(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron'],
              output: {
                // Must be CJS: package.json has "type":"module", and .mjs + require() blanks Electron
                format: 'cjs',
                entryFileNames: 'preload.cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@engine': path.resolve(__dirname, 'engine/gwr_video'),
    },
  },
  server: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
    watch: {
      ignored: ['**/admin/**', '**/engine/**', '**/gwr_video/**', '**/samples/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
