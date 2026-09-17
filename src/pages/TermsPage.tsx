import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';
import { legalSections } from './legal';

/**
 * Static Terms of Service (FE-026) — public route, no auth and no API calls.
 * Same structure as the Privacy Policy; body copy is placeholder text until
 * the product team supplies the final legal language.
 */
const TermsPage = () => {
  const { t } = useTranslation('public');

  return (
    <LegalPage
      title={t('legal.terms.title')}
      lastUpdated={t('legal.lastUpdated', { date: t('legal.lastUpdatedDate') })}
      placeholderNotice={t('legal.placeholderNotice')}
      backLabel={t('legal.back')}
      sections={legalSections(t, 'terms')}
    />
  );
};

export default TermsPage;
