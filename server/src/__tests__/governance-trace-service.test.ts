import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { GovernanceTraceService } from '../services/governance-trace-service.js';

describe('GovernanceTraceService', () => {
  let testRoot: string;
  let tracesDir: string;

  beforeEach(async () => {
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'veritas-governance-traces-'));
    tracesDir = path.join(testRoot, 'traces');
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  it('records redacted file-backed traces and filters the list', async () => {
    const service = new GovernanceTraceService({ tracesDir, storageType: 'file' });
    const secret = 'sk_live_1234567890abcdef';
    const localPath = '/Users/bradgroux/Projects/veritas-kanban/.env';

    const blocked = await service.record({
      kind: 'policy',
      outcome: 'blocked',
      title: 'Policy decision',
      summary: `Blocked ${secret} from ${localPath}`,
      subject: { agentId: 'codex', taskId: 'task-1', actionType: 'git.push' },
      evaluatedRules: [
        {
          id: 'policy:risk',
          label: 'Risk gate',
          type: 'policy',
          status: 'matched',
          outcome: 'blocked',
          message: `Matched token ${secret}`,
        },
      ],
      matchedRules: [],
      steps: [],
      raw: { secret, localPath },
      createdAt: '2026-06-01T12:00:00.000Z',
    });
    await service.record({
      kind: 'routing',
      outcome: 'routed',
      title: 'Routing decision',
      summary: 'Selected codex.',
      subject: { agentId: 'codex', actionType: 'agent.route' },
      createdAt: '2026-06-01T13:00:00.000Z',
    });

    expect(JSON.stringify(blocked)).not.toContain(secret);
    expect(JSON.stringify(blocked)).not.toContain(localPath);
    expect(blocked.redacted).toBe(true);

    const policyTraces = await service.list({ kind: 'policy', agent: 'codex' });
    expect(policyTraces.map((trace) => trace.id)).toEqual([blocked.id]);
    await expect(service.get(blocked.id)).resolves.toMatchObject({
      id: blocked.id,
      outcome: 'blocked',
    });
  });
});
