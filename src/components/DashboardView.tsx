import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  Package,
  Plus,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CreditNote,
  InventoryBatch,
  NavSection,
  ReturnRequest,
  Supplier,
} from '../types/pharma';
import { evaluateBatchEligibility } from '../utils/eligibility';
import { formatDate, formatINR, formatINRCompact } from '../utils/formatters';
import { monthlyRecoveryTrend } from '../data/mockData';
import { ReconciliationLabel, ReturnStatusLabel } from './StatusIndicator';

interface DashboardViewProps {
  batches: InventoryBatch[];
  suppliers: Supplier[];
  returnRequests: ReturnRequest[];
  creditNotes: CreditNote[];
  onNavigate: (section: NavSection, filterHint?: string) => void;
  onOpenReturnDetail: (requestId: string) => void;
  onOpenCreateReturn: () => void;
  onOpenImportModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  batches,
  suppliers,
  returnRequests,
  creditNotes,
  onNavigate,
  onOpenReturnDetail,
  onOpenCreateReturn,
  onOpenImportModal,
}) => {
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dateWindow, setDateWindow] = useState<'all' | '30d' | '90d' | 'fy'>('all');

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const activeBatches = useMemo(
    () =>
      batches.filter(
        (b) => !b.archived && (supplierFilter === 'all' || b.supplierId === supplierFilter)
      ),
    [batches, supplierFilter]
  );

  const filteredRequests = useMemo(() => {
    return returnRequests.filter((r) => {
      if (supplierFilter !== 'all' && r.supplierId !== supplierFilter) return false;
      if (dateWindow === '30d') return r.submissionDate >= '2026-10-18';
      if (dateWindow === '90d') return r.submissionDate >= '2026-08-19';
      return true;
    });
  }, [returnRequests, supplierFilter, dateWindow]);

  const filteredCreditNotes = useMemo(() => {
    const reqIds = new Set(filteredRequests.map((r) => r.id));
    return creditNotes.filter(
      (cn) =>
        (supplierFilter === 'all' || cn.supplierId === supplierFilter) &&
        reqIds.has(cn.returnRequestId)
    );
  }, [creditNotes, filteredRequests, supplierFilter]);

  const metrics = useMemo(() => {
    let nearExpiryValue = 0;
    let expiredValue = 0;
    let eligibleValue = 0;
    let eligibleCount = 0;

    const evaluated = activeBatches.map((batch) => {
      const ev = evaluateBatchEligibility(batch, supplierMap.get(batch.supplierId));
      const val = batch.quantity * batch.purchasePrice;
      if (ev.daysToExpiry < 0) {
        expiredValue += val;
      } else if (ev.daysToExpiry <= 90) {
        nearExpiryValue += val;
      }
      if (ev.status === 'Eligible') {
        eligibleValue += val;
        eligibleCount += 1;
      }
      return { batch, ev, val };
    });

    const openStatuses = new Set([
      'Draft',
      'Submitted',
      'Awaiting supplier response',
      'Approved',
      'Partially approved',
      'Pickup scheduled',
      'Collected',
      'Credit pending',
      'Partially credited',
    ]);
    const pendingRequests = filteredRequests.filter((r) => openStatuses.has(r.status));

    const creditedByRequest = new Map<string, number>();
    creditNotes.forEach((cn) => {
      creditedByRequest.set(
        cn.returnRequestId,
        (creditedByRequest.get(cn.returnRequestId) || 0) + cn.creditAmount
      );
    });

    let pendingCreditValue = 0;
    filteredRequests.forEach((r) => {
      if (r.status === 'Rejected' || r.status === 'Closed' || r.status === 'Draft') return;
      const baseExpected = r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit;
      const received = creditedByRequest.get(r.id) || 0;
      if (baseExpected > received) {
        pendingCreditValue += baseExpected - received;
      }
    });

    const totalRecoveredValue = filteredCreditNotes.reduce(
      (sum, cn) => sum + cn.creditAmount,
      0
    );

    const upcomingDeadlines = evaluated
      .filter(
        ({ ev }) =>
          ev.daysToDeadline !== null &&
          ev.daysToDeadline >= 0 &&
          ev.daysToDeadline <= 45 &&
          (ev.status === 'Eligible' || ev.status === 'Manual verification required')
      )
      .sort((a, b) => (a.ev.daysToDeadline ?? 999) - (b.ev.daysToDeadline ?? 999))
      .slice(0, 5);

    const discrepancies = filteredCreditNotes
      .map((cn) => {
        const req = returnRequests.find((r) => r.id === cn.returnRequestId);
        const approvedOrExpected = req
          ? req.approvedCredit > 0
            ? req.approvedCredit
            : req.expectedCredit
          : cn.creditAmount;
        const diff = approvedOrExpected - cn.creditAmount;
        return { cn, req, diff };
      })
      .filter((d) => d.diff > 0 || d.cn.reconciliationStatus === 'Credit discrepancy');

    // Top suppliers by pending credit
    const pendingBySupplier = new Map<string, number>();
    filteredRequests.forEach((r) => {
      if (r.status === 'Rejected' || r.status === 'Closed' || r.status === 'Draft') return;
      const base = r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit;
      const rec = creditedByRequest.get(r.id) || 0;
      const rem = Math.max(0, base - rec);
      if (rem > 0) {
        pendingBySupplier.set(
          r.supplierId,
          (pendingBySupplier.get(r.supplierId) || 0) + rem
        );
      }
    });
    const topSuppliersPending = Array.from(pendingBySupplier.entries())
      .map(([supId, amount]) => ({
        supplier: supplierMap.get(supId),
        amount,
      }))
      .filter((x) => x.supplier)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const pendingApprovals = filteredRequests.filter(
      (r) => r.status === 'Submitted' || r.status === 'Awaiting supplier response'
    );

    return {
      totalBatches: activeBatches.length,
      nearExpiryValue,
      expiredValue,
      eligibleValue,
      eligibleCount,
      pendingRequestsCount: pendingRequests.length,
      pendingCreditValue,
      totalRecoveredValue,
      upcomingDeadlines,
      discrepancies,
      topSuppliersPending,
      pendingApprovals,
    };
  }, [activeBatches, filteredRequests, filteredCreditNotes, creditNotes, returnRequests, supplierMap]);

  return (
    <div className="space-y-6">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Returns &amp; Recovery Overview
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Track eligible medicine batches, supplier claim approvals, and credit note recovery in INR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            aria-label="Filter dashboard by supplier"
            className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="all">All Suppliers ({suppliers.length})</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'fy', label: 'FY 26–27' },
                { id: '90d', label: '90 Days' },
                { id: '30d', label: '30 Days' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateWindow(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  dateWindow === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenImportModal}
            className="h-9 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Stock</span>
          </button>

          <button
            onClick={onOpenCreateReturn}
            className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Return Request</span>
          </button>
        </div>
      </div>

      {/* 7 PRD Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <button
          onClick={() => onNavigate('inventory')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Inventory Batches</span>
            <Package className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {metrics.totalBatches}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active tracked lots</div>
        </button>

        <button
          onClick={() => onNavigate('inventory', 'near-expiry')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Near-Expiry Value</span>
            <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-amber-700">
            {formatINRCompact(metrics.nearExpiryValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Expiring within 90d</div>
        </button>

        <button
          onClick={() => onNavigate('inventory', 'expired')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Expired Value</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-red-700">
            {formatINRCompact(metrics.expiredValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Past expiry stock</div>
        </button>

        <button
          onClick={() => onNavigate('eligibility', 'Eligible')}
          className="text-left bg-white border border-slate-200 hover:border-teal-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Return-Eligible</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-teal-700">
            {formatINRCompact(metrics.eligibleValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.eligibleCount} batches ready
          </div>
        </button>

        <button
          onClick={() => onNavigate('returns')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pending Requests</span>
            <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {metrics.pendingRequestsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Open claim workflows</div>
        </button>

        <button
          onClick={() => onNavigate('credits')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pending Credits</span>
            <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {formatINRCompact(metrics.pendingCreditValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Awaiting supplier CN</div>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-lg p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Recovered</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono tabular-nums text-emerald-700">
            {formatINRCompact(metrics.totalRecoveredValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Credited via CNs</div>
        </button>
      </div>

      {/* Main Split: Recovery Chart + Credit Discrepancies & Pending Suppliers */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Chart Card */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Monthly Claimed vs. Recovered Credit Value
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                6-month financial recovery velocity across active suppliers (INR)
              </p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Full Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRecoveryTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => formatINR(Number(value ?? 0))}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="recovered" name="Recovered Credit" fill="#0f766e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" name="Pending Credit" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Discrepancies + Top Suppliers by Pending Credit */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 flex flex-col">
          {/* Credit Note Discrepancies */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Credit-Note Discrepancies</h2>
              <button
                onClick={() => onNavigate('credits')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                Reconcile
              </button>
            </div>
            {metrics.discrepancies.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">
                No unresolved credit-note discrepancies for the selected filter.
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.discrepancies.map(({ cn, req, diff }) => (
                  <div
                    key={cn.id}
                    className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-medium text-slate-900">
                          {cn.creditNoteNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 truncate">
                          {supplierMap.get(cn.supplierId)?.name}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span>Claim {req?.requestNumber}</span>
                        <span>·</span>
                        <ReconciliationLabel status={cn.reconciliationStatus} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-xs font-semibold text-red-700">
                        -{formatINR(diff)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        Rec: {formatINR(cn.creditAmount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Suppliers by Pending Credit */}
          <div className="p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Top Suppliers by Pending Credit
              </h2>
              <button
                onClick={() => onNavigate('suppliers')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                All Suppliers
              </button>
            </div>
            {metrics.topSuppliersPending.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">No pending supplier credits.</div>
            ) : (
              <div className="space-y-2.5">
                {metrics.topSuppliersPending.map(({ supplier, amount }) => {
                  const pct = Math.min(
                    100,
                    Math.round((amount / Math.max(metrics.pendingCreditValue, 1)) * 100)
                  );
                  return (
                    <div key={supplier!.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 truncate pr-2">
                          {supplier!.name}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                          {formatINR(amount)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-700 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Split: Upcoming Return Deadlines + Recent Return Requests & Pending Approvals */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Upcoming Return Deadlines */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Upcoming Supplier Return Deadlines
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Batches closing their return window within 45 days
              </p>
            </div>
            <button
              onClick={() => onNavigate('eligibility')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Eligibility Engine
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {metrics.upcomingDeadlines.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                No urgent return deadlines within the next 45 days.
              </div>
            ) : (
              metrics.upcomingDeadlines.map(({ batch, ev, val }) => (
                <div
                  key={batch.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {batch.medicineName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono">{batch.batchNumber}</span>
                      <span>·</span>
                      <span className="truncate">{supplierMap.get(batch.supplierId)?.name}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {formatINR(val)}
                    </div>
                    <div
                      className={`text-[11px] font-medium font-mono tabular-nums mt-0.5 ${
                        (ev.daysToDeadline ?? 99) <= 20 ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {ev.daysToDeadline}d left ({formatDate(ev.returnDeadlineDate ?? undefined)})
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recently Created Return Requests + Pending Approvals */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Return Requests &amp; Pending Approvals
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {metrics.pendingApprovals.length} request(s) currently awaiting supplier confirmation
              </p>
            </div>
            <button
              onClick={() => onNavigate('returns')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Request ID</th>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4">Submitted</th>
                  <th className="py-2.5 px-4 text-right">Expected</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRequests.slice(0, 5).map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => onOpenReturnDetail(req.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-teal-700 whitespace-nowrap">
                      {req.requestNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[180px] truncate">
                      {supplierMap.get(req.supplierId)?.name}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDate(req.submissionDate)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right font-medium text-slate-900 whitespace-nowrap">
                      {formatINR(req.expectedCredit)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ReturnStatusLabel status={req.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
