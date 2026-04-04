/**
 * Cross-platform persistent configuration store for Veritas Kanban CLI.
 *
 * Config file locations:
 *   Linux/macOS: ~/.config/veritas-kanban/config.json
 *   Windows:     %APPDATA%\veritas-kanban\config.json
 *
 * Environment variables always take precedence over config file values.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface VkConfig {
  /** Server URL (e.g. http://myhost.tail652dda.ts.net:3001) */
  serverUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Display name for this connection profile */
  profileName?: string;
}

/**
 * Returns the platform-appropriate config directory.
 *   Windows: %APPDATA%\veritas-kanban
 *   Others:  ~/.config/veritas-kanban
 */
export function getConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'veritas-kanban');
  }
  return path.join(os.homedir(), '.config', 'veritas-kanban');
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/** Read the persisted config. Returns empty object if no config exists. */
export function readConfig(): VkConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw) as VkConfig;
  } catch {
    return {};
  }
}

/** Write config to disk, merging with existing values. */
export function writeConfig(updates: Partial<VkConfig>): VkConfig {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });

  const existing = readConfig();
  const merged: VkConfig = { ...existing, ...updates };

  // Remove undefined/null keys
  for (const key of Object.keys(merged) as (keyof VkConfig)[]) {
    if (merged[key] === undefined || merged[key] === null) {
      delete merged[key];
    }
  }

  fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return merged;
}

/** Clear all persisted config. */
export function clearConfig(): void {
  try {
    fs.unlinkSync(getConfigPath());
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Resolve the effective server URL with precedence:
 *   1. VK_API_URL env var
 *   2. Config file serverUrl
 *   3. Default: http://localhost:3001
 */
export function resolveServerUrl(): string {
  const envUrl = typeof process !== 'undefined' ? process.env?.VK_API_URL : undefined;
  if (envUrl) return envUrl;

  const config = readConfig();
  if (config.serverUrl) return config.serverUrl;

  return 'http://localhost:3001';
}

/**
 * Resolve the effective API key with precedence:
 *   1. VERITAS_ADMIN_KEY or VK_API_KEY env var
 *   2. Config file apiKey
 *   3. Legacy key files (~/.config/veritas-kanban/admin_key or api_key)
 */
export function resolveApiKey(): string | undefined {
  // Env vars first
  if (typeof process !== 'undefined') {
    const envKey = process.env?.VERITAS_ADMIN_KEY || process.env?.VK_API_KEY;
    if (envKey) return envKey;
  }

  // Config file
  const config = readConfig();
  if (config.apiKey) return config.apiKey;

  // Legacy key files
  try {
    const dir = getConfigDir();
    for (const filename of ['admin_key', 'api_key']) {
      const p = path.join(dir, filename);
      const raw = fs.readFileSync(p, 'utf8').trim();
      if (raw) return raw;
    }
  } catch {
    // Ignore
  }

  return undefined;
}
