import { useLayoutEffect } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleTheme } from '../../store/themeSlice';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const theme = useAppSelector((state) => state.theme.mode);
  const dispatch = useAppDispatch();
  const nextMode = theme === 'light' ? 'dark' : 'light';

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('milltrace-theme', theme);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      aria-label={`Switch to ${nextMode} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextMode} mode`}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border)',
        'bg-(--color-surface) text-(--color-text-muted) transition-colors',
        'hover:bg-(--color-surface-sunken) hover:text-(--color-text)',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
        className,
      ].join(' ')}
    >
      {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
    </button>
  );
}
