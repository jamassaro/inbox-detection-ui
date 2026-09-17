import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmailDrawer from '../EmailDrawer';
import { apiFetch } from '../../lib/apiClient';
import { sanitizeEmailHtml } from '../../lib/sanitize';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

// Asserting on the sanitizer itself: FE-014 requires evidence that DOMPurify
// runs over the excerpt before any dangerouslySetInnerHTML.
vi.mock('../../lib/sanitize', () => ({
  sanitizeEmailHtml: vi.fn((html: string) => `sanitized:${html}`),
}));

const mockApiFetch = vi.mocked(apiFetch);
const mockSanitize = vi.mocked(sanitizeEmailHtml);

const evidenceResponse = () => ({
  discoveryId: 'disc-1',
  explanation: 'Flagged because the renewal date is within 7 days.',
  evidence: [
    {
      emailId: 'msg-1935c0a1',
      sender: 'Netflix <info@netflix.com>',
      subject: 'Your renewal is coming up',
      date: '2026-09-10T12:00:00.000Z',
      snippet: 'Your Standard plan renews on October 1 for $15.49.',
      company: 'Netflix',
    },
  ],
});

const renderDrawer = ({ isOpen = true }: { isOpen?: boolean } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const view = render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <EmailDrawer discoveryId="disc-1" isOpen={isOpen} onClose={onClose} />
        </QueryClientProvider>
      </LocaleProvider>
    </I18nextProvider>,
  );
  return { onClose, ...view };
};

describe('EmailDrawer', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockSanitize.mockClear();
  });

  afterEach(async () => {
    cleanup();
    await vi.useRealTimers();
  });

  it('renders nothing and never fetches while closed', () => {
    renderDrawer({ isOpen: false });
    expect(screen.queryByTestId('email-drawer')).toBeFalsy();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('fetches the evidence lazily on open and shows the skeleton while loading', async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    renderDrawer();

    expect(await screen.findByTestId('email-drawer-panel')).toBeTruthy();
    expect(screen.getByTestId('email-drawer-loading')).toBeTruthy();
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/evidence');
  });

  it('renders sender, subject, date, explanation, and the sanitized excerpt', async () => {
    mockApiFetch.mockResolvedValue(evidenceResponse());
    renderDrawer();

    expect(await screen.findByTestId('email-drawer-content')).toBeTruthy();
    expect(screen.getByTestId('evidence-subject').textContent).toContain('Your renewal is coming up');
    expect(screen.getByTestId('evidence-sender').textContent).toContain('info@netflix.com');
    expect(screen.getByTestId('evidence-date').textContent).toContain('September 10, 2026');
    expect(screen.getByText('Flagged because the renewal date is within 7 days.')).toBeTruthy();
    // The excerpt is rendered from the sanitizer's output — raw email content
    // can only reach the DOM through sanitizeEmailHtml.
    expect(screen.getByTestId('evidence-excerpt').innerHTML).toBe(
      'sanitized:Your Standard plan renews on October 1 for $15.49.',
    );
    expect(mockSanitize).toHaveBeenCalledWith(
      'Your Standard plan renews on October 1 for $15.49.',
    );
  });

  it('links to Gmail from the derived deep link', async () => {
    mockApiFetch.mockResolvedValue(evidenceResponse());
    renderDrawer();

    const link = (await screen.findByTestId('evidence-gmail-link')) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://mail.google.com/mail/u/0/#inbox/msg-1935c0a1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders the error state with retry when the fetch fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('boom'));
    renderDrawer();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText("Couldn't load the source email")).toBeTruthy();

    mockApiFetch.mockResolvedValue(evidenceResponse());
    await waitFor(async () => {
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    });
    expect(await screen.findByTestId('email-drawer-content')).toBeTruthy();
  });

  it('closes on the close button and on Escape', async () => {
    mockApiFetch.mockResolvedValue(evidenceResponse());
    const { onClose } = renderDrawer();

    await screen.findByTestId('email-drawer-content');
    await userEvent.click(screen.getByTestId('email-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
