import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.js';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  issue: vi.fn(),
  rotate: vi.fn(),
  revoke: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('../../services/agent-credential-service.js', () => ({
  getAgentCredentialService: () => mocks,
}));

vi.mock('../../services/audit-service.js', () => ({
  auditLog: mocks.auditLog,
}));

const { agentCredentialRoutes } = await import('../../routes/agent-credentials.js');

function buildApp(role: 'admin' | 'agent' = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).auth = { role, keyName: role === 'admin' ? 'session' : 'remote-agent' };
    next();
  });
  app.use('/api/agent-credentials', agentCredentialRoutes);
  app.use(errorHandler);
  return app;
}

describe('agent credential routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockReturnValue([]);
  });

  it('allows an admin to create an agent identity and returns the key once', async () => {
    mocks.issue.mockReturnValue({
      agentId: 'linux-coder-01',
      label: 'Linux coder',
      role: 'agent',
      keyPrefix: 'vk_agent_abc123',
      createdAt: '2026-07-31T00:00:00.000Z',
      createdBy: 'session',
      apiKey: 'vk_agent_secret',
    });

    const response = await request(buildApp()).post('/api/agent-credentials').send({
      agentId: 'linux-coder-01',
      label: 'Linux coder',
    });

    expect(response.status).toBe(201);
    expect(response.body.apiKey).toBe('vk_agent_secret');
    expect(mocks.issue).toHaveBeenCalledWith({
      agentId: 'linux-coder-01',
      label: 'Linux coder',
      role: 'agent',
      createdBy: 'session',
    });
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent-credential.create',
        resource: 'agent:linux-coder-01',
      })
    );
  });

  it('rejects malformed IDs and non-admin callers', async () => {
    const malformed = await request(buildApp()).post('/api/agent-credentials').send({
      agentId: '../escape',
    });
    expect(malformed.status).toBe(400);

    const forbidden = await request(buildApp('agent')).get('/api/agent-credentials');
    expect(forbidden.status).toBe(403);
  });

  it('rotates and revokes existing identities', async () => {
    mocks.rotate.mockReturnValue({ agentId: 'linux-coder-01', apiKey: 'vk_agent_rotated' });
    mocks.revoke.mockReturnValue({
      agentId: 'linux-coder-01',
      revokedAt: '2026-07-31T01:00:00.000Z',
    });

    const rotated = await request(buildApp()).post('/api/agent-credentials/linux-coder-01/rotate');
    expect(rotated.status).toBe(200);
    expect(rotated.body.apiKey).toBe('vk_agent_rotated');

    const revoked = await request(buildApp()).delete('/api/agent-credentials/linux-coder-01');
    expect(revoked.status).toBe(200);
    expect(revoked.body.revokedAt).toBeTruthy();
  });
});
