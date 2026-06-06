import { describe, expect, it } from 'vitest';
import { veritasMantineTheme } from '@/theme/mantine-theme';

describe('veritasMantineTheme', () => {
  it('keeps overlay scroll locking disabled for CSP-safe packaged desktop modals', () => {
    expect(veritasMantineTheme.components?.Modal?.defaultProps).toMatchObject({
      lockScroll: false,
    });
    expect(veritasMantineTheme.components?.Drawer?.defaultProps).toMatchObject({
      lockScroll: false,
    });
  });
});
