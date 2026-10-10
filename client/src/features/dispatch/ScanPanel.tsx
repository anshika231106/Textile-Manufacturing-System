import { useState } from 'react';
import { QrCodeIcon, CameraIcon } from '@heroicons/react/24/outline';

interface ScanPanelProps {
  onScan: (code: string) => void;
}

export function ScanPanel({ onScan }: ScanPanelProps) {
  const [active, setActive] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-[#E8E4DF] bg-[#FBFBFA] p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-[#78716C] mb-2">
        <QrCodeIcon className="w-5 h-5 text-[#EA580C]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1714]">
          Optical Barcode / QR Scanner (P1 Feature)
        </span>
      </div>

      <p className="text-xs text-[#78716C] max-w-md mx-auto">
        Camera scanning interface for automated roll barcode tags. In standard P0 operations, manual entry and one-click selection from the passed rolls queue below are fully supported.
      </p>

      {active ? (
        <div className="mt-3 p-4 bg-slate-900 rounded-lg text-white max-w-sm mx-auto space-y-2">
          <div className="w-full h-32 border-2 border-emerald-400 border-dashed rounded flex items-center justify-center relative overflow-hidden bg-slate-800">
            <div className="absolute inset-x-0 h-0.5 bg-emerald-400 animate-pulse top-1/2" />
            <CameraIcon className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-400">Position roll QR code in viewport or enter code manually below.</p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onScan('ROLL-0001')}
              className="text-xs px-2 py-1 bg-emerald-600 rounded text-white hover:bg-emerald-500 font-mono"
            >
              Simulate Scan: ROLL-0001
            </button>
            <button
              type="button"
              onClick={() => setActive(false)}
              className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300 hover:bg-slate-600"
            >
              Close Camera
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#78716C] hover:text-[#1A1714] bg-white border border-[#E8E4DF] rounded-lg hover:border-[#A8A29E] transition-colors"
        >
          <CameraIcon className="w-4 h-4 text-[#78716C]" />
          Activate Scanner View
        </button>
      )}
    </div>
  );
}
