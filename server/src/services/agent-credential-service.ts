import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getRuntimeDir } from '../utils/paths.js';

export type AgentCredentialRole = 'agent' | 'read-only';

interface StoredAgentCredential {
  agentId: string;
  label: string;
  role: AgentCredentialRole;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  createdBy: string;
  rotatedAt?: string;
  revokedAt?: string;
}

export interface AgentCredentialSummary {
  agentId: string;
  label: string;
  role: AgentCredentialRole;
  keyPrefix: string;
  createdAt: string;
  createdBy: string;
  rotatedAt?: string;
  revokedAt?: string;
}

export interface IssuedAgentCredential extends AgentCredentialSummary {
  /** Returned only when a credential is created or rotated. Never persisted. */
  apiKey: string;
}

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,49}$/;

function hashKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function toSummary(record: StoredAgentCredential): AgentCredentialSummary {
  const { keyHash: _keyHash, ...summary } = record;
  return summary;
}

/**
 * Persistent, revocable API credentials for remote coding agents.
 *
 * Only SHA-256 hashes of random 256-bit keys are written to disk. Plaintext
 * keys are returned once at creation/rotation time and cannot be recovered.
 */
export class AgentCredentialService {
  private readonly records = new Map<string, StoredAgentCredential>();

  constructor(private readonly filePath = path.join(getRuntimeDir(), 'agent-credentials.json')) {
    this.load();
  }

  list(): AgentCredentialSummary[] {
    return Array.from(this.records.values())
      .map(toSummary)
      .sort((a, b) => a.agentId.localeCompare(b.agentId));
  }

  activeCount(): number {
    return Array.from(this.records.values()).filter((record) => !record.revokedAt).length;
  }

  issue(input: {
    agentId: string;
    label?: string;
    role?: AgentCredentialRole;
    createdBy: string;
  }): IssuedAgentCredential {
    const agentId = input.agentId.trim().toLowerCase();
    if (!AGENT_ID_PATTERN.test(agentId)) {
      throw new Error(
        'Agent ID must be 3-50 lowercase characters and use only letters, numbers, hyphens, or underscores.'
      );
    }
    if (this.records.has(agentId)) {
      throw new Error(`Agent ID already exists: ${agentId}`);
    }

    const apiKey = this.generateKey();
    const createdAt = new Date().toISOString();
    const record: StoredAgentCredential = {
      agentId,
      label: input.label?.trim() || agentId,
      role: input.role || 'agent',
      keyHash: hashKey(apiKey),
      keyPrefix: apiKey.slice(0, 16),
      createdAt,
      createdBy: input.createdBy,
    };

    this.records.set(agentId, record);
    this.save();
    return { ...toSummary(record), apiKey };
  }

  rotate(agentIdInput: string): IssuedAgentCredential | null {
    const agentId = agentIdInput.trim().toLowerCase();
    const existing = this.records.get(agentId);
    if (!existing) return null;

    const apiKey = this.generateKey();
    const updated: StoredAgentCredential = {
      ...existing,
      keyHash: hashKey(apiKey),
      keyPrefix: apiKey.slice(0, 16),
      rotatedAt: new Date().toISOString(),
      revokedAt: undefined,
    };
    this.records.set(agentId, updated);
    this.save();
    return { ...toSummary(updated), apiKey };
  }

  revoke(agentIdInput: string): AgentCredentialSummary | null {
    const agentId = agentIdInput.trim().toLowerCase();
    const existing = this.records.get(agentId);
    if (!existing) return null;

    const updated: StoredAgentCredential = {
      ...existing,
      revokedAt: new Date().toISOString(),
    };
    this.records.set(agentId, updated);
    this.save();
    return toSummary(updated);
  }

  validate(apiKey: string): { name: string; role: AgentCredentialRole } | null {
    if (!apiKey.startsWith('vk_agent_')) return null;
    const keyHash = hashKey(apiKey);
    for (const record of this.records.values()) {
      const matches = crypto.timingSafeEqual(
        Buffer.from(record.keyHash, 'hex'),
        Buffer.from(keyHash, 'hex')
      );
      if (!record.revokedAt && matches) {
        return { name: record.agentId, role: record.role };
      }
    }
    return null;
  }

  private generateKey(): string {
    return `vk_agent_${crypto.randomBytes(32).toString('base64url')}`;
  }

  private load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as StoredAgentCredential[];
      if (!Array.isArray(parsed)) {
        throw new Error('Agent credential store must contain an array');
      }
      parsed.forEach((record, index) => {
        const valid =
          record &&
          typeof record.agentId === 'string' &&
          AGENT_ID_PATTERN.test(record.agentId) &&
          typeof record.keyHash === 'string' &&
          /^[0-9a-f]{64}$/.test(record.keyHash) &&
          typeof record.keyPrefix === 'string' &&
          typeof record.label === 'string' &&
          (record.role === 'agent' || record.role === 'read-only');
        if (!valid) {
          throw new Error(`Invalid agent credential store record at index ${index}`);
        }
        this.records.set(record.agentId, record);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(Array.from(this.records.values()), null, 2)}\n`,
      {
        encoding: 'utf8',
        mode: 0o600,
      }
    );
    fs.renameSync(temporaryPath, this.filePath);
    fs.chmodSync(this.filePath, 0o600);
  }
}

let singleton: AgentCredentialService | null = null;

export function getAgentCredentialService(): AgentCredentialService {
  singleton ??= new AgentCredentialService();
  return singleton;
}

export function disposeAgentCredentialService(): void {
  singleton = null;
}
