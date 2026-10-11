import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Callout } from '../../components/ui/Callout';
import { createRoll, listRollableOrders, type QcRollItem, type RollableOrder } from './qc.api';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

interface CreateRollFormProps {
  onRollCreated: (roll: QcRollItem) => void;
  onCancel?: () => void;
}

export function CreateRollForm({ onRollCreated, onCancel }: CreateRollFormProps) {
  const { showToast } = useToast();

  // Only orders that finished spinning, weaving and dyeing and still have dyed metres to roll
  const [orders, setOrders] = useState<RollableOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Form states
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [metres, setMetres] = useState('100');
  const [selectedWeavingMachineId, setSelectedWeavingMachineId] = useState('');
  const [selectedDyeingMachineId, setSelectedDyeingMachineId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const selectOrder = (order: RollableOrder | undefined) => {
    setSelectedOrderId(order?.id ?? '');
    setSelectedWeavingMachineId(order?.weavingMachines[0]?.id ?? '');
    setSelectedDyeingMachineId(order?.dyeingMachines[0]?.id ?? '');
    if (order) setMetres(String(Math.min(100, order.remainingMetres)));
  };

  useEffect(() => {
    async function loadRollableOrders() {
      try {
        const list = await listRollableOrders();
        setOrders(list);
        selectOrder(list[0]);
      } catch (err: any) {
        showToast(err.message || 'Failed to load orders ready for rolling', 'error');
      } finally {
        setLoadingOrders(false);
      }
    }

    loadRollableOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrder) {
      showToast('Please select an order for this fabric roll', 'error');
      return;
    }

    const metresNum = parseFloat(metres);
    if (isNaN(metresNum) || metresNum <= 0) {
      showToast('Please enter valid positive metres length', 'error');
      return;
    }

    if (metresNum > selectedOrder.remainingMetres) {
      showToast(`Only ${selectedOrder.remainingMetres} m of dyed fabric is left to roll for this order`, 'error');
      return;
    }

    if (!selectedWeavingMachineId) {
      showToast('Please select the weaving loom used', 'error');
      return;
    }

    if (!selectedDyeingMachineId) {
      showToast('Please select the dyeing vessel used', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const newRoll = await createRoll({
        orderId: selectedOrder.id,
        metres: metresNum,
        weavingMachineId: selectedWeavingMachineId,
        dyeingMachineId: selectedDyeingMachineId,
      });

      showToast(`Roll ${newRoll.rollNo} (${metresNum}m) registered for QC inspection`, 'success');
      onRollCreated(newRoll);
    } catch (err: any) {
      showToast(err.message || 'Failed to create fabric roll', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loadingOrders && orders.length === 0) {
    return (
      <div className="space-y-4">
        <Callout tone="neutral">
          No orders are ready for rolling. An order appears here once its spinning, weaving and dyeing
          jobs are all completed and it still has dyed metres that have not been rolled.
        </Callout>
        {onCancel && (
          <div className="flex justify-end pt-3 border-t border-(--color-border)">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Close
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Order selector */}
      <SearchableSelect
        label="Target Customer Order"
        required
        value={selectedOrderId}
        onChange={(orderId) => selectOrder(orders.find((o) => o.id === orderId))}
        placeholder={loadingOrders ? 'Loading orders…' : '-- Choose Order --'}
        options={orders.map((ord) => ({
          value: ord.id,
          label: `${ord.orderNumber} — ${ord.buyerName} (${ord.fabricType}, ${ord.metres}m)`,
        }))}
        searchPlaceholder="Search by order no, buyer or fabric…"
      />

      {/* Selected Order Summary Banner */}
      {selectedOrder && (
        <Callout tone="neutral">
          <div className="flex justify-between font-medium mb-1">
            <span>Fabric Specification:</span>
            <span className="font-semibold text-(--color-text)">{selectedOrder.fabricType}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Colour:</span>
            <span className="text-(--color-text) font-medium">{selectedOrder.colour}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Total Order Metres:</span>
            <span className="font-mono text-(--color-text)">{selectedOrder.metres} m</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Dyed / Already Rolled:</span>
            <span className="font-mono text-(--color-text)">
              {selectedOrder.dyeingOutput} m / {selectedOrder.alreadyRolled} m
            </span>
          </div>
          <div className="flex justify-between">
            <span>Left to Roll:</span>
            <span className="font-mono font-semibold text-(--color-text)">{selectedOrder.remainingMetres} m</span>
          </div>
        </Callout>
      )}

      {/* Metres input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
          Roll Metres Length <span className="text-(--color-danger)">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            step="1"
            min="1"
            max={selectedOrder?.remainingMetres}
            value={metres}
            onChange={(e) => setMetres(e.target.value)}
            placeholder="e.g. 100"
            className="w-full rounded-lg border border-(--color-border) bg-white py-2.5 pl-3.5 pr-12 text-sm text-(--color-text) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
            required
          />
          <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-(--color-text-muted)">
            metres
          </span>
        </div>
      </div>

      {/* Machine selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Select
          label="Weaving Loom Used"
          required
          value={selectedWeavingMachineId}
          onChange={(e) => setSelectedWeavingMachineId(e.target.value)}
          options={(selectedOrder?.weavingMachines ?? []).map((m) => ({ value: m.id, label: `${m.code} - ${m.name}` }))}
        />

        <Select
          label="Dyeing Vessel Used"
          required
          value={selectedDyeingMachineId}
          onChange={(e) => setSelectedDyeingMachineId(e.target.value)}
          options={(selectedOrder?.dyeingMachines ?? []).map((m) => ({ value: m.id, label: `${m.code} - ${m.name}` }))}
        />
      </div>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-(--color-border)">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="shadow-xs"
        >
          <PlusCircleIcon className="w-4 h-4" />
          Create Roll for QC Queue
        </Button>
      </div>
    </form>
  );
}
