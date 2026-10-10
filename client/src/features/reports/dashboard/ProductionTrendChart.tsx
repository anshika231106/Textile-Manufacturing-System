import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ProductionDay, Stage } from '../reports.api';

export const STAGE_ORDER: Stage[] = ['SPINNING', 'WEAVING', 'DYEING'];

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  SPINNING: { label: 'Spinning', color: 'var(--color-series-1)' },
  WEAVING:  { label: 'Weaving',  color: 'var(--color-series-2)' },
  DYEING:   { label: 'Dyeing',   color: 'var(--color-series-3)' },
};

const HEIGHT = 232;
const PAD = { top: 12, right: 8, bottom: 26, left: 44 };
const SEGMENT_GAP = 2;
const RADIUS = 4;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Rounds the axis max up to 1/2/2.5/5 x 10^n so gridlines land on readable values. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

function shortNumber(n: number) {
  return n >= 1000 ? `${(n / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k` : String(n);
}

/** Rect path with only the top two corners rounded (data end), flat on the baseline side. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function dayLabel(date: string, isToday: boolean) {
  if (isToday) return 'Today';
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface ProductionTrendChartProps {
  data: ProductionDay[];
  view: 'chart' | 'table';
}

export function ProductionTrendChart({ data, view }: ProductionTrendChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  // Drop hover state if the data set changes under the pointer (e.g. on refresh).
  useEffect(() => setHover(null), [data]);

  const maxTotal = useMemo(() => Math.max(0, ...data.map((d) => d.total)), [data]);
  const yMax = niceMax(maxTotal);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);

  if (view === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-(--color-border)">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-(--color-bg) text-xs uppercase tracking-wide text-(--color-text-muted)">
              <th className="px-3 py-2 text-left font-semibold">Day</th>
              {STAGE_ORDER.map((s) => (
                <th key={s} className="px-3 py-2 text-right font-semibold">{STAGE_META[s].label}</th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d, i) => (
              <tr key={d.date} className="border-t border-(--color-border)">
                <td className="px-3 py-1.5 text-(--color-text)">{dayLabel(d.date, i === 0)}</td>
                {STAGE_ORDER.map((s) => (
                  <td key={s} className="px-3 py-1.5 text-right tabular-nums text-(--color-text-muted)">
                    {d[s].toLocaleString('en-IN')}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-(--color-text)">
                  {d.total.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(28, slot * 0.6));
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const hovered = hover != null ? data[hover] : null;
  const labelEvery = slot < 30 ? 3 : slot < 56 ? 2 : 1;

  return (
    <div ref={ref} className="relative w-full" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Metres produced per day by stage, last 14 days">
          {/* Gridlines + y ticks */}
          {ticks.map((t, i) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={i === 0 ? 'var(--color-chart-axis)' : 'var(--color-chart-grid)'}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-(--color-text-subtle) text-[11px] tabular-nums"
              >
                {shortNumber(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const x = cx - barW / 2;
            const isToday = i === data.length - 1;
            const visible = STAGE_ORDER.filter((s) => d[s] > 0);
            let cursor = y(0);
            return (
              <g key={d.date}>
                {hover === i && (
                  <rect
                    x={PAD.left + slot * i + 1}
                    y={PAD.top}
                    width={slot - 2}
                    height={innerH}
                    rx={6}
                    className="fill-(--color-surface-sunken)"
                  />
                )}
                {visible.map((s, k) => {
                  const h = (d[s] / yMax) * innerH;
                  const isTop = k === visible.length - 1;
                  // 2px surface gap between stacked segments (taken from the lower segment's top).
                  const segH = Math.max(1, isTop ? h : h - SEGMENT_GAP);
                  const top = cursor - h;
                  cursor = top;
                  const fill = STAGE_META[s].color;
                  const opacity = hover == null || hover === i ? 1 : 0.45;
                  return isTop ? (
                    <path key={s} d={topRoundedRect(x, top, barW, segH, RADIUS)} fill={fill} opacity={opacity} />
                  ) : (
                    <rect key={s} x={x} y={top + (h - segH)} width={barW} height={segH} fill={fill} opacity={opacity} />
                  );
                })}
                {(i % labelEvery === (data.length - 1) % labelEvery || isToday) && (
                  <text
                    x={cx}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className={[
                      'text-[11px]',
                      isToday ? 'fill-(--color-text) font-semibold' : 'fill-(--color-text-subtle)',
                    ].join(' ')}
                  >
                    {dayLabel(d.date, isToday)}
                  </text>
                )}
                {/* Hit target: the full column, much larger than the bar itself */}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={innerH + PAD.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`${dayLabel(d.date, isToday)}: ${d.total} metres`}
                />
              </g>
            );
          })}
        </svg>
      )}

      {maxTotal === 0 && width > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="rounded-md bg-white/90 px-3 py-1.5 text-sm text-(--color-text-muted)">
            No production logged in the last 14 days
          </p>
        </div>
      )}

      {hovered && hover != null && (
        <div
          className="pointer-events-none absolute z-10 w-44 rounded-lg border border-(--color-border) bg-white p-2.5 text-xs shadow-lg"
          style={{
            top: 4,
            left: Math.min(
              Math.max(0, PAD.left + slot * hover + slot / 2 - 88),
              Math.max(0, width - 176)
            ),
          }}
        >
          <p className="mb-1.5 font-semibold text-(--color-text)">
            {new Date(`${hovered.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          {[...STAGE_ORDER].reverse().map((s) => (
            <div key={s} className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-(--color-text-muted)">
                <span className="h-2 w-2 rounded-sm" style={{ background: STAGE_META[s].color }} />
                {STAGE_META[s].label}
              </span>
              <span className="tabular-nums text-(--color-text)">{hovered[s].toLocaleString('en-IN')} m</span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-(--color-border) pt-1">
            <span className="font-medium text-(--color-text-muted)">Total</span>
            <span className="font-semibold tabular-nums text-(--color-text)">{hovered.total.toLocaleString('en-IN')} m</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StageLegend({ totals }: { totals: Record<Stage, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {STAGE_ORDER.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STAGE_META[s].color }} />
          {STAGE_META[s].label}
          <span className="font-semibold tabular-nums text-(--color-text)">{totals[s].toLocaleString('en-IN')} m</span>
        </span>
      ))}
    </div>
  );
}
