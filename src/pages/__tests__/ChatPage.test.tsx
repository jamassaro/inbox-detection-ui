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
import { ToastProvider } from '../../contexts/ToastProvider';
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
  conversationId: 'conv-1',
  response: 'You have 3 active subscriptions totalling $47.97 per month.',
  sources: [{ id: 'disc-1', title: 'Netflix renews at $15.49', type: 'subscription' }],
  artifacts: [],
  ...overrides,
});

/**
 * Pro users' history column fetches GET /chat/conversations on mount,
 * before any user interaction — queued ahead of a test's own POST /chat
 * mock so the two never compete for the same "once" slot (mockApiFetch
 * isn't path-aware in this file; ordering is what keeps them apart).
 */
const emptyConversationsWire = () => ({ conversations: [], total: 0, pagination: { limit: 20, offset: 0 } });

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
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
      </ToastProvider>
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
    // Pro's history column does fetch on mount — this only asserts no
    // question was sent (no POST /chat).
    expect(mockApiFetch).not.toHaveBeenCalledWith('/chat', expect.anything());
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
    mockApiFetch.mockResolvedValueOnce(emptyConversationsWire());
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
    mockApiFetch.mockResolvedValueOnce(emptyConversationsWire());
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

  it('navigates to the upgrade page with the chat_limit context when the limit CTA is clicked', async () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(0));
    mockApiFetch.mockResolvedValueOnce(emptyConversationsWire());
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));

    expect(await screen.findByText('probe:/upgrade')).toBeTruthy();
  });
});

describe('ChatPage — conversation history (Pro)', () => {
  /** Path-aware routing — history involves several distinct endpoints in one test. */
  const stubApi = ({
    conversations = [],
    onSelect,
  }: {
    conversations?: { id: string; title: string; updatedAt: string; messageCount: number }[];
    onSelect?: (id: string) => unknown;
  } = {}) => {
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/chat/conversations?limit=20&offset=0') {
        return { conversations, total: conversations.length, pagination: { limit: 20, offset: 0 } };
      }
      if (path.startsWith('/chat/conversations/')) {
        if (!onSelect) throw new Error(`unexpected fetch: ${path}`);
        return onSelect(path.split('/')[3]!);
      }
      if (path === '/chat' && options?.method === 'POST') return wireAnswer();
      throw new Error(`unexpected apiFetch: ${path} ${options?.method ?? 'GET'}`);
    });
  };

  it('shows the history column with past conversations for Pro users', async () => {
    stubApi({
      conversations: [
        { id: 'conv-1', title: 'Netflix pricing', updatedAt: '2026-09-20T00:00:00.000Z', messageCount: 4 },
      ],
    });
    renderPage();

    const item = await screen.findByTestId('chat-history-item');
    expect(item.textContent).toContain('Netflix pricing');
  });

  it('shows the empty state when there are no past conversations', async () => {
    stubApi({ conversations: [] });
    renderPage();

    expect(await screen.findByText('No past conversations yet.')).toBeTruthy();
  });

  it('loads a selected conversation into the transcript', async () => {
    stubApi({
      conversations: [
        { id: 'conv-1', title: 'Netflix pricing', updatedAt: '2026-09-20T00:00:00.000Z', messageCount: 2 },
      ],
      onSelect: () => ({
        id: 'conv-1',
        title: 'Netflix pricing',
        createdAt: '2026-09-20T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'Why did Netflix go up?',
            sources: [],
            artifacts: [],
            createdAt: '2026-09-20T00:00:00.000Z',
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'Netflix raised prices in September.',
            sources: [],
            artifacts: [],
            createdAt: '2026-09-20T00:00:01.000Z',
          },
        ],
      }),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('chat-history-item'));

    expect(await screen.findByText('Why did Netflix go up?')).toBeTruthy();
    expect(screen.getByText('Netflix raised prices in September.')).toBeTruthy();
  });

  it('shows a toast and leaves the transcript untouched when loading a conversation fails', async () => {
    stubApi({
      conversations: [
        { id: 'conv-1', title: 'Netflix pricing', updatedAt: '2026-09-20T00:00:00.000Z', messageCount: 2 },
      ],
      onSelect: () => {
        throw new Error('not found');
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('chat-history-item'));

    expect(await screen.findByText("Couldn't load that conversation.")).toBeTruthy();
    expect(screen.queryByTestId('chat-message-detective')).toBeNull();
  });

  it('resets the transcript when New chat is clicked', async () => {
    stubApi();
    const user = userEvent.setup();
    renderPage();

    await typeAndSend('Which subscriptions am I paying for?');
    await screen.findByTestId('chat-message-detective');

    await user.click(screen.getByTestId('chat-new'));

    expect(screen.queryByTestId('chat-message-user')).toBeNull();
    expect(screen.queryByTestId('chat-message-detective')).toBeNull();
    expect(screen.getByText('Ask me anything about your inbox')).toBeTruthy();
  });

  it('does not show the history column or fetch conversations for Free users', () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(2));
    renderPage();

    expect(screen.queryByTestId('chat-history-column')).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalledWith('/chat/conversations?limit=20&offset=0');
  });

  it('redirects Free users straight to the upgrade page when History is clicked, with no request fired', async () => {
    mockUseEntitlements.mockReturnValue(entitlementsResult(2));
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('chat-history-upgrade'));

    expect(await screen.findByText('probe:/upgrade')).toBeTruthy();
    expect(mockApiFetch).not.toHaveBeenCalledWith('/chat/conversations?limit=20&offset=0');
  });
});

describe('ChatPage — artifacts', () => {
  it('renders artifacts under the detective message, and links a source chip to its discovery', async () => {
    mockApiFetch.mockResolvedValueOnce(emptyConversationsWire());
    mockApiFetch.mockResolvedValueOnce(
      wireAnswer({
        response: 'You have a 70% off offer from Everlane.',
        artifacts: [
          {
            type: 'offer',
            data: {
              discoveryId: 'disc-1',
              companyEntityId: 'co-1',
              company: 'Everlane',
              value: 70,
              unit: 'percent',
              historicalBest: true,
            },
          },
        ],
      }),
    );
    renderPage();

    await typeAndSend('What offers did I get from Everlane?');

    expect(await screen.findByTestId('artifact-offer')).toBeTruthy();
    expect(screen.getByTestId('artifact-offer').textContent).toContain('70% off');

    const sourceLink = screen.getByTestId('chat-source-chip') as HTMLAnchorElement;
    expect(sourceLink.getAttribute('href')).toBe('/app/discoveries/disc-1');
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
