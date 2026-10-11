import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { Table, type Column } from '../../components/ui/Table';
import { DEFAULT_PAGE_SIZE, Pagination } from '../../components/ui/Pagination';
import { Callout } from '../../components/ui/Callout';
import { Dialog } from '../../components/ui/Dialog';
import { formatCurrency, formatApiMonth } from '../../lib/format';
import { getMonthEnd, type MonthEndReport } from './reports.api';
import { getWages, type MonthlyWagesResponse, type WorkerWageSummary } from '../attendance/attendance.api';
import {
  ChartBarIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ShoppingBagIcon,
  UsersIcon,
  BriefcaseIcon,
  CpuChipIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';

export function MonthEndPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(formatApiMonth(new Date()));
  const [orderPage, setOrderPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MonthEndReport | null>(null);
  const orderPageSize = DEFAULT_PAGE_SIZE;
  const [wagesOpen, setWagesOpen] = useState(false);
  const [wagesData, setWagesData] = useState<MonthlyWagesResponse | null>(null);
  const [wagesLoading, setWagesLoading] = useState(false);
  const [wagesError, setWagesError] = useState('');
  const [wagePage, setWagePage] = useState(0);

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
    setOrderPage(0);
    setWagesOpen(false);
    setWagesData(null);
    loadReport(selectedMonth);
  }, [selectedMonth]);

  // Per-staff breakdown behind the Staff Wages card: daily wage x days present.
  const openWageBreakdown = async () => {
    setWagesOpen(true);
    setWagePage(0);
    if (wagesData?.month === selectedMonth) return;
    setWagesLoading(true);
    setWagesError('');
    try {
      setWagesData(await getWages(selectedMonth));
    } catch (err) {
      setWagesData(null);
      setWagesError(err instanceof Error ? err.message : 'Unable to load staff wages.');
    } finally {
      setWagesLoading(false);
    }
  };

  const wageColumns: Column<WorkerWageSummary>[] = [
    { key: 'code', header: 'Code', render: (w) => <span className="font-mono font-medium text-(--color-text)">{w.workerCode}</span> },
    { key: 'name', header: 'Staff Name', render: (w) => <span className="font-semibold text-(--color-text)">{w.workerName}</span> },
    { key: 'rate', header: 'Daily Wage', align: 'right', render: (w) => <span className="font-mono text-(--color-text-muted)">{formatCurrency(w.dailyWage)}</span> },
    { key: 'present', header: 'Present', align: 'right', render: (w) => <span className="font-mono font-bold text-emerald-700">{w.presentDays}</span> },
    { key: 'absent', header: 'Absent', align: 'right', render: (w) => <span className="font-mono text-rose-700">{w.absentDays}</span> },
    {
      key: 'lost',
      header: 'Lost to Absence',
      align: 'right',
      render: (w) => <span className="font-mono text-rose-700">{formatCurrency(w.absentDays * w.dailyWage)}</span>,
    },
    { key: 'earned', header: 'Wages Earned', align: 'right', render: (w) => <span className="font-mono font-bold text-emerald-800">{formatCurrency(w.totalWage)}</span> },
  ];
  const wageWorkers = wagesData?.workers ?? [];
  const totalAbsentDays = wageWorkers.reduce((sum, w) => sum + w.absentDays, 0);

  const costColumns: Column<MonthEndReport['costPerOrder'][number]>[] = report
    ? [
        { key: 'orderNumber', header: 'Order Number', render: (row) => <span className="font-mono font-bold text-(--color-text)">{row.orderNumber}</span> },
        {
          key: 'buyer',
          header: 'Buyer / Fabric',
          render: (row) => (
            <div>
              <div className="font-semibold text-(--color-text)">{row.buyerName}</div>
              <div className="text-[11px] text-(--color-text-muted)">{row.fabricType}</div>
            </div>
          ),
        },
        { key: 'metres', header: 'Metres', align: 'right', render: (row) => <span className="font-mono font-medium text-(--color-text)">{row.metres.toLocaleString()} m</span> },
        { key: 'yarnCost', header: 'Yarn Cost', align: 'right', render: (row) => <span className="font-mono text-(--color-text-muted)">{formatCurrency(row.yarnCost)}</span> },
        { key: 'machineCost', header: 'Machine Cost', align: 'right', render: (row) => <span className="font-mono text-(--color-text-muted)">{formatCurrency(row.machineCost)}</span> },
        { key: 'invoicedAmount', header: 'Invoiced Amount', align: 'right', render: (row) => <span className="font-mono font-bold text-(--color-text)">{formatCurrency(row.invoicedAmount)}</span> },
        { key: 'marginAmount', header: 'Gross Margin', align: 'right', render: (row) => <span className="font-mono font-bold text-emerald-800">{formatCurrency(row.marginAmount)}</span> },
        {
          key: 'marginPercent',
          header: 'Margin %',
          align: 'center',
          render: (row) => (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {row.marginPercent}%
            </span>
          ),
        },
      ]
    : [];

  const machineColumns: Column<MonthEndReport['metresPerMachine'][number]>[] = report
    ? [
        { key: 'code', header: 'Machine Code', render: (row) => <span className="font-mono font-bold text-(--color-text)">{row.machineCode}</span> },
        { key: 'name', header: 'Machine Name', render: (row) => <span className="font-medium text-(--color-text)">{row.machineName}</span> },
        {
          key: 'stage',
          header: 'Stage',
          render: (row) => (
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-(--color-surface-sunken) text-(--color-text-dark)">
              {row.stage}
            </span>
          ),
        },
        { key: 'hours', header: 'Operating Hours', align: 'right', render: (row) => <span className="font-mono text-(--color-text-muted)">{row.hoursActive} hrs</span> },
        { key: 'metres', header: 'Metres Produced', align: 'right', render: (row) => <span className="font-mono font-bold text-amber-900">{row.metresProduced.toLocaleString()} m</span> },
        { key: 'cost', header: 'Operating Rate Cost', align: 'right', render: (row) => <span className="font-mono font-bold text-(--color-text)">{formatCurrency(row.costTotal)}</span> },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Month-End Financial & Operating Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Executive P&L
            </span>
          </div>
          <p className="text-sm text-(--color-text-muted) mt-1">
            Authoritative statement of raw purchases, staff payroll, billing, cash flow, and plant unit operating margins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-(--color-text-muted)">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-(--color-border) bg-white py-1.5 px-3 text-xs font-semibold text-(--color-text) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadReport(selectedMonth)}
            className="text-xs"
          >
            <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
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
        <div className="flex flex-col items-center justify-center py-24 text-(--color-text-muted)">
          <Spinner size="lg" />
          <p className="text-sm mt-3 font-medium">Aggregating month-end ledgers for {selectedMonth}...</p>
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-sm text-(--color-text-muted)">
          Unable to generate month-end report for {selectedMonth}.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Executive Stat Cards */}
          <StatGrid columns={4}>
            <StatCard icon={ShoppingBagIcon} label="Raw Purchases" value={formatCurrency(report.purchases)} sub="Yarn receipts cost" tone="neutral" />
            <StatCard
              icon={UsersIcon}
              label="Staff Wages"
              value={formatCurrency(report.staffWages)}
              sub="Click for per-staff breakdown"
              tone="neutral"
              onClick={() => void openWageBreakdown()}
            />
            <StatCard
              icon={BriefcaseIcon}
              label="Salaries"
              value={formatCurrency(report.salaries)}
              sub={`${report.salariedEmployees} supervisor & office staff`}
              tone="neutral"
            />
            <StatCard icon={UsersIcon} label="Total Payroll" value={formatCurrency(report.wages)} sub="Wages + salaries" tone="neutral" />
            <StatCard icon={ReceiptPercentIcon} label="Gross Invoiced" value={formatCurrency(report.invoiced)} sub="Sales billing issued" tone="neutral" />
            <StatCard icon={BanknotesIcon} label="Payments In" value={formatCurrency(report.paymentsReceived)} sub="Bank receipts cash" tone="info" />
            <StatCard
              icon={ArrowTrendingUpIcon}
              label="Operating Profit"
              value={formatCurrency(report.profit)}
              sub="Invoiced - (Yarn + Payroll)"
              tone={report.profit >= 0 ? 'success' : 'danger'}
            />
          </StatGrid>

          {report.salaryNotSet > 0 && (
            <Callout tone="warning">
              {report.salaryNotSet} supervisor / office {report.salaryNotSet === 1 ? 'employee has' : 'employees have'} no monthly
              salary set, so salaries and profit are understated. The owner can set salaries on the Attendance page.
            </Callout>
          )}

          {/* TABLE 1: Cost & Margin Per Order */}
          <div className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-(--color-surface-sunken)">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-(--color-accent)" />
                <h2 className="text-base font-semibold text-(--color-text)">
                  Cost & Margin Analysis Per Order
                </h2>
              </div>
              <span className="text-xs text-(--color-text-muted)">
                {report.costPerOrder.length} processed orders
              </span>
            </div>

            <Table
              columns={costColumns}
              rows={report.costPerOrder.slice(orderPage * orderPageSize, (orderPage + 1) * orderPageSize)}
              rowKey={(row) => row.orderId}
            />
            <Pagination
              page={orderPage}
              pageSize={orderPageSize}
              totalCount={report.costPerOrder.length}
              itemLabel="orders"
              onPageChange={setOrderPage}
            />
          </div>

          {/* TABLE 2: Output Metres Per Machine */}
          <div className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-(--color-surface-sunken)">
              <div className="flex items-center gap-2">
                <CpuChipIcon className="w-5 h-5 text-(--color-text-muted)" />
                <h2 className="text-base font-semibold text-(--color-text)">
                  Production Output & Machine Utilization
                </h2>
              </div>
              <span className="text-xs text-(--color-text-muted)">
                {report.metresPerMachine.length} machine units recorded
              </span>
            </div>

            <Table columns={machineColumns} rows={report.metresPerMachine} rowKey={(row) => row.machineId} />
          </div>
        </div>
      )}

      <Dialog
        open={wagesOpen}
        onClose={() => setWagesOpen(false)}
        title={`Staff Wages — ${selectedMonth}`}
        width="max-w-5xl"
      >
        <div className="max-h-[75vh] overflow-y-auto space-y-4">
          <p className="text-xs text-(--color-text-muted)">
            Each staff member earns their daily wage for every day marked present. Absent days are not paid.
          </p>
          {wagesData && !wagesError && (
            <StatGrid columns={4}>
              <StatCard icon={UsersIcon} label="Staff" value={wageWorkers.length} tone="neutral" />
              <StatCard icon={UsersIcon} label="Days Present" value={wagesData.totalPresentDays} tone="success" />
              <StatCard icon={UsersIcon} label="Days Absent" value={totalAbsentDays} tone="danger" />
              <StatCard icon={BanknotesIcon} label="Wages Earned" value={formatCurrency(wagesData.totalWages)} tone="success" />
            </StatGrid>
          )}
          {wagesError ? (
            <Callout tone="danger">{wagesError}</Callout>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table
                  columns={wageColumns}
                  rows={wageWorkers.slice(wagePage * orderPageSize, (wagePage + 1) * orderPageSize)}
                  loading={wagesLoading}
                  rowKey={(w) => w.workerId}
                  emptyTitle="No staff"
                  emptyDescription={`No staff attendance recorded for ${selectedMonth}.`}
                />
              </div>
              <Pagination
                page={wagePage}
                pageSize={orderPageSize}
                totalCount={wageWorkers.length}
                itemLabel="staff members"
                onPageChange={setWagePage}
              />
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
