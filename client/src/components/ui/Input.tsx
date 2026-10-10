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
          className="text-sm font-medium text-(--color-text)"
        >
          {label}
          {props.required && <span className="text-(--color-danger) ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full rounded-lg border px-3.5 py-2.5 text-sm text-(--color-text) bg-white',
          'placeholder:text-(--color-text-subtle) transition-colors duration-150 shadow-xs',
          'focus:outline-none focus:ring-2 focus:ring-(--color-accent)/30 focus:border-(--color-accent)',
          error
            ? 'border-(--color-danger) focus:ring-(--color-danger)/20 focus:border-(--color-danger)'
            : 'border-(--color-border) hover:border-(--color-text-subtle)',
          props.disabled ? 'bg-(--color-surface-sunken) text-(--color-text-muted) cursor-not-allowed' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      {hint && !error && <p className="text-xs text-(--color-text-muted)">{hint}</p>}
    </div>
  );
}
