import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { getStockSummary, type YarnStockSummary } from './stock.api';
import { listYarnTypes } from '../masters/masters.api';
import { LedgerPanel } from './LedgerPanel';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import {
  CubeIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  DocumentTextIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';

export function StockPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'inventory' | 'ledger'>('inventory');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showLowOnly, setShowLowOnly] = useState<boolean>(false);
  const [selectedLedgerYarnId, setSelectedLedgerYarnId] = useState<string>('ALL');

  const {
    data: stockData,
    loading: stockLoading,
    error: stockError,
    reload: reloadStock,
  } = useApi(getStockSummary, []);

  // The ledger is history, so its yarn filter includes retired yarn types.
  const { data: yarnTypes } = useApi(() => listYarnTypes(true), []);

  const canRecord = user?.role === 'OWNER' || user?.role === 'SUPERVISOR';

  // Compute KPI metrics
  const kpis = useMemo(() => {
    const list = stockData || [];
    const totalOnHand = list.reduce((acc, curr) => acc + (curr.onHandKg || 0), 0);
    const totalAvailable = list.reduce((acc, curr) => acc + (curr.availableKg || 0), 0);
    const totalReserved = list.reduce((acc, curr) => acc + (curr.reservedKg || 0), 0);
    const lowStockCount = list.filter((i) => i.isLow).length;
    return { totalOnHand, totalAvailable, totalReserved, lowStockCount };
  }, [stockData]);

  // Filtered rows for the inventory table
  const filteredRows = useMemo(() => {
    let list = stockData || [];
    if (showLowOnly) {
      list = list.filter((item) => item.isLow);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.colour.toLowerCase().includes(q) ||
          (item.countLabel && item.countLabel.toLowerCase().includes(q))
      );
    }
    return list;
  }, [stockData, showLowOnly, searchQuery]);

  const handleViewLedger = (yarnTypeId: string) => {
    setSelectedLedgerYarnId(yarnTypeId);
    setActiveTab('ledger');
  };

  const handleQuickReceive = (yarnTypeId: string) => {
    navigate(`/stock/receipt?yarnTypeId=${yarnTypeId}`);
  };

  const columns: Column<YarnStockSummary>[] = [
    {
      key: 'code',
      header: 'Yarn Code & Name',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-(--color-text) font-mono text-xs bg-(--color-surface-sunken) px-2 py-0.5 rounded border border-(--color-border)">
              {row.code}
            </span>
            {row.countLabel && (
              <span className="text-xs text-(--color-text-muted) font-medium">({row.countLabel})</span>
            )}
          </div>
          <p className="text-sm font-medium text-(--color-text) mt-1">{row.name}</p>
          <p className="text-xs text-(--color-text-muted)">Colour: {row.colour}</p>
        </div>
      ),
    },
    {
      key: 'onHand',
      header: 'On-Hand (kg)',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-sm text-(--color-text) block text-right">
          {row.onHandKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg
        </span>
      ),
    },
    {
      key: 'reserved',
      header: 'Reserved (kg)',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <span
            className={`font-medium text-xs block ${
              row.reservedKg > 0 ? 'text-(--color-accent)' : 'text-(--color-text-muted)'
            }`}
          >
            {row.reservedKg > 0
              ? `${row.reservedKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg`
              : '—'}
          </span>
          {row.shortfallKg > 0 && (
            <span className="text-[11px] font-semibold text-(--color-danger) block">
              Shortfall: {row.shortfallKg.toLocaleString('en-IN')} kg
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Available (kg)',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <span
            className={`font-semibold text-sm block ${
              row.availableKg <= 0 ? 'text-(--color-danger)' : 'text-(--color-success)'
            }`}
          >
            {row.availableKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg
          </span>
          <span className="text-[11px] text-(--color-text-muted) block">
            Reorder at: {row.reorderLevelKg.toLocaleString('en-IN')} kg
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Stock Status',
      render: (row) =>
        row.isLow ? (
          <Badge
            variant="danger"
            label="LOW STOCK"
            dot
          />
        ) : (
          <Badge
            variant="success"
            label="ADEQUATE"
            dot
          />
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleViewLedger(row.yarnTypeId)}
            className="text-xs text-(--color-text-muted) hover:text-(--color-accent) font-medium px-2.5 py-1 rounded-md hover:bg-(--color-accent-light) transition-colors"
            title="View ledger history"
          >
            Ledger
          </button>
          {canRecord && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickReceive(row.yarnTypeId)}
              className="text-xs py-1 px-2.5"
            >
              <PlusIcon className="w-3.5 h-3.5 mr-0.5" />
              Receive
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text)">Yarn Stock Management</h1>
          <p className="text-sm text-(--color-text-muted) mt-0.5">
            Raw material inventory, real-time availability, reorder alerts and gate movement history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={reloadStock}
            title="Refresh Stock Data"
          >
            <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
          </Button>

          {canRecord && (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/stock/receipt')}
            >
              <PlusIcon className="w-4 h-4" />
              Record Yarn Receipt
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <StatGrid columns={4}>
        <StatCard
          icon={CubeIcon}
          label="Total On-Hand"
          value={`${kpis.totalOnHand.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`}
          sub="Physical stock inside store"
          tone="neutral"
        />
        <StatCard
          icon={CheckCircleIcon}
          label="Available"
          value={`${kpis.totalAvailable.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`}
          sub="Unallocated for new orders"
          tone="success"
        />
        <StatCard
          icon={ClockIcon}
          label="Reserved"
          value={`${kpis.totalReserved.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`}
          sub="Committed to active orders"
          tone="accent"
        />
        <StatCard
          icon={kpis.lowStockCount > 0 ? ShieldExclamationIcon : CheckCircleIcon}
          label="Low Stock Alerts"
          value={`${kpis.lowStockCount} materials`}
          sub="Below minimum reorder level"
          tone={kpis.lowStockCount > 0 ? 'danger' : 'success'}
        />
      </StatGrid>

      {/* Tabs */}
      <div className="flex items-center border-b border-(--color-border)">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-(--color-accent) text-(--color-accent)'
              : 'border-transparent text-(--color-text-muted) hover:text-(--color-text)'
          }`}
        >
          <ScaleIcon className="w-4 h-4" />
          Yarn Inventory Overview
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-(--color-surface-sunken) text-(--color-text-muted)">
            {stockData?.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'ledger'
              ? 'border-(--color-accent) text-(--color-accent)'
              : 'border-transparent text-(--color-text-muted) hover:text-(--color-text)'
          }`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          Movement Ledger
        </button>
      </div>

      {/* Tab 1: Inventory Table */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <MagnifyingGlassIcon className="w-4 h-4 text-(--color-text-muted) absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by code, yarn name, or colour..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--color-border) bg-white placeholder:text-(--color-text-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/20 focus:border-(--color-accent)"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-(--color-text)">
                <input
                  type="checkbox"
                  checked={showLowOnly}
                  onChange={(e) => setShowLowOnly(e.target.checked)}
                  className="rounded border-(--color-border) text-(--color-accent) focus:ring-(--color-accent)"
                />
                <span className="inline-flex items-center gap-1 text-(--color-danger)">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  Show Low Stock Only ({kpis.lowStockCount})
                </span>
              </label>
            </div>
          </div>

          {/* Main Table */}
          {stockError ? (
            <ErrorState message={stockError.message} code={stockError.code} onRetry={reloadStock} />
          ) : (
            <Table
              columns={columns}
              rows={filteredRows}
              loading={stockLoading}
              rowKey={(r) => r.yarnTypeId}
              emptyTitle="No yarn stock found"
              emptyDescription={
                searchQuery || showLowOnly
                  ? 'No yarns match your current search filters.'
                  : 'No yarn materials are currently tracked.'
              }
            />
          )}
        </div>
      )}

      {/* Tab 2: Ledger Panel */}
      {activeTab === 'ledger' && (
        <LedgerPanel
          yarnTypes={yarnTypes || []}
          selectedYarnId={selectedLedgerYarnId}
          onSelectYarnId={(id) => setSelectedLedgerYarnId(id)}
        />
      )}
    </div>
  );
}
