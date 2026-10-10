import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Callout } from '../../components/ui/Callout';
import { listOrders, type Order } from '../orders/orders.api';
import { getBoard, type FloorMachine } from '../floor/floor.api';
import { createRoll, type QcRollItem } from './qc.api';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

interface CreateRollFormProps {
  onRollCreated: (roll: QcRollItem) => void;
  onCancel?: () => void;
}

export function CreateRollForm({ onRollCreated, onCancel }: CreateRollFormProps) {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [weavingMachines, setWeavingMachines] = useState<FloorMachine[]>([]);
  const [dyeingMachines, setDyeingMachines] = useState<FloorMachine[]>([]);

  // Form states
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [metres, setMetres] = useState('100');
  const [selectedWeavingMachineId, setSelectedWeavingMachineId] = useState('');
  const [selectedDyeingMachineId, setSelectedDyeingMachineId] = useState('');
  const [rollNoCustom, setRollNoCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadFormDeps() {
      try {
        const [ordersList, boardData] = await Promise.all([
          listOrders(),
          getBoard(),
        ]);

        const activeOrders = ordersList.filter(
          (o) => o.status !== 'CANCELLED' && o.status !== 'DISPATCHED'
        );
        setOrders(activeOrders);
        if (activeOrders.length > 0) {
          setSelectedOrderId(activeOrders[0].id);
        }

        const looms = boardData.machines.filter((m) => m.stage === 'WEAVING');
        const vats = boardData.machines.filter((m) => m.stage === 'DYEING');
        setWeavingMachines(looms);
        setDyeingMachines(vats);

        if (looms.length > 0) setSelectedWeavingMachineId(looms[0].id);
        if (vats.length > 0) setSelectedDyeingMachineId(vats[0].id);
      } catch (err) {
        console.error('Error loading roll form dependencies:', err);
      }
    }

    loadFormDeps();
  }, []);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrderId) {
      showToast('Please select an order for this fabric roll', 'error');
      return;
    }

    const metresNum = parseFloat(metres);
    if (isNaN(metresNum) || metresNum <= 0) {
      showToast('Please enter valid positive metres length', 'error');
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
        orderId: selectedOrderId,
        metres: metresNum,
        weavingMachineId: selectedWeavingMachineId,
        dyeingMachineId: selectedDyeingMachineId,
        rollNo: rollNoCustom.trim() || undefined,
      });

      showToast(`Roll ${newRoll.rollNo} (${metresNum}m) registered for QC inspection`, 'success');
      onRollCreated(newRoll);
    } catch (err: any) {
      showToast(err.message || 'Failed to create fabric roll', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Order selector */}
      <Select
        label="Target Customer Order"
        required
        value={selectedOrderId}
        onChange={(e) => setSelectedOrderId(e.target.value)}
        placeholder="-- Choose Order --"
        options={orders.map((ord) => ({
          value: ord.id,
          label: `${ord.orderNumber} — ${ord.buyerName} (${ord.fabricType}, ${ord.metres}m)`,
        }))}
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
          <div className="flex justify-between">
            <span>Total Order Metres:</span>
            <span className="font-mono text-(--color-text)">{selectedOrder.metres} m</span>
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
          options={weavingMachines.map((m) => ({ value: m.id, label: `${m.code} - ${m.name}` }))}
        />

        <Select
          label="Dyeing Vessel Used"
          required
          value={selectedDyeingMachineId}
          onChange={(e) => setSelectedDyeingMachineId(e.target.value)}
          options={dyeingMachines.map((m) => ({ value: m.id, label: `${m.code} - ${m.name}` }))}
        />
      </div>

      {/* Optional custom roll identifier */}
      <Input
        label="Roll Serial No. (Optional / Auto-generated)"
        type="text"
        value={rollNoCustom}
        onChange={(e) => setRollNoCustom(e.target.value)}
        placeholder="Leave blank for automatic sequential code (e.g. ROLL-0005)"
        className="font-mono"
      />

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
