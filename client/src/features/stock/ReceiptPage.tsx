import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { useApi } from '../../lib/useApi';
import { recordReceipt } from './stock.api';
import { listSuppliers, listYarnTypes } from '../masters/masters.api';
import { listOrders } from '../orders/orders.api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { formatCurrency } from '../../lib/format';
import {
  CubeIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CalculatorIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

export function ReceiptPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const prefilledYarnId = searchParams.get('yarnTypeId') || '';

  // Form states
  const [supplierId, setSupplierId] = useState<string>('');
  const [yarnTypeId, setYarnTypeId] = useState<string>(prefilledYarnId);
  const [kgStr, setKgStr] = useState<string>('');
  const [rateStr, setRateStr] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successReceipt, setSuccessReceipt] = useState<{
    yarnName: string;
    kg: number;
    ratePerKg: number;
    newOnHand: number;
    reference: string;
  } | null>(null);

  // Load masters & orders
  const { data: suppliers, loading: loadingSuppliers } = useApi(listSuppliers, []);
  const { data: yarnTypes, loading: loadingYarnTypes } = useApi(listYarnTypes, []);
  const { data: orders } = useApi(() => listOrders(), []);

  // Sync prefilled yarn if available
  useEffect(() => {
    if (prefilledYarnId && !yarnTypeId) {
      setYarnTypeId(prefilledYarnId);
    }
  }, [prefilledYarnId, yarnTypeId]);

  const canRecord = user?.role === 'OWNER' || user?.role === 'STOREKEEPER';

  const selectedYarn = yarnTypes?.find((y) => y.id === yarnTypeId);
  const kgVal = parseFloat(kgStr) || 0;
  const rateVal = parseFloat(rateStr) || 0;
  const totalValue = kgVal * rateVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!supplierId) newErrors.supplierId = 'Supplier is required.';
    if (!yarnTypeId) newErrors.yarnTypeId = 'Yarn type is required.';
    if (!kgStr || kgVal <= 0) newErrors.kg = 'Quantity must be greater than 0 kg.';
    if (!rateStr || rateVal <= 0) newErrors.rate = 'Rate per kg must be greater than ₹0.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const res = await recordReceipt({
        supplierId,
        yarnTypeId,
        kg: kgVal,
        ratePerKg: rateVal,
        orderId: orderId || undefined,
        reference: reference.trim() || undefined,
      });

      showToast(`Received ${kgVal} kg of ${selectedYarn?.name || 'yarn'} successfully!`, 'success');

      setSuccessReceipt({
        yarnName: selectedYarn?.name || 'Yarn',
        kg: kgVal,
        ratePerKg: rateVal,
        newOnHand: res.onHandKg,
        reference: res.movement.reference || reference || 'N/A',
      });

      // Reset form fields
      setKgStr('');
      setRateStr('');
      setReference('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record yarn receipt.', 'error');
      setErrors({ form: err.message || 'Error occurred while saving receipt.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setSuccessReceipt(null);
  };

  const supplierOptions = (suppliers || []).map((s) => ({
    value: s.id,
    label: `${s.name} ${s.phone ? `(${s.phone})` : ''}`,
  }));

  const yarnOptions = (yarnTypes || []).map((y) => ({
    value: y.id,
    label: `${y.code} — ${y.name} [${y.colour}]`,
  }));

  const orderOptions = [
    { value: '', label: 'General Stock (No specific order)' },
    ...(orders || []).map((o) => ({
      value: o.id,
      label: `${o.orderNumber} — ${o.buyerName} (${o.fabricType})`,
    })),
  ];

  if (loadingSuppliers || loadingYarnTypes) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!canRecord) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="text-center p-8">
          <CubeIcon className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1A1714]">Access Restricted</h2>
          <p className="text-sm text-[#78716C] mt-1 mb-6">
            Only Storekeepers and Mill Owners have permission to record raw material yarn receipts.
          </p>
          <Button variant="secondary" onClick={() => navigate('/stock')}>
            Return to Stock Overview
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/stock')}
            className="p-2 text-[#78716C] hover:text-[#1A1714] hover:bg-[#F5F4F2] rounded-lg transition-colors"
            title="Back to Stock"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1714]">Record Yarn Receipt</h1>
            <p className="text-sm text-[#78716C] mt-0.5">
              Enter incoming yarn stock at factory gate with supplier invoice details.
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={() => navigate('/stock')}>
          View Stock Table
        </Button>
      </div>

      {/* Success banner after submission */}
      {successReceipt && (
        <Card className="p-6 border-l-4 border-l-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 text-[#16A34A] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-[#166534]">
                  Yarn Inward Recorded Successfully!
                </h3>
                <p className="text-sm text-[#14532D] mt-1">
                  Received <span className="font-bold">{successReceipt.kg} kg</span> of{' '}
                  <span className="font-semibold">{successReceipt.yarnName}</span> at{' '}
                  <span className="font-bold">{formatCurrency(successReceipt.ratePerKg)}/kg</span>.
                  Reference: <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-[#86EFAC]">{successReceipt.reference}</span>
                </p>
                <p className="text-xs text-[#15803D] mt-2 font-medium">
                  Updated on-hand stock for this yarn: {successReceipt.newOnHand.toLocaleString('en-IN')} kg
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleResetForAnother}>
                Record Another
              </Button>
              <Button size="sm" variant="primary" onClick={() => navigate('/stock')}>
                View Stock
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Receipt Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 border border-[#E8E4DF] shadow-xs space-y-6">
          <div className="border-b border-[#E8E4DF] pb-4">
            <h2 className="text-base font-semibold text-[#1A1714] flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-[#EA580C]" />
              Gate Inward & Material Details
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Accurate rates ensure correct cost-of-production calculation during weaving and dyeing.
            </p>
          </div>

          {errors.form && (
            <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-sm text-[#991B1B]">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Supplier */}
            <div>
              <Select
                label="Supplier (Yarn Mill / Vendor)"
                required
                placeholder="Select a supplier..."
                options={supplierOptions}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                error={errors.supplierId}
              />
              <p className="text-xs text-[#78716C] mt-1">
                From approved vendor master list.
              </p>
            </div>

            {/* Yarn Type */}
            <div>
              <Select
                label="Yarn Material & Count"
                required
                placeholder="Select yarn type..."
                options={yarnOptions}
                value={yarnTypeId}
                onChange={(e) => setYarnTypeId(e.target.value)}
                error={errors.yarnTypeId}
              />
              {selectedYarn && (
                <p className="text-xs text-[#EA580C] mt-1 font-medium">
                  Current on-hand: {selectedYarn.availableKg ?? 0} kg available | Reorder level: {selectedYarn.reorderLevelKg} kg
                </p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Input
                label="Gross Quantity (kg)"
                required
                type="number"
                step="0.001"
                min="0.001"
                placeholder="e.g. 500"
                value={kgStr}
                onChange={(e) => setKgStr(e.target.value)}
                error={errors.kg}
                hint="Net weight received at weighing scale (up to 3 decimal places)"
              />
            </div>

            {/* Rate per kg */}
            <div>
              <Input
                label="Purchase Rate (₹ / kg)"
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 240.00"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                error={errors.rate}
                hint="Agreed mill invoice purchase rate per kg in INR"
              />
            </div>

            {/* Optional Order Link */}
            <div>
              <Select
                label="Allocated Order (Optional)"
                placeholder="General Stock (No specific order)"
                options={orderOptions}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
              <p className="text-xs text-[#78716C] mt-1">
                Link if purchased specifically to fulfill a pending customer order.
              </p>
            </div>

            {/* Challan / Reference */}
            <div>
              <Input
                label="Challan / Bill Reference (Optional)"
                type="text"
                maxLength={60}
                placeholder="e.g. CH-2026-9041 or Lorry No."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                hint="Supplier delivery challan, invoice number, or vehicle number"
              />
            </div>
          </div>

          {/* Live Valuation Box */}
          <div className="rounded-xl p-4 bg-[#FFF7ED] border border-[#FDBA74]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[#EA580C]/10 text-[#EA580C]">
                <CalculatorIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
                  Total Inward Valuation
                </p>
                <p className="text-xs text-[#9A3412] mt-0.5">
                  {kgVal > 0 && rateVal > 0
                    ? `${kgVal.toLocaleString('en-IN')} kg @ ${formatCurrency(rateVal)}/kg`
                    : 'Enter quantity and rate to calculate total'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-[#1A1714]">
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E4DF]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/stock')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting || kgVal <= 0 || rateVal <= 0}
            >
              Confirm & Post Receipt
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
