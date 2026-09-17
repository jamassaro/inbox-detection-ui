import type { ReactNode } from 'react';
import { useEntitlements } from '../hooks/useEntitlements';
import type { ProFeature } from '../types';
import UpgradePrompt from './UpgradePrompt';

interface RequiresProProps {
  feature: ProFeature;
  children: ReactNode;
  /** Shown to Free users instead of the default <UpgradePrompt>. */
  fallback?: ReactNode;
}

/**
 * Render-level gate for Pro features — NOT a security control; the backend
 * enforces actual entitlements. Children render only for entitled users;
 * Free users see `fallback` (default: <UpgradePrompt feature={feature} />).
 * While entitlements are unknown (loading / unauthenticated / fetch error)
 * nothing renders — fail closed, no flash of Pro UI.
 */
const RequiresPro = ({ feature, children, fallback }: RequiresProProps) => {
  const { entitlements, hasFeature } = useEntitlements();

  if (!entitlements) {
    return null;
  }
  if (hasFeature(feature)) {
    return <>{children}</>;
  }
  return fallback === undefined ? <UpgradePrompt feature={feature} /> : <>{fallback}</>;
};

export default RequiresPro;
