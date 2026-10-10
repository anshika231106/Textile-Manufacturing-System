import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { formatCurrency, formatApiMonth } from '../../lib/format';
import { getMonthEnd, type MonthEndReport } from './reports.api';
import {
  ChartBarIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ShoppingBagIcon,
  UsersIcon,
  CpuChipIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';

export function MonthEndPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(formatApiMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MonthEndReport | null>(null);

  const loadReport = async (monthStr: string) => {
    try {
      setLoading(true);
      const data = await getMonthEnd(monthStr);
      setReport(data);
    } catch (err) {
      console.error('Failed to load month-end report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(selectedMonth);
  }, [selectedMonth]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E4DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">
              Month-End Financial & Operating Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Executive P&L
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-1">
            Authoritative statement of raw purchases, staff payroll, billing, cash flow, and plant unit operating margins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#78716C]">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-3 text-xs font-semibold text-[#1A1714] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadReport(selectedMonth)}
            className="text-xs"
          >
            <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="text-xs"
          >
            Print P&L
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#78716C]">
          <Spinner size="lg" />
          <p className="text-sm mt-3 font-medium">Aggregating month-end ledgers for {selectedMonth}...</p>
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-sm text-[#78716C]">
          Unable to generate month-end report for {selectedMonth}.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Executive Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Purchases */}
            <div className="bg-white rounded-xl border border-[#E8E4DF] p-4.5 shadow-2xs">
              <div className="flex items-center justify-between text-[#78716C] mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Raw Purchases</span>
                <ShoppingBagIcon className="w-4 h-4 text-[#A8A29E]" />
              </div>
              <div className="text-xl font-bold font-mono text-[#1A1714]">
                {formatCurrency(report.purchases)}
              </div>
              <div className="text-[11px] text-[#78716C] mt-1">Yarn receipts cost</div>
            </div>

            {/* Wages */}
            <div className="bg-white rounded-xl border border-[#E8E4DF] p-4.5 shadow-2xs">
              <div className="flex items-center justify-between text-[#78716C] mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Staff Wages</span>
                <UsersIcon className="w-4 h-4 text-[#A8A29E]" />
              </div>
              <div className="text-xl font-bold font-mono text-[#1A1714]">
                {formatCurrency(report.wages)}
              </div>
              <div className="text-[11px] text-[#78716C] mt-1">Floor shift payroll</div>
            </div>

            {/* Invoiced */}
            <div className="bg-white rounded-xl border border-[#E8E4DF] p-4.5 shadow-2xs">
              <div className="flex items-center justify-between text-[#78716C] mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Gross Invoiced</span>
                <ReceiptPercentIcon className="w-4 h-4 text-[#A8A29E]" />
              </div>
              <div className="text-xl font-bold font-mono text-[#1A1714]">
                {formatCurrency(report.invoiced)}
              </div>
              <div className="text-[11px] text-[#78716C] mt-1">Sales billing issued</div>
            </div>

            {/* Payments Received */}
            <div className="bg-white rounded-xl border border-blue-200 p-4.5 shadow-2xs bg-blue-50/20">
              <div className="flex items-center justify-between text-blue-800 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Payments In</span>
                <BanknotesIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-bold font-mono text-blue-900">
                {formatCurrency(report.paymentsReceived)}
              </div>
              <div className="text-[11px] text-blue-700 mt-1 font-medium">Bank receipts cash</div>
            </div>

            {/* Gross Profit */}
            <div className={`rounded-xl border p-4.5 shadow-2xs ${
              report.profit >= 0
                ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                : 'border-rose-200 bg-rose-50/40 text-rose-950'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Operating Profit</span>
                <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-600" />
              </div>
              <div className={`text-xl font-bold font-mono ${
                report.profit >= 0 ? 'text-emerald-900' : 'text-rose-900'
              }`}>
                {formatCurrency(report.profit)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                Invoiced - (Yarn + Wages)
              </div>
            </div>
          </div>

          {/* TABLE 1: Cost & Margin Per Order */}
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F4F2]">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-[#EA580C]" />
                <h2 className="text-base font-semibold text-[#1A1714]">
                  Cost & Margin Analysis Per Order
                </h2>
              </div>
              <span className="text-xs text-[#78716C]">
                {report.costPerOrder.length} processed orders
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E4DF] bg-[#FBFBFA] text-[#78716C] font-semibold">
                    <th className="py-3 px-3">Order Number</th>
                    <th className="py-3 px-3">Buyer / Fabric</th>
                    <th className="py-3 px-3 text-right">Metres</th>
                    <th className="py-3 px-3 text-right">Yarn Cost</th>
                    <th className="py-3 px-3 text-right">Machine Cost</th>
                    <th className="py-3 px-3 text-right">Invoiced Amount</th>
                    <th className="py-3 px-3 text-right">Gross Margin</th>
                    <th className="py-3 px-3 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F4F2]">
                  {report.costPerOrder.map((row) => (
                    <tr key={row.orderId} className="hover:bg-[#FBFBFA] transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#1A1714]">
                        {row.orderNumber}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#1A1714]">{row.buyerName}</div>
                        <div className="text-[11px] text-[#78716C]">{row.fabricType}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-[#1A1714]">
                        {row.metres.toLocaleString()} m
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-[#78716C]">
                        {formatCurrency(row.yarnCost)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-[#78716C]">
                        {formatCurrency(row.machineCost)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-[#1A1714]">
                        {formatCurrency(row.invoicedAmount)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                        {formatCurrency(row.marginAmount)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {row.marginPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2: Output Metres Per Machine */}
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F4F2]">
              <div className="flex items-center gap-2">
                <CpuChipIcon className="w-5 h-5 text-[#78716C]" />
                <h2 className="text-base font-semibold text-[#1A1714]">
                  Production Output & Machine Utilization
                </h2>
              </div>
              <span className="text-xs text-[#78716C]">
                {report.metresPerMachine.length} machine units recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E4DF] bg-[#FBFBFA] text-[#78716C] font-semibold">
                    <th className="py-3 px-3">Machine Code</th>
                    <th className="py-3 px-3">Machine Name</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-3 text-right">Operating Hours</th>
                    <th className="py-3 px-3 text-right">Metres Produced</th>
                    <th className="py-3 px-3 text-right">Operating Rate Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F4F2]">
                  {report.metresPerMachine.map((row) => (
                    <tr key={row.machineId} className="hover:bg-[#FBFBFA] transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#1A1714]">
                        {row.machineCode}
                      </td>

                      <td className="py-3 px-3 font-medium text-[#1A1714]">
                        {row.machineName}
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F5F4F2] text-[#44403C]">
                          {row.stage}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-[#78716C]">
                        {row.hoursActive} hrs
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-900">
                        {row.metresProduced.toLocaleString()} m
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-[#1A1714]">
                        {formatCurrency(row.costTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
