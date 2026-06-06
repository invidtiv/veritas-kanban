import type { WebSocket } from 'ws';

const MAX_CLOSE_REASON_BYTES = 123;
const ELLIPSIS = '...';

export function truncateWebSocketCloseReason(
  reason: string,
  maxBytes = MAX_CLOSE_REASON_BYTES
): string {
  if (Buffer.byteLength(reason, 'utf8') <= maxBytes) {
    return reason;
  }

  const suffixBytes = Buffer.byteLength(ELLIPSIS, 'utf8');
  let truncated = '';

  for (const char of reason) {
    const next = truncated + char;
    if (Buffer.byteLength(next, 'utf8') + suffixBytes > maxBytes) {
      break;
    }
    truncated = next;
  }

  return truncated + ELLIPSIS;
}

export function closeWebSocketSafely(ws: WebSocket, code: number, reason: string): void {
  ws.close(code, truncateWebSocketCloseReason(reason));
}
