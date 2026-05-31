import path from 'node:path';
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';

import type { DesktopPaths } from './types.js';

export interface CreateDesktopPathsOptions {
  userDataPath: string;
  repoRoot: string;
  isPackaged: boolean;
  profile?: string;
  workspace?: string;
}

function profileSegment(profile: string | undefined): string {
  return (profile || 'default').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function workspaceSegment(workspace: string | undefined): string {
  return (workspace || 'local').replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function createDesktopPaths(options: CreateDesktopPathsOptions): DesktopPaths {
  const profile = profileSegment(options.profile);
  const workspace = workspaceSegment(options.workspace);
  const legacyAppHome = options.isPackaged
    ? options.userDataPath
    : path.join(options.repoRoot, '.veritas-desktop-dev', profile);
  const profileDir = options.isPackaged
    ? path.join(options.userDataPath, 'profiles', profile)
    : path.join(options.repoRoot, '.veritas-desktop-dev', 'profiles', profile);
  const workspaceDir = path.join(profileDir, 'workspaces', workspace);
  const appHome = workspaceDir;
  const configDir = path.join(appHome, 'config');

  return {
    profile,
    workspace,
    appHome,
    profileDir,
    workspaceDir,
    legacyAppHome: legacyAppHome === appHome ? null : legacyAppHome,
    configDir,
    dataDir: path.join(appHome, 'data'),
    logsDir: path.join(appHome, 'logs'),
    runtimeDir: path.join(appHome, 'runtime'),
    exportsDir: path.join(appHome, 'exports'),
    backupsDir: path.join(appHome, 'backups'),
    debugBundlesDir: path.join(appHome, 'debug-bundles'),
    secretsFile: path.join(configDir, 'desktop-secrets.json'),
    migrationManifest: path.join(configDir, 'desktop-path-migration.json'),
  };
}

const MIGRATED_ENTRIES = ['config', 'data', 'logs', 'exports', 'backups', 'debug-bundles'] as const;

export interface DesktopPathMigrationResult {
  migrated: boolean;
  from: string | null;
  to: string;
  copiedEntries: string[];
  skippedReason?: string;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDesktopPathLayout(
  paths: DesktopPaths
): Promise<DesktopPathMigrationResult> {
  await Promise.all([
    mkdir(paths.profileDir, { recursive: true }),
    mkdir(paths.workspaceDir, { recursive: true }),
    mkdir(paths.configDir, { recursive: true }),
    mkdir(paths.dataDir, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.runtimeDir, { recursive: true }),
    mkdir(paths.exportsDir, { recursive: true }),
    mkdir(paths.backupsDir, { recursive: true }),
    mkdir(paths.debugBundlesDir, { recursive: true }),
  ]);

  if (!paths.legacyAppHome) {
    return {
      migrated: false,
      from: null,
      to: paths.appHome,
      copiedEntries: [],
      skippedReason: 'no legacy app home',
    };
  }

  if (!(await exists(paths.legacyAppHome))) {
    return {
      migrated: false,
      from: paths.legacyAppHome,
      to: paths.appHome,
      copiedEntries: [],
      skippedReason: 'legacy app home does not exist',
    };
  }

  const copiedEntries: string[] = [];
  for (const entry of MIGRATED_ENTRIES) {
    const source = path.join(paths.legacyAppHome, entry);
    const target = path.join(paths.appHome, entry);
    if (await exists(source)) {
      await cp(source, target, {
        recursive: true,
        force: false,
      });
      copiedEntries.push(entry);
    }
  }

  const result: DesktopPathMigrationResult = {
    migrated: copiedEntries.length > 0,
    from: paths.legacyAppHome,
    to: paths.appHome,
    copiedEntries,
    skippedReason: copiedEntries.length > 0 ? undefined : 'workspace app home already initialized',
  };

  await writeFile(paths.migrationManifest, JSON.stringify(result, null, 2), 'utf-8');
  return result;
}

export function resolveRepoRoot(appPath: string, cwd = process.cwd()): string {
  if (process.env.VERITAS_REPO_ROOT) {
    return process.env.VERITAS_REPO_ROOT;
  }

  if (path.basename(cwd) === 'desktop') {
    return path.resolve(cwd, '..');
  }

  const segments = appPath.split(path.sep);
  const desktopIndex = segments.lastIndexOf('desktop');
  if (desktopIndex > 0) {
    return segments.slice(0, desktopIndex).join(path.sep) || path.sep;
  }

  return path.resolve(appPath, '..');
}
