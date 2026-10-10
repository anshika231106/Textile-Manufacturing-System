import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
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
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
          Target Customer Order <span className="text-rose-500">*</span>
        </label>
        <select
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2.5 px-3 text-sm text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
          required
        >
          <option value="">-- Choose Order --</option>
          {orders.map((ord) => (
            <option key={ord.id} value={ord.id}>
              {ord.orderNumber} — {ord.buyerName} ({ord.fabricType}, {ord.metres}m)
            </option>
          ))}
        </select>
      </div>

      {/* Selected Order Summary Banner */}
      {selectedOrder && (
        <div className="p-3 bg-[#F5F4F2] rounded-xl border border-[#E8E4DF] text-xs space-y-1 text-[#44403C]">
          <div className="flex justify-between font-medium">
            <span>Fabric Specification:</span>
            <span className="font-semibold text-[#1A1714]">{selectedOrder.fabricType}</span>
          </div>
          <div className="flex justify-between">
            <span>Colour:</span>
            <span className="text-[#1A1714] font-medium">{selectedOrder.colour}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Order Metres:</span>
            <span className="font-mono text-[#1A1714]">{selectedOrder.metres} m</span>
          </div>
        </div>
      )}

      {/* Metres input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
          Roll Metres Length <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            step="1"
            min="1"
            value={metres}
            onChange={(e) => setMetres(e.target.value)}
            placeholder="e.g. 100"
            className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2.5 pl-3.5 pr-12 text-sm text-[#1A1714] font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            required
          />
          <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-[#78716C]">
            metres
          </span>
        </div>
      </div>

      {/* Machine selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
            Weaving Loom Used <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedWeavingMachineId}
            onChange={(e) => setSelectedWeavingMachineId(e.target.value)}
            className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            required
          >
            {weavingMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} - {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
            Dyeing Vessel Used <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedDyeingMachineId}
            onChange={(e) => setSelectedDyeingMachineId(e.target.value)}
            className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            required
          >
            {dyeingMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} - {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Optional custom roll identifier */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
          Roll Serial No. (Optional / Auto-generated)
        </label>
        <input
          type="text"
          value={rollNoCustom}
          onChange={(e) => setRollNoCustom(e.target.value)}
          placeholder="Leave blank for automatic sequential code (e.g. ROLL-0005)"
          className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
        />
      </div>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E8E4DF]">
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
