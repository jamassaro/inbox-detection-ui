import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

interface LockedDiscoveryCardProps {
  count: number;
  onUpgrade: () => void;
}

/**
 * Entitlement-aware placeholder for Discoveries beyond the Free tier's
 * visible limit (FE-012). Standalone card (not the RequiresPro wrapper):
 * renders like a real card's ghost, blurred for privacy, and delegates the
 * upgrade decision to `onUpgrade` — FE-004's UpgradePrompt pattern.
 */
const LockedDiscoveryCard = ({ count, onUpgrade }: LockedDiscoveryCardProps) => {
  const { t } = useTranslation('discoveries');

  return (
    <div
      data-testid="locked-discovery-card"
      className="relative bg-white border border-gray-200 rounded-xl p-5 overflow-hidden"
      aria-label={t('card.locked.count', { count })}
    >
      {/* Hidden-content suggestion: blurred placeholder rows */}
      <div className="space-y-3 opacity-50" aria-hidden="true">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-200 blur-[2px]" />
          <div className="space-y-2">
            <div className="h-3 w-40 bg-gray-200 rounded blur-[2px]" />
            <div className="h-3 w-24 bg-gray-200 rounded blur-[2px]" />
          </div>
        </div>
        <div className="h-3 w-56 bg-gray-200 rounded blur-[2px]" />
        <div className="h-3 w-44 bg-gray-200 rounded blur-[2px]" />
      </div>

      {/* Lock + copy overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <Lock className="w-5 h-5 text-gray-500" aria-hidden="true" />
        <div className="text-sm font-semibold text-gray-900" data-testid="locked-count">
          {t('card.locked.count', { count })}
        </div>
        <div className="text-xs text-gray-500" data-testid="locked-category-hint">
          {t('card.locked.categoryHint')}
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-2 bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          data-testid="locked-cta"
        >
          {t('card.locked.cta')}
        </button>
      </div>
    </div>
  );
};

export default LockedDiscoveryCard;
