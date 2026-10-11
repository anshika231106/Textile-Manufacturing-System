import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { SelectOption } from './Select';

interface SearchableSelectProps {
  label?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
}

const PANEL_GAP = 4;
const PANEL_MAX_HEIGHT = 320;
const PANEL_MIN_WIDTH = 240;

function matchesQuery(label: string, query: string) {
  const haystack = label.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

/**
 * Drop-in alternative to `Select` for long, data-driven option lists (staff, orders, yarns…).
 * The panel is portalled to <body> so it is never clipped by cards or dialogs with overflow-hidden.
 */
export function SearchableSelect({
  label,
  error,
  options = [],
  placeholder,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches found',
  value,
  onChange,
  id,
  required,
  disabled,
  className = '',
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const generatedId = useId();
  // useId (not the label) so repeated instances, e.g. one per machine card, get unique ids.
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find((o) => o.value === value);
  const filteredOptions = useMemo(
    () => (query.trim() ? safeOptions.filter((o) => matchesQuery(o.label, query)) : safeOptions),
    [safeOptions, query],
  );

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP - 8;
    const spaceAbove = rect.top - PANEL_GAP - 8;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPosition({
      top: openUpward ? rect.top - PANEL_GAP : rect.bottom + PANEL_GAP,
      left,
      width,
      maxHeight: Math.min(PANEL_MAX_HEIGHT, openUpward ? spaceAbove : spaceBelow),
      openUpward,
    });
  };

  const openPanel = () => {
    if (disabled) return;
    setQuery('');
    const selectedIndex = safeOptions.findIndex((o) => o.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    updatePosition();
    setOpen(true);
  };

  const closePanel = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const selectOption = (option: SelectOption) => {
    if (option.value !== value) onChange(option.value);
    closePanel();
  };

  // Focus the search box once the panel mounts.
  useLayoutEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Keep the panel anchored to the trigger and close it on outside clicks.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closePanel(false);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close if the control becomes disabled mid-interaction (e.g. while saving).
  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  // Keep the highlighted option within the filtered results and scrolled into view.
  useEffect(() => {
    if (activeIndex >= filteredOptions.length) setActiveIndex(Math.max(0, filteredOptions.length - 1));
  }, [filteredOptions.length, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openPanel();
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(0, filteredOptions.length - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = filteredOptions[activeIndex];
        if (option) selectOption(option);
        break;
      }
      case 'Escape':
        // Stop here so an enclosing Dialog doesn't also close.
        event.preventDefault();
        event.stopPropagation();
        closePanel();
        break;
      case 'Tab':
        closePanel(false);
        break;
    }
  };

  const triggerLabel = selectedOption?.label ?? placeholder ?? 'Select…';

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={triggerId} className="text-sm font-medium text-(--color-text)">
          {label}
          {required && <span className="text-(--color-danger) ml-0.5">*</span>}
        </label>
      )}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={handleTriggerKeyDown}
        className={[
          'relative w-full flex items-center rounded-lg border px-3.5 py-2.5 pr-9 text-left text-sm bg-white',
          'transition-colors duration-150 cursor-pointer shadow-xs',
          'focus:outline-none focus:ring-2 focus:ring-(--color-accent)/30 focus:border-(--color-accent)',
          error
            ? 'border-(--color-danger)'
            : open
              ? 'border-(--color-accent) ring-2 ring-(--color-accent)/30'
              : 'border-(--color-border) hover:border-(--color-text-subtle)',
          disabled ? 'bg-(--color-surface-sunken) text-(--color-text-muted) cursor-not-allowed' : '',
          selectedOption ? 'text-(--color-text)' : 'text-(--color-text-subtle)',
          className,
        ].join(' ')}
      >
        <span className="block truncate">{triggerLabel}</span>
        <ChevronUpDownIcon
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-muted)"
          aria-hidden="true"
        />
      </button>

      {/* Invisible proxy so native `required` validation still blocks form submission. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={selectedOption ? value : ''}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="absolute bottom-0 left-4 h-px w-px opacity-0 pointer-events-none"
        />
      )}

      {error && <p className="text-xs text-(--color-danger)">{error}</p>}

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[70] flex flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) shadow-lg"
            style={{
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              ...(position.openUpward
                ? { bottom: window.innerHeight - position.top }
                : { top: position.top }),
            }}
            // Keep clicks inside the portal from triggering handlers on React ancestors (cards, dialogs).
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-(--color-border) p-2">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-subtle)"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label ?? ariaLabel ?? 'options'}`}
                aria-controls={listboxId}
                aria-activedescendant={
                  filteredOptions[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined
                }
                className="w-full rounded-md border border-(--color-border) bg-(--color-surface-sunken) py-1.5 pl-8 pr-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-subtle) focus:outline-none focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent)/20"
              />
            </div>
            <ul ref={listRef} id={listboxId} role="listbox" className="flex-1 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <li className="px-3.5 py-3 text-center text-sm text-(--color-text-muted)">{emptyMessage}</li>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={option.value}
                      id={`${listboxId}-opt-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                      className={[
                        'flex cursor-pointer items-center gap-2 px-3.5 py-2 text-sm',
                        isActive ? 'bg-(--color-surface-sunken)' : '',
                        isSelected ? 'font-medium text-(--color-accent)' : 'text-(--color-text)',
                      ].join(' ')}
                    >
                      <span className="flex-1 truncate" title={option.label}>
                        {option.label}
                      </span>
                      {isSelected && <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
