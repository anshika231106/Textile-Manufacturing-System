import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { listBuyers, listYarnTypes, MOCK_BUYERS, MOCK_YARN_TYPES, type Buyer, type YarnType } from '../masters/masters.api';
import { createOrder, checkFeasibility, type FeasibilityResult } from './orders.api';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { formatCurrency, formatApiDate } from '../../lib/format';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface YarnRow {
  id: string;
  yarnTypeId: string;
  requiredKg: string;
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Master data initialized with non-null defaults
  const [buyers, setBuyers] = useState<Buyer[]>(MOCK_BUYERS);
  const [yarnTypes, setYarnTypes] = useState<YarnType[]>(MOCK_YARN_TYPES);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Form state
  const [buyerId, setBuyerId] = useState(MOCK_BUYERS[0]?.id ?? '');
  const [fabricType, setFabricType] = useState('');
  const [colour, setColour] = useState('');
  const [metres, setMetres] = useState('');
  const [ratePerMetre, setRatePerMetre] = useState('');
  const [deadline, setDeadline] = useState('');
  const [yarnRows, setYarnRows] = useState<YarnRow[]>([
    { id: '1', yarnTypeId: MOCK_YARN_TYPES[0]?.id ?? '', requiredKg: '' },
  ]);

  // Feasibility state
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null);
  const [checkingFeasibility, setCheckingFeasibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Load buyers & yarn types
  useEffect(() => {
    Promise.all([listBuyers(), listYarnTypes()])
      .then(([bList, yList]) => {
        const safeBuyers = Array.isArray(bList) && bList.length > 0 ? bList : MOCK_BUYERS;
        const safeYarns = Array.isArray(yList) && yList.length > 0 ? yList : MOCK_YARN_TYPES;

        setBuyers(safeBuyers);
        setYarnTypes(safeYarns);

        if (safeBuyers.length > 0) setBuyerId(safeBuyers[0].id);
        if (safeYarns.length > 0) {
          setYarnRows([{ id: '1', yarnTypeId: safeYarns[0].id, requiredKg: '' }]);
        }
      })
      .catch(() => {
        setBuyers(MOCK_BUYERS);
        setYarnTypes(MOCK_YARN_TYPES);
      })
      .finally(() => setLoadingMasters(false));
  }, []);

  // Set default deadline (14 days from now)
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDeadline(formatApiDate(d));
  }, []);

  // Debounced feasibility check (~400ms)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const validRows = (yarnRows ?? [])
      .filter((r) => r.yarnTypeId && Number(r.requiredKg) > 0)
      .map((r) => ({
        yarnTypeId: r.yarnTypeId,
        requiredKg: Number(r.requiredKg),
      }));

    if (validRows.length === 0) {
      setFeasibility(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setCheckingFeasibility(true);

    timerRef.current = setTimeout(async () => {
      try {
        const result = await checkFeasibility(validRows);
        setFeasibility(result);
      } catch {
        setFeasibility(null);
      } finally {
        setCheckingFeasibility(false);
      }
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [yarnRows]);

  // Add / Remove yarn rows
  function handleAddYarnRow() {
    const safeYarns = Array.isArray(yarnTypes) ? yarnTypes : MOCK_YARN_TYPES;
    const defaultYarnId = safeYarns.length > 0 ? safeYarns[0].id : '';
    setYarnRows((prev) => [
      ...prev,
      { id: String(Date.now()), yarnTypeId: defaultYarnId, requiredKg: '' },
    ]);
  }

  function handleRemoveYarnRow(id: string) {
    if (yarnRows.length <= 1) return;
    setYarnRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleYarnChange(id: string, field: 'yarnTypeId' | 'requiredKg', val: string) {
    setYarnRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  }

  // Calculated values
  const numMetres = Number(metres) || 0;
  const numRate = Number(ratePerMetre) || 0;
  const estimatedTotal = numMetres * numRate;

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!buyerId) return setFormError('Please select a buyer.');
    if (!fabricType.trim()) return setFormError('Please enter the fabric type.');
    if (!colour.trim()) return setFormError('Please enter the colour.');
    if (numMetres <= 0) return setFormError('Metres must be greater than zero.');
    if (numRate <= 0) return setFormError('Rate per metre must be greater than zero.');
    if (!deadline) return setFormError('Please select a deadline.');

    const validYarn = (yarnRows ?? [])
      .filter((r) => r.yarnTypeId && Number(r.requiredKg) > 0)
      .map((r) => ({
        yarnTypeId: r.yarnTypeId,
        requiredKg: Number(r.requiredKg),
      }));

    if (validYarn.length === 0) {
      return setFormError('Please specify at least one yarn requirement with quantity.');
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        buyerId,
        fabricType: fabricType.trim(),
        colour: colour.trim(),
        metres: numMetres,
        ratePerMetre: numRate,
        deadline,
        yarnRequirements: validYarn,
      });

      showToast('Order created successfully!', 'success');
      navigate(`/orders/${order.id}`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMasters) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const safeBuyersList = Array.isArray(buyers) ? buyers : MOCK_BUYERS;
  const safeYarnsList = Array.isArray(yarnTypes) ? yarnTypes : MOCK_YARN_TYPES;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto page-content pb-12">
      {/* Back & Title */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-[#EA580C] mb-3 transition-colors"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Back to Orders
        </button>
        <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Create New Order</h1>
        <p className="mt-1 text-sm text-[#78716C]">
          Configure fabric specs, yarn bill of materials, and preview live stock feasibility.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {/* Error banner */}
        {formError && (
          <div className="rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] p-4 flex items-start gap-3 text-[#DC2626]">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Unable to create order</p>
              <p className="mt-0.5">{formError}</p>
            </div>
          </div>
        )}

        {/* 1. Buyer & Basic Information */}
        <Card className="p-6 flex flex-col gap-5">
          <h2 className="text-base font-bold text-[#1A1714] border-b border-[#E8E4DF] pb-3">
            1. Buyer & Fabric Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="buyer-select"
              label="Buyer / Customer"
              required
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              options={safeBuyersList.map((b) => ({
                value: b.id,
                label: `${b.name} (${b.contactName})`,
              }))}
            />

            <Input
              id="deadline"
              label="Delivery Deadline"
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="fabric-type"
              label="Fabric Specification"
              placeholder="e.g. Cotton Twill 2/1, Poplin 40s"
              required
              value={fabricType}
              onChange={(e) => setFabricType(e.target.value)}
            />

            <Input
              id="colour"
              label="Colour / Shade"
              placeholder="e.g. Bleached White, Navy 402"
              required
              value={colour}
              onChange={(e) => setColour(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <Input
              id="metres"
              label="Target Quantity (Metres)"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 2500"
              required
              value={metres}
              onChange={(e) => setMetres(e.target.value)}
            />

            <Input
              id="rate"
              label="Rate per Metre (₹)"
              type="number"
              min="0.1"
              step="0.1"
              placeholder="e.g. 145"
              required
              value={ratePerMetre}
              onChange={(e) => setRatePerMetre(e.target.value)}
            />

            <div className="flex flex-col gap-1.5 justify-end">
              <span className="text-xs font-medium text-[#78716C]">Estimated Total Value</span>
              <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-lg px-3.5 py-2.5 text-[#1A1714] font-bold text-sm">
                {estimatedTotal > 0 ? formatCurrency(estimatedTotal) : '₹0.00'}
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Yarn Bill of Materials */}
        <Card className="p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1A1714]">2. Yarn Requirements</h2>
              <p className="text-xs text-[#78716C] mt-0.5">
                Specify the yarn types and estimated raw kg needed for spinning/weaving.
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddYarnRow}
              className="text-xs"
            >
              <PlusIcon className="w-3.5 h-3.5 mr-1" />
              Add Yarn Line
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {yarnRows.map((row, idx) => (
              <div
                key={row.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3.5 rounded-xl bg-[#FAFAF8] border border-[#E8E4DF]"
              >
                <div className="sm:col-span-7">
                  <Select
                    id={`yarn-type-${row.id}`}
                    label={`Yarn Material #${idx + 1}`}
                    value={row.yarnTypeId}
                    onChange={(e) => handleYarnChange(row.id, 'yarnTypeId', e.target.value)}
                    options={safeYarnsList.map((y) => ({
                      value: y.id,
                      label: `${y.name} (${y.code}) · Avail: ${y.availableKg ?? 0} kg`,
                    }))}
                  />
                </div>

                <div className="sm:col-span-4">
                  <Input
                    id={`yarn-kg-${row.id}`}
                    label="Required (kg)"
                    type="number"
                    min="1"
                    placeholder="e.g. 350"
                    value={row.requiredKg}
                    onChange={(e) => handleYarnChange(row.id, 'requiredKg', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={yarnRows.length <= 1}
                    onClick={() => handleRemoveYarnRow(row.id)}
                    className="text-[#DC2626] hover:bg-[#FEF2F2] p-2"
                    title="Remove yarn row"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 3. Live Feasibility Preview */}
        <Card className="p-6 flex flex-col gap-4 bg-gradient-to-b from-white to-[#FAFAF8]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-[#EA580C]" />
              <h2 className="text-base font-bold text-[#1A1714]">Live Stock Feasibility</h2>
            </div>

            {checkingFeasibility && (
              <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                <Spinner size="sm" />
                Checking inventory...
              </div>
            )}
          </div>

          {!feasibility && !checkingFeasibility && (
            <p className="text-xs text-[#78716C] italic">
              Enter required yarn kg above to check live raw material availability in the mill store.
            </p>
          )}

          {feasibility && (
            <div className="flex flex-col gap-3">
              {/* Overall status indicator */}
              <div
                className={[
                  'p-4 rounded-xl border flex items-start gap-3',
                  feasibility.isFeasible
                    ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]'
                    : 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]',
                ].join(' ')}
              >
                {feasibility.isFeasible ? (
                  <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-bold">
                    {feasibility.isFeasible
                      ? 'All required yarn is in stock'
                      : 'Raw material shortfall detected'}
                  </p>
                  <p className="text-xs mt-0.5 text-[#78716C]">
                    {feasibility.isFeasible
                      ? 'Production can be started immediately upon order creation.'
                      : 'You can still create this order to lock specifications, but production will be locked until additional yarn is received at the gate.'}
                  </p>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="overflow-x-auto border border-[#E8E4DF] rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAF8] border-b border-[#E8E4DF] text-[#78716C] font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Yarn Material</th>
                      <th className="px-4 py-2.5">Required</th>
                      <th className="px-4 py-2.5">In Stock (Avail)</th>
                      <th className="px-4 py-2.5">Status / Shortfall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DF]/70 text-[#1A1714]">
                    {(feasibility.items ?? []).map((item) => (
                      <tr key={item.yarnTypeId} className="hover:bg-[#FAFAF8]/50">
                        <td className="px-4 py-2.5 font-medium">
                          {item.yarnTypeName}
                          <span className="text-[#78716C] ml-1">({item.yarnTypeCode})</span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold">{item.requiredKg} kg</td>
                        <td className="px-4 py-2.5">{item.availableKg} kg</td>
                        <td className="px-4 py-2.5">
                          {item.isSufficient ? (
                            <Badge variant="success" label="Sufficient" dot />
                          ) : (
                            <Badge
                              variant="warning"
                              label={`Short by ${item.shortfallKg} kg`}
                              dot
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => navigate('/orders')}
            disabled={submitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            className="px-8 shadow-xs font-semibold"
          >
            Create Order
          </Button>
        </div>
      </form>
    </div>
  );
}
