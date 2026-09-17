import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SkeletonCard from '../SkeletonCard';

afterEach(cleanup);

describe('SkeletonCard', () => {
  it('is pulse-animated via Tailwind (no custom CSS)', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('defaults to 3 lines and honors the lines prop', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll('[data-testid="skeleton-line"]')).toHaveLength(3);

    const rerun = render(<SkeletonCard lines={5} />);
    expect(rerun.container.querySelectorAll('[data-testid="skeleton-line"]')).toHaveLength(5);
  });

  it('renders zero text lines when lines is 0', () => {
    const { container } = render(<SkeletonCard lines={0} />);
    expect(container.querySelectorAll('[data-testid="skeleton-line"]')).toHaveLength(0);
  });
});
