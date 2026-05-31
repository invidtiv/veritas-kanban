import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { createDesktopPaths } from '../paths.js';
import { DesktopSecretStore, type DesktopSafeStorage } from '../secrets.js';

function mockSafeStorage(available = true): DesktopSafeStorage {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf-8'),
    decryptString: (encrypted) => encrypted.toString('utf-8').replace(/^encrypted:/, ''),
  };
}

async function testPaths() {
  const root = await mkdtemp(path.join(tmpdir(), 'veritas-desktop-secrets-'));
  return createDesktopPaths({
    userDataPath: path.join(root, 'user-data'),
    repoRoot: root,
    isPackaged: true,
    profile: 'fresh',
    workspace: 'local',
  });
}

describe('desktop secret store', () => {
  it('stores runtime secrets as encrypted keychain-backed blobs scoped by profile and workspace', async () => {
    const paths = await testPaths();
    const store = new DesktopSecretStore({
      safeStorage: mockSafeStorage(),
      paths,
    });

    const first = await store.loadRuntimeSecrets();
    const second = await store.loadRuntimeSecrets();
    const raw = await readFile(paths.secretsFile, 'utf-8');

    expect(second).toEqual(first);
    expect(first.adminKey).toMatch(/^vk_admin_/);
    expect(first.jwtSecret).toMatch(/^vk_jwt_/);
    expect(raw).toContain('"profile": "fresh"');
    expect(raw).toContain('"workspace": "local"');
    expect(raw).not.toContain(first.adminKey);
    expect(raw).not.toContain(first.jwtSecret);
    expect(raw).toContain(Buffer.from(`encrypted:${first.adminKey}`).toString('base64'));
  });

  it('surfaces keychain availability recovery actions without writing plaintext fallbacks', async () => {
    const paths = await testPaths();
    const store = new DesktopSecretStore({
      safeStorage: mockSafeStorage(false),
      paths,
    });

    const state = store.inspect();

    expect(state.available).toBe(false);
    expect(state.error).toContain('safeStorage encryption is unavailable');
    expect(state.recoveryActions.join(' ')).toContain('Keychain');
    await expect(store.loadRuntimeSecrets()).rejects.toThrow('Keychain');
  });

  it('rejects corrupt secret state with reset instructions', async () => {
    const paths = await testPaths();
    const store = new DesktopSecretStore({
      safeStorage: mockSafeStorage(),
      paths,
    });
    await store.loadRuntimeSecrets();
    await writeFile(paths.secretsFile, '{bad json', 'utf-8');

    await expect(store.loadRuntimeSecrets()).rejects.toThrow('Desktop secret state is unreadable');
  });
});
