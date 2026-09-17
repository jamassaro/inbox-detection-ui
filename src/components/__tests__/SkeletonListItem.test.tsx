import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SkeletonListItem from '../SkeletonListItem';

afterEach(cleanup);

describe('SkeletonListItem', () => {
  it('is pulse-animated and hidden from screen readers', () => {
    const { container } = render(<SkeletonListItem />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.animate-pulse')).toBeTruthy();
  });
});
