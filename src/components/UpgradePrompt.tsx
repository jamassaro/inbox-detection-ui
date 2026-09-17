import { useTranslation } from 'react-i18next';
import type { ProFeature } from '../types';
import { useUpgradeRedirect } from '../hooks/useUpgradeRedirect';

interface UpgradePromptProps {
  feature: ProFeature;
}

/**
 * Inline paywall companion for <RequiresPro>: states the feature requirement
 * and hands off through useUpgradeRedirect (FE-016) — the upgrade context
 * (source = feature, returnPath = current location) is persisted to
 * sessionStorage so post-checkout (FE-017) can resume where the user was.
 */
const UpgradePrompt = ({ feature }: UpgradePromptProps) => {
  const { t } = useTranslation('billing');
  const { redirectToUpgrade } = useUpgradeRedirect();

  const featureLabel = t(`requiresPro.feature.${feature}`, { defaultValue: feature });

  const unlock = () => {
    redirectToUpgrade({ source: feature });
  };

  return (
    <div
      className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-4"
      data-testid="upgrade-prompt"
    >
      <p className="text-sm text-gray-600">{t('requiresPro.message', { feature: featureLabel })}</p>
      <button
        type="button"
        onClick={unlock}
        className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
      >
        {t('requiresPro.cta')}
      </button>
    </div>
  );
};

export default UpgradePrompt;
