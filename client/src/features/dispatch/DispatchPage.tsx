import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../lib/format';
import { listOrders, type Order } from '../orders/orders.api';
import {
  getFinishedGoods,
  validateRoll,
  confirmDispatch,
  type FinishedGoodItem,
  type ConfirmDispatchResponse,
} from './dispatch.api';
import {
  TruckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export function DispatchPage() {
  const { showToast } = useToast();

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  const [goods, setGoods] = useState<FinishedGoodItem[]>([]);
  const [loadingGoods, setLoadingGoods] = useState(false);

  // Selected rolls for dispatch (array of roll IDs)
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [vehicleNo, setVehicleNo] = useState('');

  // Manual roll code entry
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dispatch success response dialog
  const [dispatchResult, setDispatchResult] = useState<ConfirmDispatchResponse | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Load orders on mount
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoadingOrders(true);
        const allOrders = await listOrders();
        // Only orders with at least one QC-passed roll still waiting to ship. This covers
        // READY orders and partially dispatched ones (client status DISPATCHED) alike.
        const candidateOrders = allOrders.filter((o) => (o.rolls?.passed ?? 0) > 0);
        setOrders(candidateOrders);
        if (candidateOrders.length > 0) {
          setSelectedOrderId(candidateOrders[0].id);
        }
      } catch (err) {
        console.error('Failed to load orders for dispatch:', err);
      } finally {
        setLoadingOrders(false);
      }
    }
    loadInitial();
  }, []);

  // When selectedOrderId changes, load finished goods for that order
  useEffect(() => {
    if (!selectedOrderId) {
      setGoods([]);
      setSelectedRollIds([]);
      return;
    }

    async function loadGoods() {
      try {
        setLoadingGoods(true);
        const items = await getFinishedGoods(selectedOrderId);
        setGoods(items);
        setSelectedRollIds([]); // reset selection when order changes
        setValidationError(null);
      } catch (err) {
        console.error('Failed to load goods:', err);
      } finally {
        setLoadingGoods(false);
      }
    }

    loadGoods();
  }, [selectedOrderId]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Available passed rolls for the order that haven't been dispatched
  const passedRolls = useMemo(() => {
    return goods.filter((g) => g.status === 'PASSED');
  }, [goods]);

  // The actual roll objects currently selected
  const selectedRolls = useMemo(() => {
    return goods.filter((g) => selectedRollIds.includes(g.id));
  }, [goods, selectedRollIds]);

  const totalMetresSelected = selectedRolls.reduce((acc, r) => acc + r.metres, 0);
  const ratePerMetre = selectedOrder?.ratePerMetre || (selectedRolls[0]?.ratePerMetre ?? 150);
  const estimatedInvoiceAmount = totalMetresSelected * ratePerMetre;

  // Toggle selection of a roll
  const toggleRollSelection = (rollId: string) => {
    setValidationError(null);
    setSelectedRollIds((prev) =>
      prev.includes(rollId) ? prev.filter((id) => id !== rollId) : [...prev, rollId]
    );
  };

  // Add roll via manual code or scanned code
  const handleAddCode = async (codeToAdd?: string) => {
    const raw = codeToAdd || manualCodeInput;
    const code = raw.trim().toUpperCase();
    if (!code) return;

    setValidationError(null);
    setValidatingCode(true);

    try {
      const res = await validateRoll(code, selectedOrderId);

      if (!res.valid) {
        setValidationError(res.errorMessage || 'Invalid roll code.');
        showToast(res.errorMessage || 'Invalid roll code', 'error');
        return;
      }

      if (!res.roll) {
        setValidationError('Roll not found.');
        return;
      }

      const matchedRoll = res.roll;

      // Check client-side dedup
      if (selectedRollIds.includes(matchedRoll.id)) {
        setValidationError(`Roll "${matchedRoll.rollNo}" is already added to the dispatch selection.`);
        showToast(`Roll ${matchedRoll.rollNo} already selected`, 'info');
        return;
      }

      // If roll belongs to order but wasn't in goods array, add it to goods list
      if (!goods.some((g) => g.id === matchedRoll.id)) {
        setGoods((prev) => [matchedRoll, ...prev]);
      }

      setSelectedRollIds((prev) => [...prev, matchedRoll.id]);
      setManualCodeInput('');
      showToast(`Added ${matchedRoll.rollNo} (${matchedRoll.metres}m) to dispatch`, 'success');
    } catch (err: any) {
      setValidationError(err.message || 'Validation error.');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!selectedOrderId) {
      showToast('Please select a target customer order', 'error');
      return;
    }

    if (selectedRollIds.length === 0) {
      showToast('Please select at least one passed fabric roll to dispatch', 'error');
      return;
    }

    try {
      setConfirming(true);
      const res = await confirmDispatch({
        orderId: selectedOrderId,
        rollIds: selectedRollIds,
        vehicleNo: vehicleNo.trim() || undefined,
      });

      setDispatchResult(res);
      showToast(`Dispatch ${res.dispatch.dispatchNo} recorded! Invoice ${res.invoice.invoiceNo} generated.`, 'success');

      // Refresh finished goods for this order
      const updatedGoods = await getFinishedGoods(selectedOrderId);
      setGoods(updatedGoods);
      setSelectedRollIds([]);
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm dispatch', 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Finished Goods Dispatch
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Plant Gate
            </span>
          </div>
          <p className="text-sm text-(--color-text-muted) mt-1">
            Verify passed rolls, assign logistics details, and generate sales invoices upon dispatch confirmation.
          </p>
        </div>

        <Link to="/invoices">
          <Button variant="secondary" size="sm" className="text-xs">
            <DocumentTextIcon className="w-4 h-4" />
            View Invoices Table
          </Button>
        </Link>
      </div>

      {loadingOrders ? (
        <div className="flex flex-col items-center justify-center py-24 text-(--color-text-muted)">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading customer orders & dispatch gate...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Selection & Roll Verification */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Order Selector Card */}
            <div className="bg-white rounded-2xl border border-(--color-border) p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-(--color-surface-sunken)">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-(--color-accent) text-white flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <h2 className="text-sm font-semibold text-(--color-text)">
                    Select Target Customer Order
                  </h2>
                </div>
                <span className="text-xs text-(--color-text-muted)">
                  {orders.length} orders eligible
                </span>
              </div>

              <SearchableSelect
                value={selectedOrderId}
                onChange={setSelectedOrderId}
                options={orders.map((ord) => ({
                  value: ord.id,
                  label: `${ord.orderNumber} — ${ord.buyerName} (${ord.fabricType}, ${ord.metres}m)`,
                }))}
                className="font-medium"
                searchPlaceholder="Search by order no, buyer or fabric…"
              />

              {orders.length === 0 && (
                <Callout tone="neutral">
                  No orders are ready for dispatch. An order appears here once at least one of its rolls
                  has passed QC and has not been dispatched yet.
                </Callout>
              )}

              {selectedOrder && (
                <Callout tone="warning">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold text-sm font-mono text-(--color-text)">
                      {selectedOrder.orderNumber}
                    </span>
                    <Badge variant="info" label={selectedOrder.status} />
                  </div>
                  <div className="text-(--color-text-dark)">
                    <strong>Buyer:</strong> {selectedOrder.buyerName} {selectedOrder.buyerPhone ? `(${selectedOrder.buyerPhone})` : ''}
                  </div>
                  <div className="text-(--color-text-dark)">
                    <strong>Fabric Spec:</strong> {selectedOrder.fabricType} • {selectedOrder.colour}
                  </div>
                  <div className="pt-1.5 mt-1.5 flex justify-between border-t border-amber-200/50">
                    <span>Contract Rate: <strong className="text-(--color-text) font-mono">₹{selectedOrder.ratePerMetre}/m</strong></span>
                    <span>Order Metres: <strong className="text-(--color-text) font-mono">{selectedOrder.metres} m</strong></span>
                  </div>
                </Callout>
              )}
            </div>

            {/* Step 2: Roll Selection & Validation */}
            <div className="bg-white rounded-2xl border border-(--color-border) p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-(--color-surface-sunken)">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-(--color-accent) text-white flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <h2 className="text-sm font-semibold text-(--color-text)">
                    Select Passed Rolls for Dispatch
                  </h2>
                </div>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {passedRolls.length} rolls passed QC
                </span>
              </div>

              {/* Manual Roll Code Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Manual Roll Code Entry / Barcode Scanner Input
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => {
                      setManualCodeInput(e.target.value);
                      setValidationError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCode();
                      }
                    }}
                    placeholder="e.g. ROLL-0001, ROLL-0005..."
                    className="flex-1 rounded-lg border border-(--color-border) bg-white py-2 px-3 text-xs text-(--color-text) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={validatingCode}
                    onClick={() => handleAddCode()}
                    className="text-xs"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add Roll
                  </Button>
                </div>

                {/* Validation error notice */}
                {validationError && (
                  <Callout tone="danger" icon={ExclamationCircleIcon}>
                    {validationError}
                  </Callout>
                )}
              </div>

              {/* Passed Rolls Queue for this order */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Available Rolls in Quality Passed Warehouse
                </label>

                {loadingGoods ? (
                  <div className="p-8 text-center text-xs text-(--color-text-muted)">
                    <Spinner size="sm" />
                    <p className="mt-2">Checking warehouse stock...</p>
                  </div>
                ) : passedRolls.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-xs text-(--color-text-muted) space-y-1.5">
                    <p className="font-semibold text-(--color-text-dark)">No passed rolls available for this order.</p>
                    <p className="text-[11px] text-(--color-text-subtle)">
                      Rolls must complete weaving & dyeing and receive a PASS verdict in Quality Control before dispatch.
                    </p>
                    <Link to="/qc" className="inline-block mt-1">
                      <Button size="sm" variant="secondary" className="text-xs">
                        Open QC Queue
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="border border-(--color-border) rounded-xl overflow-hidden divide-y divide-(--color-surface-sunken)">
                    {passedRolls.map((roll) => {
                      const isSelected = selectedRollIds.includes(roll.id);

                      return (
                        <div
                          key={roll.id}
                          onClick={() => toggleRollSelection(roll.id)}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-50/70 text-(--color-text)'
                              : 'bg-white hover:bg-(--color-surface-alt)'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                              className="rounded text-(--color-accent) focus:ring-(--color-accent) h-4 w-4"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-(--color-text)">
                                <span>{roll.rollNo}</span>
                                <Link
                                  to={`/rolls/${roll.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title="View Roll Trace"
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                              <div className="text-[11px] text-(--color-text-muted)">
                                {roll.fabricType} ({roll.colour})
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-(--color-text)">
                              {roll.metres} <span className="text-xs font-sans font-normal text-(--color-text-muted)">m</span>
                            </span>
                            <Badge variant="success" label="PASSED" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Dispatch Manifest & Summary */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-5 sticky top-6">
            <div className="flex items-center justify-between pb-3 border-b border-(--color-surface-sunken)">
              <div className="flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-(--color-accent)" />
                <h2 className="text-base font-semibold text-(--color-text)">
                  Dispatch Manifest
                </h2>
              </div>
              <span className="text-xs font-mono font-semibold text-(--color-text-muted)">
                {selectedRollIds.length} rolls queued
              </span>
            </div>

            {/* Transport details */}
            <Input
              label="Vehicle / Transport Ref"
              type="text"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              placeholder="e.g. MH-12-AB-1234 or Courier Airway Bill"
              className="font-mono text-xs"
            />

            {/* Selected Rolls Breakdown List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-(--color-text-muted)">
                <span>Selected Items:</span>
                {selectedRollIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRollIds([])}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {selectedRolls.length === 0 ? (
                <div className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-xs text-(--color-text-muted)">
                  No rolls selected yet. Pick rolls from the left panel to load the dispatch vehicle.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {selectedRolls.map((roll) => (
                    <div
                      key={roll.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-(--color-surface-sunken) text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-(--color-text)">{roll.rollNo}</span>
                        <span className="ml-2 text-(--color-text-muted)">{roll.fabricType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-(--color-text)">{roll.metres} m</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRollSelection(roll.id);
                          }}
                          className="text-(--color-text-muted) hover:text-rose-600 p-0.5"
                          title="Remove roll"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Invoice Estimate Calculation */}
            <div className="p-4 bg-gradient-to-br from-(--color-surface) to-(--color-accent-light)/40 rounded-xl border border-(--color-border) space-y-2 text-xs">
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Total Dispatched Rolls:</span>
                <span className="font-mono font-bold text-(--color-text)">{selectedRolls.length}</span>
              </div>
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Total Dispatched Length:</span>
                <span className="font-mono font-bold text-(--color-text)">{totalMetresSelected.toLocaleString()} metres</span>
              </div>
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Selling Rate / Metre:</span>
                <span className="font-mono font-bold text-(--color-text)">₹{ratePerMetre}</span>
              </div>
              <div className="pt-2 border-t border-(--color-border) flex justify-between items-center text-sm">
                <span className="font-semibold text-(--color-text)">Estimated Invoice Total:</span>
                <span className="font-mono font-bold text-base text-(--color-accent)">
                  {formatCurrency(estimatedInvoiceAmount)}
                </span>
              </div>
            </div>

            {/* Action button */}
            <Button
              variant="primary"
              loading={confirming}
              disabled={selectedRollIds.length === 0}
              onClick={handleConfirmDispatch}
              className="w-full py-3 text-sm shadow-xs"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Confirm Dispatch & Generate Invoice
            </Button>
          </div>
        </div>
      )}

      {/* Dispatch Success & Invoice Modal */}
      <Dialog
        open={!!dispatchResult}
        onClose={() => setDispatchResult(null)}
        title="Dispatch Confirmed & Invoice Issued"
      >
        {dispatchResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-950">
                Goods Gate Pass Created!
              </h3>
              <p className="text-xs text-emerald-800">
                Dispatch Ref: <strong className="font-mono">{dispatchResult.dispatch.dispatchNo}</strong>
              </p>
            </div>

            <div className="bg-(--color-surface-sunken) rounded-xl p-4 space-y-2 text-xs border border-(--color-border)">
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Invoice Number:</span>
                <span className="font-mono font-bold text-(--color-text)">{dispatchResult.invoice.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Customer / Buyer:</span>
                <span className="font-semibold text-(--color-text)">{dispatchResult.invoice.buyerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Quantity:</span>
                <span className="font-mono font-medium text-(--color-text)">
                  {dispatchResult.dispatch.rollCount} rolls ({dispatchResult.dispatch.totalMetres} metres)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Vehicle No:</span>
                <span className="font-mono text-(--color-text)">{dispatchResult.dispatch.vehicleNo || 'Self Pick-up'}</span>
              </div>
              <div className="pt-2 border-t border-(--color-border) flex justify-between font-bold text-sm text-(--color-text)">
                <span>Total Amount Billed:</span>
                <span className="font-mono text-(--color-accent)">{formatCurrency(dispatchResult.invoice.amount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-(--color-border)">
              <Button
                variant="secondary"
                onClick={() => setDispatchResult(null)}
              >
                Close
              </Button>
              <Link to={`/invoices/${dispatchResult.invoice.id}`}>
                <Button variant="primary" className="shadow-xs">
                  <DocumentTextIcon className="w-4 h-4" />
                  View Invoice & Record Payment
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
