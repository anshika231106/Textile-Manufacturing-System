import type { SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[#1A1714]">
          {label}
          {props.required && <span className="text-[#DC2626] ml-0.5">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={[
          'w-full rounded-md border px-3 py-2 text-sm text-[#1A1714] bg-white',
          'transition-colors duration-150 appearance-none cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C]',
          error
            ? 'border-[#DC2626]'
            : 'border-[#E8E4DF] hover:border-[#A8A29E]',
          props.disabled ? 'bg-[#F5F4F2] text-[#78716C] cursor-not-allowed' : '',
          className,
        ].join(' ')}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2378716C' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '32px',
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
