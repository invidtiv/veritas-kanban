#!/usr/bin/env node
/**
 * Build standalone executables for Veritas Kanban CLI using Node.js SEA.
 *
 * Usage:
 *   node build-standalone.mjs                   # Build for current platform
 *   node build-standalone.mjs --target windows   # Cross-build for Windows
 *   node build-standalone.mjs --target all       # Build all platforms
 *
 * The script:
 *   1. Bundles the CLI into a single CJS file via esbuild
 *   2. Generates a SEA preparation blob
 *   3. Downloads the target platform's Node.js binary (if cross-compiling)
 *   4. Injects the blob into the binary using postject
 *
 * Output goes to cli/dist/standalone/
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const STANDALONE_DIR = path.join(DIST, 'standalone');
const BUNDLE_PATH = path.join(DIST, 'vk-bundle.cjs');
const SEA_CONFIG = path.join(DIST, 'sea-config.json');
const SEA_BLOB = path.join(DIST, 'sea-prep.blob');

// Node.js version for cross-compiled binaries
const NODE_FULL = process.versions.node;

const TARGETS = {
  windows: { platform: 'win', arch: 'x64', ext: '.exe', binaryName: 'vk.exe' },
  linux: { platform: 'linux', arch: 'x64', ext: '', binaryName: 'vk' },
  macos: { platform: 'darwin', arch: 'x64', ext: '', binaryName: 'vk' },
};

// Parse args
const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const targetArg = targetIdx !== -1 ? args[targetIdx + 1] : null;

const requestedTargets = targetArg === 'all'
  ? Object.keys(TARGETS)
  : targetArg
    ? [targetArg]
    : [currentPlatformKey()];

function currentPlatformKey() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function runFile(cmd, cmdArgs, opts = {}) {
  console.log(`  $ ${cmd} ${cmdArgs.join(' ')}`);
  return execFileSync(cmd, cmdArgs, { stdio: 'inherit', cwd: __dirname, ...opts });
}

/**
 * Download a file from a URL, following redirects.
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const doRequest = (requestUrl) => {
      https.get(requestUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${requestUrl}`));
          return;
        }
        const file = createWriteStream(dest);
        pipeline(res, file).then(resolve).catch(reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function main() {
  console.log('\n🔨 Veritas Kanban CLI — Standalone Build\n');

  // Step 1: Bundle with esbuild
  console.log('Step 1: Bundling with esbuild...');
  runFile('node', ['esbuild.config.mjs']);

  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error('❌ Bundle not found at', BUNDLE_PATH);
    process.exit(1);
  }

  // Step 2: Create SEA config
  console.log('Step 2: Creating SEA config...');
  const seaConfig = {
    main: BUNDLE_PATH,
    output: SEA_BLOB,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };
  fs.writeFileSync(SEA_CONFIG, JSON.stringify(seaConfig, null, 2));

  // Step 3: Generate SEA blob
  console.log('Step 3: Generating SEA preparation blob...');
  runFile('node', ['--experimental-sea-config', SEA_CONFIG]);

  if (!fs.existsSync(SEA_BLOB)) {
    console.error('❌ SEA blob not generated');
    process.exit(1);
  }

  const blobSize = (fs.statSync(SEA_BLOB).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓ Blob size: ${blobSize} MB`);

  // Step 4: Build for each target
  fs.mkdirSync(STANDALONE_DIR, { recursive: true });

  for (const targetKey of requestedTargets) {
    const target = TARGETS[targetKey];
    if (!target) {
      console.error(`❌ Unknown target: ${targetKey}. Use: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }

    console.log(`\nStep 4: Building for ${targetKey} (${target.platform}-${target.arch})...`);
    const outputPath = path.join(STANDALONE_DIR, target.binaryName);

    if (targetKey === currentPlatformKey()) {
      // Native build — copy current node binary
      console.log('  Using local Node.js binary...');
      fs.copyFileSync(process.execPath, outputPath);
    } else {
      // Cross-build — download target platform's node binary
      const downloadDir = path.join(DIST, 'node-downloads');
      fs.mkdirSync(downloadDir, { recursive: true });

      let downloadUrl;
      let cachedBinary;

      if (target.platform === 'win') {
        cachedBinary = path.join(downloadDir, `node-v${NODE_FULL}-win-x64.exe`);
        if (!fs.existsSync(cachedBinary)) {
          downloadUrl = `https://nodejs.org/dist/v${NODE_FULL}/win-x64/node.exe`;
          console.log(`  Downloading Node.js v${NODE_FULL} for Windows...`);
          console.log(`  URL: ${downloadUrl}`);
          await download(downloadUrl, cachedBinary);
          console.log(`  ✓ Downloaded (${(fs.statSync(cachedBinary).size / 1024 / 1024).toFixed(1)} MB)`);
        } else {
          console.log('  Using cached Node.js binary...');
        }
      } else if (target.platform === 'darwin') {
        cachedBinary = path.join(downloadDir, `node-v${NODE_FULL}-darwin-x64`);
        if (!fs.existsSync(cachedBinary)) {
          const tarFile = `${cachedBinary}.tar.gz`;
          downloadUrl = `https://nodejs.org/dist/v${NODE_FULL}/node-v${NODE_FULL}-darwin-x64.tar.gz`;
          console.log(`  Downloading Node.js v${NODE_FULL} for macOS...`);
          await download(downloadUrl, tarFile);
          const stripPath = `node-v${NODE_FULL}-darwin-x64/bin/node`;
          runFile('tar', ['-xzf', tarFile, '-C', downloadDir, '--strip-components=2', stripPath]);
          fs.renameSync(path.join(downloadDir, 'node'), cachedBinary);
          fs.unlinkSync(tarFile);
          console.log('  ✓ Downloaded and extracted');
        } else {
          console.log('  Using cached Node.js binary...');
        }
      } else {
        cachedBinary = path.join(downloadDir, `node-v${NODE_FULL}-linux-x64`);
        if (!fs.existsSync(cachedBinary)) {
          const tarFile = `${cachedBinary}.tar.xz`;
          downloadUrl = `https://nodejs.org/dist/v${NODE_FULL}/node-v${NODE_FULL}-linux-x64.tar.xz`;
          console.log(`  Downloading Node.js v${NODE_FULL} for Linux...`);
          await download(downloadUrl, tarFile);
          const stripPath = `node-v${NODE_FULL}-linux-x64/bin/node`;
          runFile('tar', ['-xJf', tarFile, '-C', downloadDir, '--strip-components=2', stripPath]);
          fs.renameSync(path.join(downloadDir, 'node'), cachedBinary);
          fs.unlinkSync(tarFile);
          console.log('  ✓ Downloaded and extracted');
        } else {
          console.log('  Using cached Node.js binary...');
        }
      }

      fs.copyFileSync(cachedBinary, outputPath);
    }

    // Remove code signatures before injection
    if (process.platform === 'darwin' && targetKey === 'macos') {
      try { runFile('codesign', ['--remove-signature', outputPath]); } catch { /* ok */ }
    }
    if (target.platform === 'win') {
      console.log('  Stripping Authenticode signature...');
      runFile('node', [path.join(__dirname, 'strip-pe-signature.mjs'), outputPath]);
    }

    // Detect the SEA fuse sentinel from the binary
    console.log('  Detecting SEA fuse sentinel...');
    const binaryContent = fs.readFileSync(outputPath);
    const fuseMatch = binaryContent.toString('binary').match(/NODE_SEA_FUSE_[a-f0-9]+/);
    if (!fuseMatch) {
      console.error('  ❌ Could not find NODE_SEA_FUSE sentinel in binary. Is this a SEA-capable Node.js?');
      process.exit(1);
    }
    const sentinelFuse = fuseMatch[0].split(':')[0]; // Strip any trailing ":0"
    console.log(`  ✓ Found fuse: ${sentinelFuse}`);

    // Inject SEA blob using postject
    console.log('  Injecting SEA blob...');
    const postjectArgs = [
      'postject',
      outputPath,
      'NODE_SEA_BLOB',
      SEA_BLOB,
      '--sentinel-fuse', sentinelFuse,
    ];

    // Windows PE format needs --overwrite flag
    if (target.platform === 'win') {
      postjectArgs.push('--overwrite');
    }

    // macOS Mach-O needs specific segment name
    if (target.platform === 'darwin') {
      postjectArgs.push('--macho-segment-name', 'NODE_SEA');
    }

    try {
      runFile('npx', postjectArgs);
    } catch {
      console.error('  ❌ postject failed. Install it: pnpm add -D postject');
      process.exit(1);
    }

    // Re-sign on macOS
    if (process.platform === 'darwin' && targetKey === 'macos') {
      try { runFile('codesign', ['--sign', '-', outputPath]); } catch { /* ok */ }
    }

    const finalSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ ${target.binaryName} ready (${finalSize} MB)`);
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('✅ Build complete!\n');
  console.log(`  Output: ${STANDALONE_DIR}/`);
  for (const targetKey of requestedTargets) {
    const target = TARGETS[targetKey];
    console.log(`    ${target.binaryName} (${targetKey})`);
  }
  console.log('\n  Usage on Windows:');
  console.log('    1. Copy vk.exe to your Windows machine');
  console.log('    2. Run: vk.exe connect http://<tailscale-host>:3001 --key <api-key>');
  console.log('    3. Run: vk.exe list');
  console.log();
}

main().catch((err) => {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
});
