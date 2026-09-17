export interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

/**
 * Card-shaped loading placeholder for TanStack Query loads. Animation is
 * Tailwind `animate-pulse` only — no custom CSS. Decorative, so hidden
 * from screen readers (a LoadingSpinner elsewhere announces the loading).
 */
const SkeletonCard = ({ lines = 3, className = '' }: SkeletonCardProps) => (
  <div
    aria-hidden="true"
    className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}
  >
    <div className="mb-4 h-5 w-1/3 animate-pulse rounded bg-gray-200" />
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          data-testid="skeleton-line"
          className="h-4 animate-pulse rounded bg-gray-200"
          style={{ width: `${Math.max(60, 100 - index * 10)}%` }}
        />
      ))}
    </div>
  </div>
);

export default SkeletonCard;
