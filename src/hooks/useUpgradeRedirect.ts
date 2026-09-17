import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveUpgradeContext } from '../lib/upgradeContext';
import type { UpgradeContext } from '../lib/upgradeContext';

/**
 * UpgradeContext with returnPath optional: the hook defaults it to the
 * caller's live location, so a paywall trigger cannot forget to say where
 * the user came from. Callers may still override it explicitly.
 */
export type UpgradeContextInput = Omit<UpgradeContext, 'returnPath'> & {
  returnPath?: string;
};

/**
 * The one way any paywall trigger reaches /upgrade (FE-016): persist the
 * upgrade context to sessionStorage, then navigate to
 * `/upgrade?from={source}`. The query param is a display hint for the
 * contextual headline; the sessionStorage entry is what survives the Stripe
 * round-trip so FE-017 can return the user to `returnPath`.
 */
export function useUpgradeRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToUpgrade = useCallback(
    (ctx: UpgradeContextInput): void => {
      saveUpgradeContext({
        ...ctx,
        returnPath: ctx.returnPath ?? `${location.pathname}${location.search}`,
      });
      navigate(`/upgrade?from=${encodeURIComponent(ctx.source)}`);
    },
    [navigate, location.pathname, location.search],
  );

  return { redirectToUpgrade } as const;
}
