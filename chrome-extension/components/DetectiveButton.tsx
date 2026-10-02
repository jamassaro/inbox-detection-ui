import { useTranslation } from 'react-i18next';
import DetectiveLogo from './DetectiveLogo';

interface DetectiveButtonProps {
  open: boolean;
  onClick: () => void;
  /** 'toolbar' sits inline in Gmail's top-right bar; 'floating' is the fallback when that bar isn't found. */
  variant: 'toolbar' | 'floating';
}

const variantClass = {
  toolbar:
    'flex h-10 w-10 items-center justify-center rounded-full text-gray-900 hover:bg-gray-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
  floating:
    'fixed right-4 top-16 z-[2147483000] flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg ring-1 ring-gray-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
} as const;

const DetectiveButton = ({ open, onClick, variant }: DetectiveButtonProps) => {
  const { t } = useTranslation('common');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('extension.launcher')}
      aria-expanded={open}
      title={t('extension.launcher')}
      className={variantClass[variant]}
    >
      <DetectiveLogo className="h-7 w-7" />
    </button>
  );
};

export default DetectiveButton;
