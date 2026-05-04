/**
 * webhook-n8n.ts
 *
 * Receives n8n email-directive payloads and optionally base64-encoded attachments.
 * Saves useful attachments (docx, pdf, txt) to the clawd inbox.
 *
 * POST /api/webhook/n8n
 * No auth required — routed BEFORE the authenticate middleware in index.ts.
 * Secured via shared webhook secret (N8N_WEBHOOK_SECRET env var).
 */
import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { asyncHandler } from '../middleware/async-handler.js';

const router: RouterType = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
]);

const ALLOWED_EXTENSIONS = new Set(['.docx', '.doc', '.pdf', '.txt', '.csv', '.xlsx']);

const ATTACHMENT_DIR =
  process.env.CLAWD_ATTACHMENT_DIR ||
  path.join(process.env.HOME || '/Users/bradgroux', 'clawd', 'inbox', 'attachments');

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

function safeCompareSecret(provided: string | string[] | undefined, expected: string): boolean {
  if (typeof provided !== 'string') return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function sanitizePathSegment(value: string | undefined, fallback: string): string {
  const sanitized = (value || fallback)
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._\-() ]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120);

  return sanitized || fallback;
}

function ensureWithinAttachmentDir(filePath: string): void {
  const base = path.resolve(ATTACHMENT_DIR);
  const resolved = path.resolve(filePath);

  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('Invalid attachment path');
  }
}

function formatTimestampForFilename(timestamp: string | undefined): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return safeDate.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * POST /api/webhook/n8n
 * Body: { type: 'email-directive', from, subject, directive, messageId, timestamp, attachments? }
 * attachments: [{ filename, mimeType, data: '<base64>' }]
 */
router.post(
  '/n8n',
  asyncHandler(async (req: Request, res: Response) => {
    if (!WEBHOOK_SECRET) {
      res.status(503).json({ ok: false, error: 'Webhook secret is not configured' });
      return;
    }

    const provided = req.headers['x-webhook-secret'];
    if (!safeCompareSecret(provided, WEBHOOK_SECRET)) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const body = req.body as {
      type?: string;
      from?: string;
      subject?: string;
      directive?: string;
      forwardedContent?: string;
      messageId?: string;
      timestamp?: string;
      attachments?: Array<{ filename: string; mimeType: string; data: string }>;
    };

    if (body.type !== 'email-directive') {
      res.status(400).json({ ok: false, error: `Unknown type: ${body.type}` });
      return;
    }

    // Ensure attachment dir exists
    await fs.mkdir(ATTACHMENT_DIR, { recursive: true });

    const saved: string[] = [];
    const skipped: string[] = [];

    for (const att of body.attachments || []) {
      const ext = path.extname(att.filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(att.mimeType)) {
        skipped.push(att.filename);
        continue;
      }

      const safeName = sanitizePathSegment(att.filename, 'attachment');
      const safeSender = sanitizePathSegment(body.from?.split('@')[0], 'unknown');
      const ts = formatTimestampForFilename(body.timestamp);
      const destName = `${ts}_${safeSender}_${safeName}`;
      const destPath = path.join(ATTACHMENT_DIR, destName);
      ensureWithinAttachmentDir(destPath);

      await fs.writeFile(destPath, Buffer.from(att.data, 'base64'));
      saved.push(destName);
    }

    // Write a sidecar .json summary for each email-directive
    const safeSender = sanitizePathSegment(body.from?.split('@')[0], 'unknown');
    const metaName = `${formatTimestampForFilename(body.timestamp)}_${safeSender}_directive.json`;
    const metaPath = path.join(ATTACHMENT_DIR, metaName);
    ensureWithinAttachmentDir(metaPath);

    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          type: 'email-directive',
          from: body.from,
          subject: body.subject,
          directive: body.directive,
          messageId: body.messageId,
          timestamp: body.timestamp,
          savedAttachments: saved,
          skippedAttachments: skipped,
        },
        null,
        2
      )
    );

    res.json({
      ok: true,
      saved,
      skipped,
      meta: metaName,
    });
  })
);

export { router as webhookN8nRouter };
