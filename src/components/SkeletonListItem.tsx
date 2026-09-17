export interface SkeletonListItemProps {
  className?: string;
}

/** List-row loading placeholder: avatar circle plus two text lines, pulse-animated. */
const SkeletonListItem = ({ className = '' }: SkeletonListItemProps) => (
  <div
    aria-hidden="true"
    className={`flex items-center gap-3 py-3 ${className}`}
  >
    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
    </div>
  </div>
);

export default SkeletonListItem;
