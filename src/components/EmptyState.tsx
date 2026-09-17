import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** Translated by the caller and passed in — this component hardcodes no copy. */
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** Centered empty-state panel with an optional icon and action button. */
const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
    {Icon ? <Icon aria-hidden="true" className="mb-3 h-10 w-10 text-gray-400" /> : null}
    <p className="text-base font-semibold text-gray-900">{title}</p>
    {description ? <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p> : null}
    {action ? (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
      >
        {action.label}
      </button>
    ) : null}
  </div>
);

export default EmptyState;
