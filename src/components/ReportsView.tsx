import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
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
  ReturnRequest,
  Supplier,
} from '../types/pharma';
import { evaluateBatchEligibility } from '../utils/eligibility';
import { exportRowsToCSV, formatDate, formatINR, formatINRCompact } from '../utils/formatters';
import { EligibilityLabel, ReconciliationLabel, ReturnStatusLabel } from './StatusIndicator';

type ReportTab =
  | 'monthly'
  | 'expired'
  | 'near-expiry'
  | 'eligible'
  | 'supplier-wise'
  | 'pending-credit'
  | 'discrepancies';

interface ReportsViewProps {
  batches: InventoryBatch[];
  suppliers: Supplier[];
  returnRequests: ReturnRequest[];
  creditNotes: CreditNote[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  batches,
  suppliers,
  returnRequests,
  creditNotes,
}) => {
  const [activeReport, setActiveReport] = useState<ReportTab>('monthly');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-11-30');

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

  const filteredRequests = useMemo(
    () =>
      returnRequests.filter(
        (r) =>
          (supplierFilter === 'all' || r.supplierId === supplierFilter) &&
          r.submissionDate >= fromDate &&
          r.submissionDate <= toDate
      ),
    [returnRequests, supplierFilter, fromDate, toDate]
  );

  const evaluatedBatches = useMemo(
    () =>
      activeBatches.map((batch) => ({
        batch,
        supplier: supplierMap.get(batch.supplierId),
        ev: evaluateBatchEligibility(batch, supplierMap.get(batch.supplierId)),
        value: batch.quantity * batch.purchasePrice,
      })),
    [activeBatches, supplierMap]
  );

  const financialKPIs = useMemo(() => {
    const potentialReturnValue = evaluatedBatches
      .filter(({ ev }) => ev.status === 'Eligible' || ev.status === 'Approaching eligibility')
      .reduce((s, x) => s + x.value, 0);

    const submittedValue = filteredRequests
      .filter((r) => r.status !== 'Draft')
      .reduce((s, r) => s + r.expectedCredit, 0);

    const approvedValue = filteredRequests.reduce((s, r) => s + r.approvedCredit, 0);

    const creditedByReq = new Map<string, number>();
    creditNotes.forEach((cn) => {
      creditedByReq.set(
        cn.returnRequestId,
        (creditedByReq.get(cn.returnRequestId) || 0) + cn.creditAmount
      );
    });

    const reqIds = new Set(filteredRequests.map((r) => r.id));
    const creditReceived = creditNotes
      .filter((cn) => reqIds.has(cn.returnRequestId))
      .reduce((s, cn) => s + cn.creditAmount, 0);

    let pendingCredit = 0;
    filteredRequests.forEach((r) => {
      if (r.status === 'Rejected' || r.status === 'Draft' || r.status === 'Closed') return;
      const base = r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit;
      const rec = creditedByReq.get(r.id) || 0;
      if (base > rec) pendingCredit += base - rec;
    });

    const rejectedValue = filteredRequests
      .filter((r) => r.status === 'Rejected')
      .reduce((s, r) => s + r.expectedCredit, 0);

    let discrepancyValue = 0;
    creditNotes
      .filter((cn) => reqIds.has(cn.returnRequestId) && cn.reconciliationStatus === 'Credit discrepancy')
      .forEach((cn) => {
        const req = returnRequests.find((r) => r.id === cn.returnRequestId);
        if (req) {
          const base = req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit;
          const rec = creditedByReq.get(req.id) || cn.creditAmount;
          if (base > rec) discrepancyValue += base - rec;
        }
      });

    return {
      potentialReturnValue,
      submittedValue,
      approvedValue,
      creditReceived,
      pendingCredit,
      rejectedValue,
      discrepancyValue,
    };
  }, [evaluatedBatches, filteredRequests, creditNotes, returnRequests]);

  // Supplier-wise summary rows
  const supplierWiseRows = useMemo(() => {
    return suppliers
      .filter((s) => supplierFilter === 'all' || s.id === supplierFilter)
      .map((sup) => {
        const reqs = filteredRequests.filter((r) => r.supplierId === sup.id);
        const cns = creditNotes.filter(
          (cn) =>
            cn.supplierId === sup.id &&
            reqs.some((r) => r.id === cn.returnRequestId)
        );
        const submitted = reqs.reduce((s, r) => s + r.expectedCredit, 0);
        const approved = reqs.reduce((s, r) => s + r.approvedCredit, 0);
        const credited = cns.reduce((s, cn) => s + cn.creditAmount, 0);
        return {
          supplier: sup,
          requestCount: reqs.length,
          submitted,
          approved,
          credited,
          pending: Math.max(0, (approved > 0 ? approved : submitted) - credited),
        };
      });
  }, [suppliers, supplierFilter, filteredRequests, creditNotes]);

  const expiredRows = evaluatedBatches.filter(({ ev }) => ev.daysToExpiry < 0);
  const nearExpiryRows = evaluatedBatches.filter(
    ({ ev }) => ev.daysToExpiry >= 0 && ev.daysToExpiry <= 90
  );
  const eligibleRows = evaluatedBatches.filter(({ ev }) => ev.status === 'Eligible');

  const pendingCreditRows = useMemo(() => {
    const creditedByReq = new Map<string, number>();
    creditNotes.forEach((cn) => {
      creditedByReq.set(
        cn.returnRequestId,
        (creditedByReq.get(cn.returnRequestId) || 0) + cn.creditAmount
      );
    });
    return filteredRequests
      .filter((r) => r.status !== 'Draft' && r.status !== 'Rejected' && r.status !== 'Closed')
      .map((r) => {
        const base = r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit;
        const rec = creditedByReq.get(r.id) || 0;
        return { req: r, base, rec, pending: Math.max(0, base - rec) };
      })
      .filter((x) => x.pending > 0);
  }, [filteredRequests, creditNotes]);

  const discrepancyRows = useMemo(() => {
    return creditNotes
      .filter((cn) => supplierFilter === 'all' || cn.supplierId === supplierFilter)
      .map((cn) => {
        const req = returnRequests.find((r) => r.id === cn.returnRequestId);
        const base = req ? (req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit) : cn.creditAmount;
        return { cn, req, diff: Math.max(0, base - cn.creditAmount) };
      })
      .filter((x) => x.diff > 0 || x.cn.reconciliationStatus === 'Credit discrepancy');
  }, [creditNotes, returnRequests, supplierFilter]);

  const handleExportCurrentReport = () => {
    if (activeReport === 'expired' || activeReport === 'near-expiry' || activeReport === 'eligible') {
      const target =
        activeReport === 'expired'
          ? expiredRows
          : activeReport === 'near-expiry'
            ? nearExpiryRows
            : eligibleRows;
      exportRowsToCSV(
        `PharmaReturn_${activeReport}_report.csv`,
        ['Medicine', 'Batch', 'Supplier', 'Expiry Date', 'Quantity', 'Unit Price', 'Value (INR)', 'Eligibility'],
        target.map(({ batch, supplier, ev, value }) => [
          batch.medicineName,
          batch.batchNumber,
          supplier?.name || '',
          batch.expiryDate,
          batch.quantity,
          batch.purchasePrice,
          value,
          ev.status,
        ])
      );
      return;
    }

    if (activeReport === 'supplier-wise' || activeReport === 'monthly') {
      exportRowsToCSV(
        `PharmaReturn_${activeReport}_recovery_report.csv`,
        ['Supplier', 'Requests', 'Submitted (INR)', 'Approved (INR)', 'Credited (INR)', 'Pending (INR)'],
        supplierWiseRows.map((r) => [
          r.supplier.name,
          r.requestCount,
          r.submitted,
          r.approved,
          r.credited,
          r.pending,
        ])
      );
      return;
    }

    if (activeReport === 'pending-credit') {
      exportRowsToCSV(
        'PharmaReturn_pending_credits.csv',
        ['Request ID', 'Supplier', 'Submitted Date', 'Approved/Expected (INR)', 'Credited (INR)', 'Pending (INR)', 'Status'],
        pendingCreditRows.map((x) => [
          x.req.requestNumber,
          supplierMap.get(x.req.supplierId)?.name || '',
          x.req.submissionDate,
          x.base,
          x.rec,
          x.pending,
          x.req.status,
        ])
      );
      return;
    }

    exportRowsToCSV(
      'PharmaReturn_credit_discrepancies.csv',
      ['Credit Note', 'Supplier', 'Request ID', 'CN Date', 'CN Amount (INR)', 'Shortfall (INR)', 'Status'],
      discrepancyRows.map((x) => [
        x.cn.creditNoteNumber,
        supplierMap.get(x.cn.supplierId)?.name || '',
        x.req?.requestNumber || '',
        x.cn.creditNoteDate,
        x.cn.creditAmount,
        x.diff,
        x.cn.reconciliationStatus,
      ])
    );
  };

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'monthly', label: 'Monthly Recovery' },
    { id: 'supplier-wise', label: 'Supplier-Wise Returns' },
    { id: 'eligible', label: 'Return-Eligible Stock' },
    { id: 'near-expiry', label: 'Near-Expiry Stock' },
    { id: 'expired', label: 'Expired Stock' },
    { id: 'pending-credit', label: 'Pending Credits' },
    { id: 'discrepancies', label: 'Credit Discrepancies' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Financial Recovery &amp; Operational Reports
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Track total returnable exposure, submitted claims, recovered credits, and unresolved discrepancies.
          </p>
        </div>

        <button
          onClick={handleExportCurrentReport}
          className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Report CSV</span>
        </button>
      </div>

      {/* 7 PRD Financial Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Potential Return</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
            {formatINRCompact(financialKPIs.potentialReturnValue)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Submitted Claims</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
            {formatINRCompact(financialKPIs.submittedValue)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Approved Value</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
            {formatINRCompact(financialKPIs.approvedValue)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Credit Received</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-emerald-700">
            {formatINRCompact(financialKPIs.creditReceived)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Pending Credit</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-amber-700">
            {formatINRCompact(financialKPIs.pendingCredit)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Rejected Value</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-700">
            {formatINRCompact(financialKPIs.rejectedValue)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500">Unresolved Diff</div>
          <div className="mt-1 text-base font-semibold font-mono tabular-nums text-red-700">
            {formatINRCompact(financialKPIs.discrepancyValue)}
          </div>
        </div>
      </div>

      {/* Filters + Report Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              aria-label="Filter reports by supplier"
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 px-2 font-mono border border-slate-200 rounded-md text-xs"
              />
              <span>To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 px-2 font-mono border border-slate-200 rounded-md text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeReport === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      {activeReport === 'monthly' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Supplier Recovery Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison of submitted claims, credited notes, and remaining pending balance by supplier
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={supplierWiseRows.map((r) => ({
                  name: r.supplier.name.split(' ')[0],
                  credited: r.credited,
                  pending: r.pending,
                }))}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                <Bar dataKey="credited" name="Credited (INR)" fill="#0f766e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" name="Pending (INR)" fill="#d97706" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(activeReport === 'monthly' || activeReport === 'supplier-wise') && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Requests</th>
                  <th className="py-3 px-4 text-right">Submitted Value</th>
                  <th className="py-3 px-4 text-right">Approved Value</th>
                  <th className="py-3 px-4 text-right">Credited Received</th>
                  <th className="py-3 px-4 text-right">Pending Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {supplierWiseRows.map((row) => (
                  <tr key={row.supplier.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">{row.supplier.name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {row.requestCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatINR(row.submitted)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatINR(row.approved)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {formatINR(row.credited)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">
                      {formatINR(row.pending)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeReport === 'expired' ||
        activeReport === 'near-expiry' ||
        activeReport === 'eligible') && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Medicine &amp; Batch</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Stock Value</th>
                  <th className="py-3 px-4">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(activeReport === 'expired'
                  ? expiredRows
                  : activeReport === 'near-expiry'
                    ? nearExpiryRows
                    : eligibleRows
                ).map(({ batch, supplier, ev, value }) => (
                  <tr key={batch.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{batch.medicineName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{batch.batchNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{supplier?.name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                      {formatDate(batch.expiryDate)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {batch.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(value)}
                    </td>
                    <td className="py-3 px-4">
                      <EligibilityLabel status={ev.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'pending-credit' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Baseline Value</th>
                  <th className="py-3 px-4 text-right">Credited</th>
                  <th className="py-3 px-4 text-right">Pending Credit</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingCreditRows.map(({ req, base, rec, pending }) => (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-teal-700">
                      {req.requestNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {supplierMap.get(req.supplierId)?.name}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {formatDate(req.submissionDate)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatINR(base)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                      {formatINR(rec)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">
                      {formatINR(pending)}
                    </td>
                    <td className="py-3 px-4">
                      <ReturnStatusLabel status={req.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'discrepancies' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Credit Note</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Linked Claim</th>
                  <th className="py-3 px-4 text-right">CN Amount</th>
                  <th className="py-3 px-4 text-right">Shortfall</th>
                  <th className="py-3 px-4">Reconciliation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {discrepancyRows.map(({ cn, req, diff }) => (
                  <tr key={cn.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {cn.creditNoteNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {supplierMap.get(cn.supplierId)?.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-teal-700">
                      {req?.requestNumber}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatINR(cn.creditAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-red-700">
                      {formatINR(diff)}
                    </td>
                    <td className="py-3 px-4">
                      <ReconciliationLabel status={cn.reconciliationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
