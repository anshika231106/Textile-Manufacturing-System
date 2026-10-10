import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[#1A1714]"
        >
          {label}
          {props.required && <span className="text-[#DC2626] ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#1A1714] bg-white',
          'placeholder:text-[#A8A29E] transition-colors duration-150 shadow-xs',
          'focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C]',
          error
            ? 'border-[#DC2626] focus:ring-[#DC2626]/20 focus:border-[#DC2626]'
            : 'border-[#E8E4DF] hover:border-[#A8A29E]',
          props.disabled ? 'bg-[#F5F4F2] text-[#78716C] cursor-not-allowed' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#78716C]">{hint}</p>}
    </div>
  );
}
