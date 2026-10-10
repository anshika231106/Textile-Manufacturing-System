import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E4DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">
              Customer Sales Invoices
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Finance & Billing
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-1">
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
            <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E8E4DF] p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Invoiced</span>
            <DocumentTextIcon className="w-5 h-5 text-[#A8A29E]" />
          </div>
          <div className="text-2xl font-bold text-[#1A1714] font-mono">
            {formatCurrency(stats.totalInvoiced)}
          </div>
          <div className="text-xs text-[#78716C] mt-1">{invoices.length} total customer invoices</div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4.5 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Payments Collected</span>
            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 font-mono">
            {formatCurrency(stats.totalCollected)}
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-medium">Realized revenue</div>
        </div>

        <div className={`bg-white rounded-xl border p-4.5 shadow-2xs ${
          stats.totalOutstanding > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-[#E8E4DF]'
        }`}>
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className={`text-xs font-medium uppercase tracking-wider ${stats.totalOutstanding > 0 ? 'text-amber-800' : ''}`}>
              Outstanding Receivables
            </span>
            <BanknotesIcon className={`w-5 h-5 ${stats.totalOutstanding > 0 ? 'text-amber-600' : 'text-[#A8A29E]'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${stats.totalOutstanding > 0 ? 'text-amber-900' : 'text-[#1A1714]'}`}>
            {formatCurrency(stats.totalOutstanding)}
          </div>
          <div className={`text-xs mt-1 ${stats.totalOutstanding > 0 ? 'text-amber-700 font-medium' : 'text-[#78716C]'}`}>
            {stats.unpaidCount} invoice{stats.unpaidCount === 1 ? '' : 's'} with balance due
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-[#E8E4DF] p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-[#1A1714] text-white shadow-2xs'
                  : 'bg-[#F5F4F2] text-[#78716C] hover:bg-[#E8E4DF] hover:text-[#1A1714]'
              }`}
            >
              {tab === 'ALL' ? 'All Invoices' : tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <MagnifyingGlassIcon className="w-4 h-4 text-[#A8A29E] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search invoice #, buyer, order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg border border-[#E8E4DF] bg-white py-2 pl-9 pr-3 text-[#1A1714] placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
          />
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#78716C]">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading sales ledger and invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#E8E4DF] p-12 text-center text-sm text-[#78716C] space-y-2">
          <p className="font-semibold text-[#44403C]">No invoices found matching criteria.</p>
          <p className="text-xs text-[#A8A29E]">
            Confirm a dispatch gate pass to automatically generate sales invoices.
          </p>
          <Link to="/dispatch" className="inline-block mt-2">
            <Button size="sm" variant="secondary">Go to Dispatch</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4DF] bg-[#FBFBFA] text-[#78716C] font-semibold">
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Order / Dispatch</th>
                  <th className="py-3.5 px-4">Buyer</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">Paid</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F4F2]">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#FBFBFA] transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-mono font-bold text-sm text-[#EA580C] hover:underline"
                      >
                        {inv.invoiceNo}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-[#1A1714] font-medium">{inv.orderNumber}</div>
                      <div className="text-[11px] text-[#78716C]">{inv.dispatchNo}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#1A1714]">{inv.buyerName}</div>
                      <div className="text-[11px] text-[#78716C]">
                        {inv.totalMetres} m ({inv.fabricType})
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-[#78716C] whitespace-nowrap">
                      {formatDate(inv.issuedAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#1A1714] whitespace-nowrap">
                      {formatCurrency(inv.amount)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs text-emerald-700 whitespace-nowrap">
                      {formatCurrency(inv.paidAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-xs whitespace-nowrap">
                      {inv.outstandingAmount > 0 ? (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {formatCurrency(inv.outstandingAmount)}
                        </span>
                      ) : (
                        <span className="text-[#A8A29E]">₹0.00</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {inv.status === 'PAID' && <Badge variant="success" label="PAID" dot />}
                      {inv.status === 'PARTIAL' && <Badge variant="warning" label="PARTIAL" dot />}
                      {inv.status === 'UNPAID' && <Badge variant="danger" label="UNPAID" dot />}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link to={`/invoices/${inv.id}`}>
                        <Button size="sm" variant="secondary" className="text-xs">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
