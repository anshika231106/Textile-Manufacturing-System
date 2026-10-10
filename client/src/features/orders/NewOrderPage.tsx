import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { listBuyers, listYarnTypes, MOCK_BUYERS, MOCK_YARN_TYPES, type Buyer, type YarnType } from '../masters/masters.api';
import { getStockSummary } from '../stock/stock.api';
import { createOrder, checkFeasibility, type FeasibilityResult } from './orders.api';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { Table, type Column } from '../../components/ui/Table';
import { formatCurrency, formatApiDate } from '../../lib/format';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface YarnRow {
  id: string;
  yarnTypeId: string;
  requiredKg: string;
}

export const FABRIC_SPECIFICATIONS = [
  'Cotton Twill 2/1',
  'Cotton Twill Premium',
  'Cotton Poplin 40s',
  'Poly-Cotton Blend Suiting',
  'Pure Linen Slub 60s',
  'Linen Slub Voile',
  'Viscose Rayon Satin',
  'Denim 3/1 Heavy Twill',
  'Oxford Weave Shirting',
  'Canvas Heavy 10oz',
  'Cotton Cambric 60s',
  'Viscose Georgette',
];

export const COLOUR_SHADES = [
  'Bleached White',
  'Optical White',
  'Raw Natural / Off-White',
  'Navy Blue (Navy 402)',
  'Jet Black',
  'Royal Blue',
  'Olive Green',
  'Crimson Red',
  'Charcoal Grey',
  'Khaki Beige',
  'Forest Green',
  'Mustard Yellow',
  'Burgundy / Maroon',
];

export function NewOrderPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Master data initialized with non-null defaults
  const [buyers, setBuyers] = useState<Buyer[]>(MOCK_BUYERS);
  const [yarnTypes, setYarnTypes] = useState<YarnType[]>(MOCK_YARN_TYPES);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Form state
  const [buyerId, setBuyerId] = useState(MOCK_BUYERS[0]?.id ?? '');
  const [selectedFabricPreset, setSelectedFabricPreset] = useState('');
  const [customFabricType, setCustomFabricType] = useState('');
  const [selectedColourPreset, setSelectedColourPreset] = useState('');
  const [customColour, setCustomColour] = useState('');
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

  // Load buyers & yarn types with live stock balances
  useEffect(() => {
    Promise.all([
      listBuyers(),
      listYarnTypes(),
      getStockSummary().catch(() => []),
    ])
      .then(([bList, yList, stockList]) => {
        const safeBuyers = Array.isArray(bList) && bList.length > 0 ? bList : MOCK_BUYERS;
        const safeYarns = Array.isArray(yList) && yList.length > 0 ? yList : MOCK_YARN_TYPES;

        const stockMap = new Map<string, { availableKg: number; onHandKg: number; reservedKg: number }>(
          (Array.isArray(stockList) ? stockList : []).map((s: any) => [
            s.yarnTypeId,
            { availableKg: s.availableKg ?? 0, onHandKg: s.onHandKg ?? 0, reservedKg: s.reservedKg ?? 0 },
          ])
        );

        const enrichedYarns = safeYarns.map((y) => {
          const stock = stockMap.get(y.id);
          return {
            ...y,
            availableKg: stock ? stock.availableKg : (y.availableKg ?? 0),
            onHandKg: stock ? stock.onHandKg : (y.onHandKg ?? 0),
            reservedKg: stock ? stock.reservedKg : (y.reservedKg ?? 0),
          };
        });

        setBuyers(safeBuyers);
        setYarnTypes(enrichedYarns);

        if (safeBuyers.length > 0) setBuyerId(safeBuyers[0].id);
        if (enrichedYarns.length > 0) {
          setYarnRows([{ id: '1', yarnTypeId: enrichedYarns[0].id, requiredKg: '' }]);
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

    const effectiveFabric = (selectedFabricPreset === 'OTHER' ? customFabricType : selectedFabricPreset).trim();
    const effectiveColour = (selectedColourPreset === 'OTHER' ? customColour : selectedColourPreset).trim();

    if (!buyerId) return setFormError('Please select a buyer.');
    if (!effectiveFabric) return setFormError('Please select or specify the fabric specification.');
    if (!effectiveColour) return setFormError('Please select or specify the colour / shade.');
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
        fabricType: effectiveFabric,
        colour: effectiveColour,
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

  const columns: Column<NonNullable<FeasibilityResult['items']>[number]>[] = [
    {
      key: 'yarn',
      header: 'Yarn Material',
      render: (item) => (
        <span className="font-medium">
          {item.yarnTypeName}
          <span className="text-(--color-text-muted) ml-1">({item.yarnTypeCode})</span>
        </span>
      ),
    },
    {
      key: 'required',
      header: 'Required',
      render: (item) => <span className="font-semibold">{item.requiredKg} kg</span>,
    },
    {
      key: 'available',
      header: 'In Stock (Avail)',
      render: (item) => <span>{item.availableKg} kg</span>,
    },
    {
      key: 'status',
      header: 'Status / Shortfall',
      render: (item) =>
        item.isSufficient ? (
          <Badge variant="success" label="Sufficient" dot />
        ) : (
          <Badge variant="warning" label={`Short by ${item.shortfallKg} kg`} dot />
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto page-content pb-12">
      {/* Back & Title */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-(--color-text-muted) hover:text-(--color-accent) mb-3 transition-colors"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Back to Orders
        </button>
        <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">Create New Order</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Configure fabric specs, yarn bill of materials, and preview live stock feasibility.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {/* Error banner */}
        {formError && (
          <Callout tone="danger" title="Unable to create order" icon={ExclamationTriangleIcon}>
            {formError}
          </Callout>
        )}

        {/* 1. Buyer & Basic Information */}
        <Card className="p-6 flex flex-col gap-5">
          <h2 className="text-base font-bold text-(--color-text) border-b border-(--color-border) pb-3">
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
            <div>
              <Select
                id="fabric-type-select"
                label="Fabric Specification"
                required
                placeholder="Select fabric specification..."
                value={selectedFabricPreset}
                onChange={(e) => {
                  setSelectedFabricPreset(e.target.value);
                  if (e.target.value !== 'OTHER') {
                    setCustomFabricType('');
                  }
                }}
                options={[
                  ...FABRIC_SPECIFICATIONS.map((spec) => ({
                    value: spec,
                    label: spec,
                  })),
                  { value: 'OTHER', label: '✏️ Other / Custom Specification...' },
                ]}
              />
              {selectedFabricPreset === 'OTHER' && (
                <div className="mt-2.5">
                  <Input
                    id="custom-fabric-type"
                    label="Custom Fabric Specification"
                    placeholder="e.g. Silk Chiffon 20D, Modal Satin"
                    required
                    value={customFabricType}
                    onChange={(e) => setCustomFabricType(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div>
              <Select
                id="colour-select"
                label="Colour / Shade"
                required
                placeholder="Select colour shade..."
                value={selectedColourPreset}
                onChange={(e) => {
                  setSelectedColourPreset(e.target.value);
                  if (e.target.value !== 'OTHER') {
                    setCustomColour('');
                  }
                }}
                options={[
                  ...COLOUR_SHADES.map((shade) => ({
                    value: shade,
                    label: shade,
                  })),
                  { value: 'OTHER', label: '✏️ Other / Custom Shade...' },
                ]}
              />
              {selectedColourPreset === 'OTHER' && (
                <div className="mt-2.5">
                  <Input
                    id="custom-colour"
                    label="Custom Colour / Shade"
                    placeholder="e.g. Pantone 19-4052 Classic Blue, Rust 802"
                    required
                    value={customColour}
                    onChange={(e) => setCustomColour(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>
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
              <span className="text-xs font-medium text-(--color-text-muted)">Estimated Total Value</span>
              <div
                className={[
                  'rounded-lg px-3.5 py-2.5 font-bold text-sm border transition-colors',
                  estimatedTotal > 0
                    ? 'bg-(--color-accent-light) border-(--color-accent)/20 text-(--color-accent)'
                    : 'bg-(--color-bg) border-(--color-border) text-(--color-text)',
                ].join(' ')}
              >
                {estimatedTotal > 0 ? formatCurrency(estimatedTotal) : '₹0.00'}
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Yarn Bill of Materials */}
        <Card className="p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-(--color-border) pb-3">
            <div>
              <h2 className="text-base font-bold text-(--color-text)">2. Yarn Requirements</h2>
              <p className="text-xs text-(--color-text-muted) mt-0.5">
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
            {yarnRows.map((row, idx) => {
              const selectedYarn = safeYarnsList.find((y) => y.id === row.yarnTypeId);
              const avail = selectedYarn?.availableKg ?? 0;
              const onHand = selectedYarn?.onHandKg ?? 0;

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start p-4 rounded-xl bg-(--color-bg) border border-(--color-border)"
                >
                  <div className="sm:col-span-7">
                    <Select
                      id={`yarn-type-${row.id}`}
                      label={`Yarn Material #${idx + 1}`}
                      value={row.yarnTypeId}
                      onChange={(e) => handleYarnChange(row.id, 'yarnTypeId', e.target.value)}
                      options={safeYarnsList.map((y) => ({
                        value: y.id,
                        label: `${y.code} — ${y.name} [${y.colour}] · Avail: ${(y.availableKg ?? 0).toLocaleString('en-IN')} kg (${(y.onHandKg ?? 0).toLocaleString('en-IN')} kg in store)`,
                      }))}
                    />
                    {selectedYarn && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <span className="text-(--color-text-muted)">Live Stock:</span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            avail <= 0
                              ? 'bg-(--color-danger-light) text-(--color-danger)'
                              : 'bg-(--color-success-light) text-(--color-success-dark)'
                          }`}
                        >
                          {avail.toLocaleString('en-IN')} kg available
                        </span>
                        <span className="text-(--color-text-subtle)">
                          ({onHand.toLocaleString('en-IN')} kg on-hand)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-4">
                    <Input
                      id={`yarn-kg-${row.id}`}
                      label="Required (kg)"
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder={numMetres > 0 ? `e.g. ${Math.round(numMetres * 0.15)}` : 'e.g. 350'}
                      value={row.requiredKg}
                      onChange={(e) => handleYarnChange(row.id, 'requiredKg', e.target.value)}
                      hint={numMetres > 0 ? `~0.15 kg/m is ~${Math.round(numMetres * 0.15)} kg` : undefined}
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end pt-7">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={yarnRows.length <= 1}
                      onClick={() => handleRemoveYarnRow(row.id)}
                      className="text-(--color-danger) hover:bg-(--color-danger-light) p-2"
                      title="Remove yarn row"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 3. Live Feasibility Preview */}
        <Card className="p-6 flex flex-col gap-4 bg-gradient-to-b from-white to-(--color-bg)">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-(--color-accent)" />
              <h2 className="text-base font-bold text-(--color-text)">Live Stock Feasibility</h2>
            </div>

            {checkingFeasibility && (
              <div className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
                <Spinner size="sm" />
                Checking inventory...
              </div>
            )}
          </div>

          {!feasibility && !checkingFeasibility && (
            <p className="text-xs text-(--color-text-muted) italic">
              Enter required yarn kg above to check live raw material availability in the mill store.
            </p>
          )}

          {feasibility && (
            <div className="flex flex-col gap-3">
              <Callout
                tone={feasibility.isFeasible ? 'success' : 'warning'}
                title={
                  feasibility.isFeasible
                    ? 'All required yarn is in stock'
                    : 'Raw material shortfall detected'
                }
              >
                {feasibility.isFeasible
                  ? 'Production can be started immediately upon order creation.'
                  : 'You can still create this order to lock specifications, but production will be locked until additional yarn is received at the gate.'}
              </Callout>

              <Table
                columns={columns}
                rows={feasibility.items ?? []}
                rowKey={(item) => item.yarnTypeId}
                emptyTitle="No yarn lines"
              />
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
