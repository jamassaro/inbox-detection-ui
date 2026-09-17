import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmptyState from '../EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders title and description without an action button', () => {
    render(
      <EmptyState
        title="No offers yet"
        description="Scan your inbox to find offers."
      />,
    );

    expect(screen.getByText('No offers yet')).toBeTruthy();
    expect(screen.getByText('Scan your inbox to find offers.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the optional action button and wires onClick', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Nothing saved"
        action={{ label: 'Browse offers', onClick }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Browse offers' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the provided lucide icon', () => {
    render(<EmptyState icon={Inbox} title="Inbox empty" />);
    expect(screen.getByText('Inbox empty')).toBeTruthy();
  });
});
