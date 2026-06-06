import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';

import { closeWebSocketSafely, truncateWebSocketCloseReason } from '../utils/websocket-close.js';

describe('websocket close helpers', () => {
  it('keeps close reasons inside the protocol byte limit', () => {
    const longReason =
      'Password sessions are limited to local-owner loopback clients. Use a device session or scoped API token for remote or multi-user access.';

    const result = truncateWebSocketCloseReason(longReason);

    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(123);
    expect(result).toMatch(/\.\.\.$/);
  });

  it('closes with the truncated reason instead of throwing for long auth errors', () => {
    const close = vi.fn();
    const ws = { close } as unknown as WebSocket;

    closeWebSocketSafely(
      ws,
      4001,
      'Password sessions are limited to local-owner loopback clients. Use a device session or scoped API token for remote or multi-user access.'
    );

    expect(close).toHaveBeenCalledWith(4001, expect.any(String));
    const reason = close.mock.calls[0]?.[1] as string;
    expect(Buffer.byteLength(reason, 'utf8')).toBeLessThanOrEqual(123);
  });
});
