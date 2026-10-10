const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return inrFormatter.format(value).replace(/-\s+/, '-');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Returns YYYY-MM string for API month fields */
export function formatApiMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns YYYY-MM-DD string for API date fields */
export function formatApiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const relativeFormatter = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

/** "just now", "5 min ago", "3 hours ago", "yesterday", then a short date. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 7 * 86_400) return relativeFormatter.format(Math.round(diffSec / 86_400), 'day');
  return formatDate(iso);
}

/** Compact number for tight spaces: 1,250 -> "1.3k", 2,400,000 -> "24L" (Indian lakh). */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Up to two initials from a name: "Suresh Patil" -> "SP". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  return ((words[0]?.[0] ?? '?') + (words.length > 1 ? words[1][0] : '')).toUpperCase();
}

// Best-effort swatch colour from a shade name like "Crimson Red" or "Raw Beige".
const SHADE_SWATCHES: [RegExp, string][] = [
  [/white|bleach/i, '#FFFFFF'],
  [/black|charcoal/i, '#1F1F1F'],
  [/red|crimson|maroon/i, '#B91C1C'],
  [/blue|navy|indigo/i, '#1D4ED8'],
  [/green|olive|sage/i, '#15803D'],
  [/yellow|mustard/i, '#EAB308'],
  [/grey|gray/i, '#9CA3AF'],
  [/natural|raw|beige|ecru|cream|ivory/i, '#E7DCC5'],
];

export function shadeSwatch(colour: string): string | undefined {
  return SHADE_SWATCHES.find(([pattern]) => pattern.test(colour))?.[1];
}
