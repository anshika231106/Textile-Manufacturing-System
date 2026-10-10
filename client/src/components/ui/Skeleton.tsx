import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/** Shimmering placeholder block. Caller controls size/shape via className (e.g. "h-4 w-32 rounded"). */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return <div aria-hidden className={['animate-shimmer', className].join(' ')} {...props} />;
}

const WIDTH_CYCLE = ['85%', '65%', '92%', '50%', '75%'];

export interface SkeletonTableRowsProps {
  columns: number;
  rows?: number;
}

/** Table-shaped loading placeholder - renders <tr>/<td> rows matching Table.tsx's cell padding. */
export function SkeletonTableRows({ columns, rows = 5 }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-(--color-border) last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton
                className="h-4 rounded"
                style={{ width: WIDTH_CYCLE[(r + c) % WIDTH_CYCLE.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
