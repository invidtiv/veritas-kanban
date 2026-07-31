/**
 * esbuild configuration for bundling the CLI into a single JS file.
 * Used as input for Node.js Single Executable Application (SEA) builds.
 */

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

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
    __VERITAS_CLI_VERSION__: JSON.stringify(version),
    'import.meta.url': JSON.stringify(pathToFileURL(resolve(__dirname, 'src/index.ts')).href),
  },
  logLevel: 'info',
});

console.log('\n✓ Bundle ready: dist/vk-bundle.cjs\n');
