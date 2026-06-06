declare global {
  interface Window {
    __VERITAS_CSP_NONCE__?: string;
  }
}

export function getDocumentCspNonce(): string | undefined {
  if (typeof window !== 'undefined' && window.__VERITAS_CSP_NONCE__) {
    return window.__VERITAS_CSP_NONCE__;
  }

  if (typeof document === 'undefined') return undefined;

  const nonceSource = document.querySelector<HTMLScriptElement | HTMLStyleElement>(
    'script[nonce], style[nonce]'
  );
  const nonce = nonceSource?.nonce || nonceSource?.getAttribute('nonce') || undefined;
  return nonce || undefined;
}
