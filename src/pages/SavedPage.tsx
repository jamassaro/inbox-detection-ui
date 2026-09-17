import { useTranslation } from 'react-i18next';

const SavedPage = () => {
  const { t } = useTranslation('common');

  return (
    <div className="flex-1 bg-white overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{t('pages.saved.title')}</h1>
        <p className="text-gray-600">{t('pages.saved.subtitle')}</p>
        <div className="mt-8 text-center text-gray-500">
          {t('pages.saved.empty')}
        </div>
      </div>
    </div>
  );
};

export default SavedPage;
