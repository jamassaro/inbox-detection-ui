import { useTranslation } from 'react-i18next';

const SIZE_CLASSES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-4',
} as const;

export type SpinnerSize = keyof typeof SIZE_CLASSES;

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

/**
 * Inline CSS-animated spinner (Tailwind `animate-spin`, no library).
 * Color follows the surrounding text via `border-current`, so it stays
 * visible on dark (primary ActionButton) and light backgrounds alike.
 */
const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => {
  const { t } = useTranslation('common');

  return (
    <span
      role="status"
      aria-label={t('labels.loading')}
      className={`inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent ${SIZE_CLASSES[size]} ${className}`}
    />
  );
};

export default LoadingSpinner;
