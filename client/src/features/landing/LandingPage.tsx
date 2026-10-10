import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import {
  lookupOrderForPublic,
  getPublicSampleOrders,
  getPublicMillStats,
  type Order,
  type OrderStatus,
  type PublicSampleOrder,
  type PublicMillStats,
} from '../orders/orders.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../lib/format';
import {
  drawCheck,
  fadeUpVariants,
  revealContainer,
  sequenceItem,
  springIndicator,
  staggerItem,
  transitionSmooth,
} from '../../lib/motion';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const DEFAULT_QUICK_SEARCHES: PublicSampleOrder[] = [
  { code: 'ORD-2026-001', label: 'Cotton Twill · Weaving', hint: 'Active on Loom', status: 'IN_PRODUCTION', buyerName: 'Nimesh Pathak Textiles', fabricType: 'Cotton Twill 2/1', colour: 'Bleached White', metres: 2500, trackingToken: 'tr_8f9a2b1c4e' },
  { code: 'ORD-2026-003', label: 'Linen Slub · In QC', hint: 'Rolls in QC', status: 'QC', buyerName: 'Bombay Dyeing & Mfg', fabricType: 'Linen Slub Voile', colour: 'Raw Ivory', metres: 3000, trackingToken: 'tr_9e8d7c6b5a' },
  { code: 'ORD-0001', label: 'Cotton Twill · Dispatched', hint: 'Dispatched Roll', status: 'DISPATCHED', buyerName: 'Nimesh Pathak Textiles', fabricType: 'Cotton Twill', colour: 'White', metres: 500, trackingToken: 'trk_2bfbe080-cc58-468d-b403-e8228d1e84f6' },
  { code: 'ORD-2026-002', label: 'Poly-Cotton · Pending', hint: 'Spinning Queue', status: 'PENDING', buyerName: 'Raymond Apparel Ltd', fabricType: 'Poly-Cotton Blend Suiting', colour: 'Navy Blue', metres: 1800, trackingToken: 'tr_1b4c7d9e2a' },
];

const STATUS_VARIANTS: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  IN_PRODUCTION: 'info',
  QC: 'warning',
  READY: 'success',
  DISPATCHED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const STAGES = [
  { key: 'YARN', label: 'Yarn Inflow', desc: 'Raw material verified & issued' },
  { key: 'SPINNING', label: 'Spinning', desc: 'Yarn spun to specification count' },
  { key: 'WEAVING', label: 'Weaving', desc: 'Loom weaving into greige fabric' },
  { key: 'DYEING', label: 'Dyeing', desc: 'Vat dyeing, washing & finishing' },
  { key: 'QC', label: 'QC & Rolls', desc: '100% inspection & roll grading' },
];

// Pipeline reveal timeline (seconds): cards enter one by one, then finished stages
// turn green in order until the active stage lands.
const STAGE_ENTER_START = 0.25;
const STAGE_ENTER_GAP = 0.07;
const STAGE_FILL_START = STAGE_ENTER_START + STAGES.length * STAGE_ENTER_GAP + 0.1;
const STAGE_FILL_GAP = 0.15;

function PipelineStepper({ activeIdx }: { activeIdx: number }) {
  // Collapse the whole timeline when the user prefers reduced motion
  const t = useReducedMotion() ? 0 : 1;
  const fillAt = (idx: number) => (STAGE_FILL_START + idx * STAGE_FILL_GAP) * t;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
      {/* Connector thread between stage centres (desktop only), filling up to the active stage */}
      <div
        aria-hidden
        className="hidden sm:block absolute top-7 left-[calc(10%-0.3rem)] right-[calc(10%-0.3rem)] h-0.5 rounded-full bg-(--color-border)"
      >
        {activeIdx > 0 && (
          <motion.div
            className="h-full w-full rounded-full origin-left bg-gradient-to-r from-(--color-success) to-(--color-accent)"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: activeIdx / (STAGES.length - 1) }}
            transition={{ delay: fillAt(0), duration: activeIdx * STAGE_FILL_GAP * t, ease: 'linear' }}
          />
        )}
      </div>

      {STAGES.map((stg, idx) => {
        const isPassed = idx < activeIdx;
        const isCurrent = idx === activeIdx;

        return (
          <motion.div
            key={stg.key}
            custom={(STAGE_ENTER_START + idx * STAGE_ENTER_GAP) * t}
            variants={sequenceItem}
            initial="initial"
            animate="animate"
            className={[
              'p-4 rounded-2xl border flex flex-col justify-between relative z-10 bg-(--color-bg) border-(--color-border)',
            ].join(' ')}
          >
            {/* Stage colour washes in when the fill sweep reaches this card */}
            {(isPassed || isCurrent) && (
              <motion.div
                aria-hidden
                className={[
                  'absolute -inset-px rounded-2xl border',
                  isCurrent
                    ? 'bg-(--color-accent-light) border-(--color-accent)/40 shadow-sm shadow-(--color-accent)/10 ring-1 ring-(--color-accent)/20'
                    : 'bg-(--color-success-light) border-(--color-success-border)',
                ].join(' ')}
                initial={{ opacity: 0 }}
                animate={isCurrent ? { opacity: 1, scale: [1, 1.03, 1] } : { opacity: 1 }}
                transition={{ delay: fillAt(idx), duration: 0.45 * t, ease: 'easeOut' }}
              />
            )}

            <div className={`relative ${!isPassed && !isCurrent ? 'opacity-75' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="relative w-6 h-6">
                  <span className="absolute inset-0 rounded-full bg-(--color-border) text-(--color-text-muted) text-xs font-bold font-mono flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {(isPassed || isCurrent) && (
                    <motion.span
                      className="absolute inset-0"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ ...springIndicator, delay: fillAt(idx) }}
                    >
                      {isPassed ? (
                        <span className="w-full h-full rounded-full bg-(--color-success) flex items-center justify-center">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
                            <motion.path
                              d="M3.5 8.5l3 3 6-7"
                              stroke="white"
                              strokeWidth={2.2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              custom={fillAt(idx) + 0.1 * t}
                              variants={drawCheck}
                              initial="initial"
                              animate="animate"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span className="w-full h-full rounded-full bg-(--color-accent) text-white text-xs font-bold font-mono flex items-center justify-center animate-pulse-subtle">
                          {idx + 1}
                        </span>
                      )}
                    </motion.span>
                  )}
                </span>

                {isCurrent && (
                  <motion.span
                    className="text-[10px] uppercase font-bold text-(--color-accent) bg-white px-2 py-0.5 rounded-full border border-(--color-accent)/20"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: fillAt(idx) + 0.15 * t, duration: 0.25 * t }}
                  >
                    Active
                  </motion.span>
                )}
              </div>

              <p className="text-sm font-bold text-(--color-text)">{stg.label}</p>
              <p className="text-[11px] text-(--color-text-muted) mt-0.5 leading-snug">{stg.desc}</p>
            </div>

            {/* Micro progress bar for current stage */}
            {isCurrent && (
              <div className="relative mt-3 pt-2 border-t border-(--color-accent)/20">
                <div className="w-full bg-[#FED7AA] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-(--color-accent) h-full w-2/3 rounded-full animate-pulse" />
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [sampleOrders, setSampleOrders] = useState<PublicSampleOrder[]>(DEFAULT_QUICK_SEARCHES);
  const [millStats, setMillStats] = useState<PublicMillStats | null>(null);

  const trackingResultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Fetch live sample orders and live factory stats from the database
    getPublicSampleOrders().then((samples) => {
      if (samples && samples.length > 0) {
        setSampleOrders(samples);
      }
    });

    getPublicMillStats().then((stats) => {
      if (stats) {
        setMillStats(stats);
      }
    });
  }, []);

  async function handleSearch(codeToSearch?: string, scroll: boolean = true) {
    const query = (codeToSearch ?? searchQuery).trim();
    if (!query) {
      setSearchError('Please enter an order number or tracking token.');
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const order = await lookupOrderForPublic(query);
      if (order) {
        setTrackedOrder(order);
        setLastRefreshed(new Date());
        if (scroll && trackingResultRef.current) {
          setTimeout(() => {
            trackingResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      } else {
        setSearchError(`No order found matching "${query}". Try one of the quick test badges below.`);
        setTrackedOrder(null);
      }
    } catch {
      setSearchError('Unable to connect to live mill network. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  // Calculate active stage index
  function getActiveStageIndex(order: Order): number {
    if (order.status === 'PENDING') return 0;
    if (order.status === 'COMPLETED' || order.status === 'DISPATCHED' || order.status === 'READY') return 4;
    if (order.status === 'QC') return 4;
    if (order.currentStage === 'SPINNING') return 1;
    if (order.currentStage === 'WEAVING') return 2;
    if (order.currentStage === 'DYEING') return 3;
    return 1;
  }

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-text) selection:bg-(--color-accent)/20 flex flex-col font-sans">
      {/* ─── Top Navigation Bar ─── */}
      <header className="sticky top-0 z-40 bg-(--color-bg)/85 backdrop-blur-md border-b border-(--color-border) px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-3 group" aria-label="MillTrace dashboard">
            <img
              src="/logo.png"
              alt="MillTrace"
              className="w-44 h-16 object-contain group-hover:scale-[1.02] transition-transform duration-200"
            />
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-(--color-text-muted)">
            <a href="#tracker" className="hover:text-(--color-accent) transition-colors">
              Live Tracker
            </a>
            <a href="#pipeline" className="hover:text-(--color-accent) transition-colors">
              Manufacturing Pipeline
            </a>
            <a href="#capabilities" className="hover:text-(--color-accent) transition-colors">
              Mill Capabilities
            </a>
            <a href="#quality" className="hover:text-(--color-accent) transition-colors">
              Quality Protocol
            </a>
          </nav>

          {/* Staff Access Button */}
          <div className="flex items-center gap-2">
            {user ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-xs font-semibold shadow-xs"
              >
                Go to Staff Portal
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/login')}
                className="text-xs font-semibold bg-white border-(--color-border) hover:border-(--color-accent)/40 hover:bg-(--color-accent-light)"
              >
                Staff Sign In
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section with Live Search ─── */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-8 overflow-hidden bg-white">
        {/* Subtle radial glow in warm orange */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-(--color-accent)/5 rounded-full blur-3xl pointer-events-none" />

        {/* ─── Background: Textile Mill Facility (Ambient Backdrop Merged to White Downwards) ─── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
          <img
            src="/textile-mill-hero.jpg"
            alt="Everest Textile Mills automated weaving shed and spinning units"
            className="w-full h-full object-cover object-top opacity-50 [mask-image:linear-gradient(to_bottom,black_15%,transparent_85%)] [-webkit-mask-image:linear-gradient(to_bottom,black_15%,transparent_85%)]"
          />
          {/* Subtle gradient overlays so cards and text remain crystal clear while background smoothly dissolves into white */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-white/60 to-white" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-transparent to-white/80" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--color-accent-light) border border-(--color-accent)/25 text-(--color-accent) text-xs font-semibold mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-(--color-accent) animate-pulse-subtle" />
            Live Fabric Lifecycle & Order Intelligence
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-(--color-text) leading-[1.15]">
            From Yarn Gate to Dispatched Roll,{' '}
            <span className="text-(--color-accent)">Tracked Live.</span>
          </h1>

          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-(--color-text-muted) max-w-2xl mx-auto leading-relaxed">
            Real-time stage visibility for buyers and production heads. Monitor spinning, weaving,
            continuous dyeing, and individual roll QC inspection with zero delay.
          </p>

          {/* Live Mill Real-Time Metrics Pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs text-(--color-text-muted)">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-(--color-border) shadow-2xs font-medium">
              <span className="w-2 h-2 rounded-full bg-(--color-success) animate-pulse" />
              Everest Mill Unit 1 Online {millStats ? `(${millStats.runningMachines}/${millStats.totalMachines} Machines Active)` : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-(--color-border) shadow-2xs font-medium">
              <span className="text-(--color-accent) font-bold">
                {millStats?.totalMetresProduced ? millStats.totalMetresProduced.toLocaleString('en-IN') : '7,500'} m
              </span> Floor Output Recorded
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-(--color-border) shadow-2xs font-medium">
              <span className="text-(--color-success) font-bold">
                {millStats ? `${millStats.firstPassQcRate}%` : '99.4%'}
              </span> QC Verified Pass Rate
            </span>
          </div>

          {/* ─── Interactive Order Tracker Search Card ─── */}
          <div id="tracker" className="mt-8 sm:mt-10 text-left">
            <div className="bg-white border border-(--color-border) rounded-2xl shadow-xl shadow-stone-200/50 p-4 sm:p-6 transition-all duration-200">
              <label htmlFor="search-input" className="block text-xs font-bold uppercase tracking-wider text-(--color-text-muted) mb-2">
                Public Order Status Lookup (Database Connected)
              </label>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch();
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-(--color-text-muted)">
                    <MagnifyingGlassIcon className="w-5 h-5" />
                  </div>
                  <input
                    id="search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Order # (e.g. ORD-2026-001, ORD-0001) or Tracking Token..."
                    className="w-full pl-11 pr-4 py-3 bg-(--color-bg) border border-(--color-border) rounded-xl text-sm text-(--color-text) placeholder-(--color-text-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/25 focus:border-(--color-accent) transition-all font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={searching}
                  className="px-6 py-3 font-semibold shadow-xs shrink-0"
                >
                  Track Order
                </Button>
              </form>

              {/* Demo Quick-Chips */}
              <div className="mt-4 pt-3 border-t border-(--color-border)/70 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-(--color-text-muted) flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5 text-(--color-accent)" />
                  Live orders in database:
                </span>
                {sampleOrders.map((demo) => (
                  <button
                    key={demo.code}
                    type="button"
                    onClick={() => {
                      setSearchQuery(demo.code);
                      handleSearch(demo.code, true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-(--color-bg) border border-(--color-border) text-(--color-text) hover:bg-(--color-accent-light) hover:border-(--color-accent)/40 hover:text-(--color-accent) transition-all cursor-pointer"
                  >
                    <span className="font-mono font-bold text-(--color-accent)">{demo.code}</span>
                    <span className="text-(--color-text-muted) text-[11px]">({demo.hint})</span>
                  </button>
                ))}
              </div>

              {/* Error Alert */}
              {searchError && (
                <div className="mt-4 p-3 rounded-xl bg-(--color-danger-light) border border-(--color-danger-border) text-xs text-(--color-danger) flex items-center gap-2">
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* ─── Unfolded Live Order Tracking Details (JUST BELOW LOOKUP) ─── */}
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="wait">
                {trackedOrder && (
                  <motion.div
                    key={trackedOrder.orderNumber}
                    ref={trackingResultRef}
                    className="mt-6 sm:mt-8 text-left"
                    variants={fadeUpVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={transitionSmooth}
                  >
                    <motion.div
                      className="bg-white border-2 border-(--color-accent)/20 rounded-3xl p-6 sm:p-8 shadow-xl shadow-(--color-accent)/5 relative overflow-hidden"
                      variants={revealContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {/* Top decorative accent bar, drawn left to right */}
                      <motion.div
                        className="absolute top-0 left-0 right-0 h-1.5 origin-left bg-gradient-to-r from-(--color-accent) via-[#F97316] to-(--color-accent)"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />

                      {/* Header info */}
                      <motion.div
                        variants={staggerItem}
                        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-(--color-border)"
                      >
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-2xl font-extrabold text-(--color-text) tracking-tight">
                              {trackedOrder.orderNumber}
                            </h2>
                            <Badge
                              variant={STATUS_VARIANTS[trackedOrder.status] ?? 'neutral'}
                              label={trackedOrder.status.replace('_', ' ')}
                              dot
                            />
                            <span className="text-xs text-(--color-text-muted) font-mono bg-(--color-bg) px-2 py-0.5 rounded-md border border-(--color-border)">
                              Token: {trackedOrder.trackingToken}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-(--color-text-muted)">
                            Buyer: <span className="font-semibold text-(--color-text)">{trackedOrder.buyerName}</span> ·{' '}
                            <span className="font-medium text-(--color-text)">{trackedOrder.fabricType}</span> ({trackedOrder.colour})
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleSearch(trackedOrder.orderNumber, false)}
                            title="Refresh status"
                            className="p-2 rounded-lg border border-(--color-border) hover:bg-(--color-bg) text-(--color-text-muted) hover:text-(--color-text) transition-colors"
                          >
                            <ArrowPathIcon className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTrackedOrder(null);
                              setSearchQuery('');
                            }}
                            title="Dismiss order details"
                            className="p-2 rounded-lg border border-(--color-border) hover:bg-(--color-danger-light) text-(--color-text-muted) hover:text-(--color-danger) hover:border-(--color-danger-border) transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>

                      {/* ─── Animated Milestone Pipeline Stepper ─── */}
                      <motion.div variants={staggerItem} className="py-8">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-(--color-text-muted)">
                            Live Manufacturing Pipeline
                          </span>
                          <span className="text-xs font-semibold text-(--color-accent) flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-(--color-accent) animate-pulse" />
                            Active Stage: {trackedOrder.currentStage}
                          </span>
                        </div>

                        <PipelineStepper activeIdx={getActiveStageIndex(trackedOrder)} />
                      </motion.div>

                      {/* ─── Metres & Quantitative Progress Counters ─── */}
                      <motion.div
                        variants={staggerItem}
                        className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-(--color-border)"
                      >
                        <div className="p-4 rounded-xl bg-(--color-bg) border border-(--color-border)">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-(--color-text-muted) block">
                            Ordered Quantity
                          </span>
                          <p className="text-2xl font-extrabold text-(--color-text) mt-1">
                            {trackedOrder.metres.toLocaleString('en-IN')} <span className="text-sm font-normal text-(--color-text-muted)">m</span>
                          </p>
                          <p className="text-xs text-(--color-text-muted) mt-0.5">{trackedOrder.fabricType} · {trackedOrder.colour}</p>
                        </div>

                        <div className="p-4 rounded-xl bg-(--color-bg) border border-(--color-border)">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-(--color-text-muted) block">
                            Produced on Machines
                          </span>
                          <p className="text-2xl font-extrabold text-(--color-accent) mt-1">
                            {((trackedOrder as any).producedMetres ?? trackedOrder.stageProgress?.reduce((acc, s) => acc + (s.producedMetres || 0), 0) ?? 0).toLocaleString('en-IN')}{' '}
                            <span className="text-sm font-normal text-(--color-text-muted)">m</span>
                          </p>
                          <p className="text-xs text-(--color-text-muted) mt-0.5">Through spinning/looms/dyeing</p>
                        </div>

                        <div className="p-4 rounded-xl bg-(--color-bg) border border-(--color-border)">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-(--color-text-muted) block">
                            Passed Quality Check
                          </span>
                          <p className="text-2xl font-extrabold text-(--color-success) mt-1">
                            {((trackedOrder as any).passedMetres ?? (trackedOrder.rollSummary?.passedRolls ?? 0) * 500).toLocaleString('en-IN')}{' '}
                            <span className="text-sm font-normal text-(--color-text-muted)">m</span>
                          </p>
                          <p className="text-xs text-(--color-text-muted) mt-0.5">{trackedOrder.rollSummary?.passedRolls ?? 0} rolls graded PASS</p>
                        </div>

                        <div className="p-4 rounded-xl bg-(--color-bg) border border-(--color-border)">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-(--color-text-muted) block">
                            Delivery Deadline
                          </span>
                          <p className="text-xl font-bold text-(--color-text) mt-1">
                            {formatDate(trackedOrder.deadline)}
                          </p>
                          <p className="text-xs text-(--color-text-muted) mt-0.5">Scheduled dispatch</p>
                        </div>
                      </motion.div>

                      {/* Rolls Grid if rolls exist */}
                      {trackedOrder.rollSummary && trackedOrder.rollSummary.rolls.length > 0 && (
                        <motion.div variants={staggerItem} className="mt-6 pt-5 border-t border-(--color-border)">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--color-text-muted)">
                              Individual Fabric Roll Inspect Log
                            </p>
                            <span className="text-xs text-(--color-text-muted)">
                              {trackedOrder.rollSummary.totalRolls} rolls generated
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {trackedOrder.rollSummary.rolls.map((roll) => (
                              <div
                                key={roll.rollNumber}
                                className="p-3 rounded-xl border border-(--color-border) bg-(--color-bg) flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-(--color-text) font-mono">{roll.rollNumber}</span>
                                  <p className="text-(--color-text-muted) text-[11px]">{roll.metres} metres</p>
                                </div>
                                <Badge
                                  variant={roll.qcStatus === 'PASS' ? 'success' : 'warning'}
                                  label={roll.qcStatus}
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Bottom status refresh indicator */}
                      <motion.div
                        variants={staggerItem}
                        className="mt-6 pt-4 border-t border-(--color-border)/60 flex items-center justify-between text-xs text-(--color-text-subtle)"
                      >
                        <span className="flex items-center gap-1.5">
                          <ShieldCheckIcon className="w-4 h-4 text-(--color-success)" />
                          Direct live synchronization with Everest Textile Mills ERP
                        </span>
                        <span>Updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </MotionConfig>
          </div>
        </div>
      </section>

      {/* ─── Section: Manufacturing Pipeline Showcase ─── */}
      <section id="pipeline" className="py-16 sm:py-24 bg-white px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-(--color-accent)">
              Rigorous 4-Stage Traceability
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-(--color-text) tracking-tight mt-2">
              Every Metre Accounted For
            </h2>
            <p className="mt-3 text-sm text-(--color-text-muted)">
              We replace notebooks and verbal floor checks with automated state machines that
              record each physical event from receipt to the buyer's truck.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-(--color-bg) border border-(--color-border) hover:border-(--color-accent)/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-(--color-accent-light) border border-(--color-accent)/20 flex items-center justify-center text-(--color-accent) mb-4 group-hover:scale-110 transition-transform">
                <CubeIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-(--color-accent)">STAGE 01</span>
              <h3 className="text-base font-bold text-(--color-text) mt-1">Yarn Gate & Inward</h3>
              <p className="text-xs text-(--color-text-muted) mt-2 leading-relaxed">
                Raw yarn is logged with supplier reference, exact kg weight, count specifications, and
                allocated directly to buyer orders with zero shortfall leakage.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-(--color-bg) border border-(--color-border) hover:border-(--color-accent)/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-(--color-accent-light) border border-(--color-accent)/20 flex items-center justify-center text-(--color-accent) mb-4 group-hover:scale-110 transition-transform">
                <WrenchScrewdriverIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-(--color-accent)">STAGE 02</span>
              <h3 className="text-base font-bold text-(--color-text) mt-1">Spinning & Loom Weaving</h3>
              <p className="text-xs text-(--color-text-muted) mt-2 leading-relaxed">
                Orders run on assigned spinning units and high-speed looms. Shift supervisors record
                metres produced per shift with automated stage cap protection.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-(--color-bg) border border-(--color-border) hover:border-(--color-accent)/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-(--color-accent-light) border border-(--color-accent)/20 flex items-center justify-center text-(--color-accent) mb-4 group-hover:scale-110 transition-transform">
                <BeakerIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-(--color-accent)">STAGE 03</span>
              <h3 className="text-base font-bold text-(--color-text) mt-1">Dyeing & Roll Batching</h3>
              <p className="text-xs text-(--color-text-muted) mt-2 leading-relaxed">
                Dyed vats produce discrete fabric rolls. Each roll is minted with a globally unique ID
                linking it directly to its origin machines and yarn lot.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl bg-(--color-bg) border border-(--color-border) hover:border-(--color-accent)/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-(--color-accent-light) border border-(--color-accent)/20 flex items-center justify-center text-(--color-accent) mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-(--color-accent)">STAGE 04</span>
              <h3 className="text-base font-bold text-(--color-text) mt-1">100% Roll QC & Dispatch</h3>
              <p className="text-xs text-(--color-text-muted) mt-2 leading-relaxed">
                Rigorous fabric inspection checks for holes, slubs, and colour mismatch. Only
                PASSED rolls are unlocked for dispatch and invoicing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section: Mill Capabilities & Trust Numbers ─── */}
      <section id="capabilities" className="py-16 sm:py-20 px-4 sm:px-8 textile-dots">
        <div className="max-w-5xl mx-auto">
          <div className="bg-(--color-text) text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-(--color-accent)/20 to-transparent pointer-events-none" />

            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-(--color-accent)">
                Factory Infrastructure
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-2 text-white">
                Built for High-Volume Reliability
              </h2>
              <p className="mt-3 text-sm text-(--color-text-subtle) leading-relaxed">
                Everest Textile Mills combines state-of-the-art weaving machinery with MillTrace’s
                digital ledger to eliminate order delays and unverified stock discrepancies.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-8 border-t border-stone-800">
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-(--color-accent)">50k+ m</p>
                <p className="text-xs text-(--color-text-subtle) mt-1 font-medium">Monthly Production Volume</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">99.4%</p>
                <p className="text-xs text-(--color-text-subtle) mt-1 font-medium">First-Pass QC Standard</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-(--color-accent)">100%</p>
                <p className="text-xs text-(--color-text-subtle) mt-1 font-medium">Roll-Level Traceability</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">&lt; 15s</p>
                <p className="text-xs text-(--color-text-subtle) mt-1 font-medium">Live Floor Refresh Sync</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section: Quality Guarantee ─── */}
      <section id="quality" className="py-16 sm:py-20 bg-white border-t border-(--color-border) px-4 sm:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-12 h-12 rounded-2xl bg-(--color-accent-light) border border-(--color-accent)/20 text-(--color-accent) mx-auto flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-(--color-text)">
            Everest Quality Assurance Promise
          </h2>
          <p className="mt-3 text-sm text-(--color-text-muted) max-w-xl mx-auto">
            No roll leaves our dispatch dock without passing quality parameters. Each buyer receives
            transparent yardage counts and access to the complete machine and yarn production history.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-medium text-(--color-text-muted)">
            <span className="flex items-center gap-1.5 bg-(--color-bg) px-3.5 py-2 rounded-xl border border-(--color-border)">
              ✓ Defect-flagged roll exclusion
            </span>
            <span className="flex items-center gap-1.5 bg-(--color-bg) px-3.5 py-2 rounded-xl border border-(--color-border)">
              ✓ Pre-dispatch yardage double-check
            </span>
            <span className="flex items-center gap-1.5 bg-(--color-bg) px-3.5 py-2 rounded-xl border border-(--color-border)">
              ✓ Tamper-proof tracking tokens
            </span>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-auto bg-(--color-bg) border-t border-(--color-border) py-12 px-4 sm:px-8 text-xs text-(--color-text-muted)">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" aria-label="MillTrace dashboard" className="inline-block">
              <img src="/logo.png" alt="MillTrace" className="w-36 h-12 object-contain" />
            </Link>
            <div>
              <p className="font-bold text-(--color-text)">Everest Textile Mills</p>
              <p className="text-[11px] text-(--color-text-subtle)">Powered by MillTrace Operating System</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#tracker" className="hover:text-(--color-accent) transition-colors">
              Order Tracker
            </a>
            <Link to="/login" className="hover:text-(--color-accent) transition-colors font-semibold text-(--color-text)">
              Staff Sign In
            </Link>
          </div>

          <p className="text-[11px] text-(--color-text-subtle)">
            © 2026 Everest Textile Mills. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
