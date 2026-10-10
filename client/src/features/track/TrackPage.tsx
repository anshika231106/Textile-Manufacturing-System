import { useParams } from 'react-router-dom';
import { usePolling } from '../../lib/usePolling';
import { api } from '../../lib/api';
import { useState, useCallback } from 'react';
import { ApiError } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../lib/format';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface TrackData {
  orderNumber: string;
  status: string;
  currentStage: string | null;
  orderedMetres: number;
  producedMetres: number;
  passedMetres: number;
  dispatchedMetres: number;
  deadline: string;
  lastUpdated: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:       'Pending',
  IN_PRODUCTION: 'In Production',
  QC:            'In QC',
  READY:         'Ready',
  DISPATCHED:    'Dispatched',
  COMPLETED:     'Completed',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  PENDING:       'neutral',
  IN_PRODUCTION: 'info',
  QC:            'warning',
  READY:         'success',
  DISPATCHED:    'success',
  COMPLETED:     'success',
};

function Metre({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 bg-white border border-[#E8E4DF] rounded-xl">
      <p className="text-2xl font-bold text-[#1A1714]">{value.toLocaleString('en-IN')}</p>
      <p className="text-xs text-[#78716C] text-center">{label}</p>
    </div>
  );
}

export function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await api<TrackData>(`/public/track/${token}`, { auth: false });
      setData(res);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'NOT_FOUND'
          ? 'Order not found. Please check your tracking link.'
          : 'Unable to load order status. Please try again shortly.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  usePolling(fetchData, 15_000);

  return (
    <div className="min-h-screen bg-[#FAFAF8] px-4 py-10">
      <div className="max-w-sm mx-auto">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#EA580C] mb-3">
            <span className="text-white text-sm font-bold">MT</span>
          </div>
          <p className="text-sm text-[#78716C]">MillTrace Order Tracker</p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {error && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl p-5 text-center">
            <p className="text-sm text-[#DC2626]">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="flex flex-col gap-4">
            {/* Order header */}
            <div className="bg-white border border-[#E8E4DF] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#78716C] uppercase tracking-wide mb-1">Order</p>
                  <p className="text-lg font-bold text-[#1A1714]">{data.orderNumber}</p>
                </div>
                <Badge
                  variant={STATUS_VARIANT[data.status] ?? 'neutral'}
                  label={STATUS_LABEL[data.status] ?? data.status}
                  dot
                />
              </div>
              {data.currentStage && (
                <p className="mt-3 text-sm text-[#78716C]">
                  Stage: <span className="font-medium text-[#1A1714]">{data.currentStage}</span>
                </p>
              )}
              <p className="mt-1 text-sm text-[#78716C]">
                Deadline: <span className="font-medium text-[#1A1714]">{formatDate(data.deadline)}</span>
              </p>
            </div>

            {/* Metres */}
            <div className="grid grid-cols-2 gap-3">
              <Metre label="Ordered (m)" value={data.orderedMetres} />
              <Metre label="Produced (m)" value={data.producedMetres} />
              <Metre label="Passed QC (m)" value={data.passedMetres} />
              <Metre label="Dispatched (m)" value={data.dispatchedMetres} />
            </div>

            {/* Last updated */}
            <div className="flex items-center gap-1.5 justify-center text-xs text-[#A8A29E]">
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Last updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
