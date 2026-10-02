import { afterEach, describe, expect, it } from 'vitest';
import { mountExtension, ROOT_ID, unmountExtension } from '../content/mount';

afterEach(() => unmountExtension());

describe('mountExtension', () => {
  it('is idempotent: one root no matter how often it is called', () => {
    const a = mountExtension();
    const b = mountExtension();
    expect(a).toBe(b);
    expect(document.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1);
  });

  it('re-attaches the same host if Gmail removes it', async () => {
    const host = mountExtension();
    host.remove();
    await new Promise((r) => setTimeout(r, 0));
    expect(host.isConnected).toBe(true);
    expect(document.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1);
  });

  it('closes the shadow root to page scripts', () => {
    expect(mountExtension().shadowRoot).toBeNull();
  });
});
