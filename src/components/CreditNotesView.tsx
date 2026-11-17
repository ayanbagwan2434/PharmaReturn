import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  CreditNote,
  ReconciliationStatus,
  ReturnRequest,
  Supplier,
} from '../types/pharma';
import { formatDate, formatINR } from '../utils/formatters';
import { ReconciliationLabel } from './StatusIndicator';

interface CreditNotesViewProps {
  creditNotes: CreditNote[];
  returnRequests: ReturnRequest[];
  suppliers: Supplier[];
  uploadContext: { open: boolean; returnRequestId?: string };
  onCloseUploadModal: () => void;
  onOpenUploadModal: (returnRequestId?: string) => void;
  onAddCreditNote: (cn: Omit<CreditNote, 'id' | 'createdAt'>) => void;
  onResolveDiscrepancy: (
    creditNoteId: string,
    newStatus: ReconciliationStatus,
    resolutionNotes: string
  ) => void;
}

export const CreditNotesView: React.FC<CreditNotesViewProps> = ({
  creditNotes,
  returnRequests,
  suppliers,
  uploadContext,
  onCloseUploadModal,
  onOpenUploadModal,
  onAddCreditNote,
  onResolveDiscrepancy,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReconciliationStatus>('all');

  // Upload Credit Note Form
  const [cnNumber, setCnNumber] = useState('');
  const [cnRequestId, setCnRequestId] = useState(returnRequests[0]?.id || '');
  const [cnDate, setCnDate] = useState('2026-11-17');
  const [cnAmount, setCnAmount] = useState('');
  const [cnDocName, setCnDocName] = useState('');

  // Discrepancy Resolution Modal
  const [resolvingCn, setResolvingCn] = useState<CreditNote | null>(null);
  const [resolutionStatus, setResolutionStatus] =
    useState<ReconciliationStatus>('Reconciled');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const requestMap = useMemo(
    () => new Map(returnRequests.map((r) => [r.id, r])),
    [returnRequests]
  );

  useEffect(() => {
    if (uploadContext.open) {
      const targetReq =
        returnRequests.find((r) => r.id === uploadContext.returnRequestId) ||
        returnRequests.find((r) => r.status !== 'Draft' && r.status !== 'Rejected') ||
        returnRequests[0];
      setCnNumber(`CN-${Math.floor(10000 + Math.random() * 89999)}`);
      setCnRequestId(targetReq?.id || '');
      setCnDate('2026-11-17');
      setCnAmount(
        targetReq
          ? String(targetReq.approvedCredit > 0 ? targetReq.approvedCredit : targetReq.expectedCredit)
          : ''
      );
      setCnDocName('');
    }
  }, [uploadContext, returnRequests]);

  // Compute aggregated credit received per return request (supports partial credits!)
  const totalCreditedByRequest = useMemo(() => {
    const map = new Map<string, number>();
    creditNotes.forEach((cn) => {
      map.set(cn.returnRequestId, (map.get(cn.returnRequestId) || 0) + cn.creditAmount);
    });
    return map;
  }, [creditNotes]);

  const reconciliationSummary = useMemo(() => {
    let totalExpected = 0;
    let totalApproved = 0;
    let totalCredited = 0;
    let totalShortfall = 0;

    returnRequests.forEach((req) => {
      if (req.status === 'Draft' || req.status === 'Rejected') return;
      totalExpected += req.expectedCredit;
      totalApproved += req.approvedCredit;
    });

    creditNotes.forEach((cn) => {
      totalCredited += cn.creditAmount;
      const req = requestMap.get(cn.returnRequestId);
      if (req && cn.reconciliationStatus === 'Credit discrepancy') {
        const baseline = req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit;
        const totalForReq = totalCreditedByRequest.get(req.id) || cn.creditAmount;
        if (baseline > totalForReq) {
          totalShortfall += baseline - totalForReq;
        }
      }
    });

    return { totalExpected, totalApproved, totalCredited, totalShortfall };
  }, [returnRequests, creditNotes, requestMap, totalCreditedByRequest]);

  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter((cn) => {
      if (statusFilter !== 'all' && cn.reconciliationStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sup = supplierMap.get(cn.supplierId)?.name.toLowerCase() || '';
        const reqNum = requestMap.get(cn.returnRequestId)?.requestNumber.toLowerCase() || '';
        return (
          cn.creditNoteNumber.toLowerCase().includes(q) ||
          sup.includes(q) ||
          reqNum.includes(q)
        );
      }
      return true;
    });
  }, [creditNotes, statusFilter, searchQuery, supplierMap, requestMap]);

  const handleSaveCreditNote = (e: React.FormEvent) => {
    e.preventDefault();
    const req = requestMap.get(cnRequestId);
    if (!req) return;
    const amt = Math.max(1, Number(cnAmount) || 0);
    const existingForReq = totalCreditedByRequest.get(req.id) || 0;
    const newCumulative = existingForReq + amt;
    const benchmark = req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit;

    let status: ReconciliationStatus = 'Fully credited';
    if (newCumulative < benchmark) {
      status = 'Credit discrepancy';
    } else if (newCumulative === benchmark) {
      status = 'Reconciled';
    }

    onAddCreditNote({
      creditNoteNumber: cnNumber.trim(),
      supplierId: req.supplierId,
      returnRequestId: req.id,
      creditNoteDate: cnDate,
      creditAmount: amt,
      documentName: cnDocName.trim() || `${cnNumber.trim()}.pdf`,
      reconciliationStatus: status,
    });
    onCloseUploadModal();
  };

  const handleSaveResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingCn || !resolutionNotes.trim()) return;
    onResolveDiscrepancy(resolvingCn.id, resolutionStatus, resolutionNotes.trim());
    setResolvingCn(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Credit Notes &amp; Financial Reconciliation
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Compare expected return credits against actual supplier credit notes and investigate short credits.
          </p>
        </div>
        <button
          onClick={() => onOpenUploadModal()}
          className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Credit Note</span>
        </button>
      </div>

      {/* Reconciliation Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 font-medium">Total Claimed Value</div>
          <div className="mt-1.5 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {formatINR(reconciliationSummary.totalExpected)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Submitted return requests</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 font-medium">Supplier-Approved Value</div>
          <div className="mt-1.5 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {formatINR(reconciliationSummary.totalApproved)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Confirmed by CFAs</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 font-medium">Actual Credit Notes Received</div>
          <div className="mt-1.5 text-xl font-semibold font-mono tabular-nums text-emerald-700">
            {formatINR(reconciliationSummary.totalCredited)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {creditNotes.length} recorded credit notes
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 font-medium">Unresolved Shortfall</div>
          <div
            className={`mt-1.5 text-xl font-semibold font-mono tabular-nums ${
              reconciliationSummary.totalShortfall > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {formatINR(reconciliationSummary.totalShortfall)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Flagged for supplier follow-up</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search CN number, supplier, or return request ID..."
            className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | ReconciliationStatus)
          }
          aria-label="Filter by reconciliation status"
          className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
        >
          <option value="all">All Reconciliation Statuses</option>
          <option value="Credit discrepancy">Credit discrepancy</option>
          <option value="Partially credited">Partially credited</option>
          <option value="Under review">Under review</option>
          <option value="Fully credited">Fully credited</option>
          <option value="Reconciled">Reconciled</option>
        </select>
      </div>

      {/* Credit Note Reconciliation Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredCreditNotes.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No credit notes match your active filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Credit Note &amp; Date</th>
                  <th className="py-3 px-4">Supplier / Linked Request</th>
                  <th className="py-3 px-4 text-right">Expected Credit</th>
                  <th className="py-3 px-4 text-right">Supplier Approved</th>
                  <th className="py-3 px-4 text-right">Actual CN Amount</th>
                  <th className="py-3 px-4 text-right">Unreconciled Diff</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredCreditNotes.map((cn) => {
                  const req = requestMap.get(cn.returnRequestId);
                  const expected = req?.expectedCredit || 0;
                  const approved = req?.approvedCredit || expected;
                  const cumulative = totalCreditedByRequest.get(cn.returnRequestId) || cn.creditAmount;
                  const diff = approved - cumulative;

                  return (
                    <tr key={cn.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">
                          {cn.creditNoteNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {formatDate(cn.creditNoteDate)} · {cn.documentName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {supplierMap.get(cn.supplierId)?.name}
                        </div>
                        <div className="font-mono text-[11px] text-teal-700 mt-0.5">
                          Linked to {req?.requestNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatINR(expected)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {formatINR(approved)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatINR(cn.creditAmount)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                          diff > 0 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {diff > 0 ? formatINR(diff) : '₹0'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <ReconciliationLabel status={cn.reconciliationStatus} />
                        {cn.resolutionNotes && (
                          <div className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] truncate">
                            {cn.resolutionNotes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {cn.reconciliationStatus !== 'Reconciled' ? (
                          <button
                            onClick={() => {
                              setResolvingCn(cn);
                              setResolutionStatus('Reconciled');
                              setResolutionNotes(cn.resolutionNotes || '');
                            }}
                            className="h-7 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-medium rounded"
                          >
                            Investigate / Resolve
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Verified {formatDate(cn.resolvedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Credit Requests Reminder Section */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Return Requests Awaiting Credit Notes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Collected or approved returns without full credit note reconciliation
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {returnRequests
            .filter((r) => {
              if (r.status === 'Draft' || r.status === 'Rejected' || r.status === 'Closed') {
                return false;
              }
              const benchmark = r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit;
              const rec = totalCreditedByRequest.get(r.id) || 0;
              return rec < benchmark;
            })
            .map((req) => {
              const benchmark = req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit;
              const rec = totalCreditedByRequest.get(req.id) || 0;
              const outstanding = benchmark - rec;
              return (
                <div
                  key={req.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900">
                        {req.requestNumber}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-medium text-slate-700">
                        {supplierMap.get(req.supplierId)?.name}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{req.status}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                      Expected/Approved: {formatINR(benchmark)} · Credited so far: {formatINR(rec)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Outstanding</div>
                      <div className="font-mono tabular-nums text-xs font-semibold text-amber-700">
                        {formatINR(outstanding)}
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenUploadModal(req.id)}
                      className="h-8 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Record CN</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Upload Credit Note Modal */}
      {uploadContext.open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Upload &amp; Reconcile Supplier Credit Note
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link credit note to a return request; discrepancies are flagged automatically.
                </p>
              </div>
              <button
                onClick={onCloseUploadModal}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCreditNote} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Linked Return Request <span className="text-red-600">*</span>
                </label>
                <select
                  value={cnRequestId}
                  onChange={(e) => {
                    const req = requestMap.get(e.target.value);
                    setCnRequestId(e.target.value);
                    if (req) {
                      const alreadyCredited = totalCreditedByRequest.get(req.id) || 0;
                      const target =
                        (req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit) -
                        alreadyCredited;
                      setCnAmount(String(Math.max(0, target)));
                    }
                  }}
                  className="w-full h-9 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                >
                  {returnRequests
                    .filter((r) => r.status !== 'Draft' && r.status !== 'Rejected')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.requestNumber} — {supplierMap.get(r.supplierId)?.name} (
                        {formatINR(r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Credit Note Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={cnNumber}
                    onChange={(e) => setCnNumber(e.target.value)}
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Credit Note Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={cnDate}
                    onChange={(e) => setCnDate(e.target.value)}
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Actual Credit Amount (₹) <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    min={1}
                    type="number"
                    value={cnAmount}
                    onChange={(e) => setCnAmount(e.target.value)}
                    className="w-full h-9 px-3 font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Credit Note PDF / Document
                  </label>
                  <input
                    type="text"
                    value={cnDocName}
                    onChange={(e) => setCnDocName(e.target.value)}
                    placeholder={`${cnNumber || 'CN_Document'}.pdf`}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Live Discrepancy Preview */}
              {cnRequestId && requestMap.get(cnRequestId) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                  {(() => {
                    const req = requestMap.get(cnRequestId)!;
                    const baseline =
                      req.approvedCredit > 0 ? req.approvedCredit : req.expectedCredit;
                    const prev = totalCreditedByRequest.get(req.id) || 0;
                    const entered = Number(cnAmount) || 0;
                    const remaining = baseline - (prev + entered);
                    return (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>Claim Approved/Expected Baseline:</span>
                          <span className="font-mono tabular-nums font-medium text-slate-900">
                            {formatINR(baseline)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Previously Credited + This Entry:</span>
                          <span className="font-mono tabular-nums font-medium text-slate-900">
                            {formatINR(prev + entered)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold">
                          <span>Projected Unreconciled Difference:</span>
                          <span
                            className={`font-mono tabular-nums ${
                              remaining > 0 ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            {remaining > 0 ? formatINR(remaining) : '₹0 (Balanced)'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseUploadModal}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Save &amp; Reconcile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Discrepancy Modal */}
      {resolvingCn && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Resolve Credit Discrepancy — {resolvingCn.creditNoteNumber}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {supplierMap.get(resolvingCn.supplierId)?.name}
                </p>
              </div>
              <button
                onClick={() => setResolvingCn(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveResolution} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md flex items-start gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  If the supplier issued a supplementary credit note, record it separately or document
                  the agreed write-off / deduction reason below.
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Updated Reconciliation Status
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) =>
                    setResolutionStatus(e.target.value as ReconciliationStatus)
                  }
                  className="w-full h-9 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                >
                  <option value="Under review">Under review (Awaiting CFA reply)</option>
                  <option value="Partially credited">Partially credited (Balance CN pending)</option>
                  <option value="Reconciled">Reconciled (Discrepancy resolved)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Audit &amp; Resolution Notes <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g., CFA confirmed ₹7,000 GST rate adjustment to be settled in supplementary CN."
                  className="w-full p-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingCn(null)}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Reconciliation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
