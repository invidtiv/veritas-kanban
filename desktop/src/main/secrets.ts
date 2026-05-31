import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DesktopPaths, DesktopRuntimeSecrets } from './types.js';

export interface DesktopSafeStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface DesktopSecretRecord {
  ciphertext: string;
  updatedAt: string;
}

export interface DesktopSecretFile {
  version: 1;
  keychainProvider: 'electron-safeStorage';
  scope: {
    profile: string;
    workspace: string;
  };
  secrets: Record<string, DesktopSecretRecord>;
}

export interface DesktopSecretState {
  available: boolean;
  filePath: string;
  recoveryActions: string[];
  error: string | null;
}

export interface DesktopSecretStoreOptions {
  safeStorage: DesktopSafeStorage;
  paths: DesktopPaths;
}

function createSecretValue(prefix: string): string {
  return `${prefix}_${randomBytes(48).toString('base64url')}`;
}

function emptySecretFile(paths: DesktopPaths): DesktopSecretFile {
  return {
    version: 1,
    keychainProvider: 'electron-safeStorage',
    scope: {
      profile: paths.profile,
      workspace: paths.workspace,
    },
    secrets: {},
  };
}

function recoveryActions(paths: DesktopPaths): string[] {
  return [
    'Confirm macOS Keychain is unlocked and available.',
    `Quit Veritas Kanban and move ${path.basename(paths.secretsFile)} out of ${paths.configDir}.`,
    'Restart the app so desktop secrets can be regenerated for this profile and workspace.',
  ];
}

export class DesktopSecretStore {
  constructor(private readonly options: DesktopSecretStoreOptions) {}

  inspect(): DesktopSecretState {
    if (!this.options.safeStorage.isEncryptionAvailable()) {
      return {
        available: false,
        filePath: this.options.paths.secretsFile,
        recoveryActions: recoveryActions(this.options.paths),
        error: 'Electron safeStorage encryption is unavailable.',
      };
    }

    return {
      available: true,
      filePath: this.options.paths.secretsFile,
      recoveryActions: recoveryActions(this.options.paths),
      error: null,
    };
  }

  async loadRuntimeSecrets(): Promise<DesktopRuntimeSecrets> {
    const state = this.inspect();
    if (!state.available) {
      throw new Error(`${state.error} ${state.recoveryActions.join(' ')}`);
    }

    const adminKey = await this.getOrCreateSecret('admin-key', () => createSecretValue('vk_admin'));
    const jwtSecret = await this.getOrCreateSecret('jwt-secret', () => createSecretValue('vk_jwt'));

    return {
      adminKey,
      jwtSecret,
      warnings: [],
    };
  }

  async getOrCreateSecret(name: string, createValue: () => string): Promise<string> {
    const file = await this.readSecretFile();
    const existing = file.secrets[name];
    if (existing) {
      return this.decrypt(existing.ciphertext);
    }

    const value = createValue();
    file.secrets[name] = {
      ciphertext: this.encrypt(value),
      updatedAt: new Date().toISOString(),
    };
    await this.writeSecretFile(file);
    return value;
  }

  async clearSecrets(): Promise<void> {
    await this.writeSecretFile(emptySecretFile(this.options.paths));
  }

  private async readSecretFile(): Promise<DesktopSecretFile> {
    try {
      const raw = await readFile(this.options.paths.secretsFile, 'utf-8');
      const parsed = JSON.parse(raw) as DesktopSecretFile;
      if (
        parsed.version !== 1 ||
        parsed.scope?.profile !== this.options.paths.profile ||
        parsed.scope?.workspace !== this.options.paths.workspace ||
        typeof parsed.secrets !== 'object' ||
        parsed.secrets === null
      ) {
        throw new Error('Desktop secret file scope or schema is invalid.');
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptySecretFile(this.options.paths);
      }
      throw new Error(
        `Desktop secret state is unreadable. ${recoveryActions(this.options.paths).join(' ')}`,
        { cause: error }
      );
    }
  }

  private async writeSecretFile(file: DesktopSecretFile): Promise<void> {
    await mkdir(path.dirname(this.options.paths.secretsFile), { recursive: true });
    await writeFile(this.options.paths.secretsFile, JSON.stringify(file, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  private encrypt(value: string): string {
    return this.options.safeStorage.encryptString(value).toString('base64');
  }

  private decrypt(ciphertext: string): string {
    try {
      return this.options.safeStorage.decryptString(Buffer.from(ciphertext, 'base64'));
    } catch (error) {
      throw new Error(
        `Desktop secret could not be decrypted. ${recoveryActions(this.options.paths).join(' ')}`,
        { cause: error }
      );
    }
  }
}
