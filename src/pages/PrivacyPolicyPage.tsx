import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';
import { legalSections } from './legal';

/**
 * Static Privacy Policy (FE-026) — public route, no auth and no API calls.
 * Body copy is placeholder text until the product team supplies the final
 * legal language; structure, navigation, and translations are the deliverable.
 */
const PrivacyPolicyPage = () => {
  const { t } = useTranslation('public');

  return (
    <LegalPage
      title={t('legal.privacy.title')}
      lastUpdated={t('legal.lastUpdated', { date: t('legal.lastUpdatedDate') })}
      placeholderNotice={t('legal.placeholderNotice')}
      backLabel={t('legal.back')}
      sections={legalSections(t, 'privacy')}
    />
  );
};

export default PrivacyPolicyPage;
