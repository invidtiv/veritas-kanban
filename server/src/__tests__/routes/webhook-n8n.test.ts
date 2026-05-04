import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { errorHandler } from '../../middleware/error-handler.js';

async function createApp() {
  const { webhookN8nRouter } = await import('../../routes/webhook-n8n.js');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/webhook', webhookN8nRouter);
  app.use(errorHandler);
  return app;
}

describe('n8n webhook route', () => {
  let attachmentDir: string;
  let originalSecret: string | undefined;
  let originalAttachmentDir: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    attachmentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veritas-webhook-'));
    originalSecret = process.env.N8N_WEBHOOK_SECRET;
    originalAttachmentDir = process.env.CLAWD_ATTACHMENT_DIR;
    process.env.CLAWD_ATTACHMENT_DIR = attachmentDir;
  });

  afterEach(async () => {
    vi.resetModules();
    if (originalSecret === undefined) {
      delete process.env.N8N_WEBHOOK_SECRET;
    } else {
      process.env.N8N_WEBHOOK_SECRET = originalSecret;
    }
    if (originalAttachmentDir === undefined) {
      delete process.env.CLAWD_ATTACHMENT_DIR;
    } else {
      process.env.CLAWD_ATTACHMENT_DIR = originalAttachmentDir;
    }
    await fs.rm(attachmentDir, { recursive: true, force: true });
  });

  it('rejects requests when the webhook secret is not configured', async () => {
    delete process.env.N8N_WEBHOOK_SECRET;
    const app = await createApp();

    const res = await request(app).post('/api/webhook/n8n').send({ type: 'email-directive' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Webhook secret is not configured');
  });

  it('rejects requests with an invalid webhook secret', async () => {
    process.env.N8N_WEBHOOK_SECRET = 'correct-secret';
    const app = await createApp();

    const res = await request(app)
      .post('/api/webhook/n8n')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ type: 'email-directive' });

    expect(res.status).toBe(401);
  });

  it('sanitizes generated filenames and skips mismatched attachment types', async () => {
    process.env.N8N_WEBHOOK_SECRET = 'correct-secret';
    const app = await createApp();

    const res = await request(app)
      .post('/api/webhook/n8n')
      .set('x-webhook-secret', 'correct-secret')
      .send({
        type: 'email-directive',
        from: '../../operator@example.com',
        subject: 'Directive',
        directive: 'Review this',
        timestamp: '2026-05-03T12:00:00.000Z',
        attachments: [
          {
            filename: '../notes.txt',
            mimeType: 'text/plain',
            data: Buffer.from('hello').toString('base64'),
          },
          {
            filename: 'invoice.exe',
            mimeType: 'text/plain',
            data: Buffer.from('nope').toString('base64'),
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.saved).toHaveLength(1);
    expect(res.body.skipped).toEqual(['invoice.exe']);

    const files = await fs.readdir(attachmentDir);
    expect(files).toHaveLength(2);
    expect(files.every((file) => !file.includes('..') && !file.includes('/'))).toBe(true);
  });
});
