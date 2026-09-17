import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SendHorizonal } from 'lucide-react';
import { useChat, isLimitReachedError } from '../hooks/useChat';
import { useEntitlements } from '../hooks/useEntitlements';
import ErrorState from '../components/ErrorState';
import ActionButton from '../components/ActionButton';

/**
 * Detective Chat page (FE-022).
 *
 * Backend reality (Inbox-api chat.routes.ts, verified against the live API):
 * - A single POST /chat route ({ message } in, { response, sources } out).
 * - No GET history endpoint — the transcript starts empty each visit.
 * - `sources` are discovery references { id, title, type }; the compact
 *   DiscoveryCard (FE-012) needs company/amount/summary fields the wire does
 *   not carry, so sources render as plain non-navigating chips (FE-014's
 *   EmailDrawer does not exist yet).
 * - The free-question limit surfaces as 402 pro_required; the response text is
 *   AI-generated in the user's stored locale and rendered as-is (never run
 *   through t()).
 */
/**
 * Backend free-plan daily chat limit (Inbox-api free tier). The entitlements
 * payload exposes only the remaining count, not the total.
 */
const FREE_CHAT_DAILY_LIMIT = 3;

const ChatPage = () => {
  const { t } = useTranslation('detective');
  const { messages, send, retry, isLoading, error } = useChat();
  const { chatQuestionsRemaining } = useEntitlements();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // A backend 402 (pro_required) flips the page into the same state as a
  // zeroed counter — the client-side count can lag the server's.
  const atLimit =
    chatQuestionsRemaining === 0 || (error !== null && isLimitReachedError(error));

  // Keep the newest turn in view as the transcript grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isLoading]);

  const submit = () => {
    if (atLimit || isLoading) return;
    send(draft);
    setDraft('');
  };

  const suggestions = [1, 2, 3, 4, 5, 6].map((n) => t(`chat.suggestion${n}`));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">{t('chat.title')}</h1>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isLoading && !error ? (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-10 text-center">
            <p className="text-base text-gray-600">{t('chat.emptyState')}</p>
            <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  data-testid="chat-suggestion"
                  onClick={() => setDraft(suggestion)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <div
                data-testid="chat-message-user"
                className="max-w-[75%] rounded-2xl rounded-br-md bg-gray-100 px-4 py-2 text-sm text-gray-900"
              >
                {message.content}
              </div>
            </div>
          ) : (
            <div key={message.id} className="flex justify-start">
              <div
                data-testid="chat-message-detective"
                className="max-w-[75%] rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
              >
                {/* AI-generated content — rendered as-is, never translated. */}
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.sources && message.sources.length > 0 ? (
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-500">{t('chat.sources')}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {message.sources.map((source) => (
                        <span
                          key={source.id}
                          data-testid="chat-source-chip"
                          title={t('chat.sourceUnavailable')}
                          className="inline-flex max-w-full cursor-not-allowed items-center truncate rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-600"
                        >
                          {source.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ),
        )}

        {isLoading ? (
          <div className="flex justify-start">
            <div
              data-testid="chat-thinking"
              className="rounded-2xl rounded-bl-md bg-gray-50 px-4 py-3 text-sm text-gray-500"
            >
              {t('chat.thinking')}
            </div>
          </div>
        ) : null}

        {error && !isLimitReachedError(error) ? (
          <ErrorState title={t('chat.error')} description={error.message} onRetry={retry} />
        ) : null}
      </div>

      <footer className="border-t border-gray-200 bg-white px-6 py-3">
        {atLimit ? (
          <div
            data-testid="chat-limit-reached"
            className="mb-3 flex items-center justify-between gap-4"
          >
            <p className="text-sm text-gray-600">{t('chat.limitReached')}</p>
            <ActionButton size="sm">{t('chat.upgrade')}</ActionButton>
          </div>
        ) : chatQuestionsRemaining !== null ? (
          <p data-testid="chat-limit-counter" className="mb-2 text-xs text-gray-500">
            {t('chat.limitRemaining', {
              remaining: chatQuestionsRemaining,
              total: FREE_CHAT_DAILY_LIMIT,
            })}
          </p>
        ) : null}
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            type="text"
            data-testid="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('chat.inputPlaceholder')}
            aria-label={t('chat.inputPlaceholder')}
            disabled={atLimit}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400"
          />
          <ActionButton
            type="submit"
            data-testid="chat-send"
            aria-label={t('chat.send')}
            disabled={draft.trim() === '' || isLoading || atLimit}
          >
            <SendHorizonal aria-hidden="true" className="h-4 w-4" />
          </ActionButton>
        </form>
      </footer>
    </div>
  );
};

export default ChatPage;
