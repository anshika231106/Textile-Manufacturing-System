import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Table, type Column } from '../../components/ui/Table';
import { formatCurrency, formatDate } from '../../lib/format';
import { listInvoices, type Invoice } from './dispatch.api';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  CheckCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

const STATUS_TABS: { value: 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'; label: string }[] = [
  { value: 'ALL', label: 'All Invoices' },
  { value: 'UNPAID', label: 'UNPAID' },
  { value: 'PARTIAL', label: 'PARTIAL' },
  { value: 'PAID', label: 'PAID' },
];

export function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await listInvoices();
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats computation
  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((acc, i) => acc + i.amount, 0);
    const totalCollected = invoices.reduce((acc, i) => acc + i.paidAmount, 0);
    const totalOutstanding = invoices.reduce((acc, i) => acc + i.outstandingAmount, 0);
    const unpaidCount = invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIAL').length;

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      unpaidCount,
    };
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = inv.invoiceNo.toLowerCase().includes(q) || inv.dispatchNo.toLowerCase().includes(q);
        const matchBuyer = inv.buyerName.toLowerCase().includes(q) || inv.orderNumber.toLowerCase().includes(q);
        if (!matchNo && !matchBuyer) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNo',
      header: 'Invoice #',
      render: (inv) => (
        <Link to={`/invoices/${inv.id}`} className="font-mono font-bold text-sm text-(--color-accent) hover:underline">
          {inv.invoiceNo}
        </Link>
      ),
    },
    {
      key: 'order',
      header: 'Order / Dispatch',
      render: (inv) => (
        <div>
          <div className="font-mono text-(--color-text) font-medium">{inv.orderNumber}</div>
          <div className="text-[11px] text-(--color-text-muted)">{inv.dispatchNo}</div>
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (inv) => (
        <div>
          <div className="font-semibold text-(--color-text)">{inv.buyerName}</div>
          <div className="text-[11px] text-(--color-text-muted)">{inv.totalMetres} m ({inv.fabricType})</div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (inv) => <span className="text-(--color-text-muted)">{formatDate(inv.issuedAt)}</span>,
    },
    {
      key: 'amount',
      header: 'Total Amount',
      align: 'right',
      render: (inv) => <span className="font-mono font-bold text-sm text-(--color-text)">{formatCurrency(inv.amount)}</span>,
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      render: (inv) => <span className="font-mono text-xs text-emerald-700">{formatCurrency(inv.paidAmount)}</span>,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (inv) =>
        inv.outstandingAmount > 0 ? (
          <span className="font-mono font-bold text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            {formatCurrency(inv.outstandingAmount)}
          </span>
        ) : (
          <span className="font-mono font-bold text-xs text-(--color-text-subtle)">₹0.00</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (inv) => (
        <>
          {inv.status === 'PAID' && <Badge variant="success" label="PAID" dot />}
          {inv.status === 'PARTIAL' && <Badge variant="warning" label="PARTIAL" dot />}
          {inv.status === 'UNPAID' && <Badge variant="danger" label="UNPAID" dot />}
        </>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (inv) => (
        <Link to={`/invoices/${inv.id}`}>
          <Button size="sm" variant="secondary" className="text-xs">View</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Customer Sales Invoices
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Finance & Billing
            </span>
          </div>
          <p className="text-sm text-(--color-text-muted) mt-1">
            Track issued dispatch invoices, customer payments, and outstanding commercial balances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            className="text-xs"
          >
            <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
            Refresh
          </Button>

          <Link to="/dispatch">
            <Button variant="primary" size="sm" className="text-xs shadow-xs">
              <TruckIcon className="w-4 h-4" />
              Create Dispatch
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <StatGrid columns={3}>
        <StatCard
          icon={DocumentTextIcon}
          label="Total Invoiced"
          value={formatCurrency(stats.totalInvoiced)}
          sub={`${invoices.length} total customer invoices`}
          tone="neutral"
        />
        <StatCard
          icon={CheckCircleIcon}
          label="Payments Collected"
          value={formatCurrency(stats.totalCollected)}
          sub="Realized revenue"
          tone="success"
        />
        <StatCard
          icon={BanknotesIcon}
          label="Outstanding Receivables"
          value={formatCurrency(stats.totalOutstanding)}
          sub={`${stats.unpaidCount} invoice${stats.unpaidCount === 1 ? '' : 's'} with balance due`}
          tone={stats.totalOutstanding > 0 ? 'warning' : 'neutral'}
        />
      </StatGrid>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-(--color-border) p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={STATUS_TABS} size="sm" />

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <MagnifyingGlassIcon className="w-4 h-4 text-(--color-text-subtle) absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search invoice #, buyer, order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg border border-(--color-border) bg-white py-2 pl-9 pr-3 text-(--color-text) placeholder-(--color-text-subtle) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
          />
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-(--color-text-muted)">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading sales ledger and invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-(--color-border) p-12 text-center text-sm text-(--color-text-muted) space-y-2">
          <p className="font-semibold text-(--color-text-dark)">No invoices found matching criteria.</p>
          <p className="text-xs text-(--color-text-subtle)">
            Confirm a dispatch gate pass to automatically generate sales invoices.
          </p>
          <Link to="/dispatch" className="inline-block mt-2">
            <Button size="sm" variant="secondary">Go to Dispatch</Button>
          </Link>
        </div>
      ) : (
        <Table columns={columns} rows={filteredInvoices} rowKey={(inv) => inv.id} />
      )}
    </div>
  );
}
