import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { Table, type Column } from '../../components/ui/Table';
import { RestrictedAccess } from '../../components/ui/RestrictedAccess';
import { formatCurrency, formatDate } from '../../lib/format';
import { getInvoice, recordPayment, type Invoice } from './dispatch.api';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  CreditCardIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const PAYMENT_METHODS = [
  'NEFT / Bank Transfer',
  'RTGS',
  'Cheque Deposit',
  'UPI / Instant Transfer',
  'Cash Receipt',
].map((v) => ({ value: v, label: v }));

export function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isFinancePermitted = user?.role === 'OWNER' || user?.role === 'OFFICE';

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  // Record payment form states
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('NEFT / Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getInvoice(id);
      setInvoice(data);
      if (data.outstandingAmount > 0) {
        setPayAmount(String(data.outstandingAmount));
      }
    } catch (err: any) {
      showToast(err.message || 'Invoice not found', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    if (amt > invoice.outstandingAmount) {
      showToast('Payment amount exceeds outstanding balance', 'error');
      return;
    }

    try {
      setSubmittingPayment(true);
      const updated = await recordPayment(
        invoice.id,
        {
          amount: amt,
          paidOn: payDate,
          method: payMethod,
          reference: payRef.trim() || undefined,
        },
        user?.name || 'Office Staff'
      );

      setInvoice(updated);
      showToast(`Payment of ${formatCurrency(amt)} recorded successfully!`, 'success');
      setPayRef('');
      setPayAmount(String(updated.outstandingAmount));
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-(--color-text-muted)">
        <Spinner size="lg" />
        <p className="text-sm mt-3 font-medium">Loading invoice record...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-(--color-text-muted) space-y-3">
        <p className="text-base font-semibold text-(--color-text)">Invoice record not found</p>
        <Link to="/invoices">
          <Button variant="secondary" size="sm">Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  const rollColumns: Column<Invoice['rolls'][number]>[] = [
    { key: 'rollNo', header: 'Roll Serial No.', render: (r) => <span className="font-mono font-medium text-(--color-text)">{r.rollNo}</span> },
    { key: 'spec', header: 'Fabric Spec', render: () => <span className="text-(--color-text-muted)">{invoice.fabricType} ({invoice.colour})</span> },
    { key: 'metres', header: 'Length (Metres)', align: 'right', render: (r) => <span className="font-mono font-bold text-(--color-text)">{r.metres} m</span> },
  ];

  const paymentColumns: Column<Invoice['payments'][number]>[] = [
    { key: 'date', header: 'Date', render: (p) => <span className="text-(--color-text-muted) whitespace-nowrap">{formatDate(p.paidOn)}</span> },
    {
      key: 'method',
      header: 'Method / Ref',
      render: (p) => (
        <div>
          <div className="font-semibold text-(--color-text)">{p.method}</div>
          {p.reference && <div className="text-[11px] font-mono text-(--color-text-muted)">{p.reference}</div>}
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-mono font-bold text-emerald-800 whitespace-nowrap">{formatCurrency(p.amount)}</span> },
    { key: 'receivedBy', header: 'Received By', render: (p) => <span className="text-(--color-text-muted)">{p.createdByName || 'Office Staff'}</span> },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-(--color-border)">
        <div className="flex items-center gap-3">
          <Link
            to="/invoices"
            className="p-2 rounded-lg border border-(--color-border) bg-white text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-sunken) transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono text-(--color-text)">
                {invoice.invoiceNo}
              </h1>
              {invoice.status === 'PAID' && <Badge variant="success" label="PAID" dot />}
              {invoice.status === 'PARTIAL' && <Badge variant="warning" label="PARTIAL" dot />}
              {invoice.status === 'UNPAID' && <Badge variant="danger" label="UNPAID" dot />}
            </div>
            <p className="text-xs text-(--color-text-muted) mt-0.5">
              Issued on {formatDate(invoice.issuedAt)} • Linked to {invoice.dispatchNo}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="text-xs"
          >
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Overview Card */}
      <div className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 border-b border-(--color-surface-sunken)">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Billed Buyer</span>
            <div className="text-base font-bold text-(--color-text) mt-1">{invoice.buyerName}</div>
            <div className="text-xs text-(--color-text-muted)">Order: {invoice.orderNumber}</div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Fabric Specification</span>
            <div className="text-sm font-semibold text-(--color-text) mt-1">{invoice.fabricType}</div>
            <div className="text-xs text-(--color-text-muted)">Colour: {invoice.colour}</div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Dispatched Quantity</span>
            <div className="text-base font-bold text-(--color-text) font-mono mt-1">
              {invoice.totalMetres.toLocaleString()} <span className="text-xs font-sans font-normal text-(--color-text-muted)">metres</span>
            </div>
            <div className="text-xs text-(--color-text-muted)">Rate: ₹{invoice.ratePerMetre}/m</div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Transport Gate Ref</span>
            <div className="text-sm font-mono font-medium text-(--color-text) mt-1">
              {invoice.vehicleNo || 'Self Pick-up'}
            </div>
            <div className="text-xs text-(--color-text-muted)">Gate: {invoice.dispatchNo}</div>
          </div>
        </div>

        {/* Balance KPI Banner */}
        <StatGrid columns={3}>
          <StatCard label="Invoice Total" value={formatCurrency(invoice.amount)} tone="neutral" />
          <StatCard label="Amount Received" value={formatCurrency(invoice.paidAmount)} tone="success" />
          <StatCard
            label="Outstanding Balance"
            value={formatCurrency(invoice.outstandingAmount)}
            tone={invoice.outstandingAmount > 0 ? 'warning' : 'neutral'}
          />
        </StatGrid>

        {/* Dispatched Rolls Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Dispatched Fabric Rolls ({invoice.rolls.length} items)
          </h3>
          <Table columns={rollColumns} rows={invoice.rolls} rowKey={(r) => r.rollId} />
        </div>
      </div>

      {/* Financial Section: Payments Ledger & Record Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Payments History Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-(--color-surface-sunken)">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="w-5 h-5 text-(--color-accent)" />
              <h2 className="text-base font-semibold text-(--color-text)">
                Recorded Payments
              </h2>
            </div>
            <span className="text-xs text-(--color-text-muted)">
              {invoice.payments.length} transaction{invoice.payments.length === 1 ? '' : 's'}
            </span>
          </div>

          <Table
            columns={paymentColumns}
            rows={invoice.payments}
            rowKey={(p) => p.id}
            emptyTitle="No payments yet"
            emptyDescription="No payments recorded against this invoice yet."
          />
        </div>

        {/* Record Payment Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-(--color-surface-sunken)">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-(--color-text)">
              Record Payment
            </h2>
          </div>

          {!isFinancePermitted ? (
            <RestrictedAccess message="Only Owner and Office staff roles have permission to record commercial financial payments." />
          ) : invoice.outstandingAmount <= 0 ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 text-center space-y-1">
              <CheckCircleIcon className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm">Invoice Fully Paid</p>
              <p className="text-emerald-700">Zero outstanding balance remaining.</p>
            </div>
          ) : (
            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              {/* Payment Amount */}
              <div>
                <Input
                  label="Payment Amount (₹)"
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  max={invoice.outstandingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="font-mono"
                />
                <span className="text-[11px] text-(--color-text-muted)">
                  Max payable: {formatCurrency(invoice.outstandingAmount)}
                </span>
              </div>

              {/* Payment Date */}
              <Input
                label="Payment Date"
                required
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />

              {/* Payment Method */}
              <Select
                label="Payment Mode"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                options={PAYMENT_METHODS}
              />

              {/* Reference */}
              <Input
                label="Transaction Ref / Cheque No"
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. UTR-123456 or Cheque #8899"
                className="font-mono"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingPayment}
                  className="w-full shadow-xs text-xs py-2.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  Save Payment Receipt
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
