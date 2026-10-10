import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { getRollTrace, type RollTraceData } from './rolls.api';
import { formatDate } from '../../lib/format';
import {
  PrinterIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  TagIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

/**
 * Deterministic SVG Barcode renderer (Code-128 visual style)
 */
function VisualBarcode({ value }: { value: string }) {
  // Generate high-density bar pattern deterministically from the string
  const chars = value.split('');
  const barPattern: number[] = [2, 1, 1, 2]; // Start pattern
  chars.forEach((char, idx) => {
    const code = char.charCodeAt(0) + idx * 7;
    barPattern.push((code % 3) + 1, ((code >> 2) % 2) + 1, ((code >> 4) % 3) + 1, ((code >> 1) % 2) + 1);
  });
  barPattern.push(2, 3, 1, 2); // Stop pattern

  let currentX = 10;
  const rects: { x: number; width: number }[] = [];
  barPattern.forEach((width, i) => {
    if (i % 2 === 0) {
      rects.push({ x: currentX, width: width * 1.5 });
    }
    currentX += width * 1.5;
  });

  const totalWidth = currentX + 10;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} 48`}
        className="w-full h-12 max-w-[280px]"
        preserveAspectRatio="none"
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y="0" width={r.width} height="48" fill="#000000" />
        ))}
      </svg>
      <span className="font-mono text-xs tracking-widest text-slate-800 font-bold mt-1">
        *{value.toUpperCase()}*
      </span>
    </div>
  );
}

/**
 * 21x21 QR Code visual matrix (Version 1 / Micro-QR visual format)
 */
function VisualQrCode({ value }: { value: string }) {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder pattern helper (7x7 with 3x3 center)
  const drawFinder = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (
          x === 0 || x === 6 || y === 0 || y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4)
        ) {
          grid[startY + y][startX + x] = true;
        }
      }
    }
  };

  // Top-left, Top-right, Bottom-left finder patterns
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (i % 2 === 0) {
      grid[6][i] = true;
      grid[i][6] = true;
    }
  }

  // Populate data modules pseudo-randomly based on string hash
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Don't overwrite finders or timing lines
      const inFinder =
        (x < 8 && y < 8) ||
        (x >= size - 8 && y < 8) ||
        (x < 8 && y >= size - 8) ||
        x === 6 || y === 6;

      if (!inFinder) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        grid[y][x] = (seed % 100) < 48;
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-24 h-24 bg-white p-1 border border-slate-300">
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#000000" /> : null
        )
      )}
    </svg>
  );
}

export function RollLabelPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<RollTraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getRollTrace(id)
      .then((res) => setData(res))
      .catch((err) => {
        console.error('Failed to load roll for label:', err);
        setError(err.message || `Roll "${id}" not found.`);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 font-medium">Generating thermal printable sticker tag...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <Callout tone="danger" title="Roll Label Error">
          {error || 'Unable to load roll details for printing.'}
        </Callout>
      </div>
    );
  }

  const { roll, order, qcHistory } = data;
  const latestQc = qcHistory[qcHistory.length - 1];
  const isPassed = roll.status === 'PASSED' || roll.status === 'DISPATCHED' || latestQc?.result === 'PASS';

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Top Action Bar (Hidden during print) */}
      <div className="print:hidden flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/rolls/${roll.id}`)}>
            <ArrowLeftIcon className="w-4 h-4 mr-1" /> View Trace
          </Button>
          <span className="text-xs text-slate-400">|</span>
          <h1 className="text-base font-bold text-slate-800">Printable Fabric Roll Tag</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-1.5" /> Print Label
          </Button>
        </div>
      </div>

      {/* Printer Notice (Hidden during print) */}
      <div className="print:hidden bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Formatted for standard 4" × 6" (100mm × 150mm) thermal label printers and industrial adhesive stickers.</span>
        </div>
        <span className="font-semibold text-blue-900">Ready</span>
      </div>

      {/* --- PRINTABLE STICKER LABEL CONTAINER --- */}
      <div
        id="printable-roll-label"
        className="bg-white border-2 border-black rounded-lg p-5 shadow-md print:shadow-none print:border-2 print:border-black print:p-4 print:m-0 print:w-[100mm] print:h-[150mm] mx-auto max-w-[420px] font-sans text-black relative select-none"
      >
        {/* Header Branding */}
        <div className="border-b-2 border-black pb-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <BuildingOffice2Icon className="w-5 h-5 text-black" />
            <span className="font-extrabold tracking-wider text-sm uppercase">EVEREST TEXTILE MILLS</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-700 font-semibold mt-0.5">
            QUALITY ASSURED FABRIC TAG • LOT IDENTIFIER
          </div>
        </div>

        {/* Big Roll Serial Number */}
        <div className="py-3 border-b-2 border-black flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">ROLL SERIAL NO.</div>
            <div className="text-3xl font-black font-mono tracking-tight text-black">{roll.rollNo}</div>
          </div>

          {/* QR Code */}
          <div className="text-right">
            <VisualQrCode value={roll.rollNo} />
          </div>
        </div>

        {/* Key Product Details Grid */}
        <div className="py-2.5 border-b-2 border-black grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-600 block uppercase">ORDER NUMBER</span>
            <span className="font-mono font-bold text-sm text-black">{order.orderNo}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-600 block uppercase">CUSTOMER / BUYER</span>
            <span className="font-bold text-xs truncate block text-black">{order.buyer.name}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-600 block uppercase">FABRIC SPECIFICATION</span>
            <span className="font-bold text-xs block text-black">{order.fabricType}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-600 block uppercase">COLOUR / SHADE</span>
            <span className="font-bold text-xs block text-black">{order.colour}</span>
          </div>
        </div>

        {/* Roll Metres & QC Grade (The Big Highlight) */}
        <div className="py-3 border-b-2 border-black grid grid-cols-2 gap-2 items-center bg-slate-50/70 p-2 my-2 rounded">
          <div className="border-r border-black pr-2">
            <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wider">NET LENGTH</span>
            <div className="text-3xl font-black font-mono leading-none text-black">
              {roll.metres} <span className="text-base font-bold">METRES</span>
            </div>
          </div>

          <div className="text-center pl-2">
            <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wider mb-1">QC GRADE</span>
            <div className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 border-2 font-black text-xs sm:text-[13px] uppercase rounded whitespace-nowrap tracking-tight ${isPassed ? 'border-black bg-black text-white' : 'border-black text-black'}`}>
              <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{isPassed ? 'PASSED (GRADE A)' : roll.status}</span>
            </div>
          </div>
        </div>

        {/* Machine & Inspector Footnotes */}
        <div className="text-[10px] space-y-1 py-1.5 border-b border-black font-mono">
          <div className="flex justify-between">
            <span className="text-slate-600">WEAVING LOOM:</span>
            <span className="font-bold text-black">{roll.weavingMachine.code} ({roll.weavingMachine.name})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">DYEING VAT:</span>
            <span className="font-bold text-black">{roll.dyeingMachine.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">TAG CREATED ON:</span>
            <span className="font-bold text-black">{formatDate(roll.createdAt)}</span>
          </div>
          {latestQc && (
            <div className="flex justify-between">
              <span className="text-slate-600">QC INSPECTOR:</span>
              <span className="font-bold text-black">{latestQc.inspector.name}</span>
            </div>
          )}
        </div>

        {/* 1D Barcode Footer */}
        <div className="pt-3 text-center">
          <VisualBarcode value={roll.rollNo} />
        </div>
      </div>

      {/* Print CSS Injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-roll-label, #printable-roll-label * {
            visibility: visible;
          }
          #printable-roll-label {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            border-width: 2px !important;
          }
          @page {
            size: auto;
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  );
}
