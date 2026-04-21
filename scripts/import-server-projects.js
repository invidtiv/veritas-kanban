#!/usr/bin/env node
/**
 * Import server directories as Veritas Kanban projects.
 *
 * Default behavior is DRY RUN.
 *
 * Examples:
 *   node scripts/import-server-projects.js
 *   node scripts/import-server-projects.js --apply --api-key "$VERITAS_ADMIN_KEY"
 *   node scripts/import-server-projects.js --apply --create-seed-tasks
 *   node scripts/import-server-projects.js --include "Bshome,bstimer,bsdeals" --apply
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SCAN_ROOT = '/home/bsdev';
const PROJECT_COLOR_CLASSES = [
  'bg-blue-500/20',
  'bg-green-500/20',
  'bg-purple-500/20',
  'bg-orange-500/20',
  'bg-pink-500/20',
  'bg-cyan-500/20',
  'bg-amber-500/20',
  'bg-rose-500/20',
  'bg-indigo-500/20',
  'bg-teal-500/20',
];

const DEFAULT_EXCLUDES = new Set([
  'node_modules',
  'logs',
  'screenshots',
  'ssl',
  'ssl-certs',
  'npm-ssl',
  'babysharkstech_site',
  'bin',
  'documentation',
  'changelogs',
  'rclone-bisync-logs',
  'rclone-sync-logs',
  'tmp',
  '__pycache__',
]);

const PROJECT_MARKERS = [
  '.git',
  'docker-compose.yml',
  'docker-compose.yaml',
  'docker-compose.prod.yml',
  'package.json',
  'pnpm-workspace.yaml',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'composer.json',
  'AGENTS.md',
];

function printHelp() {
  console.log(`
Usage:
  node scripts/import-server-projects.js [options]

Options:
  --apply                     Create projects in Veritas Kanban (default is dry-run)
  --create-seed-tasks         Also create one starter task per newly imported project
  --root <path>               Directory to scan (default: ${DEFAULT_SCAN_ROOT})
  --api-base <url>            API base URL (auto-detects localhost:3001 then :3888)
  --api-key <key>             Veritas admin API key (uses VERITAS_ADMIN_KEY or VK_API_KEY if omitted)
  --include <a,b,c>           Only include these folder names
  --exclude <a,b,c>           Additional folders to exclude
  --include-hidden            Include directories starting with "."
  --help                      Show this help

Examples:
  node scripts/import-server-projects.js
  node scripts/import-server-projects.js --apply --api-key "$VERITAS_ADMIN_KEY"
  node scripts/import-server-projects.js --include "Bshome,bstimer,bsdeals" --apply
`);
}

function parseList(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    createSeedTasks: false,
    root: DEFAULT_SCAN_ROOT,
    apiBase: null,
    apiKey: process.env.VERITAS_ADMIN_KEY || process.env.VK_API_KEY || '',
    include: [],
    exclude: [],
    includeHidden: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--create-seed-tasks') {
      options.createSeedTasks = true;
      continue;
    }
    if (arg === '--include-hidden') {
      options.includeHidden = true;
      continue;
    }
    if (arg === '--root' && next) {
      options.root = next;
      i += 1;
      continue;
    }
    if (arg === '--api-base' && next) {
      options.apiBase = next;
      i += 1;
      continue;
    }
    if (arg === '--api-key' && next) {
      options.apiKey = next;
      i += 1;
      continue;
    }
    if (arg === '--include' && next) {
      options.include = parseList(next);
      i += 1;
      continue;
    }
    if (arg === '--exclude' && next) {
      options.exclude = parseList(next);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function pathExists(candidatePath) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function isProjectLikeDir(absoluteDir) {
  for (const marker of PROJECT_MARKERS) {
    const markerPath = path.join(absoluteDir, marker);
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(markerPath)) {
      return true;
    }
  }
  return false;
}

function unwrapApiPayload(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    Object.prototype.hasOwnProperty.call(payload, 'success') &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    return payload.data;
  }
  return payload;
}

function extractErrorMessage(parsed, fallback) {
  if (!parsed) return fallback;
  if (typeof parsed === 'string') return parsed;
  if (parsed.error) {
    if (typeof parsed.error === 'string') return parsed.error;
    if (typeof parsed.error === 'object' && parsed.error?.message) {
      return String(parsed.error.message);
    }
  }
  if (typeof parsed.message === 'string') return parsed.message;
  if (parsed?.data?.error) {
    if (typeof parsed.data.error === 'string') return parsed.data.error;
    if (typeof parsed.data.error === 'object' && parsed.data.error?.message) {
      return String(parsed.data.error.message);
    }
  }
  if (parsed?.data?.message) return String(parsed.data.message);
  try {
    return JSON.stringify(parsed);
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest({ apiBase, apiKey, method, route, body, maxRetries = 6 }) {
  const base = apiBase.replace(/\/+$/, '');
  const url = `${base}${route}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  let attempt = 0;

  while (true) {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After') || 0);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000;
      attempt += 1;
      console.log(`Rate limited on ${method} ${route}. Waiting ${Math.ceil(waitMs / 1000)}s (retry ${attempt}/${maxRetries})...`);
      // Consume response body before retrying
      await res.text().catch(() => undefined);
      // eslint-disable-next-line no-await-in-loop
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Keep raw text when JSON parse fails
      }
      const message = extractErrorMessage(parsed, text || res.statusText || 'Unknown error');
      throw new Error(`[${res.status}] ${message}`);
    }

    if (res.status === 204) {
      return null;
    }

    const json = await res.json();
    return unwrapApiPayload(json);
  }
}

async function assertWriteAccess({ apiBase, apiKey }) {
  const base = apiBase.replace(/\/+$/, '');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  // Intentional validation failure (empty label) to safely test write permission
  // with zero data changes.
  const res = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ label: '' }),
  });

  if (res.status === 400 || res.status === 422) {
    return; // Reached validation layer => write permission exists
  }

  const raw = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // keep raw message
  }
  const message =
    (parsed && (parsed.error || parsed.message || parsed?.data?.message || parsed?.data?.error)) ||
    raw ||
    res.statusText;

  if (res.status === 403) {
    throw new Error(
      `Write access denied for this key (${message}). ` +
        `If you're running native dev on :3888, use VERITAS_ADMIN_KEY from server/.env, not root .env.`
    );
  }
  if (res.status === 401) {
    throw new Error(
      `Unauthorized (${message}). Pass --api-key <write-capable key> or export VERITAS_ADMIN_KEY.`
    );
  }

  throw new Error(`Write preflight failed [${res.status}]: ${message}`);
}

async function detectApiBase(explicitApiBase, apiKey) {
  if (explicitApiBase) return explicitApiBase;
  if (process.env.VK_API_BASE) return process.env.VK_API_BASE;
  if (process.env.VERITAS_API_BASE) return process.env.VERITAS_API_BASE;

  const candidates = [
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://127.0.0.1:3888',
    'http://localhost:3888',
  ];

  for (const base of candidates) {
    try {
      const headers = apiKey ? { 'X-API-Key': apiKey } : undefined;
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${base}/api/projects`, { headers });

      // Auth-protected but route exists
      if (res.status === 401 || res.status === 403) return base;
      if (!res.ok) continue;

      // eslint-disable-next-line no-await-in-loop
      const payload = await res.json().catch(() => null);
      const projects = unwrapApiPayload(payload);
      if (Array.isArray(projects)) return base;
    } catch {
      // Keep trying
    }
  }

  return 'http://127.0.0.1:3001';
}

async function scanCandidateDirectories({ root, includeHidden, includeSet, excludeSet }) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const candidates = [];

  for (const name of dirs) {
    const explicitInclude = includeSet.size > 0 && includeSet.has(name);

    if (!explicitInclude && includeSet.size > 0) continue;
    if (!includeHidden && name.startsWith('.')) continue;
    if (excludeSet.has(name)) continue;

    const absoluteDir = path.join(root, name);
    // eslint-disable-next-line no-await-in-loop
    const projectLike = explicitInclude ? true : await isProjectLikeDir(absoluteDir);
    if (!projectLike) continue;

    candidates.push({
      name,
      absoluteDir,
      reason: explicitInclude ? 'explicit include' : 'project marker matched',
    });
  }

  return candidates;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiBase = await detectApiBase(options.apiBase, options.apiKey);
  const includeSet = new Set(options.include);
  const excludeSet = new Set([...DEFAULT_EXCLUDES, ...options.exclude]);

  console.log(`\nVeritas Kanban Server Project Import`);
  console.log(`API Base: ${apiBase}`);
  console.log(`Scan Root: ${options.root}`);
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Create Seed Tasks: ${options.createSeedTasks ? 'yes' : 'no'}`);

  if (!options.apiKey) {
    console.log(
      '\nWarning: No API key provided. If localhost bypass is read-only, create operations will fail.'
    );
    console.log('Set VERITAS_ADMIN_KEY or pass --api-key <key>.');
  }

  if (options.apply) {
    await assertWriteAccess({ apiBase, apiKey: options.apiKey });
  }

  const candidates = await scanCandidateDirectories({
    root: options.root,
    includeHidden: options.includeHidden,
    includeSet,
    excludeSet,
  });

  const existingProjects = await apiRequest({
    apiBase,
    apiKey: options.apiKey,
    method: 'GET',
    route: '/api/projects',
  });

  if (!Array.isArray(existingProjects)) {
    throw new Error('Unexpected API response for /api/projects (expected an array).');
  }

  const existingByName = new Set();
  for (const project of existingProjects) {
    if (project?.id) existingByName.add(String(project.id).toLowerCase());
    if (project?.label) existingByName.add(String(project.label).toLowerCase());
  }

  const toCreate = candidates.filter((candidate) => !existingByName.has(candidate.name.toLowerCase()));

  console.log(`\nFound ${candidates.length} project-like directories.`);
  console.log(`Already in Kanban: ${candidates.length - toCreate.length}`);
  console.log(`To create: ${toCreate.length}`);

  if (toCreate.length > 0) {
    console.log('\nPlanned imports:');
    toCreate.forEach((candidate) => {
      console.log(`- ${candidate.name} (${candidate.reason})`);
    });
  } else {
    console.log('\nNo new projects to import.');
  }

  if (toCreate.length === 0) {
    console.log('\nNo changes needed.');
    return;
  }

  if (!options.apply) {
    console.log('\nDry run complete. Re-run with --apply to create projects.');
    return;
  }

  const created = [];
  const failed = [];
  const seededTasks = [];

  for (let i = 0; i < toCreate.length; i += 1) {
    const candidate = toCreate[i];
    const color = PROJECT_COLOR_CLASSES[i % PROJECT_COLOR_CLASSES.length];
    const now = new Date().toISOString().slice(0, 10);

    try {
      // eslint-disable-next-line no-await-in-loop
      const project = await apiRequest({
        apiBase,
        apiKey: options.apiKey,
        method: 'POST',
        route: '/api/projects',
        body: {
          label: candidate.name,
          color,
          description: `Imported from ${candidate.absoluteDir} on ${now}`,
        },
      });

      const projectId = project?.id || candidate.name;
      created.push({ name: candidate.name, id: projectId });
      console.log(`Created project: ${candidate.name} (id: ${projectId})`);

      if (options.createSeedTasks) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const task = await apiRequest({
            apiBase,
            apiKey: options.apiKey,
            method: 'POST',
            route: '/api/tasks',
            body: {
              title: `Inventory ${candidate.name}`,
              description:
                `Imported from server directory:\n` +
                `- ${candidate.absoluteDir}\n\n` +
                `Use this task to capture backlog and migration notes for this project.`,
              type: 'system',
              priority: 'medium',
              project: projectId,
            },
          });
          seededTasks.push({ project: candidate.name, taskId: task?.id || 'unknown' });
          console.log(`  Added seed task for ${candidate.name}`);
        } catch (error) {
          failed.push({
            name: candidate.name,
            stage: 'create-task',
            error: error instanceof Error ? error.message : String(error),
          });
          console.log(`  Failed to add seed task: ${String(error)}`);
        }
      }
    } catch (error) {
      failed.push({
        name: candidate.name,
        stage: 'create-project',
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`Failed project import: ${candidate.name} -> ${String(error)}`);
    }
  }

  console.log('\nImport summary:');
  console.log(`- Created projects: ${created.length}`);
  console.log(`- Seed tasks created: ${seededTasks.length}`);
  console.log(`- Failures: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailures:');
    failed.forEach((item) => {
      console.log(`- ${item.name} (${item.stage}): ${item.error}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nImport failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
