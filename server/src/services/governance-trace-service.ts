import path from 'path';
import { nanoid } from 'nanoid';
import type {
  CreateGovernanceTraceInput,
  GovernanceTraceListFilters,
  GovernanceTraceRecord,
} from '@veritas-kanban/shared';
import { mkdir, readFile, readdir, writeFile } from '../storage/fs-helpers.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { redactString } from '../lib/redact.js';
import { getRuntimeDir } from '../utils/paths.js';
import { ensureWithinBase, validatePathSegment } from '../utils/sanitize.js';
import { SqliteDatabase, type SqliteConnectionOptions } from '../storage/sqlite/database.js';
import { SqliteGovernanceTraceRepository } from '../storage/sqlite/governance-repositories.js';

export interface GovernanceTraceServiceOptions {
  tracesDir?: string;
  storageType?: 'file' | 'sqlite';
  sqliteDatabase?: SqliteDatabase;
  sqliteConnectionOptions?: SqliteConnectionOptions;
}

const MAX_LIST_LIMIT = 500;

export class GovernanceTraceService {
  private readonly tracesDir: string;
  private readonly repository: SqliteGovernanceTraceRepository | null = null;
  private readonly sqliteDatabase: SqliteDatabase | null = null;
  private readonly ownsSqliteDatabase: boolean = false;

  constructor(options: GovernanceTraceServiceOptions = {}) {
    this.tracesDir = options.tracesDir ?? path.join(getRuntimeDir(), 'governance-traces');
    const storageType =
      options.storageType ?? (process.env.VERITAS_STORAGE === 'sqlite' ? 'sqlite' : 'file');

    if (storageType === 'sqlite') {
      this.sqliteDatabase =
        options.sqliteDatabase ?? new SqliteDatabase(options.sqliteConnectionOptions);
      this.ownsSqliteDatabase = !options.sqliteDatabase;
      this.sqliteDatabase.open();
      this.repository = new SqliteGovernanceTraceRepository(this.sqliteDatabase);
    }
  }

  async record(input: CreateGovernanceTraceInput): Promise<GovernanceTraceRecord> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const trace: GovernanceTraceRecord = this.redactValue({
      id: `govtrace_${Date.now()}_${nanoid(6)}`,
      kind: input.kind,
      outcome: input.outcome,
      title: input.title,
      summary: input.summary,
      remediation: input.remediation,
      subject: input.subject ?? {},
      evaluatedRules: input.evaluatedRules ?? [],
      matchedRules: input.matchedRules ?? [],
      steps: input.steps ?? [],
      raw: input.raw,
      redacted: true,
      createdAt,
    }) as GovernanceTraceRecord;

    if (this.repository) {
      this.repository.save(trace);
      return trace;
    }

    await mkdir(this.tracesDir, { recursive: true });
    await writeFile(this.getTracePath(trace.id), JSON.stringify(trace, null, 2), 'utf8');
    return trace;
  }

  async get(id: string): Promise<GovernanceTraceRecord> {
    if (this.repository) {
      const trace = this.repository.get(id);
      if (!trace) throw new NotFoundError('Governance trace not found');
      return trace;
    }

    const tracePath = this.getTracePath(id);
    const trace = JSON.parse(await readFile(tracePath, 'utf8')) as GovernanceTraceRecord;
    return trace;
  }

  async list(filters: GovernanceTraceListFilters = {}): Promise<GovernanceTraceRecord[]> {
    const normalized = {
      ...filters,
      limit: Math.min(Math.max(filters.limit ?? 100, 1), MAX_LIST_LIMIT),
    };

    if (this.repository) {
      return this.repository.list(normalized);
    }

    await mkdir(this.tracesDir, { recursive: true });
    const files = await readdir(this.tracesDir);
    const traces = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => JSON.parse(await readFile(path.join(this.tracesDir, file), 'utf8')))
    );

    return (traces as GovernanceTraceRecord[])
      .filter((trace) => {
        const created = Date.parse(trace.createdAt);
        const start = normalized.startTime ? Date.parse(normalized.startTime) : undefined;
        const end = normalized.endTime ? Date.parse(normalized.endTime) : undefined;

        if (normalized.kind && trace.kind !== normalized.kind) return false;
        if (normalized.outcome && trace.outcome !== normalized.outcome) return false;
        if (normalized.agent && trace.subject.agentId !== normalized.agent) return false;
        if (normalized.taskId && trace.subject.taskId !== normalized.taskId) return false;
        if (normalized.actionType && trace.subject.actionType !== normalized.actionType) {
          return false;
        }
        if (start !== undefined && created < start) return false;
        if (end !== undefined && created > end) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, normalized.limit);
  }

  dispose(): void {
    if (this.ownsSqliteDatabase) {
      this.sqliteDatabase?.close();
    }
  }

  private getTracePath(id: string): string {
    validatePathSegment(id);
    return ensureWithinBase(this.tracesDir, path.join(this.tracesDir, `${id}.json`));
  }

  private redactValue(value: unknown): unknown {
    if (typeof value === 'string') return this.redactText(value);
    if (Array.isArray(value)) return value.map((entry) => this.redactValue(entry));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          this.redactValue(entry),
        ])
      );
    }
    return value;
  }

  private redactText(value: string): string {
    return redactString(value)
      .replace(/\/Users\/[^/\s]+\/[^\s)]+/g, '[redacted-local-path]')
      .replace(/[A-Z]:\\Users\\[^\\\s]+\\[^\s)]+/g, '[redacted-local-path]');
  }
}

let singleton: GovernanceTraceService | null = null;

export function getGovernanceTraceService(): GovernanceTraceService {
  singleton ??= new GovernanceTraceService();
  return singleton;
}
