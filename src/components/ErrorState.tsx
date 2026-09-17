import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';
import ActionButton from './ActionButton';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * Error panel. Defaults to the shared `errors.generic` copy; a translated
 * retry button appears when `onRetry` is provided. `role="alert"` so screen
 * readers announce the failure immediately.
 */
const ErrorState = ({ title, description, onRetry }: ErrorStateProps) => {
  const { t } = useTranslation('errors');

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden="true" className="mb-3 h-10 w-10 text-red-500" />
      <p className="text-base font-semibold text-red-900">{title ?? t('generic')}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-red-700">{description}</p> : null}
      {onRetry ? (
        <ActionButton variant="destructive" size="sm" className="mt-5" onClick={onRetry}>
          {t('retry')}
        </ActionButton>
      ) : null}
    </div>
  );
};

export default ErrorState;
