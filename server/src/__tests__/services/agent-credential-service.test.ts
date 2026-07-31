import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentCredentialService } from '../../services/agent-credential-service.js';

describe('AgentCredentialService', () => {
  let temporaryDirectory: string;
  let credentialPath: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-agent-credentials-'));
    credentialPath = path.join(temporaryDirectory, 'agent-credentials.json');
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('issues a one-time plaintext key while persisting only its hash', () => {
    const service = new AgentCredentialService(credentialPath);
    const issued = service.issue({
      agentId: 'linux-coder-01',
      label: 'Linux coder 01',
      createdBy: 'session',
    });

    expect(issued.apiKey).toMatch(/^vk_agent_[A-Za-z0-9_-]{40,}$/);
    expect(service.validate(issued.apiKey)).toEqual({ name: 'linux-coder-01', role: 'agent' });

    const persisted = fs.readFileSync(credentialPath, 'utf8');
    expect(persisted).not.toContain(issued.apiKey);
    expect(persisted).toContain('"keyHash"');
    expect(fs.statSync(credentialPath).mode & 0o777).toBe(0o600);
  });

  it('reloads, rotates, revokes, and re-enables credentials', () => {
    const firstService = new AgentCredentialService(credentialPath);
    const original = firstService.issue({
      agentId: 'windows-builder',
      role: 'read-only',
      createdBy: 'admin',
    });

    const service = new AgentCredentialService(credentialPath);
    expect(service.validate(original.apiKey)?.role).toBe('read-only');

    const rotated = service.rotate('windows-builder');
    expect(rotated?.apiKey).not.toBe(original.apiKey);
    expect(service.validate(original.apiKey)).toBeNull();
    expect(service.validate(rotated!.apiKey)?.name).toBe('windows-builder');

    expect(service.revoke('windows-builder')?.revokedAt).toBeTruthy();
    expect(service.validate(rotated!.apiKey)).toBeNull();

    const reissued = service.rotate('windows-builder');
    expect(reissued?.revokedAt).toBeUndefined();
    expect(service.validate(reissued!.apiKey)?.name).toBe('windows-builder');
  });

  it('rejects duplicate and malformed agent IDs', () => {
    const service = new AgentCredentialService(credentialPath);
    service.issue({ agentId: 'valid-agent', createdBy: 'admin' });

    expect(() => service.issue({ agentId: 'valid-agent', createdBy: 'admin' })).toThrow(
      'Agent ID already exists'
    );
    expect(() => service.issue({ agentId: '../escape', createdBy: 'admin' })).toThrow(
      'Agent ID must be 3-50 lowercase characters'
    );
  });

  it('fails closed instead of overwriting a malformed credential store', () => {
    fs.writeFileSync(credentialPath, JSON.stringify([{ agentId: 'broken', keyHash: 'short' }]));

    expect(() => new AgentCredentialService(credentialPath)).toThrow(
      'Invalid agent credential store record at index 0'
    );
  });
});
