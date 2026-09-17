import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionButton from '../ActionButton';

afterEach(cleanup);

describe('ActionButton', () => {
  it('renders children and handles clicks', () => {
    const onClick = vi.fn();
    render(<ActionButton onClick={onClick}>Save changes</ActionButton>);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the variant classes', () => {
    const { rerender } = render(<ActionButton>Go</ActionButton>);
    const button = () => screen.getByRole('button');

    expect(button().className).toContain('bg-gray-900');
    rerender(<ActionButton variant="secondary">Go</ActionButton>);
    expect(button().className).toContain('border-gray-300');
    rerender(<ActionButton variant="destructive">Go</ActionButton>);
    expect(button().className).toContain('bg-red-600');
    rerender(<ActionButton variant="ghost">Go</ActionButton>);
    expect(button().className).toContain('text-gray-700');
  });

  it('applies the size classes', () => {
    const { rerender } = render(<ActionButton size="sm">Go</ActionButton>);
    const button = () => screen.getByRole('button');

    expect(button().className).toContain('px-2.5');
    rerender(<ActionButton size="md">Go</ActionButton>);
    expect(button().className).toContain('px-4');
    rerender(<ActionButton size="lg">Go</ActionButton>);
    expect(button().className).toContain('px-5');
  });

  it('disables itself and shows an inline spinner while loading', () => {
    render(<ActionButton isLoading>Saving</ActionButton>);

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
