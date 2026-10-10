import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { formatCurrency, formatDate } from '../../lib/format';
import { getInvoice, recordPayment, type Invoice } from './dispatch.api';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  CreditCardIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

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
      <div className="flex flex-col items-center justify-center py-24 text-[#78716C]">
        <Spinner size="lg" />
        <p className="text-sm mt-3 font-medium">Loading invoice record...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-[#78716C] space-y-3">
        <p className="text-base font-semibold text-[#1A1714]">Invoice record not found</p>
        <Link to="/invoices">
          <Button variant="secondary" size="sm">Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DF]">
        <div className="flex items-center gap-3">
          <Link
            to="/invoices"
            className="p-2 rounded-lg border border-[#E8E4DF] bg-white text-[#78716C] hover:text-[#1A1714] hover:bg-[#F5F4F2] transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono text-[#1A1714]">
                {invoice.invoiceNo}
              </h1>
              {invoice.status === 'PAID' && <Badge variant="success" label="PAID" dot />}
              {invoice.status === 'PARTIAL' && <Badge variant="warning" label="PARTIAL" dot />}
              {invoice.status === 'UNPAID' && <Badge variant="danger" label="UNPAID" dot />}
            </div>
            <p className="text-xs text-[#78716C] mt-0.5">
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
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 border-b border-[#F5F4F2]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">Billed Buyer</span>
            <div className="text-base font-bold text-[#1A1714] mt-1">{invoice.buyerName}</div>
            <div className="text-xs text-[#78716C]">Order: {invoice.orderNumber}</div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">Fabric Specification</span>
            <div className="text-sm font-semibold text-[#1A1714] mt-1">{invoice.fabricType}</div>
            <div className="text-xs text-[#78716C]">Colour: {invoice.colour}</div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">Dispatched Quantity</span>
            <div className="text-base font-bold text-[#1A1714] font-mono mt-1">
              {invoice.totalMetres.toLocaleString()} <span className="text-xs font-sans font-normal text-[#78716C]">metres</span>
            </div>
            <div className="text-xs text-[#78716C]">Rate: ₹{invoice.ratePerMetre}/m</div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">Transport Gate Ref</span>
            <div className="text-sm font-mono font-medium text-[#1A1714] mt-1">
              {invoice.vehicleNo || 'Self Pick-up'}
            </div>
            <div className="text-xs text-[#78716C]">Gate: {invoice.dispatchNo}</div>
          </div>
        </div>

        {/* Balance KPI Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#FBFBFA] rounded-xl border border-[#E8E4DF]">
          <div>
            <div className="text-xs text-[#78716C]">Invoice Total</div>
            <div className="text-xl font-bold font-mono text-[#1A1714] mt-0.5">
              {formatCurrency(invoice.amount)}
            </div>
          </div>

          <div>
            <div className="text-xs text-emerald-700">Amount Received</div>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
              {formatCurrency(invoice.paidAmount)}
            </div>
          </div>

          <div>
            <div className={`text-xs ${invoice.outstandingAmount > 0 ? 'text-amber-700 font-semibold' : 'text-[#78716C]'}`}>
              Outstanding Balance
            </div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${
              invoice.outstandingAmount > 0 ? 'text-amber-800' : 'text-[#78716C]'
            }`}>
              {formatCurrency(invoice.outstandingAmount)}
            </div>
          </div>
        </div>

        {/* Dispatched Rolls Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
            Dispatched Fabric Rolls ({invoice.rolls.length} items)
          </h3>
          <div className="border border-[#E8E4DF] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F4F2] text-[#78716C] font-semibold border-b border-[#E8E4DF]">
                <tr>
                  <th className="py-2.5 px-3">Roll Serial No.</th>
                  <th className="py-2.5 px-3">Fabric Spec</th>
                  <th className="py-2.5 px-3 text-right">Length (Metres)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F4F2]">
                {invoice.rolls.map((r) => (
                  <tr key={r.rollId}>
                    <td className="py-2.5 px-3 font-mono font-medium text-[#1A1714]">{r.rollNo}</td>
                    <td className="py-2.5 px-3 text-[#78716C]">{invoice.fabricType} ({invoice.colour})</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1A1714]">{r.metres} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Financial Section: Payments Ledger & Record Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Payments History Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F5F4F2]">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="w-5 h-5 text-[#EA580C]" />
              <h2 className="text-base font-semibold text-[#1A1714]">
                Recorded Payments
              </h2>
            </div>
            <span className="text-xs text-[#78716C]">
              {invoice.payments.length} transaction{invoice.payments.length === 1 ? '' : 's'}
            </span>
          </div>

          {invoice.payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#78716C] border border-dashed border-[#E8E4DF] rounded-xl">
              No payments recorded against this invoice yet.
            </div>
          ) : (
            <div className="border border-[#E8E4DF] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F4F2] text-[#78716C] font-semibold border-b border-[#E8E4DF]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Method / Ref</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F4F2]">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#78716C]">
                        {formatDate(p.paidOn)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#1A1714]">{p.method}</div>
                        {p.reference && (
                          <div className="text-[11px] font-mono text-[#78716C]">{p.reference}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-[#78716C]">
                        {p.createdByName || 'Office Staff'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Record Payment Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F5F4F2]">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-[#1A1714]">
              Record Payment
            </h2>
          </div>

          {!isFinancePermitted ? (
            <div className="p-4 bg-[#F5F4F2] rounded-xl border border-[#E8E4DF] text-xs text-[#78716C] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#44403C]">
                <ShieldCheckIcon className="w-4 h-4 text-[#A8A29E]" />
                Access Restricted
              </div>
              <p>
                Only Owner and Office staff roles have permission to record commercial financial payments.
              </p>
            </div>
          ) : invoice.outstandingAmount <= 0 ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 text-center space-y-1">
              <CheckCircleIcon className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm">Invoice Fully Paid</p>
              <p className="text-emerald-700">Zero outstanding balance remaining.</p>
            </div>
          ) : (
            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              {/* Payment Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={invoice.outstandingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-sm font-mono text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  required
                />
                <span className="text-[11px] text-[#78716C]">
                  Max payable: {formatCurrency(invoice.outstandingAmount)}
                </span>
              </div>

              {/* Payment Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  required
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Payment Mode
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                >
                  <option value="NEFT / Bank Transfer">NEFT / Bank Transfer</option>
                  <option value="RTGS">RTGS</option>
                  <option value="Cheque Deposit">Cheque Deposit</option>
                  <option value="UPI / Instant Transfer">UPI / Instant Transfer</option>
                  <option value="Cash Receipt">Cash Receipt</option>
                </select>
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Transaction Ref / Cheque No
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR-123456 or Cheque #8899"
                  className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs font-mono text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                />
              </div>

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
