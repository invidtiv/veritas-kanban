import { afterEach, describe, expect, it } from 'vitest';
import { getDocumentCspNonce } from '@/theme/csp-nonce';

describe('getDocumentCspNonce', () => {
  afterEach(() => {
    delete window.__VERITAS_CSP_NONCE__;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('prefers the nonce captured by the trusted bootstrap script', () => {
    window.__VERITAS_CSP_NONCE__ = 'captured-nonce';

    expect(getDocumentCspNonce()).toBe('captured-nonce');
  });

  it('returns the nonce from the server-injected script tag', () => {
    const script = document.createElement('script');
    script.nonce = 'nonce-from-server';
    document.head.appendChild(script);

    expect(getDocumentCspNonce()).toBe('nonce-from-server');
  });

  it('returns undefined when no nonce-bearing tag is present', () => {
    document.head.appendChild(document.createElement('script'));

    expect(getDocumentCspNonce()).toBeUndefined();
  });
});
