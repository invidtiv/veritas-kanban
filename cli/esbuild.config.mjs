/**
 * esbuild configuration for bundling the CLI into a single JS file.
 * Used as input for Node.js Single Executable Application (SEA) builds.
 */

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs', // SEA requires CommonJS
  outfile: resolve(__dirname, 'dist/vk-bundle.cjs'),
  minify: false, // Keep readable for debugging
  sourcemap: false,
  // Externalize nothing — we want a fully self-contained bundle
  external: [],
  // Banner to handle ESM-only chalk imports
  banner: {
    js: '// Veritas Kanban CLI — standalone bundle\n',
  },
  define: {
    'import.meta.url': 'undefined', // Prevent import.meta in CJS output
  },
  logLevel: 'info',
});

console.log('\n✓ Bundle ready: dist/vk-bundle.cjs\n');
