import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  FileText,
  Paperclip,
  Plus,
  ReceiptIndianRupee,
  Search,
  X,
} from 'lucide-react';
import {
  CreditNote,
  InventoryBatch,
  ReturnRequest,
  ReturnRequestItem,
  ReturnStatus,
  Supplier,
} from '../types/pharma';
import { evaluateBatchEligibility } from '../utils/eligibility';
import { exportRowsToCSV, formatDate, formatDateTime, formatINR } from '../utils/formatters';
import { EligibilityLabel, ReturnStatusLabel } from './StatusIndicator';

const ALL_RETURN_STATUSES: ReturnStatus[] = [
  'Draft',
  'Submitted',
  'Awaiting supplier response',
  'Approved',
  'Partially approved',
  'Rejected',
  'Pickup scheduled',
  'Collected',
  'Credit pending',
  'Partially credited',
  'Credited',
  'Closed',
];

interface ReturnsViewProps {
  returnRequests: ReturnRequest[];
  suppliers: Supplier[];
  batches: InventoryBatch[];
  creditNotes: CreditNote[];
  selectedRequestId: string | null;
  onSelectRequest: (id: string | null) => void;
  createDraftContext: { open: boolean; supplierId?: string; batchId?: string };
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
  onCreateRequest: (req: Omit<ReturnRequest, 'id' | 'requestNumber' | 'createdAt'>) => void;
  onUpdateRequestStatus: (
    requestId: string,
    newStatus: ReturnStatus,
    approvedCredit: number,
    note?: string,
    rejectionReason?: string
  ) => void;
  onAttachDocument: (requestId: string, fileName: string) => void;
  onOpenRecordCreditNote: (returnRequestId: string) => void;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  returnRequests,
  suppliers,
  batches,
  creditNotes,
  selectedRequestId,
  onSelectRequest,
  createDraftContext,
  onCloseCreateModal,
  onOpenCreateModal,
  onCreateRequest,
  onUpdateRequestStatus,
  onAttachDocument,
  onOpenRecordCreditNote,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReturnStatus>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Create Return Request Form State
  const [draftSupplierId, setDraftSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [selectedBatchQtys, setSelectedBatchQtys] = useState<Record<string, number>>({});
  const [draftRemarks, setDraftRemarks] = useState('');
  const [draftDocName, setDraftDocName] = useState('');

  // Status Update Modal/Form inside Detail Drawer
  const [nextStatus, setNextStatus] = useState<ReturnStatus>('Submitted');
  const [approvedAmountInput, setApprovedAmountInput] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  // Sync prefilled supplier/batch when triggered from Eligibility Engine
  useEffect(() => {
    if (createDraftContext.open) {
      const targetSup = createDraftContext.supplierId || suppliers[0]?.id || '';
      setDraftSupplierId(targetSup);
      if (createDraftContext.batchId) {
        const b = batches.find((x) => x.id === createDraftContext.batchId);
        if (b) {
          setSelectedBatchQtys({ [b.id]: b.quantity });
        }
      } else {
        setSelectedBatchQtys({});
      }
      setDraftRemarks('');
      setDraftDocName('');
    }
  }, [createDraftContext, suppliers, batches]);

  const selectedRequest = useMemo(
    () => returnRequests.find((r) => r.id === selectedRequestId) || null,
    [returnRequests, selectedRequestId]
  );

  useEffect(() => {
    if (selectedRequest) {
      setNextStatus(selectedRequest.status);
      setApprovedAmountInput(
        String(
          selectedRequest.approvedCredit > 0
            ? selectedRequest.approvedCredit
            : selectedRequest.expectedCredit
        )
      );
      setStatusNote('');
      setRejectionReason(selectedRequest.rejectionReason || '');
    }
  }, [selectedRequest]);

  const filteredRequests = useMemo(() => {
    return returnRequests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (supplierFilter !== 'all' && r.supplierId !== supplierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const supName = supplierMap.get(r.supplierId)?.name.toLowerCase() || '';
        return (
          r.requestNumber.toLowerCase().includes(q) ||
          supName.includes(q) ||
          r.items.some(
            (it) =>
              it.medicineName.toLowerCase().includes(q) ||
              it.batchNumber.toLowerCase().includes(q)
          )
        );
      }
      return true;
    });
  }, [returnRequests, statusFilter, supplierFilter, searchQuery, supplierMap]);

  // Batches available for the chosen supplier in Create Return modal
  const supplierCandidateBatches = useMemo(() => {
    return batches
      .filter((b) => !b.archived && b.supplierId === draftSupplierId)
      .map((batch) => ({
        batch,
        evaluation: evaluateBatchEligibility(batch, supplierMap.get(batch.supplierId)),
      }));
  }, [batches, draftSupplierId, supplierMap]);

  const draftTotalExpected = useMemo(() => {
    return supplierCandidateBatches.reduce((sum, { batch }) => {
      const qty = selectedBatchQtys[batch.id] || 0;
      return sum + qty * batch.purchasePrice;
    }, 0);
  }, [supplierCandidateBatches, selectedBatchQtys]);

  const toggleBatchSelection = (batch: InventoryBatch) => {
    setSelectedBatchQtys((prev) => {
      const next = { ...prev };
      if (next[batch.id]) {
        delete next[batch.id];
      } else {
        next[batch.id] = batch.quantity;
      }
      return next;
    });
  };

  const handleSubmitNewRequest = (asDraft: boolean) => {
    const items: ReturnRequestItem[] = supplierCandidateBatches
      .filter(({ batch }) => (selectedBatchQtys[batch.id] || 0) > 0)
      .map(({ batch }, idx) => {
        const qty = Math.min(batch.quantity, selectedBatchQtys[batch.id]);
        const expected = qty * batch.purchasePrice;
        return {
          id: `rri-new-${Date.now()}-${idx}`,
          batchId: batch.id,
          medicineName: batch.medicineName,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          requestedQuantity: qty,
          approvedQuantity: 0,
          unitPrice: batch.purchasePrice,
          expectedCredit: expected,
          approvedCredit: 0,
        };
      });

    if (items.length === 0) return;

    const initialStatus: ReturnStatus = asDraft ? 'Draft' : 'Submitted';
    onCreateRequest({
      supplierId: draftSupplierId,
      submissionDate: '2026-11-17',
      expectedCredit: draftTotalExpected,
      approvedCredit: 0,
      status: initialStatus,
      remarks: draftRemarks.trim() || 'Return request prepared from eligible stock.',
      documents: draftDocName.trim()
        ? [{ name: draftDocName.trim(), uploadedAt: '2026-11-17', size: '240 KB' }]
        : [],
      items,
      statusHistory: [
        {
          id: `sh-new-${Date.now()}`,
          status: initialStatus,
          timestamp: new Date().toISOString(),
          updatedBy: 'Sneha Kulkarni',
          note: asDraft ? 'Saved as draft.' : 'Submitted to supplier.',
        },
      ],
      createdBy: 'Sneha Kulkarni',
    });
    onCloseCreateModal();
  };

  const handleStatusSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (nextStatus === 'Rejected' && !rejectionReason.trim()) return;
    const parsedApproved = Number(approvedAmountInput) || 0;
    onUpdateRequestStatus(
      selectedRequest.id,
      nextStatus,
      parsedApproved,
      statusNote.trim() || undefined,
      nextStatus === 'Rejected' ? rejectionReason.trim() : undefined
    );
    setStatusNote('');
  };

  const handleDownloadReturnManifest = (req: ReturnRequest) => {
    const supName = supplierMap.get(req.supplierId)?.name || 'Supplier';
    exportRowsToCSV(
      `${req.requestNumber}_Return_Manifest.csv`,
      [
        'Request ID',
        'Supplier',
        'Medicine',
        'Batch',
        'Expiry',
        'Requested Qty',
        'Unit Price (INR)',
        'Expected Credit (INR)',
        'Status',
      ],
      req.items.map((it) => [
        req.requestNumber,
        supName,
        it.medicineName,
        it.batchNumber,
        it.expiryDate,
        it.requestedQuantity,
        it.unitPrice,
        it.expectedCredit,
        req.status,
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Return Requests
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Prepare multi-batch return claims, attach supporting documents, and track approvals through credit closure.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Return Request</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search request ID (e.g. PR-2026-0142), supplier, medicine, or batch..."
            className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          aria-label="Filter requests by supplier"
          className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ReturnStatus)}
          aria-label="Filter requests by status"
          className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
        >
          <option value="all">All Statuses</option>
          {ALL_RETURN_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Return Requests Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No return requests match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Batches</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Expected Credit</th>
                  <th className="py-3 px-4 text-right">Approved</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => onSelectRequest(req.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedRequestId === req.id ? 'bg-teal-50/40' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-teal-700 whitespace-nowrap">
                      {req.requestNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-900 font-medium">
                      {supplierMap.get(req.supplierId)?.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono tabular-nums">
                      {req.items.length} batch{req.items.length > 1 ? 'es' : ''}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDate(req.submissionDate)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatINR(req.expectedCredit)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {req.approvedCredit > 0 ? formatINR(req.approvedCredit) : '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <ReturnStatusLabel status={req.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRequest(req.id);
                        }}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Return Request Details Slide-over Drawer */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-semibold text-slate-900">
                    {selectedRequest.requestNumber}
                  </span>
                  <span className="text-slate-300">·</span>
                  <ReturnStatusLabel status={selectedRequest.status} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {supplierMap.get(selectedRequest.supplierId)?.name} · Submitted{' '}
                  {formatDate(selectedRequest.submissionDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadReturnManifest(selectedRequest)}
                  className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Manifest</span>
                </button>
                <button
                  onClick={() => onSelectRequest(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Financial Summary Strip */}
              <div className="grid grid-cols-3 gap-3 border border-slate-200 rounded-lg p-4 bg-slate-50/70">
                <div>
                  <div className="text-[11px] text-slate-500">Expected Credit</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatINR(selectedRequest.expectedCredit)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Supplier Approved</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                    {selectedRequest.approvedCredit > 0
                      ? formatINR(selectedRequest.approvedCredit)
                      : 'Pending'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Credited via CN</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-emerald-700 mt-0.5">
                    {formatINR(
                      creditNotes
                        .filter((cn) => cn.returnRequestId === selectedRequest.id)
                        .reduce((s, cn) => s + cn.creditAmount, 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Batches Included */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-2.5">
                  Included Medicine Batches ({selectedRequest.items.length})
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 px-3">Medicine &amp; Batch</th>
                        <th className="py-2 px-3">Expiry</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Expected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedRequest.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{item.medicineName}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {item.batchNumber} · ₹{item.unitPrice}/unit
                            </div>
                            {item.rejectionReason && (
                              <div className="text-[11px] text-amber-700 mt-0.5">
                                Note: {item.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                            {formatDate(item.expiryDate)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {item.requestedQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                            {formatINR(item.expectedCredit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks & Supporting Documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-3.5">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">
                    Distributor Remarks
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedRequest.remarks || 'No remarks.'}
                  </p>
                  {selectedRequest.rejectionReason && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-red-700">
                      <span className="font-semibold">Rejection Reason: </span>
                      {selectedRequest.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Supporting Documents
                    </span>
                    <button
                      onClick={() => {
                        const docName = `${selectedRequest.requestNumber}_Followup_${selectedRequest.documents.length + 1}.pdf`;
                        onAttachDocument(selectedRequest.id, docName);
                      }}
                      className="text-[11px] font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>Attach File</span>
                    </button>
                  </div>
                  {selectedRequest.documents.length === 0 ? (
                    <div className="text-xs text-slate-400">No documents attached yet.</div>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {selectedRequest.documents.map((doc, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-2 text-slate-700"
                        >
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate font-mono text-[11px]">{doc.name}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 shrink-0">{doc.size}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Update Return Status Form */}
              <form
                onSubmit={handleStatusSave}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Update Request Status</h3>
                  <button
                    type="button"
                    onClick={() => onOpenRecordCreditNote(selectedRequest.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    <ReceiptIndianRupee className="w-3.5 h-3.5" />
                    <span>Upload Credit Note</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Next Status</label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as ReturnStatus)}
                      className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                    >
                      {ALL_RETURN_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Supplier Approved Credit (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={approvedAmountInput}
                      onChange={(e) => setApprovedAmountInput(e.target.value)}
                      className="w-full h-9 px-3 font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                {nextStatus === 'Rejected' && (
                  <div>
                    <label className="block font-medium text-red-700 mb-1">
                      Rejection Reason <span className="text-red-600">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Specify supplier reason for rejection..."
                      className="w-full h-9 px-3 bg-white border border-red-300 rounded-md focus:outline-none focus:border-red-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Follow-up / Logistics Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g., Pickup LR #49120 confirmed by CFA..."
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="h-8 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md"
                  >
                    Record Status Update
                  </button>
                </div>
              </form>

              {/* Timestamped Status Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-3">
                  Timestamped Activity Log
                </h3>
                <div className="space-y-3 border-l border-slate-200 ml-2 pl-4">
                  {[...selectedRequest.statusHistory].reverse().map((entry) => (
                    <div key={entry.id} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <ReturnStatusLabel status={entry.status} />
                        <span className="font-mono text-[11px] text-slate-400">
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Updated by {entry.updatedBy}
                      </div>
                      {entry.note && (
                        <div className="text-slate-700 mt-1">{entry.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Return Request Modal */}
      {createDraftContext.open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Create Medicine Return Request
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a supplier, choose batches and return quantities, and review expected INR credit.
                </p>
              </div>
              <button
                onClick={onCloseCreateModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Select Supplier <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={draftSupplierId}
                    onChange={(e) => {
                      setDraftSupplierId(e.target.value);
                      setSelectedBatchQtys({});
                    }}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Supporting Debit Note / Document Reference
                  </label>
                  <input
                    type="text"
                    value={draftDocName}
                    onChange={(e) => setDraftDocName(e.target.value)}
                    placeholder="e.g., Debit_Note_Nov2026.pdf"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Candidate Batches Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">
                    Available Batches for {supplierMap.get(draftSupplierId)?.name}
                  </span>
                  <span className="text-slate-500">
                    Selected Value:{' '}
                    <strong className="font-mono tabular-nums text-teal-700">
                      {formatINR(draftTotalExpected)}
                    </strong>
                  </span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {supplierCandidateBatches.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      No active batches found for this supplier.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 px-3 w-10">Pick</th>
                          <th className="py-2.5 px-3">Medicine &amp; Batch</th>
                          <th className="py-2.5 px-3">Expiry</th>
                          <th className="py-2.5 px-3">Eligibility</th>
                          <th className="py-2.5 px-3 text-right">Return Qty</th>
                          <th className="py-2.5 px-3 text-right">Expected Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {supplierCandidateBatches.map(({ batch, evaluation }) => {
                          const qty = selectedBatchQtys[batch.id] || 0;
                          const isChecked = qty > 0;
                          return (
                            <tr key={batch.id} className={isChecked ? 'bg-teal-50/40' : ''}>
                              <td className="py-2.5 px-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleBatchSelection(batch)}
                                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                                  aria-label={`Select ${batch.medicineName}`}
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-900">
                                  {batch.medicineName}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500">
                                  {batch.batchNumber} · Avail: {batch.quantity} @ ₹
                                  {batch.purchasePrice}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                                {formatDate(batch.expiryDate)}
                              </td>
                              <td className="py-2.5 px-3">
                                <EligibilityLabel status={evaluation.status} />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={batch.quantity}
                                  value={qty || ''}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = Math.min(
                                      batch.quantity,
                                      Math.max(0, Number(e.target.value) || 0)
                                    );
                                    setSelectedBatchQtys((prev) => ({
                                      ...prev,
                                      [batch.id]: val,
                                    }));
                                  }}
                                  className="w-20 h-8 px-2 text-right font-mono tabular-nums border border-slate-200 rounded bg-white focus:outline-none focus:border-teal-600"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {formatINR(qty * batch.purchasePrice)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Remarks &amp; Supplier Instructions
                </label>
                <textarea
                  rows={2}
                  value={draftRemarks}
                  onChange={(e) => setDraftRemarks(e.target.value)}
                  placeholder="Optional remarks for CFA pickup or invoice reference..."
                  className="w-full p-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600">
                Total Expected Credit:{' '}
                <strong className="font-mono tabular-nums text-sm text-slate-900">
                  {formatINR(draftTotalExpected)}
                </strong>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onCloseCreateModal}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitNewRequest(true)}
                  disabled={draftTotalExpected <= 0}
                  className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-medium rounded-md"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSubmitNewRequest(false)}
                  disabled={draftTotalExpected <= 0}
                  className="h-9 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Submit Return Request</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
