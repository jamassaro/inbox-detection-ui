import { useNavigate } from 'react-router-dom';
import { AuthCallbackError, AuthCallbackLoading } from '../AuthCallbackPage';

/**
 * Dev-only auth-states gallery (FE-007), in the /dev/primitives style. Not
 * linked from any navigation; exists to visually verify and capture PR
 * evidence for the callback loading/error states, which otherwise only
 * appear mid-OAuth-redirect. The error card's "Try again" is the real
 * component with its real handler (navigates to /).
 */
const AuthStatesDemoPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">FE-007 auth states</h1>
        <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
      </header>

      <section aria-label="AuthCallback loading">
        <h2 className="mb-3 text-lg font-semibold">AuthCallbackLoading</h2>
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <AuthCallbackLoading />
        </div>
      </section>

      <section aria-label="AuthCallback error">
        <h2 className="mb-3 text-lg font-semibold">AuthCallbackError</h2>
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <AuthCallbackError onTryAgain={() => navigate('/')} />
        </div>
      </section>
    </div>
  );
};

export default AuthStatesDemoPage;
