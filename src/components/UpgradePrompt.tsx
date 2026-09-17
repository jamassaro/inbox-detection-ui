import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ProFeature } from '../types';

interface UpgradePromptProps {
  feature: ProFeature;
}

/**
 * Inline paywall companion for <RequiresPro>: states the feature requirement
 * and routes to /upgrade with `from` + `returnPath` so FE-016 can return the
 * user to where they started after checkout.
 */
const UpgradePrompt = ({ feature }: UpgradePromptProps) => {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const location = useLocation();

  const featureLabel = t(`requiresPro.feature.${feature}`, { defaultValue: feature });

  const unlock = () => {
    const returnPath = encodeURIComponent(`${location.pathname}${location.search}`);
    navigate(`/upgrade?from=${feature}&returnPath=${returnPath}`);
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
