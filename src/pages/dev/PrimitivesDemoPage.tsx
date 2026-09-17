import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';
import ActionButton from '../../components/ActionButton';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import SkeletonCard from '../../components/SkeletonCard';
import SkeletonListItem from '../../components/SkeletonListItem';
import { useToast } from '../../hooks/useToast';

/**
 * Dev-only primitives gallery (FE-005). Not linked from any navigation;
 * exists to visually verify the shared components and to capture PR
 * evidence. Safe to keep for future tickets — remove whenever the
 * orchestrator asks.
 */
const PrimitivesDemoPage = () => {
  const { t } = useTranslation('common');
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const flashLoading = () => {
    setLoadingDemo(true);
    window.setTimeout(() => setLoadingDemo(false), 1500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">FE-005 primitives gallery</h1>
        <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
      </header>

      <section aria-label="LoadingSpinner">
        <h2 className="mb-3 text-lg font-semibold">LoadingSpinner (sm / md / lg)</h2>
        <div className="flex items-center gap-6">
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
          <LoadingSpinner size="lg" />
          <span className="sr-only">{t('labels.loading')}</span>
        </div>
      </section>

      <section aria-label="Skeletons">
        <h2 className="mb-3 text-lg font-semibold">Skeletons</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={5} />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      </section>

      <section aria-label="Empty and error states">
        <h2 className="mb-3 text-lg font-semibold">EmptyState / ErrorState</h2>
        <div className="grid gap-4">
          <EmptyState
            icon={SearchX}
            title="No offers found"
            description="Adjust the filters or scan the inbox again."
            action={{ label: 'Scan inbox', onClick: () => toast.info('Scanning (demo)') }}
          />
          <EmptyState title="Empty without action" description="Minimal variant — icon and action omitted." />
          <ErrorState onRetry={() => toast.success('Retried (demo)')} />
        </div>
      </section>

      <section aria-label="ActionButton">
        <h2 className="mb-3 text-lg font-semibold">ActionButton</h2>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton variant="primary">Primary</ActionButton>
          <ActionButton variant="secondary">Secondary</ActionButton>
          <ActionButton variant="destructive">Destructive</ActionButton>
          <ActionButton variant="ghost">Ghost</ActionButton>
          <ActionButton size="sm">sm</ActionButton>
          <ActionButton size="lg">lg</ActionButton>
          <ActionButton isLoading>Submitting</ActionButton>
          <ActionButton isLoading={loadingDemo} onClick={flashLoading}>
            Click to load
          </ActionButton>
        </div>
      </section>

      <section aria-label="Toasts">
        <h2 className="mb-3 text-lg font-semibold">Toasts (max 3, 4s auto-dismiss)</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => toast.success('Offer saved')}>toast.success</ActionButton>
          <ActionButton onClick={() => toast.error('Scan failed')}>toast.error</ActionButton>
          <ActionButton onClick={() => toast.info('5 new discoveries')}>toast.info</ActionButton>
        </div>
      </section>

      <section aria-label="Modals">
        <h2 className="mb-3 text-lg font-semibold">Modal / ConfirmModal</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => setModalOpen(true)}>Open modal</ActionButton>
          <ActionButton onClick={() => setConfirmOpen(true)}>Open confirm</ActionButton>
          <ActionButton variant="destructive" onClick={() => setDestructiveOpen(true)}>
            Open destructive confirm
          </ActionButton>
        </div>
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Example modal">
        <p className="text-sm text-gray-600">
          Focus starts here and cycles inside the dialog. Escape and the backdrop close it.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={() => setModalOpen(false)}>
            {t('buttons.cancel')}
          </ActionButton>
          <ActionButton onClick={() => setModalOpen(false)}>{t('buttons.confirm')}</ActionButton>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirm action"
        message="Run the discovery scan now?"
        onConfirm={() => {
          setConfirmOpen(false);
          toast.success('Scan started');
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={destructiveOpen}
        title="Delete discovery"
        message="This permanently removes the discovery from your history."
        variant="destructive"
        onConfirm={() => {
          setDestructiveOpen(false);
          toast.error('Discovery deleted');
        }}
        onCancel={() => setDestructiveOpen(false)}
      />
    </div>
  );
};

export default PrimitivesDemoPage;
