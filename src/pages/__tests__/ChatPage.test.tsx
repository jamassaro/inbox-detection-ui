import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPage from '../ChatPage';
import { useEntitlements } from '../../hooks/useEntitlements';
import type { UseEntitlementsResult } from '../../hooks/useEntitlements';
import { ApiError } from '../../lib/apiError';
import { apiFetch } from '../../lib/apiClient';
import type { ChatAnswerWire } from '../../hooks/useChat';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

// The entitlements contract (chatQuestionsRemaining) drives the counter and
// the at-limit state; mocking the hook keeps these tests focused on the page.
vi.mock('../../hooks/useEntitlements', () => ({
  useEntitlements: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);
const mockUseEntitlements = vi.mocked(useEntitlements);

const entitlementsResult = (chatQuestionsRemaining: number | null): UseEntitlementsResult => {
  const isPro = chatQuestionsRemaining === null;
  return {
    entitlements: {
      plan: isPro ? 'pro' : 'free',
      visibleDiscoveries: isPro ? 100 : 5,
      continuousMonitoring: isPro,
      reminders: isPro,
      calendarActions: isPro,
      emailActions: isPro,
      dailyBriefing: isPro,
      chatQuestionsRemaining,
    },
    isLoading: false,
    refresh: vi.fn(),
    decrementChatQuestions: vi.fn(),
    plan: isPro ? 'pro' : 'free',
    isPro,
    isFree: !isPro,
    hasFeature: vi.fn(() => isPro),
    canUseContinuousMonitoring: isPro,
    canUseReminders: isPro,
    canUseCalendar: isPro,
    canUseEmailActions: isPro,
    canUseDailyBriefing: isPro,
    chatQuestionsRemaining,
  };
};

const wireAnswer = (overrides: Partial<ChatAnswerWire> = {}): ChatAnswerWire => ({
  response: 'You have 3 active subscriptions totalling $47.97 per month.',
  sources: [{ id: 'disc-1', title: 'Netflix renews at $15.49', type: 'subscription' }],
  ...overrides,
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/app/chat']}>
            <Routes>
              <Route path="/app/chat" element={<ChatPage />} />
              <Route path="/upgrade" element={<div>probe:/upgrade</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </I18nextProvider>,
  );
};

const typeAndSend = async (message: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByTestId('chat-input'), message);
  await user.click(screen.getByTestId('chat-send'));
};

beforeEach(() => {
  mockApiFetch.mockReset();
  mockUseEntitlements.mockReturnValue(entitlementsResult(null));
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('ChatPage — empty state', () => {
  it('renders the translated suggested-prompt grid', () => {
    renderPage();
    const suggestions = screen.getAllByTestId('chat-suggestion');
    expect(suggestions).toHaveLength(6);
    expect(suggestions[0]?.textContent).toBe('Which subscriptions am I paying for?');
    expect(screen.getByText('Ask me anything about your inbox')).not.toBeNull();
  });

  it('fills the input when a suggestion is clicked (does not send)', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getAllByTestId('chat-suggestion')[0]!);
    expect((screen.getByTestId('chat-input') as HTMLInputElement).value).toBe(
      'Which subscriptions am I paying for?',
    );
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('renders suggestions in Spanish after switching locale', async () => {
    await i18n.changeLanguage('es');
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })?.textContent).toBe('Pregunta al Detective');
    expect(screen.getAllByTestId('chat-suggestion')[0]?.textContent).toBe(
      '¿A qué suscripciones estoy pagando?',
    );
  });
});

describe('ChatPage — send flow', () => {
  it('shows the user bubble, then the detective response rendered as-is with source chips', async () => {
    mockApiFetch.mockResolvedValueOnce(wireAnswer());
    renderPage();

    await typeAndSend('Which subscriptions am I paying for?');

    expect(await screen.findByTestId('chat-message-user')).not.toBeNull();
    const detective = await screen.findByTestId('chat-message-detective');
    // AI-generated content passes through untouched (never through t()).
    expect(detective.textContent).toContain(
      'You have 3 active subscriptions totalling $47.97 per month.',
    );
    const chips = screen.getAllByTestId('chat-source-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]?.textContent).toContain('Netflix renews at $15.49');
    // The accepted turn cleared the input.
    expect((screen.getByTestId('chat-input') as HTMLInputElement).value).toBe('');
  });

  it('shows the thinking state while the request is in flight', async () => {
    // Never-settling request — the pending indicator must show on its own.
    mockApiFetch.mockImplementation(() => new Promise<ChatAnswerWire>(() => {}));
    renderPage();

    await typeAndSend('Where can I save money?');
    expect(screen.getByTestId('chat-thinking').textContent).toContain('Detective is thinking');

    mockApiFetch.mockReset();
  });

  it('renders an inline error with retry, and the retry recovers', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(502, 'chat_unavailable', 'chat unavailable'));
    renderPage();

    await typeAndSend('How much am I spending?');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("The Detective couldn't answer right now.");

    // Retry re-sends the last message (shared errors.retry label).
    mockApiFetch.mockResolvedValueOnce(wireAnswer({ response: 'About $64 per month.' }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('chat-message-detective');
  });
});

describe('ChatPage — entitlements', () => {
  it('shows the interpolated remaining-questions counter for Free users', () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(2));
    renderPage();
    expect(screen.getByTestId('chat-limit-counter').textContent).toBe(
      '2 of 3 questions remaining today',
    );
    expect((screen.getByTestId('chat-input') as HTMLInputElement).disabled).toBe(false);
  });

  it('disables the input and shows the upgrade prompt at the limit', () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(0));
    renderPage();
    expect(screen.getByTestId('chat-limit-reached').textContent).toContain(
      "You've used all your free Detective questions for today.",
    );
    expect((screen.getByTestId('chat-input') as HTMLInputElement).disabled).toBe(true);
    // The counter is replaced by the limit-reached prompt.
    expect(screen.queryByTestId('chat-limit-counter')).toBeNull();
  });

  it('shows no counter for Pro users', () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(null));
    renderPage();
    expect(screen.queryByTestId('chat-limit-counter')).toBeNull();
    expect(screen.queryByTestId('chat-limit-reached')).toBeNull();
  });

  it('treats a backend 402 pro_required as limit reached', async () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(1));
    mockApiFetch.mockRejectedValueOnce(new ApiError(402, 'pro_required', 'limit reached'));
    renderPage();

    await typeAndSend('One more question?');

    expect(await screen.findByTestId('chat-limit-reached')).not.toBeNull();
    expect((screen.getByTestId('chat-input') as HTMLInputElement).disabled).toBe(true);
    // The rejected optimistic turn was rolled back.
    expect(screen.queryByTestId('chat-message-user')).toBeNull();
  });
});

describe('ChatPage — i18n', () => {
  it('renders the input placeholder through the detective namespace in Spanish', async () => {
    await i18n.changeLanguage('es');
    renderPage();
    expect(screen.getByTestId('chat-input').getAttribute('placeholder')).toBe(
      'Pregunta al Detective…',
    );
  });
});
