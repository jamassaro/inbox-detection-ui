import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

interface DetectiveButtonProps {
  open: boolean;
  onClick: () => void;
}

const DetectiveButton = ({ open, onClick }: DetectiveButtonProps) => {
  const { t } = useTranslation('common');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('extension.launcher')}
      aria-expanded={open}
      title={t('extension.launcher')}
      className="fixed bottom-24 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
    >
      <Search aria-hidden="true" className="h-5 w-5" />
    </button>
  );
};

export default DetectiveButton;
