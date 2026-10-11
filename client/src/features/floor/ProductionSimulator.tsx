import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircleIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import { Moon, Sunrise, Sunset } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Callout } from '../../components/ui/Callout';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ApiError } from '../../lib/api';
import { logProduction, type FloorMachine, type Shift, type Stage } from './floor.api';

// The simulator plays one shift per production log: each shift animates for SHIFT_MS (at 1x),
// then posts a real POST /floor/logs entry, so progress, reports and stage rules all see real data.
const SHIFT_MS = 6000;
const SHIFTS: Shift[] = ['MORNING', 'EVENING', 'NIGHT'];
const SHIFT_META: Record<Shift, { label: string; startHour: number; icon: React.ElementType }> = {
  MORNING: { label: 'Morning', startHour: 6, icon: Sunrise },
  EVENING: { label: 'Evening', startHour: 14, icon: Sunset },
  NIGHT: { label: 'Night', startHour: 22, icon: Moon },
};

type Speed = '1' | '2' | '4';
const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
];

const STAGE_COPY: Record<Stage, { title: string; product: string; accent: string; gauge: (j: number) => string }> = {
  SPINNING: { title: 'Ring spinning frame', product: 'yarn', accent: '#60A5FA', gauge: (j) => `${Math.round(14800 + j * 300).toLocaleString()} rpm` },
  WEAVING: { title: 'Shuttle loom', product: 'greige fabric', accent: '#FBBF24', gauge: (j) => `${Math.round(520 + j * 12)} picks/min` },
  DYEING: { title: 'Jigger dyeing range', product: 'dyed fabric', accent: '#C084FC', gauge: (j) => `Bath ${(98 + j * 0.6).toFixed(1)} °C` },
};

const NOMINAL_M_PER_MIN: Record<Stage, number> = { SPINNING: 18, WEAVING: 6, DYEING: 40 };

const DYE_KEYWORDS: [string, string][] = [
  ['navy', '#1E3A8A'], ['indigo', '#3730A3'], ['maroon', '#7F1D1D'], ['wine', '#7F1D1D'], ['olive', '#4D7C0F'],
  ['khaki', '#A16207'], ['beige', '#D6C3A5'], ['cream', '#F0E4CC'], ['teal', '#0F766E'], ['mustard', '#CA8A04'],
  ['charcoal', '#374151'], ['rust', '#C2410C'], ['sky', '#0EA5E9'], ['mint', '#34D399'], ['grey', '#6B7280'],
  ['gray', '#6B7280'], ['black', '#111827'], ['white', '#E7E5E4'], ['red', '#DC2626'], ['blue', '#2563EB'],
  ['green', '#16A34A'], ['yellow', '#EAB308'], ['orange', '#EA580C'], ['pink', '#DB2777'], ['purple', '#7C3AED'],
  ['brown', '#78350F'],
];

function resolveDyeColour(colour: string): string {
  const name = colour.trim().toLowerCase();
  const compact = name.replace(/\s+/g, '');
  if (compact && typeof CSS !== 'undefined' && CSS.supports('color', compact)) return compact;
  return DYE_KEYWORDS.find(([key]) => name.includes(key))?.[1] ?? '#7C3AED';
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtMetres = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Splits the remaining metres into one uneven batch per shift, like real shift-to-shift variation. */
function splitIntoShifts(total: number): number[] {
  if (total < SHIFTS.length) return [round1(total)];
  const weights = SHIFTS.map(() => 0.85 + Math.random() * 0.3);
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  parts[parts.length - 1] = round1(total - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts.filter((p) => p > 0);
}

function shiftClock(shift: Shift, t: number): string {
  const minutes = SHIFT_META[shift].startHour * 60 + Math.floor(t * 480);
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

type Phase = 'ready' | 'running' | 'done' | 'capped' | 'error';
type EventTone = 'info' | 'success' | 'warning' | 'danger';
interface SimEvent { id: number; clock: string; text: string; tone: EventTone }

interface ProductionSimulatorProps {
  /** The running machine to simulate; null closes the simulator. */
  machine: FloorMachine | null;
  onClose: () => void;
  /** Called after every logged shift so the board can refresh. */
  onLogged: () => void;
  onFinishJob: (machine: FloorMachine) => void;
}

export function ProductionSimulator({ machine, onClose, onLogged, onFinishJob }: ProductionSimulatorProps) {
  // Keep the last machine while the dialog animates out, and remount the body on every open.
  const [shown, setShown] = useState<FloorMachine | null>(machine);
  const [session, setSession] = useState(0);
  useEffect(() => {
    if (machine) {
      setShown(machine);
      setSession((s) => s + 1);
    }
    // Only a new open should reset the simulator, not each 5s board poll.
  }, [machine?.id, machine === null]);

  return (
    <Dialog
      open={!!machine}
      onClose={onClose}
      title={shown ? `Production Simulator — ${shown.name}` : 'Production Simulator'}
      width="max-w-3xl"
    >
      {shown?.currentJob && (
        <SimulatorBody
          key={`${shown.id}-${session}`}
          machine={shown}
          open={!!machine}
          onClose={onClose}
          onLogged={onLogged}
          onFinishJob={onFinishJob}
        />
      )}
    </Dialog>
  );
}

interface SimulatorBodyProps {
  machine: FloorMachine;
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
  onFinishJob: (machine: FloorMachine) => void;
}

function SimulatorBody({ machine, open, onClose, onLogged, onFinishJob }: SimulatorBodyProps) {
  const job = machine.currentJob!;
  const target = job.targetMetres;
  const copy = STAGE_COPY[machine.stage];
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>(job.producedMetres >= target ? 'done' : 'ready');
  const [display, setDisplay] = useState(job.producedMetres);
  const [shiftIndex, setShiftIndex] = useState(0);
  const [shiftPlan, setShiftPlan] = useState<Shift[]>(SHIFTS);
  const [shiftProgress, setShiftProgress] = useState(0);
  const [completedShifts, setCompletedShifts] = useState(0);
  const [speed, setSpeed] = useState<Speed>('1');
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [chip, setChip] = useState<{ id: number; metres: number } | null>(null);
  const [notice, setNotice] = useState('');

  const runningRef = useRef(false);
  const speedRef = useRef(1);
  const confirmedRef = useRef(job.producedMetres);
  const clockRef = useRef(shiftClock('MORNING', 0));
  const eventId = useRef(0);

  useEffect(() => { speedRef.current = Number(speed); }, [speed]);
  // Closing the dialog or unmounting stops the line; the partial shift is simply not logged.
  useEffect(() => { if (!open) runningRef.current = false; }, [open]);
  useEffect(() => () => { runningRef.current = false; }, []);

  const addEvent = useCallback((text: string, tone: EventTone = 'info') => {
    eventId.current += 1;
    const id = eventId.current;
    setEvents((prev) => [{ id, clock: clockRef.current, text, tone }, ...prev].slice(0, 6));
    return id;
  }, []);

  const animateShift = (shift: Shift, from: number, to: number) =>
    new Promise<boolean>((resolve) => {
      let elapsed = 0;
      let last = performance.now();
      const step = (now: number) => {
        if (!runningRef.current) return resolve(false);
        elapsed += (now - last) * speedRef.current;
        last = now;
        const t = Math.min(elapsed / SHIFT_MS, 1);
        clockRef.current = shiftClock(shift, t);
        setShiftProgress(t);
        setDisplay(from + (to - from) * t);
        if (t >= 1) resolve(true);
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

  /** Logs one shift. With the stage cap on, falls back to whatever the previous stage still allows. */
  const logShift = async (shift: Shift, metres: number): Promise<{ metres: number; capped: boolean }> => {
    const input = {
      stageJobId: job.id,
      machineId: machine.id,
      orderId: job.orderId,
      stage: machine.stage,
      shift,
      notes: 'Simulated shift output',
    };
    try {
      await logProduction({ ...input, metres });
      return { metres, capped: false };
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== 'EXCEEDS_PREVIOUS_STAGE') throw err;
      const allowed = round1(Number((err.details as { remainingMetres?: number } | undefined)?.remainingMetres ?? 0));
      if (allowed <= 0) return { metres: 0, capped: true };
      await logProduction({ ...input, metres: allowed });
      return { metres: allowed, capped: true };
    }
  };

  const start = async () => {
    const remaining = round1(target - confirmedRef.current);
    if (remaining <= 0) {
      setPhase('done');
      return;
    }
    const batches = splitIntoShifts(remaining);
    const plan = SHIFTS.slice(0, batches.length);
    setShiftPlan(plan);
    setCompletedShifts(0);
    setNotice('');
    runningRef.current = true;
    setPhase('running');
    addEvent(`${machine.code} started on ${job.orderNumber}`);

    let produced = confirmedRef.current;
    for (let i = 0; i < batches.length; i++) {
      const shift = plan[i];
      setShiftIndex(i);
      clockRef.current = shiftClock(shift, 0);
      addEvent(`${SHIFT_META[shift].label} shift crew on the line`);

      const finished = await animateShift(shift, produced, produced + batches[i]);
      if (!finished) {
        setDisplay(produced);
        return;
      }

      try {
        const result = await logShift(shift, batches[i]);
        produced = round1(produced + result.metres);
        confirmedRef.current = produced;
        setDisplay(produced);
        setCompletedShifts(i + 1);
        if (result.metres > 0) {
          const id = addEvent(`Logged ${fmtMetres(result.metres)} m of ${copy.product} · ${SHIFT_META[shift].label}`, 'success');
          setChip({ id, metres: result.metres });
          onLogged();
        }
        if (result.capped) {
          runningRef.current = false;
          const previous = machine.stage === 'DYEING' ? 'weaving' : 'spinning';
          setNotice(`This stage can't produce more than the ${previous} output logged for ${job.orderNumber}. Simulate the ${previous} stage further, then come back.`);
          addEvent(`Line halted: waiting for ${previous} output`, 'warning');
          setPhase('capped');
          return;
        }
      } catch (err) {
        runningRef.current = false;
        setDisplay(produced);
        setNotice(err instanceof Error ? err.message : 'Could not log production');
        addEvent('Log failed, line stopped', 'danger');
        setPhase('error');
        return;
      }
    }

    runningRef.current = false;
    addEvent(`Target reached: ${fmtMetres(produced)} m`, 'success');
    setPhase('done');
  };

  const stop = () => {
    runningRef.current = false;
    setPhase('ready');
    setShiftProgress(0);
    addEvent('Line stopped, partial shift discarded', 'warning');
  };

  const running = phase === 'running';
  const progress = target > 0 ? Math.min(display / target, 1) : 0;
  const percent = Math.round(progress * 100);
  const jitter = running ? Math.sin(display * 1.7) : 0;
  const metresPerMin = running ? (NOMINAL_M_PER_MIN[machine.stage] * (1 + jitter * 0.06) * Number(speed)).toFixed(1) : '0.0';
  const dyeColour = resolveDyeColour(job.colour);
  const currentShift = shiftPlan[shiftIndex] ?? 'MORNING';
  const statusLabel = running ? 'LINE RUNNING' : phase === 'done' ? 'TARGET REACHED' : phase === 'capped' ? 'WAITING ON PREVIOUS STAGE' : 'STANDBY';
  const statusColour = running ? '#4ADE80' : phase === 'done' ? '#60A5FA' : phase === 'capped' || phase === 'error' ? '#FBBF24' : '#A8A29E';

  return (
    <div className="space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto -mx-1 px-1">
      {/* Machine scene */}
      <div
        className={`sim-scene relative rounded-xl overflow-hidden border border-stone-800 ${running && !reducedMotion ? '' : 'sim-paused'}`}
        style={{ ['--sim-speed' as string]: speed, background: 'radial-gradient(120% 90% at 50% 0%, #292524 0%, #0C0A09 100%)' }}
      >
        <svg viewBox="0 0 520 240" className="block w-full h-auto" role="img" aria-label={`${copy.title} animation`}>
          <defs>
            <pattern id="sim-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
            <filter id="sim-blur"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <rect width="520" height="240" fill="url(#sim-grid)" />
          <line x1="0" y1="226" x2="520" y2="226" stroke="rgba(255,255,255,0.08)" />
          {machine.stage === 'SPINNING' && <SpinningScene progress={progress} />}
          {machine.stage === 'WEAVING' && <WeavingScene progress={progress} running={running && !reducedMotion} speed={Number(speed)} />}
          {machine.stage === 'DYEING' && <DyeingScene progress={progress} running={running && !reducedMotion} speed={Number(speed)} dye={dyeColour} />}
        </svg>

        {/* HUD */}
        <div className="absolute top-2.5 left-3 flex items-center gap-2 text-[10px] font-mono tracking-wider text-stone-300">
          <span className={`inline-block w-2 h-2 rounded-full ${running ? 'sim-blink' : ''}`} style={{ background: statusColour, boxShadow: `0 0 8px ${statusColour}` }} />
          <span style={{ color: statusColour }}>{statusLabel}</span>
          <span className="text-stone-500">· {machine.code}</span>
        </div>
        <div className="absolute top-2.5 right-3 text-right font-mono text-[10px] leading-tight text-stone-400">
          <div><span className="text-stone-200 text-xs font-semibold">{metresPerMin}</span> m/min</div>
          <div>{running ? copy.gauge(jitter) : '—'}</div>
        </div>
        <div className="absolute bottom-2 left-3 font-mono text-[10px] text-stone-400">
          {copy.title} · {job.fabricType}{machine.stage === 'DYEING' ? ` · ${job.colour}` : ''}
        </div>
        <div className="absolute bottom-1.5 right-3 font-mono text-stone-200 text-sm tabular-nums">
          {SHIFT_META[currentShift].label.toUpperCase()} {running || phase !== 'ready' ? clockRef.current : '--:--'}
        </div>

        {/* "+N m" chip floats up every time a shift is logged */}
        <AnimatePresence>
          {chip && (
            <motion.div
              key={chip.id}
              className="absolute left-1/2 top-1/3 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-sm font-semibold shadow-lg pointer-events-none"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: [0, 1, 1, 0], y: -30, scale: 1 }}
              transition={{ duration: 1.6, ease: 'easeOut' }}
              onAnimationComplete={() => setChip((c) => (c?.id === chip.id ? null : c))}
            >
              +{fmtMetres(chip.metres)} m logged
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion overlay */}
        <AnimatePresence>
          {phase === 'done' && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="absolute w-24 h-24 rounded-full border-2 border-emerald-400"
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 1.4, repeat: 2, ease: 'easeOut' }}
              />
              <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                <CheckCircleIcon className="w-16 h-16 text-emerald-400 drop-shadow-lg" />
              </motion.div>
              <p className="mt-2 text-white font-semibold">Stage target reached</p>
              <p className="text-stone-300 text-xs">{fmtMetres(display)} m of {copy.product} ready for the next stage</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Metric label="Produced" value={`${fmtMetres(display)} m`} highlight />
        <Metric label="Target" value={`${fmtMetres(target)} m`} />
        <Metric label="Remaining" value={`${fmtMetres(Math.max(target - display, 0))} m`} />
        <Metric label="Processing value" value={`₹${fmtMetres(display * machine.ratePerMetre)}`} />
      </div>
      <ProgressBar value={percent} tone={phase === 'done' ? 'success' : 'accent'} size="md" label={`${job.orderNumber} · ${job.buyerName} · ${percent}% complete`} />

      {/* Shift timeline */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${shiftPlan.length}, minmax(0, 1fr))` }}>
        {shiftPlan.map((shift, i) => {
          const Icon = SHIFT_META[shift].icon;
          const fill = i < completedShifts ? 1 : i === shiftIndex && running ? shiftProgress : 0;
          const active = running && i === shiftIndex;
          return (
            <div key={shift} className={`rounded-lg border px-2.5 py-2 ${active ? 'border-(--color-accent) bg-(--color-accent-light)' : 'border-(--color-border) bg-(--color-surface-alt)'}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-(--color-text)">
                  <Icon className="w-3.5 h-3.5" /> {SHIFT_META[shift].label}
                </span>
                <span className="font-mono text-(--color-text-muted)">{String(SHIFT_META[shift].startHour).padStart(2, '0')}:00</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-(--color-surface-sunken) overflow-hidden">
                <div className="h-full rounded-full bg-(--color-accent)" style={{ width: `${fill * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Event ticker */}
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-alt) p-2.5 h-[118px] overflow-hidden">
        {events.length === 0 ? (
          <p className="text-xs text-(--color-text-muted) text-center pt-8">
            Runs one shift at a time and logs real production entries for this job.
          </p>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <motion.li
                  key={event.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="font-mono text-(--color-text-subtle)">{event.clock}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[event.tone]}`} />
                  <span className="text-(--color-text-dark) truncate">{event.text}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {notice && <Callout tone={phase === 'error' ? 'danger' : 'warning'}>{notice}</Callout>}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-(--color-border)">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-(--color-text-muted)">Speed</span>
          <SegmentedControl value={speed} onChange={setSpeed} options={SPEED_OPTIONS} size="sm" />
        </div>
        <div className="flex items-center gap-2.5">
          {running ? (
            <Button variant="secondary" onClick={stop}>
              <StopIcon className="w-4 h-4" /> Stop line
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>Close</Button>
              {phase === 'done' || phase === 'capped' ? (
                <Button
                  onClick={() => onFinishJob(machine)}
                  className="bg-emerald-600 hover:bg-emerald-700 border-transparent"
                >
                  <CheckCircleIcon className="w-4 h-4" /> Finish job
                </Button>
              ) : (
                <Button onClick={start}>
                  <PlayIcon className="w-4 h-4" /> {phase === 'error' ? 'Retry' : events.length ? 'Resume' : 'Start simulation'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const TONE_DOT: Record<EventTone, string> = {
  info: 'bg-sky-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface-alt) px-3 py-2">
      <div className="text-[11px] text-(--color-text-muted)">{label}</div>
      <div className={`font-mono tabular-nums font-semibold ${highlight ? 'text-lg text-(--color-accent)' : 'text-sm text-(--color-text)'}`}>{value}</div>
    </div>
  );
}

/* ─── Machine scenes (SVG, 520×240) ─── */

function Roller({ cx, cy, r, fill = '#57534E' }: { cx: number; cy: number; r: number; fill?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#A8A29E" strokeWidth="1" />
      <g className="sim-anim sim-spin">
        <line x1={cx - r * 0.7} y1={cy} x2={cx + r * 0.7} y2={cy} stroke="#D6D3D1" strokeWidth="1.2" />
        <line x1={cx} y1={cy - r * 0.7} x2={cx} y2={cy + r * 0.7} stroke="#D6D3D1" strokeWidth="1.2" />
      </g>
    </g>
  );
}

function SpinningScene({ progress }: { progress: number }) {
  const spindles = [0, 1, 2, 3, 4, 5].map((i) => 180 + i * 56);
  const packageWidth = 8 + 16 * progress;
  return (
    <g>
      {/* Creel with roving bobbins feeding the drafting rollers */}
      <rect x="18" y="26" width="78" height="190" rx="6" fill="#1C1917" stroke="#44403C" />
      {[52, 110, 168].map((y) => (
        <g key={y}>
          <rect x="34" y={y - 18} width="46" height="36" rx="12" fill="#E7E5E4" />
          <line x1="40" y1={y - 6} x2="74" y2={y - 6} stroke="#D6D3D1" />
          <line x1="40" y1={y + 6} x2="74" y2={y + 6} stroke="#D6D3D1" />
          <path d={`M 80 ${y} C 125 ${y}, 120 62, 158 62`} fill="none" stroke="#E7E5E4" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="6 10" className="sim-anim sim-flow" />
        </g>
      ))}

      {/* Drafting beam */}
      <rect x="150" y="54" width="350" height="16" rx="4" fill="#292524" stroke="#57534E" />
      {spindles.map((x) => <Roller key={x} cx={x} cy={62} r={6} />)}

      {/* Ring rail traversing up and down the packages */}
      <g transform="translate(0 116)">
        <rect className="sim-anim sim-traverse" x="160" y="0" width="340" height="5" rx="2" fill="#78716C" />
      </g>

      {spindles.map((x) => (
        <g key={x}>
          {/* Yarn balloon from the roller down to the package */}
          <g transform={`translate(${x} 86)`}>
            <ellipse className="sim-anim sim-balloon" cx="0" cy="0" rx="9" ry="16" fill="none" stroke="#E7E5E4" strokeOpacity="0.35" />
          </g>
          <line x1={x} y1={68} x2={x} y2={104} stroke="#F5F5F4" strokeWidth="1.2" strokeDasharray="6 10" className="sim-anim sim-flow" />
          {/* Bobbin tube and yarn package, which grows as yarn is spun */}
          <rect x={x - 3} y={102} width={6} height={98} rx={2} fill="#A8A29E" />
          <clipPath id={`pkg-${x}`}>
            <rect x={x - packageWidth / 2} y={110} width={packageWidth} height={82} rx={packageWidth / 2.5} />
          </clipPath>
          <rect x={x - packageWidth / 2} y={110} width={packageWidth} height={82} rx={packageWidth / 2.5} fill="#F5F5F4" />
          <g clipPath={`url(#pkg-${x})`}>
            <g className="sim-anim sim-wind">
              {Array.from({ length: 16 }, (_, k) => (
                <line key={k} x1={x - 20} y1={104 + k * 6} x2={x + 20} y2={102 + k * 6} stroke="#D6D3D1" strokeWidth="1" />
              ))}
            </g>
          </g>
          <rect x={x - 9} y={200} width={18} height={10} rx={2} fill="#44403C" />
        </g>
      ))}
      {/* Spindle drive tape */}
      <line x1="160" y1="216" x2="500" y2="216" stroke="#60A5FA" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="6 10" className="sim-anim sim-flow" />
    </g>
  );
}

function WeavingScene({ progress, running, speed }: { progress: number; running: boolean; speed: number }) {
  const beamY = 38;
  const fellY = 150;
  const warp = Array.from({ length: 26 }, (_, i) => 135 + i * 10);
  const odd = warp.filter((_, i) => i % 2 === 0);
  const even = warp.filter((_, i) => i % 2 === 1);
  const shed = (xs: number[], midY: number) => xs.map((x) => `M ${x} ${beamY} L ${x} ${midY} L ${x} ${fellY}`).join(' ');
  const pick = 0.5 / speed;
  const loop = { duration: pick, repeat: Infinity, repeatType: 'reverse' as const, ease: 'easeInOut' as const };
  const rollR = 9 + 11 * progress;

  return (
    <g>
      {/* Loom frame and warp beam */}
      <rect x="110" y="16" width="10" height="200" rx="3" fill="#44403C" />
      <rect x="400" y="16" width="10" height="200" rx="3" fill="#44403C" />
      <rect x="118" y="22" width="284" height="16" rx="8" fill="#57534E" stroke="#78716C" />
      <Roller cx={128} cy={30} r={6} />

      {/* Warp threads: alternate sets open and close the shed */}
      <motion.path
        d={shed(odd, 94)}
        animate={running ? { d: [shed(odd, 80), shed(odd, 108)] } : { d: shed(odd, 94) }}
        transition={running ? loop : { duration: 0.3 }}
        stroke="#E7E5E4" strokeOpacity="0.75" strokeWidth="1" fill="none"
      />
      <motion.path
        d={shed(even, 94)}
        animate={running ? { d: [shed(even, 108), shed(even, 80)] } : { d: shed(even, 94) }}
        transition={running ? loop : { duration: 0.3 }}
        stroke="#D6D3D1" strokeOpacity="0.6" strokeWidth="1" fill="none"
      />
      {/* Heddle frames */}
      <motion.rect x="126" width="268" height="4" rx="2" fill="#FBBF24" fillOpacity="0.7"
        animate={running ? { y: [78, 106] } : { y: 92 }} transition={running ? loop : { duration: 0.3 }} />
      <motion.rect x="126" width="268" height="4" rx="2" fill="#F59E0B" fillOpacity="0.5"
        animate={running ? { y: [106, 78] } : { y: 92 }} transition={running ? loop : { duration: 0.3 }} />

      {/* Shuttle flying through the shed */}
      <motion.g
        animate={running ? { x: [0, 250] } : { x: 0 }}
        transition={running ? { duration: pick * 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' } : { duration: 0.3 }}
      >
        <path d="M 124 94 L 132 89 L 156 89 L 164 94 L 156 99 L 132 99 Z" fill="#B45309" stroke="#FCD34D" strokeWidth="1" />
        <circle cx="144" cy="94" r="2" fill="#FEF3C7" />
      </motion.g>

      {/* Reed beating each pick into the fell */}
      <motion.rect x="126" width="268" height="5" rx="2" fill="#A8A29E"
        animate={running ? { y: [124, 143, 124] } : { y: 124 }}
        transition={running ? { duration: pick * 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }} />

      {/* Woven cloth moving toward the take-up roll */}
      <clipPath id="sim-cloth"><rect x="135" y={fellY} width="250" height="38" /></clipPath>
      <rect x="135" y={fellY} width="250" height="38" fill="#E7E5E4" />
      <g clipPath="url(#sim-cloth)">
        <g className="sim-anim sim-scroll">
          {Array.from({ length: 12 }, (_, k) => (
            <line key={k} x1="135" y1={fellY - 8 + k * 4} x2="385" y2={fellY - 8 + k * 4} stroke="#A8A29E" strokeOpacity="0.55" />
          ))}
        </g>
        {warp.map((x) => <line key={x} x1={x} y1={fellY} x2={x} y2={fellY + 38} stroke="#A8A29E" strokeOpacity="0.25" />)}
      </g>
      <line x1="135" y1={fellY} x2="385" y2={fellY} stroke="#FBBF24" strokeWidth="1.5" />
      <path d={`M 135 188 L 260 ${205 - rollR} L 385 188`} fill="none" stroke="#E7E5E4" strokeOpacity="0.4" />
      <Roller cx={260} cy={205} r={rollR} fill="#E7E5E4" />
    </g>
  );
}

function DyeingScene({ progress, running, speed, dye }: { progress: number; running: boolean; speed: number; dye: string }) {
  const leftR = 30 - 16 * progress;
  const rightR = 14 + 16 * progress;
  const wave = (a: number, b: number) => `M 168 140 Q 196 ${a} 224 140 Q 252 ${b} 280 140 Q 316 ${a} 352 140 V 208 H 168 Z`;
  const greigePath = `M 70 ${78 - leftR} L 150 52 L 205 182`;
  const dyedPath = `M 205 182 L 315 182 L 372 52 L 398 53 L 450 ${78 - rightR}`;

  return (
    <g>
      {/* Steam above the hot bath */}
      {[214, 262, 310].map((x, i) => (
        <g key={x} transform={`translate(${x} 112)`}>
          <ellipse className="sim-anim sim-steam" cx="0" cy="0" rx="14" ry="8" fill="#FFFFFF" filter="url(#sim-blur)" style={{ animationDelay: `${i * 0.9}s` }} />
        </g>
      ))}

      {/* Dye liquor with a moving surface and rising bubbles */}
      <motion.path
        d={wave(132, 148)}
        animate={running ? { d: [wave(132, 148), wave(148, 132)] } : { d: wave(140, 140) }}
        transition={running ? { duration: 1.1 / speed, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' } : { duration: 0.4 }}
        fill={dye}
        fillOpacity="0.85"
      />
      {[188, 216, 240, 262, 290, 318].map((x, i) => (
        <circle key={x} className="sim-anim sim-bubble" cx={x} cy={198} r={2.5 + (i % 3)} fill="#FFFFFF" fillOpacity="0.5" style={{ animationDelay: `${i * 0.37}s` }} />
      ))}
      <path d="M 166 112 V 200 Q 166 212 178 212 H 342 Q 354 212 354 200 V 112" fill="none" stroke="#78716C" strokeWidth="4" />

      {/* Greige fabric unwinds on the left, passes through the bath and batches up dyed on the right */}
      <line x1="70" y1="78" x2="70" y2="200" stroke="#44403C" strokeWidth="4" />
      <line x1="450" y1="78" x2="450" y2="200" stroke="#44403C" strokeWidth="4" />
      <path d={greigePath} fill="none" stroke="#D6D3D1" strokeWidth="6" strokeLinejoin="round" />
      <path d={dyedPath} fill="none" stroke={dye} strokeWidth="6" strokeLinejoin="round" />
      <path d={`${greigePath} ${dyedPath.replace('M', 'L')}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 12" className="sim-anim sim-flow" />

      <Roller cx={70} cy={78} r={leftR} fill="#D6D3D1" />
      <Roller cx={450} cy={78} r={rightR} fill={dye} />
      <Roller cx={150} cy={52} r={7} />
      <Roller cx={205} cy={182} r={7} />
      <Roller cx={315} cy={182} r={7} />
      <Roller cx={372} cy={52} r={7} />
      {/* Squeeze (padding) rollers */}
      <Roller cx={398} cy={43} r={8} fill="#44403C" />
      <Roller cx={398} cy={63} r={8} fill="#44403C" />
      <rect x="40" y="200" width="60" height="16" rx="3" fill="#292524" stroke="#44403C" />
      <rect x="420" y="200" width="60" height="16" rx="3" fill="#292524" stroke="#44403C" />
    </g>
  );
}
