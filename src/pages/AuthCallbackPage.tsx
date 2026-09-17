import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { User } from '../types';

/**
 * Redirect target of the backend Google OAuth flow. The code exchange happens
 * backend-side (it sets the httpOnly session cookie); this page only confirms
 * the session with `GET /auth/me` and routes accordingly:
 * Gmail connected → /app/dashboard, otherwise → /onboarding (connect Gmail).
 */
const AuthCallbackPage = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (!params.get('code')) {
      window.location.replace('/?error=auth');
      return;
    }

    void queryClient
      .fetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: () => apiFetch<User>('/auth/me'),
      })
      .then((user) => (user.gmailConnected ? '/app/dashboard' : '/onboarding'))
      .then((dest) => {
        window.location.replace(dest);
      })
      .catch(() => {
        window.location.replace('/?error=auth');
      });
  }, [queryClient]);

  return (
    <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
};

export default AuthCallbackPage;
