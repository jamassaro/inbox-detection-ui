import { useTranslation } from 'react-i18next';
import { useLocale } from '../hooks/useLocale';

const OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
] as const;

/**
 * EN | ES locale toggle. Renders as an accessible button pair; the active
 * locale is visually indicated. Switching languages re-renders only
 * translation-bound strings — i18next's React integration handles the
 * subscriptions, so the rest of the tree is not touched.
 */
const LanguageSelector = () => {
  const { t } = useTranslation('settings');
  const { locale, changeLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 text-sm" role="group">
      {OPTIONS.map((option, index) => (
        <span key={option.code} className="flex items-center">
          {index > 0 && <span className="text-gray-400 mx-1">|</span>}
          <button
            type="button"
            onClick={() => changeLocale(option.code)}
            aria-pressed={locale === option.code}
            aria-label={t('language', { lng: option.code }) ?? undefined}
            className={`px-2 py-1 rounded transition-colors ${
              locale === option.code
                ? 'text-gray-900 font-semibold bg-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        </span>
      ))}
    </div>
  );
};

export default LanguageSelector;
