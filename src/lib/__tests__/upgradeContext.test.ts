import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearUpgradeContext,
  readUpgradeContext,
  saveUpgradeContext,
} from '../upgradeContext';
import type { UpgradeContext } from '../upgradeContext';

const baseContext: UpgradeContext = {
  source: 'locked_discovery',
  returnPath: '/app/discoveries/abc123',
};

describe('upgradeContext', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('returns null when nothing is saved', () => {
    expect(readUpgradeContext()).toBeNull();
  });

  it('round-trips a saved context', () => {
    saveUpgradeContext(baseContext);
    expect(readUpgradeContext()).toEqual(baseContext);
  });

  it('round-trips discovery and pending-action context', () => {
    const ctx: UpgradeContext = {
      ...baseContext,
      discoveryId: 'dsc_42',
      pendingAction: 'remind',
    };
    saveUpgradeContext(ctx);
    expect(readUpgradeContext()).toEqual(ctx);
  });

  it('overwrites a previously saved context', () => {
    saveUpgradeContext(baseContext);
    saveUpgradeContext({ source: 'chat_limit', returnPath: '/app/chat' });
    expect(readUpgradeContext()).toEqual({
      source: 'chat_limit',
      returnPath: '/app/chat',
    });
  });

  it('persists to sessionStorage (not localStorage)', () => {
    saveUpgradeContext(baseContext);
    expect(window.sessionStorage.getItem('inbox-detective-upgrade-context')).not.toBeNull();
    expect(window.localStorage.getItem('inbox-detective-upgrade-context')).toBeNull();
  });

  it('clearUpgradeContext removes the entry', () => {
    saveUpgradeContext(baseContext);
    clearUpgradeContext();
    expect(readUpgradeContext()).toBeNull();
    expect(window.sessionStorage.getItem('inbox-detective-upgrade-context')).toBeNull();
  });

  it('clear is a no-op when nothing is saved', () => {
    expect(() => clearUpgradeContext()).not.toThrow();
  });

  it('treats a corrupt entry as missing', () => {
    window.sessionStorage.setItem('inbox-detective-upgrade-context', '{not json');
    expect(readUpgradeContext()).toBeNull();
  });

  it('treats an entry with the wrong shape as missing', () => {
    window.sessionStorage.setItem(
      'inbox-detective-upgrade-context',
      JSON.stringify({ nope: true }),
    );
    expect(readUpgradeContext()).toBeNull();
  });
});
