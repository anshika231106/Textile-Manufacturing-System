import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { getStockSummary, type YarnStockSummary } from './stock.api';
import { listYarnTypes } from '../masters/masters.api';
import { LedgerPanel } from './LedgerPanel';
import { Card } from '../../components/ui/Card';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
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

  const { data: yarnTypes } = useApi(listYarnTypes, []);

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
            <span className="font-semibold text-[#1A1714] font-mono text-xs bg-[#F5F4F2] px-2 py-0.5 rounded border border-[#E8E4DF]">
              {row.code}
            </span>
            {row.countLabel && (
              <span className="text-xs text-[#78716C] font-medium">({row.countLabel})</span>
            )}
          </div>
          <p className="text-sm font-medium text-[#1A1714] mt-1">{row.name}</p>
          <p className="text-xs text-[#78716C]">Colour: {row.colour}</p>
        </div>
      ),
    },
    {
      key: 'onHand',
      header: 'On-Hand (kg)',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-sm text-[#1A1714] block text-right">
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
              row.reservedKg > 0 ? 'text-[#EA580C]' : 'text-[#78716C]'
            }`}
          >
            {row.reservedKg > 0
              ? `${row.reservedKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg`
              : '—'}
          </span>
          {row.shortfallKg > 0 && (
            <span className="text-[11px] font-semibold text-[#DC2626] block">
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
              row.availableKg <= 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
            }`}
          >
            {row.availableKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg
          </span>
          <span className="text-[11px] text-[#78716C] block">
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
            className="text-xs text-[#78716C] hover:text-[#EA580C] font-medium px-2.5 py-1 rounded-md hover:bg-[#FFF7ED] transition-colors"
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
          <h1 className="text-2xl font-bold text-[#1A1714]">Yarn Stock Management</h1>
          <p className="text-sm text-[#78716C] mt-0.5">
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
            <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-[#E8E4DF] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
              Total On-Hand
            </span>
            <div className="p-2 rounded-lg bg-[#F5F4F2] text-[#78716C]">
              <CubeIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#1A1714]">
              {kpis.totalOnHand.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-[#78716C] ml-1">kg</span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">Physical stock inside store</p>
        </Card>

        <Card className="p-4 border border-[#E8E4DF] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
              Available
            </span>
            <div className="p-2 rounded-lg bg-[#F0FDF4] text-[#16A34A]">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#16A34A]">
              {kpis.totalAvailable.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-[#78716C] ml-1">kg</span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">Unallocated for new orders</p>
        </Card>

        <Card className="p-4 border border-[#E8E4DF] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
              Reserved
            </span>
            <div className="p-2 rounded-lg bg-[#FFF7ED] text-[#EA580C]">
              <ClockIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#EA580C]">
              {kpis.totalReserved.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-[#78716C] ml-1">kg</span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">Committed to active orders</p>
        </Card>

        <Card className="p-4 border border-[#E8E4DF] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div
              className={`p-2 rounded-lg ${
                kpis.lowStockCount > 0 ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F0FDF4] text-[#16A34A]'
              }`}
            >
              {kpis.lowStockCount > 0 ? (
                <ShieldExclamationIcon className="w-5 h-5" />
              ) : (
                <CheckCircleIcon className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl font-bold ${
                kpis.lowStockCount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
              }`}
            >
              {kpis.lowStockCount}
            </span>
            <span className="text-xs text-[#78716C] ml-1">materials</span>
          </div>
          <p className="text-xs text-[#78716C] mt-1">Below minimum reorder level</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#E8E4DF]">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-[#EA580C] text-[#EA580C]'
              : 'border-transparent text-[#78716C] hover:text-[#1A1714]'
          }`}
        >
          <ScaleIcon className="w-4 h-4" />
          Yarn Inventory Overview
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-[#F5F4F2] text-[#78716C]">
            {stockData?.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'ledger'
              ? 'border-[#EA580C] text-[#EA580C]'
              : 'border-transparent text-[#78716C] hover:text-[#1A1714]'
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
              <MagnifyingGlassIcon className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by code, yarn name, or colour..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E8E4DF] bg-white placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#1A1714]">
                <input
                  type="checkbox"
                  checked={showLowOnly}
                  onChange={(e) => setShowLowOnly(e.target.checked)}
                  className="rounded border-[#E8E4DF] text-[#EA580C] focus:ring-[#EA580C]"
                />
                <span className="inline-flex items-center gap-1 text-[#DC2626]">
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
