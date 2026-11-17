import React, { useMemo, useState } from 'react';
import {
  Archive,
  Barcode,
  Edit3,
  History,
  Plus,
  RotateCcw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  EligibilityStatus,
  ImportHistoryRecord,
  InventoryBatch,
  Supplier,
} from '../types/pharma';
import { evaluateBatchEligibility } from '../utils/eligibility';
import { formatDate, formatDateTime, formatINR } from '../utils/formatters';
import { EligibilityLabel } from './StatusIndicator';

interface InventoryViewProps {
  batches: InventoryBatch[];
  suppliers: Supplier[];
  importHistory: ImportHistoryRecord[];
  initialFilterHint?: string;
  onOpenImportModal: () => void;
  onAddBatch: (batch: Omit<InventoryBatch, 'id' | 'createdAt'>) => void;
  onUpdateBatch: (batch: InventoryBatch) => void;
  onToggleArchiveBatch: (batchId: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  batches,
  suppliers,
  importHistory,
  initialFilterHint,
  onOpenImportModal,
  onAddBatch,
  onUpdateBatch,
  onToggleArchiveBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'batches' | 'history'>('batches');
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'near-expiry' | 'expired'>(
    initialFilterHint === 'near-expiry'
      ? 'near-expiry'
      : initialFilterHint === 'expired'
        ? 'expired'
        : 'all'
  );
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | EligibilityStatus>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Barcode quick scanner (P1 feature)
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState<string | null>(null);

  // Manual Add / Edit Modal
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formState, setFormState] = useState({
    medicineName: '',
    manufacturer: '',
    batchNumber: '',
    expiryDate: '2027-01-15',
    quantity: '100',
    purchasePrice: '150',
    supplierId: suppliers[0]?.id || '',
    invoiceNumber: '',
    invoiceDate: '',
  });

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const enrichedBatches = useMemo(() => {
    return batches
      .filter((b) => (showArchived ? Boolean(b.archived) : !b.archived))
      .map((batch) => {
        const supplier = supplierMap.get(batch.supplierId);
        const evaluation = evaluateBatchEligibility(batch, supplier);
        const stockValue = batch.quantity * batch.purchasePrice;
        return { batch, supplier, evaluation, stockValue };
      })
      .filter(({ batch, evaluation }) => {
        if (supplierFilter !== 'all' && batch.supplierId !== supplierFilter) return false;
        if (expiryFilter === 'expired' && evaluation.daysToExpiry >= 0) return false;
        if (
          expiryFilter === 'near-expiry' &&
          (evaluation.daysToExpiry < 0 || evaluation.daysToExpiry > 90)
        ) {
          return false;
        }
        if (eligibilityFilter !== 'all' && evaluation.status !== eligibilityFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            batch.medicineName.toLowerCase().includes(q) ||
            batch.batchNumber.toLowerCase().includes(q) ||
            batch.manufacturer.toLowerCase().includes(q) ||
            (batch.invoiceNumber || '').toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      });
  }, [
    batches,
    showArchived,
    supplierMap,
    supplierFilter,
    expiryFilter,
    eligibilityFilter,
    searchQuery,
  ]);

  const totalFilteredValue = useMemo(
    () => enrichedBatches.reduce((sum, item) => sum + item.stockValue, 0),
    [enrichedBatches]
  );

  const handleBarcodeLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setSearchQuery(code);
    const match = batches.find(
      (b) => b.batchNumber.toLowerCase() === code.toLowerCase()
    );
    if (match) {
      setBarcodeFeedback(`Matched batch ${match.batchNumber} — ${match.medicineName}`);
    } else {
      setBarcodeFeedback(`Filtered by scanned code "${code}"`);
    }
  };

  const openAddModal = () => {
    setEditingBatch(null);
    setFormState({
      medicineName: '',
      manufacturer: '',
      batchNumber: '',
      expiryDate: '2027-01-15',
      quantity: '100',
      purchasePrice: '150',
      supplierId: suppliers[0]?.id || '',
      invoiceNumber: '',
      invoiceDate: '',
    });
    setIsAddOpen(true);
  };

  const openEditModal = (batch: InventoryBatch) => {
    setEditingBatch(batch);
    setFormState({
      medicineName: batch.medicineName,
      manufacturer: batch.manufacturer,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantity: String(batch.quantity),
      purchasePrice: String(batch.purchasePrice),
      supplierId: batch.supplierId,
      invoiceNumber: batch.invoiceNumber || '',
      invoiceDate: batch.invoiceDate || '',
    });
    setIsAddOpen(true);
  };

  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      medicineName: formState.medicineName.trim(),
      manufacturer: formState.manufacturer.trim(),
      batchNumber: formState.batchNumber.trim(),
      expiryDate: formState.expiryDate,
      quantity: Math.max(1, Number(formState.quantity) || 1),
      purchasePrice: Math.max(1, Number(formState.purchasePrice) || 1),
      supplierId: formState.supplierId,
      invoiceNumber: formState.invoiceNumber.trim() || undefined,
      invoiceDate: formState.invoiceDate || undefined,
    };
    if (editingBatch) {
      onUpdateBatch({ ...editingBatch, ...payload });
    } else {
      onAddBatch(payload);
    }
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Medicine Batch Inventory
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Import stock exports, inspect batch expiry timelines, and maintain purchase invoice references.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'batches'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Ledger
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Import History ({importHistory.length})</span>
            </button>
          </div>

          <button
            onClick={onOpenImportModal}
            className="h-9 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import CSV / Excel</span>
          </button>

          <button
            onClick={openAddModal}
            className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Batch</span>
          </button>
        </div>
      </div>

      {activeTab === 'batches' ? (
        <>
          {/* Filter & Barcode Scan Toolbar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setBarcodeFeedback(null);
                  }}
                  placeholder="Search medicine name, batch number, manufacturer, or invoice..."
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>

              <form onSubmit={handleBarcodeLookup} className="flex items-center gap-1.5">
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan batch barcode..."
                    className="h-9 pl-8 pr-3 w-44 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
                <button
                  type="submit"
                  className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                >
                  Scan
                </button>
              </form>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  aria-label="Filter by supplier"
                  className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={expiryFilter}
                  onChange={(e) =>
                    setExpiryFilter(e.target.value as 'all' | 'near-expiry' | 'expired')
                  }
                  aria-label="Filter by expiry"
                  className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
                >
                  <option value="all">All Expiry Windows</option>
                  <option value="near-expiry">Near Expiry (0–90 days)</option>
                  <option value="expired">Already Expired</option>
                </select>

                <select
                  value={eligibilityFilter}
                  onChange={(e) =>
                    setEligibilityFilter(e.target.value as 'all' | EligibilityStatus)
                  }
                  aria-label="Filter by eligibility"
                  className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:border-teal-600"
                >
                  <option value="all">All Eligibility Statuses</option>
                  <option value="Eligible">Eligible</option>
                  <option value="Approaching eligibility">Approaching eligibility</option>
                  <option value="Manual verification required">Manual verification required</option>
                  <option value="Policy not configured">Policy not configured</option>
                  <option value="Expired">Expired</option>
                  <option value="Not yet eligible">Not yet eligible</option>
                </select>

                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>Show archived</span>
                </label>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-3">
                {barcodeFeedback && (
                  <span className="text-teal-700 font-medium">{barcodeFeedback}</span>
                )}
                <span>
                  Showing{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {enrichedBatches.length}
                  </strong>{' '}
                  batches · Total Value{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {formatINR(totalFilteredValue)}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Inventory Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {enrichedBatches.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-slate-900">
                  No medicine batches match your active filters
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your search query or import new stock records from your pharmacy ERP export.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSupplierFilter('all');
                      setExpiryFilter('all');
                      setEligibilityFilter('all');
                    }}
                    className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 rounded-md"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={onOpenImportModal}
                    className="h-8 px-3 bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white rounded-md"
                  >
                    Import CSV / Excel
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">Medicine &amp; Manufacturer</th>
                      <th className="py-3 px-4">Batch / Invoice</th>
                      <th className="py-3 px-4">Expiry</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-right">Stock Value</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Eligibility</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {enrichedBatches.map(({ batch, supplier, evaluation, stockValue }) => (
                      <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{batch.medicineName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {batch.manufacturer}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-800">
                            {batch.batchNumber}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                            {batch.invoiceNumber || 'No invoice'}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums text-slate-900">
                            {formatDate(batch.expiryDate)}
                          </div>
                          <div
                            className={`font-mono tabular-nums text-[11px] mt-0.5 ${
                              evaluation.daysToExpiry < 0
                                ? 'text-red-700'
                                : evaluation.daysToExpiry <= 90
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {evaluation.daysToExpiry < 0
                              ? `${Math.abs(evaluation.daysToExpiry)}d expired`
                              : `${evaluation.daysToExpiry}d left`}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                          {batch.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {formatINR(batch.purchasePrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatINR(stockValue)}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-[170px] truncate">
                          {supplier?.name || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <EligibilityLabel status={evaluation.status} />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(batch)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="Edit batch"
                              aria-label={`Edit ${batch.batchNumber}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onToggleArchiveBatch(batch.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title={batch.archived ? 'Restore batch' : 'Archive batch'}
                              aria-label={
                                batch.archived
                                  ? `Restore ${batch.batchNumber}`
                                  : `Archive ${batch.batchNumber}`
                              }
                            >
                              {batch.archived ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <Archive className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Import History Table */
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Inventory Import History</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of stock file uploads, duplicate detections, and validation corrections.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Imported At</th>
                  <th className="py-3 px-4">Imported By</th>
                  <th className="py-3 px-4 text-right">Total Rows</th>
                  <th className="py-3 px-4 text-right">Imported</th>
                  <th className="py-3 px-4 text-right">Duplicates Skipped</th>
                  <th className="py-3 px-4 text-right">Errors Fixed</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {importHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {item.fileName}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {formatDateTime(item.importedAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{item.importedBy}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {item.totalRows}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-emerald-700">
                      {item.importedCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                      {item.skippedDuplicates}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {item.errorsFixed}
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-700">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Add / Edit Batch Modal */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingBatch ? `Edit Batch ${editingBatch.batchNumber}` : 'Add Medicine Batch'}
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBatch} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Medicine Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formState.medicineName}
                    onChange={(e) =>
                      setFormState({ ...formState, medicineName: e.target.value })
                    }
                    placeholder="e.g., Augmentin 625 Duo Tablet (10s)"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Manufacturer <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formState.manufacturer}
                    onChange={(e) =>
                      setFormState({ ...formState, manufacturer: e.target.value })
                    }
                    placeholder="e.g., Cipla Ltd"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Batch Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formState.batchNumber}
                    onChange={(e) =>
                      setFormState({ ...formState, batchNumber: e.target.value })
                    }
                    placeholder="e.g., AUG625-24A"
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Supplier <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formState.supplierId}
                    onChange={(e) =>
                      setFormState({ ...formState, supplierId: e.target.value })
                    }
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
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
                    Expiry Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={formState.expiryDate}
                    onChange={(e) =>
                      setFormState({ ...formState, expiryDate: e.target.value })
                    }
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Quantity (Strips / Units) <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    min={1}
                    type="number"
                    value={formState.quantity}
                    onChange={(e) =>
                      setFormState({ ...formState, quantity: e.target.value })
                    }
                    className="w-full h-9 px-3 font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Purchase Price / Unit (₹) <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    min={1}
                    type="number"
                    value={formState.purchasePrice}
                    onChange={(e) =>
                      setFormState({ ...formState, purchasePrice: e.target.value })
                    }
                    className="w-full h-9 px-3 font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={formState.invoiceNumber}
                    onChange={(e) =>
                      setFormState({ ...formState, invoiceNumber: e.target.value })
                    }
                    placeholder="INV-..."
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={formState.invoiceDate}
                    onChange={(e) =>
                      setFormState({ ...formState, invoiceDate: e.target.value })
                    }
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md"
                >
                  {editingBatch ? 'Save Changes' : 'Add Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
