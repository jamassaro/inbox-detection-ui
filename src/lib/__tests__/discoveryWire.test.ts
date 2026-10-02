import { describe, expect, it } from 'vitest';
import { toDiscovery } from '../discoveryWire';
import type { DiscoveryWire } from '../discoveryWire';

const buildWire = (overrides: Partial<DiscoveryWire> = {}): DiscoveryWire => ({
  id: 'd1',
  type: 'subscription',
  priority: 'medium',
  status: 'active',
  title: 'Netflix renews October 1',
  description: 'Renews soon',
  company: 'Netflix',
  plan: 'Premium',
  isLocked: false,
  availableActions: [],
  ...overrides,
});

describe('toDiscovery plan mapping', () => {
  it('maps the plan for an unlocked subscription', () => {
    expect(toDiscovery(buildWire()).plan).toBe('Premium');
  });

  it('omits a null or blank plan', () => {
    expect(toDiscovery(buildWire({ plan: null })).plan).toBeUndefined();
    expect(toDiscovery(buildWire({ plan: '  ' })).plan).toBeUndefined();
  });

  it('ignores a plan on non-subscription types', () => {
    expect(toDiscovery(buildWire({ type: 'money' })).plan).toBeUndefined();
  });

  it('withholds the plan on locked rows', () => {
    expect(toDiscovery(buildWire({ isLocked: true })).plan).toBeUndefined();
  });
});
