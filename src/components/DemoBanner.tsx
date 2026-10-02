import { useTranslation } from 'react-i18next';
import { exitDemo, isDemoMode } from '../lib/demoMode';

/** Slim notice shown across the app while running on sample data, with a way out. */
const DemoBanner = () => {
  const { t } = useTranslation('common');

  if (!isDemoMode()) return null;

  return (
    <div
      role="status"
      data-testid="demo-banner"
      className="flex items-center justify-center gap-3 bg-gray-900 px-4 py-2 text-sm text-white"
    >
      <span>{t('demo.banner')}</span>
      <button
        type="button"
        onClick={exitDemo}
        className="rounded-md border border-white/30 px-2 py-0.5 text-xs font-medium hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {t('demo.exit')}
      </button>
    </div>
  );
};

export default DemoBanner;
