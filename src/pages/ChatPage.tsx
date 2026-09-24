import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Plus, SendHorizonal } from 'lucide-react';
import {
  useChat,
  useConversations,
  useLoadConversation,
  isLimitReachedError,
} from '../hooks/useChat';
import { useEntitlements } from '../hooks/useEntitlements';
import { useLocale } from '../hooks/useLocale';
import { useToast } from '../hooks/useToast';
import { useUpgradeRedirect } from '../hooks/useUpgradeRedirect';
import ErrorState from '../components/ErrorState';
import ActionButton from '../components/ActionButton';
import ChatArtifactList from '../components/ChatArtifacts';
import { formatRelativeDate } from '../lib/formatting';

/**
 * Detective Chat page (FE-022, V2 conversation history/artifacts hand-off
 * 2026-09-24).
 *
 * Backend reality (Inbox-api chat.routes.ts, verified against the live API):
 * - `POST /chat` ({ message, conversationId? } in, { conversationId,
 *   response, sources, artifacts } out). `conversationId` is threaded back
 *   on every send regardless of plan — see useChat's own docs for why this
 *   page never branches on plan for that specifically.
 * - `GET /chat/conversations` / `GET /chat/conversations/:id` are Pro-only
 *   (402 pro_required) — this page only ever calls them when
 *   useEntitlements().isPro, so Free never eats a guaranteed-failing
 *   request; Free instead gets a header affordance that redirects straight
 *   to /upgrade.
 * - `sources` are discovery references { id, title, type } — id is a real
 *   discoveryId, linked to `/app/discoveries/:id`.
 * - The free-question limit surfaces as 402 pro_required; the response text
 *   and artifacts are AI/backend-generated in the user's stored locale and
 *   rendered as-is (never run through t()).
 */
/**
 * Backend free-plan daily chat limit (Inbox-api free tier). The entitlements
 * payload exposes that static daily limit (`detectiveChatLimit`), not a
 * server-decremented remaining count — the counter seeds from it and actual
 * exhaustion arrives as the 402 pro_required error.
 */
const FREE_CHAT_DAILY_LIMIT = 3;

const ChatPage = () => {
  const { t } = useTranslation('detective');
  const { locale } = useLocale();
  const toast = useToast();
  const { redirectToUpgrade } = useUpgradeRedirect();
  const {
    messages,
    conversationId,
    send,
    retry,
    startNewConversation,
    loadConversation,
    isLoading,
    error,
  } = useChat();
  const { chatQuestionsRemaining, isPro } = useEntitlements();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const conversations = useConversations(isPro);
  const loadHistoryItem = useLoadConversation();

  const selectConversation = (id: string) => {
    loadHistoryItem.mutate(id, {
      onSuccess: (detail) => loadConversation(detail),
      onError: () => toast.error(t('chat.history.loadError')),
    });
  };

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
      {/* pr-20 (not px-6's symmetric 24px) — clears the floating ScanStatusWidget
          fixed at top-4 right-4 (AppLayout), which would otherwise sit on top
          of these header buttons. */}
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white py-4 pl-6 pr-20">
        <h1 className="text-xl font-semibold text-gray-900">{t('chat.title')}</h1>
        <div className="flex items-center gap-2">
          <ActionButton
            variant="secondary"
            size="sm"
            data-testid="chat-new"
            onClick={() => startNewConversation()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('chat.newChat')}
          </ActionButton>
          {!isPro && (
            <ActionButton
              variant="secondary"
              size="sm"
              data-testid="chat-history-upgrade"
              onClick={() => redirectToUpgrade({ source: 'chat_history' })}
            >
              <HistoryIcon className="h-4 w-4" aria-hidden="true" />
              {t('chat.history.title')}
            </ActionButton>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isPro && (
          <aside
            className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-2"
            data-testid="chat-history-column"
          >
            <h2 className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('chat.history.title')}
            </h2>
            {conversations.isPending ? (
              <div aria-hidden="true" className="space-y-2 p-2">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              </div>
            ) : conversations.isError ? (
              <ErrorState
                title={t('chat.history.loadError')}
                onRetry={() => void conversations.refetch()}
              />
            ) : conversations.data && conversations.data.conversations.length > 0 ? (
              <ul className="space-y-0.5">
                {conversations.data.conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      data-testid="chat-history-item"
                      onClick={() => selectConversation(conversation.id)}
                      className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        conversation.id === conversationId
                          ? 'bg-white font-medium text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:bg-white hover:text-gray-900'
                      }`}
                    >
                      {conversation.title}
                      <span className="block text-xs text-gray-400">
                        {formatRelativeDate(conversation.updatedAt, locale)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-1.5 text-sm text-gray-500">{t('chat.history.empty')}</p>
            )}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
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
                            <Link
                              key={source.id}
                              to={`/app/discoveries/${source.id}`}
                              data-testid="chat-source-chip"
                              className="inline-flex max-w-full items-center truncate rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100"
                            >
                              {source.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <ChatArtifactList artifacts={message.artifacts ?? []} />
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
                <ActionButton
                  size="sm"
                  onClick={() => redirectToUpgrade({ source: 'chat_limit' })}
                >
                  {t('chat.upgrade')}
                </ActionButton>
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
      </div>
    </div>
  );
};

export default ChatPage;
