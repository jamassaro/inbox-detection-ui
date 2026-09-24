import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmailEvidenceList from '../EmailEvidenceList';
import { sanitizeEmailHtml } from '../../lib/sanitize';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import type { DiscoveryEvidence } from '../../hooks/useDiscovery';
import i18n from '../../i18n';

// Asserting on the sanitizer itself: FE-014/FE-027 require evidence that
// DOMPurify runs over the excerpt before any dangerouslySetInnerHTML.
vi.mock('../../lib/sanitize', () => ({
  sanitizeEmailHtml: vi.fn((html: string) => `sanitized:${html}`),
}));

const mockSanitize = vi.mocked(sanitizeEmailHtml);

const evidence = (): DiscoveryEvidence => ({
  explanation: 'Flagged because the renewal date is within 7 days.',
  emails: [
    {
      id: 'msg-1935c0a1',
      sender: 'Netflix <info@netflix.com>',
      subject: 'Your renewal is coming up',
      date: '2026-09-10T12:00:00.000Z',
      excerpt: 'Your Standard plan renews on October 1 for $15.49.',
      gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/msg-1935c0a1',
    },
  ],
});

const renderList = (props: Partial<ComponentProps<typeof EmailEvidenceList>> = {}) => {
  const onRetry = vi.fn();
  const view = render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <EmailEvidenceList data={undefined} isPending={false} isError={false} onRetry={onRetry} {...props} />
      </LocaleProvider>
    </I18nextProvider>,
  );
  return { onRetry, ...view };
};

describe('EmailEvidenceList', () => {
  afterEach(() => {
    cleanup();
    mockSanitize.mockClear();
  });

  it('shows the loading skeleton while pending', () => {
    renderList({ isPending: true });
    expect(screen.getByTestId('evidence-loading')).toBeTruthy();
  });

  it('renders sender, subject, date, explanation, and the sanitized excerpt', () => {
    renderList({ data: evidence() });

    expect(screen.getByTestId('evidence-content')).toBeTruthy();
    expect(screen.getByTestId('evidence-subject').textContent).toContain('Your renewal is coming up');
    expect(screen.getByTestId('evidence-sender').textContent).toContain('info@netflix.com');
    expect(screen.getByTestId('evidence-date').textContent).toContain('September 10, 2026');
    expect(screen.getByText('Flagged because the renewal date is within 7 days.')).toBeTruthy();
    // The excerpt is rendered from the sanitizer's output — raw email content
    // can only reach the DOM through sanitizeEmailHtml.
    expect(screen.getByTestId('evidence-excerpt').innerHTML).toBe(
      'sanitized:Your Standard plan renews on October 1 for $15.49.',
    );
    expect(mockSanitize).toHaveBeenCalledWith('Your Standard plan renews on October 1 for $15.49.');
  });

  it('links to Gmail from the derived deep link', () => {
    renderList({ data: evidence() });

    const link = screen.getByTestId('evidence-gmail-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://mail.google.com/mail/u/0/#inbox/msg-1935c0a1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders the empty state when there are no evidence emails', () => {
    renderList({ data: { explanation: null, emails: [] } });
    expect(screen.getByTestId('evidence-empty')).toBeTruthy();
  });

  it('renders the error state and calls onRetry on click', async () => {
    const { onRetry } = renderList({ isError: true });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText("Couldn't load the source email")).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
