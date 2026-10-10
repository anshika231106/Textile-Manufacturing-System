import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { lookupOrderForPublic, type Order, type OrderStatus } from '../orders/orders.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDate, formatCurrency } from '../../lib/format';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

const DEMO_QUICK_SEARCHES = [
  { code: 'ORD-2026-001', label: 'Cotton Twill · Weaving', hint: 'Active on Loom' },
  { code: 'ORD-2026-002', label: 'Poly-Cotton · Pending', hint: 'Spinning Queue' },
  { code: 'ORD-2026-003', label: 'Linen Slub · In QC', hint: 'Rolls Ready' },
];

const STATUS_VARIANTS: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING:       'neutral',
  IN_PRODUCTION: 'info',
  QC:            'warning',
  READY:         'success',
  DISPATCHED:    'success',
  COMPLETED:     'success',
  CANCELLED:     'danger',
};

const STAGES = [
  { key: 'YARN', label: 'Yarn Inflow', desc: 'Raw material verified & issued' },
  { key: 'SPINNING', label: 'Spinning', desc: 'Yarn spun to specification count' },
  { key: 'WEAVING', label: 'Weaving', desc: 'Loom weaving into greige fabric' },
  { key: 'DYEING', label: 'Dyeing', desc: 'Vat dyeing, washing & finishing' },
  { key: 'QC', label: 'QC & Rolls', desc: '100% inspection & roll grading' },
];

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('ORD-2026-001');
  const [searching, setSearching] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const trackingResultRef = useRef<HTMLDivElement | null>(null);

  // Initial lookup for demo display on load
  useEffect(() => {
    handleSearch('ORD-2026-001', false);
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

  function handleCopyTrackUrl() {
    if (!trackedOrder) return;
    const url = `${window.location.origin}/track/${trackedOrder.trackingToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1714] selection:bg-[#EA580C]/20 flex flex-col font-sans">
      {/* ─── Top Navigation Bar ─── */}
      <header className="sticky top-0 z-40 bg-[#FAFAF8]/85 backdrop-blur-md border-b border-[#E8E4DF] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#EA580C] flex items-center justify-center shadow-sm shadow-[#EA580C]/25 group-hover:scale-105 transition-transform duration-200">
              <span className="text-white text-sm font-bold tracking-tight">MT</span>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-[#1A1714] block leading-none">
                MillTrace
              </span>
              <span className="text-[11px] text-[#78716C] tracking-wide font-normal">
                Everest Textile Mills
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#78716C]">
            <a href="#tracker" className="hover:text-[#EA580C] transition-colors">
              Live Tracker
            </a>
            <a href="#pipeline" className="hover:text-[#EA580C] transition-colors">
              Manufacturing Pipeline
            </a>
            <a href="#capabilities" className="hover:text-[#EA580C] transition-colors">
              Mill Capabilities
            </a>
            <a href="#quality" className="hover:text-[#EA580C] transition-colors">
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
                className="text-xs font-semibold bg-white border-[#E8E4DF] hover:border-[#EA580C]/40 hover:bg-[#FFF7ED]"
              >
                Staff Sign In
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section with Live Search ─── */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-8 textile-grid overflow-hidden">
        {/* Subtle radial glow in warm orange */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#EA580C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF7ED] border border-[#EA580C]/25 text-[#EA580C] text-xs font-semibold mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse-subtle" />
            Live Fabric Lifecycle & Order Intelligence
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1A1714] leading-[1.15]">
            From Yarn Gate to Dispatched Roll,{' '}
            <span className="text-[#EA580C]">Tracked Live.</span>
          </h1>

          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-[#78716C] max-w-2xl mx-auto leading-relaxed">
            Real-time stage visibility for buyers and production heads. Monitor spinning, weaving,
            continuous dyeing, and individual roll QC inspection with zero delay.
          </p>

          {/* ─── Interactive Order Tracker Search Card ─── */}
          <div id="tracker" className="mt-8 sm:mt-12 text-left">
            <div className="bg-white border border-[#E8E4DF] rounded-2xl shadow-xl shadow-stone-200/50 p-4 sm:p-6 transition-all duration-200">
              <label htmlFor="search-input" className="block text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2">
                Public Order Status Lookup
              </label>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch();
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
                    <MagnifyingGlassIcon className="w-5 h-5" />
                  </div>
                  <input
                    id="search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Order # (e.g. ORD-2026-001) or Tracking Token..."
                    className="w-full pl-11 pr-4 py-3 bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl text-sm text-[#1A1714] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/25 focus:border-[#EA580C] transition-all font-mono"
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
              <div className="mt-4 pt-3 border-t border-[#E8E4DF]/70 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#78716C] flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5 text-[#EA580C]" />
                  Try live demo orders:
                </span>
                {DEMO_QUICK_SEARCHES.map((demo) => (
                  <button
                    key={demo.code}
                    type="button"
                    onClick={() => {
                      setSearchQuery(demo.code);
                      handleSearch(demo.code, true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#FAFAF8] border border-[#E8E4DF] text-[#1A1714] hover:bg-[#FFF7ED] hover:border-[#EA580C]/40 hover:text-[#EA580C] transition-all"
                  >
                    <span className="font-mono font-bold text-[#EA580C]">{demo.code}</span>
                    <span className="text-[#78716C] text-[11px]">({demo.hint})</span>
                  </button>
                ))}
              </div>

              {/* Error Alert */}
              {searchError && (
                <div className="mt-4 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#DC2626] flex items-center gap-2">
                  <span>{searchError}</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── Modern Mill Facility Showcase Banner ─── */}
          <div className="mt-10 relative group rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E4DF] shadow-2xl shadow-stone-200/60 bg-stone-900">
            <div className="relative aspect-[16/9] max-h-[460px] w-full overflow-hidden">
              <img
                src="/textile-mill-hero.jpg"
                alt="Everest Textile Mills automated weaving shed and spinning units"
                className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none" />

              {/* Floating Status Pill Top Left */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 bg-white/90 backdrop-blur-md border border-white/60 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-[#1A1714] leading-tight">
                    Everest Mill Unit 1 · Spinning & Looms
                  </p>
                  <p className="text-[10px] text-[#78716C] leading-tight">
                    High-Speed Airjet & Rapier Looms Online
                  </p>
                </div>
              </div>

              {/* Floating Real-Time Floor Metrics Bottom Right */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-[#1A1714]/85 backdrop-blur-md border border-stone-700/60 rounded-2xl px-4 py-2.5 shadow-xl text-white flex items-center gap-4">
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-[#EA580C] tracking-wide">
                    Live Floor Output
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-white">4,850 m Today</p>
                </div>
                <div className="h-7 w-px bg-stone-700" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-[#A8A29E] tracking-wide">
                    First-Pass QC
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-[#16A34A]">99.4% Pass Rate</p>
                </div>
              </div>

              {/* Caption Tag Bottom Left */}
              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 hidden sm:block">
                <span className="text-[11px] font-medium text-white/90 bg-black/45 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
                  Continuous Roll Inspection & Digitized Floor Management
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Unfolded Live Order Tracking Details ─── */}
      {trackedOrder && (
        <section
          ref={trackingResultRef}
          className="pb-16 px-4 sm:px-8 max-w-5xl mx-auto w-full transition-all animate-fade-in"
        >
          <div className="bg-white border-2 border-[#EA580C]/20 rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#EA580C]/5 relative overflow-hidden">
            {/* Top decorative accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#EA580C]" />

            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#E8E4DF]">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-2xl font-extrabold text-[#1A1714] tracking-tight">
                    {trackedOrder.orderNumber}
                  </h2>
                  <Badge
                    variant={STATUS_VARIANTS[trackedOrder.status] ?? 'neutral'}
                    label={trackedOrder.status.replace('_', ' ')}
                    dot
                  />
                  <span className="text-xs text-[#78716C] font-mono bg-[#FAFAF8] px-2 py-0.5 rounded-md border border-[#E8E4DF]">
                    Token: {trackedOrder.trackingToken}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#78716C]">
                  Buyer: <span className="font-semibold text-[#1A1714]">{trackedOrder.buyerName}</span> ·{' '}
                  <span className="font-medium text-[#1A1714]">{trackedOrder.fabricType}</span> ({trackedOrder.colour})
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyTrackUrl}
                  className="text-xs"
                >
                  {copiedLink ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5 mr-1 text-[#16A34A]" />
                      Copied Link
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-3.5 h-3.5 mr-1" />
                      Copy Buyer Link
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => handleSearch(trackedOrder.orderNumber, false)}
                  title="Refresh status"
                  className="p-2 rounded-lg border border-[#E8E4DF] hover:bg-[#FAFAF8] text-[#78716C] hover:text-[#1A1714] transition-colors"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* ─── Animated Milestone Pipeline Stepper ─── */}
            <div className="py-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                  Live Manufacturing Pipeline
                </span>
                <span className="text-xs font-semibold text-[#EA580C] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
                  Active Stage: {trackedOrder.currentStage}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
                {STAGES.map((stg, idx) => {
                  const activeIdx = getActiveStageIndex(trackedOrder);
                  const isPassed = idx < activeIdx;
                  const isCurrent = idx === activeIdx;

                  return (
                    <div
                      key={stg.key}
                      className={[
                        'p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative',
                        isCurrent
                          ? 'bg-[#FFF7ED] border-[#EA580C]/40 shadow-sm shadow-[#EA580C]/10 ring-1 ring-[#EA580C]/20'
                          : isPassed
                          ? 'bg-[#F0FDF4] border-[#86EFAC]'
                          : 'bg-[#FAFAF8] border-[#E8E4DF] opacity-75',
                      ].join(' ')}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={[
                              'text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center font-mono',
                              isPassed
                                ? 'bg-[#16A34A] text-white'
                                : isCurrent
                                ? 'bg-[#EA580C] text-white animate-pulse-subtle'
                                : 'bg-[#E8E4DF] text-[#78716C]',
                            ].join(' ')}
                          >
                            {isPassed ? '✓' : idx + 1}
                          </span>

                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold text-[#EA580C] bg-white px-2 py-0.5 rounded-full border border-[#EA580C]/20">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-[#1A1714]">{stg.label}</p>
                        <p className="text-[11px] text-[#78716C] mt-0.5 leading-snug">{stg.desc}</p>
                      </div>

                      {/* Micro progress bar for current stage */}
                      {isCurrent && (
                        <div className="mt-3 pt-2 border-t border-[#EA580C]/20">
                          <div className="w-full bg-[#FED7AA] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#EA580C] h-full w-2/3 rounded-full animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Metres & Quantitative Progress Counters ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-[#E8E4DF]">
              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E8E4DF]">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#78716C] block">
                  Ordered Quantity
                </span>
                <p className="text-2xl font-extrabold text-[#1A1714] mt-1">
                  {trackedOrder.metres.toLocaleString('en-IN')} <span className="text-sm font-normal text-[#78716C]">m</span>
                </p>
                <p className="text-xs text-[#78716C] mt-0.5">Value: {formatCurrency(trackedOrder.totalAmount)}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E8E4DF]">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#78716C] block">
                  Produced on Machines
                </span>
                <p className="text-2xl font-extrabold text-[#EA580C] mt-1">
                  {(trackedOrder.stageProgress?.[1]?.producedMetres ?? trackedOrder.stageProgress?.[0]?.producedMetres ?? 0).toLocaleString('en-IN')}{' '}
                  <span className="text-sm font-normal text-[#78716C]">m</span>
                </p>
                <p className="text-xs text-[#78716C] mt-0.5">Through spinning/looms</p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E8E4DF]">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#78716C] block">
                  Passed Quality Check
                </span>
                <p className="text-2xl font-extrabold text-[#16A34A] mt-1">
                  {((trackedOrder.rollSummary?.passedRolls ?? 0) * 500).toLocaleString('en-IN')}{' '}
                  <span className="text-sm font-normal text-[#78716C]">m</span>
                </p>
                <p className="text-xs text-[#78716C] mt-0.5">{trackedOrder.rollSummary?.passedRolls ?? 0} rolls graded PASS</p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E8E4DF]">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#78716C] block">
                  Delivery Deadline
                </span>
                <p className="text-xl font-bold text-[#1A1714] mt-1">
                  {formatDate(trackedOrder.deadline)}
                </p>
                <p className="text-xs text-[#78716C] mt-0.5">Scheduled dispatch</p>
              </div>
            </div>

            {/* Rolls Grid if rolls exist */}
            {trackedOrder.rollSummary && trackedOrder.rollSummary.rolls.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#E8E4DF]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    Individual Fabric Roll Inspect Log
                  </p>
                  <span className="text-xs text-[#78716C]">
                    {trackedOrder.rollSummary.totalRolls} rolls generated
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {trackedOrder.rollSummary.rolls.map((roll) => (
                    <div
                      key={roll.id}
                      className="p-3 rounded-xl border border-[#E8E4DF] bg-[#FAFAF8] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#1A1714] font-mono">{roll.rollNumber}</span>
                        <p className="text-[#78716C] text-[11px]">{roll.metres} metres</p>
                      </div>
                      <Badge
                        variant={roll.qcStatus === 'PASS' ? 'success' : 'warning'}
                        label={roll.qcStatus}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom status refresh indicator */}
            <div className="mt-6 pt-4 border-t border-[#E8E4DF]/60 flex items-center justify-between text-xs text-[#A8A29E]">
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon className="w-4 h-4 text-[#16A34A]" />
                Direct live synchronization with Everest Textile Mills ERP
              </span>
              <span>Updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        </section>
      )}

      {/* ─── Section: Manufacturing Pipeline Showcase ─── */}
      <section id="pipeline" className="py-16 sm:py-24 bg-white border-y border-[#E8E4DF] px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">
              Rigorous 4-Stage Traceability
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#1A1714] tracking-tight mt-2">
              Every Metre Accounted For
            </h2>
            <p className="mt-3 text-sm text-[#78716C]">
              We replace notebooks and verbal floor checks with automated state machines that
              record each physical event from receipt to the buyer's truck.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-[#FAFAF8] border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] border border-[#EA580C]/20 flex items-center justify-center text-[#EA580C] mb-4 group-hover:scale-110 transition-transform">
                <CubeIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-[#EA580C]">STAGE 01</span>
              <h3 className="text-base font-bold text-[#1A1714] mt-1">Yarn Gate & Inward</h3>
              <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
                Raw yarn is logged with supplier reference, exact kg weight, count specifications, and
                allocated directly to buyer orders with zero shortfall leakage.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-[#FAFAF8] border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] border border-[#EA580C]/20 flex items-center justify-center text-[#EA580C] mb-4 group-hover:scale-110 transition-transform">
                <WrenchScrewdriverIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-[#EA580C]">STAGE 02</span>
              <h3 className="text-base font-bold text-[#1A1714] mt-1">Spinning & Loom Weaving</h3>
              <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
                Orders run on assigned spinning units and high-speed looms. Shift supervisors record
                metres produced per shift with automated stage cap protection.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-[#FAFAF8] border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] border border-[#EA580C]/20 flex items-center justify-center text-[#EA580C] mb-4 group-hover:scale-110 transition-transform">
                <BeakerIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-[#EA580C]">STAGE 03</span>
              <h3 className="text-base font-bold text-[#1A1714] mt-1">Dyeing & Roll Batching</h3>
              <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
                Dyed vats produce discrete fabric rolls. Each roll is minted with a globally unique ID
                linking it directly to its origin machines and yarn lot.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl bg-[#FAFAF8] border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] border border-[#EA580C]/20 flex items-center justify-center text-[#EA580C] mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-[#EA580C]">STAGE 04</span>
              <h3 className="text-base font-bold text-[#1A1714] mt-1">100% Roll QC & Dispatch</h3>
              <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
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
          <div className="bg-[#1A1714] text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#EA580C]/20 to-transparent pointer-events-none" />

            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">
                Factory Infrastructure
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-2 text-white">
                Built for High-Volume Reliability
              </h2>
              <p className="mt-3 text-sm text-[#A8A29E] leading-relaxed">
                Everest Textile Mills combines state-of-the-art weaving machinery with MillTrace’s
                digital ledger to eliminate order delays and unverified stock discrepancies.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-8 border-t border-stone-800">
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#EA580C]">50k+ m</p>
                <p className="text-xs text-[#A8A29E] mt-1 font-medium">Monthly Production Volume</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">99.4%</p>
                <p className="text-xs text-[#A8A29E] mt-1 font-medium">First-Pass QC Standard</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#EA580C]">100%</p>
                <p className="text-xs text-[#A8A29E] mt-1 font-medium">Roll-Level Traceability</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">&lt; 15s</p>
                <p className="text-xs text-[#A8A29E] mt-1 font-medium">Live Floor Refresh Sync</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section: Quality Guarantee ─── */}
      <section id="quality" className="py-16 sm:py-20 bg-white border-t border-[#E8E4DF] px-4 sm:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] border border-[#EA580C]/20 text-[#EA580C] mx-auto flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1714]">
            Everest Quality Assurance Promise
          </h2>
          <p className="mt-3 text-sm text-[#78716C] max-w-xl mx-auto">
            No roll leaves our dispatch dock without passing quality parameters. Each buyer receives
            transparent yardage counts and access to the complete machine and yarn production history.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-medium text-[#78716C]">
            <span className="flex items-center gap-1.5 bg-[#FAFAF8] px-3.5 py-2 rounded-xl border border-[#E8E4DF]">
              ✓ Defect-flagged roll exclusion
            </span>
            <span className="flex items-center gap-1.5 bg-[#FAFAF8] px-3.5 py-2 rounded-xl border border-[#E8E4DF]">
              ✓ Pre-dispatch yardage double-check
            </span>
            <span className="flex items-center gap-1.5 bg-[#FAFAF8] px-3.5 py-2 rounded-xl border border-[#E8E4DF]">
              ✓ Tamper-proof tracking tokens
            </span>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-auto bg-[#FAFAF8] border-t border-[#E8E4DF] py-12 px-4 sm:px-8 text-xs text-[#78716C]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#EA580C] flex items-center justify-center text-white text-xs font-bold">
              MT
            </div>
            <div>
              <p className="font-bold text-[#1A1714]">Everest Textile Mills</p>
              <p className="text-[11px] text-[#A8A29E]">Powered by MillTrace Operating System</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#tracker" className="hover:text-[#EA580C] transition-colors">
              Order Tracker
            </a>
            <Link to="/login" className="hover:text-[#EA580C] transition-colors font-semibold text-[#1A1714]">
              Staff Sign In
            </Link>
          </div>

          <p className="text-[11px] text-[#A8A29E]">
            © 2026 Everest Textile Mills. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
