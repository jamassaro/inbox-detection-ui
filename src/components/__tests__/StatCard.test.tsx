import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import StatCard from '../StatCard';

describe('StatCard', () => {
  afterEach(cleanup);

  it('renders the value and the label', () => {
    render(<StatCard value={12} label="Subscriptions found" />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Subscriptions found')).toBeTruthy();
  });

  it('defaults to the gray value color', () => {
    render(<StatCard value={3} label="New" />);
    expect(screen.getByText('3').className).toContain('text-gray-900');
  });

  it.each([
    ['red', 'text-red-600'],
    ['green', 'text-green-600'],
  ] as const)('applies the %s value color', (color, expectedClass) => {
    render(<StatCard value={3} label="New" color={color} />);
    expect(screen.getByText('3').className).toContain(expectedClass);
  });
});
