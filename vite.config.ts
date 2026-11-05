/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * Emits dist/sw.js with the list of built files baked in, so the service
 * worker can precache the whole app for offline use. No dependencies.
 */
function serviceWorker(): Plugin {
  return {
    name: 'mathtrainer-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
      const precache = ['./', ...files, ...publicFiles].map((f) => (f === './' ? f : './' + f));
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', version)
          .replace('__PRECACHE__', JSON.stringify(precache)),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: { target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'] },
});
