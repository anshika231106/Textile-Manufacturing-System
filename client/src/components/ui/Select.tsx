import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options = [],
  placeholder,
  id,
  className = '',
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-(--color-text)">
          {label}
          {props.required && <span className="text-(--color-danger) ml-0.5">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={[
          'w-full rounded-lg border px-3.5 py-2.5 text-sm text-(--color-text) bg-white',
          'transition-colors duration-150 appearance-none cursor-pointer shadow-xs',
          'focus:outline-none focus:ring-2 focus:ring-(--color-accent)/30 focus:border-(--color-accent)',
          error
            ? 'border-(--color-danger)'
            : 'border-(--color-border) hover:border-(--color-text-subtle)',
          props.disabled ? 'bg-(--color-surface-sunken) text-(--color-text-muted) cursor-not-allowed' : '',
          className,
        ].join(' ')}
        style={{
          // Data-URI can't consume a CSS var - this literal hex is the same value as --color-text-muted.
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2378716C' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {safeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
