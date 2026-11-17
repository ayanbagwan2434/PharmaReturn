import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { ImportHistoryRecord, InventoryBatch, Supplier } from '../types/pharma';
import { formatINR } from '../utils/formatters';

interface ParsedImportRow {
  rowNum: number;
  medicineName: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  purchasePrice: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  skipDuplicate?: boolean;
}

interface InventoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingBatches: InventoryBatch[];
  suppliers: Supplier[];
  onConfirmImport: (
    newBatches: Omit<InventoryBatch, 'id' | 'createdAt'>[],
    historyEntry: Omit<ImportHistoryRecord, 'id'>
  ) => void;
}

const SAMPLE_IMPORT_ROWS: ParsedImportRow[] = [
  {
    rowNum: 1,
    medicineName: 'Atorva 20mg Tablet (15s)',
    manufacturer: 'Zydus / Cipla Dist',
    batchNumber: 'ATV20-901',
    expiryDate: '2026-12-20',
    quantity: '120',
    purchasePrice: '195',
    supplierName: 'Cipla Health & Rx Distribution',
    invoiceNumber: 'INV-CP-90811',
    invoiceDate: '2025-07-10',
  },
  {
    rowNum: 2,
    medicineName: 'Glycomet-GP 2 Tablet (15s)',
    manufacturer: 'USV / Sun Pharma',
    batchNumber: '', // Intentional missing batch error
    expiryDate: '2027-01-14',
    quantity: '90',
    purchasePrice: '165',
    supplierName: 'Sun Pharma Laboratories Ltd.',
    invoiceNumber: 'INV-SN-58012',
    invoiceDate: '2025-08-02',
  },
  {
    rowNum: 3,
    medicineName: 'Augmentin 625 Duo Tablet (10s)',
    manufacturer: 'GSK / Cipla Dist',
    batchNumber: 'AUG625-24A', // Intentional duplicate with existing inventory!
    expiryDate: '2026-12-28',
    quantity: '140',
    purchasePrice: '185',
    supplierName: 'Cipla Health & Rx Distribution',
    invoiceNumber: 'INV-CP-88412',
    invoiceDate: '2025-07-12',
    skipDuplicate: true,
  },
  {
    rowNum: 4,
    medicineName: 'Telma-AM Tablet (15s)',
    manufacturer: 'Glenmark / Mankind',
    batchNumber: 'TLM-5504',
    expiryDate: '2026-12-10',
    quantity: '-15', // Intentional invalid negative quantity
    purchasePrice: '240',
    supplierName: 'Mankind Pharma Regional CFA',
    invoiceNumber: 'INV-MK-69021',
    invoiceDate: '2025-06-21',
  },
];

export const InventoryImportModal: React.FC<InventoryImportModalProps> = ({
  isOpen,
  onClose,
  existingBatches,
  suppliers,
  onConfirmImport,
}) => {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [errorsFixedCount, setErrorsFixedCount] = useState(0);

  const existingBatchKeys = useMemo(
    () => new Set(existingBatches.map((b) => b.batchNumber.trim().toUpperCase())),
    [existingBatches]
  );

  const resolveSupplier = (name: string): Supplier | undefined => {
    const q = name.trim().toLowerCase();
    return suppliers.find(
      (s) => s.name.toLowerCase() === q || s.name.toLowerCase().includes(q)
    );
  };

  const validateRow = (row: ParsedImportRow) => {
    const errors: string[] = [];
    if (!row.medicineName.trim()) errors.push('Medicine name required');
    if (!row.manufacturer.trim()) errors.push('Manufacturer required');
    if (!row.batchNumber.trim()) errors.push('Batch number required');
    if (!row.expiryDate || Number.isNaN(new Date(row.expiryDate).getTime())) {
      errors.push('Valid expiry date (YYYY-MM-DD) required');
    }
    const qty = Number(row.quantity);
    if (!Number.isFinite(qty) || qty <= 0) errors.push('Quantity must be > 0');
    const price = Number(row.purchasePrice);
    if (!Number.isFinite(price) || price <= 0) errors.push('Unit price must be > 0');
    const supplier = resolveSupplier(row.supplierName);
    if (!supplier) errors.push('Supplier not matched');

    const isDuplicate =
      Boolean(row.batchNumber.trim()) &&
      existingBatchKeys.has(row.batchNumber.trim().toUpperCase());

    return { errors, isDuplicate, supplier };
  };

  const validationSummary = useMemo(() => {
    let invalidCount = 0;
    let duplicateCount = 0;
    let validToImport = 0;

    rows.forEach((r) => {
      const { errors, isDuplicate } = validateRow(r);
      if (isDuplicate && r.skipDuplicate !== false) {
        duplicateCount += 1;
      } else if (errors.length > 0) {
        invalidCount += 1;
      } else {
        validToImport += 1;
      }
    });

    return { invalidCount, duplicateCount, validToImport };
  }, [rows, existingBatchKeys, suppliers]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        setRows(SAMPLE_IMPORT_ROWS);
        setStep('preview');
        return;
      }
      const parsed: ParsedImportRow[] = lines.slice(1).map((line, idx) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        return {
          rowNum: idx + 1,
          medicineName: cols[0] || '',
          manufacturer: cols[1] || '',
          batchNumber: cols[2] || '',
          expiryDate: cols[3] || '',
          quantity: cols[4] || '',
          purchasePrice: cols[5] || '',
          supplierName: cols[6] || '',
          invoiceNumber: cols[7] || '',
          invoiceDate: cols[8] || '',
          skipDuplicate: true,
        };
      });
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName('Stock_Expiry_Import_Nov2026.csv');
    setRows(SAMPLE_IMPORT_ROWS.map((r) => ({ ...r })));
    setErrorsFixedCount(0);
    setStep('preview');
  };

  const updateRowField = (
    rowNum: number,
    field: keyof ParsedImportRow,
    value: string | boolean
  ) => {
    setErrorsFixedCount((c) => c + 1);
    setRows((prev) =>
      prev.map((r) => (r.rowNum === rowNum ? { ...r, [field]: value } : r))
    );
  };

  const handleConfirm = () => {
    const toImport: Omit<InventoryBatch, 'id' | 'createdAt'>[] = [];
    let skippedDupes = 0;

    rows.forEach((r) => {
      const { errors, isDuplicate, supplier } = validateRow(r);
      if (isDuplicate && r.skipDuplicate !== false) {
        skippedDupes += 1;
        return;
      }
      if (errors.length > 0 || !supplier) return;

      toImport.push({
        medicineName: r.medicineName.trim(),
        manufacturer: r.manufacturer.trim(),
        batchNumber: r.batchNumber.trim(),
        expiryDate: r.expiryDate.trim(),
        quantity: Number(r.quantity),
        purchasePrice: Number(r.purchasePrice),
        supplierId: supplier.id,
        invoiceNumber: r.invoiceNumber.trim() || undefined,
        invoiceDate: r.invoiceDate.trim() || undefined,
      });
    });

    onConfirmImport(toImport, {
      fileName: fileName || 'Manual_Upload.csv',
      importedAt: new Date().toISOString(),
      importedBy: 'Sneha Kulkarni',
      totalRows: rows.length,
      importedCount: toImport.length,
      skippedDuplicates: skippedDupes,
      errorsFixed: errorsFixedCount,
      status: validationSummary.invalidCount > 0 ? 'Partial' : 'Completed',
    });

    setStep('upload');
    setRows([]);
    setFileName('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 id="import-modal-title" className="text-base font-semibold text-slate-900">
              Import Inventory Batches (CSV / Excel)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Validate required columns, detect duplicate batch numbers, and resolve data errors before confirming.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Close import modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'upload' ? (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50/50">
                <FileSpreadsheet className="w-9 h-9 text-teal-700 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Upload Stock &amp; Expiry CSV / XLSX Export
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Expected columns: Medicine Name, Manufacturer, Batch Number, Expiry Date (YYYY-MM-DD),
                  Quantity, Purchase Price, Supplier, Invoice Number, Invoice Date.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <label className="cursor-pointer h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-2 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose CSV File</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                  <button
                    onClick={handleLoadSample}
                    className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors"
                  >
                    Load Sample File (With Validation Errors)
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  Required &amp; Recommended Import Schema
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 text-xs">
                  <div>
                    <span className="font-medium text-slate-900">Medicine Name</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Manufacturer</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Batch Number</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Expiry Date</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Quantity</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Purchase Price (INR)</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Supplier</span>
                    <span className="text-red-600 ml-1">*</span>
                  </div>
                  <div className="text-slate-600">Invoice Number (Recommended)</div>
                  <div className="text-slate-600">Invoice Date (Recommended)</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Validation Summary Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-slate-500">File: </span>
                    <span className="font-mono font-medium text-slate-900">{fileName}</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{validationSummary.validToImport}</span>
                    <span>ready to import</span>
                  </div>
                  {validationSummary.invalidCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">
                        {validationSummary.invalidCount}
                      </span>
                      <span>validation error(s) — edit cells below</span>
                    </div>
                  )}
                  {validationSummary.duplicateCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">
                        {validationSummary.duplicateCount}
                      </span>
                      <span>duplicate batch skipped</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                >
                  Choose different file
                </button>
              </div>

              {/* Editable Preview Grid */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Medicine Name</th>
                      <th className="py-2.5 px-3">Batch No.</th>
                      <th className="py-2.5 px-3">Expiry</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit ₹</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.map((row) => {
                      const { errors, isDuplicate } = validateRow(row);
                      const hasError = errors.length > 0 && !(isDuplicate && row.skipDuplicate !== false);
                      return (
                        <tr
                          key={row.rowNum}
                          className={
                            isDuplicate
                              ? 'bg-amber-50/40'
                              : hasError
                                ? 'bg-red-50/40'
                                : 'bg-white'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-400">{row.rowNum}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 min-w-[180px]">
                            <input
                              type="text"
                              value={row.medicineName}
                              onChange={(e) =>
                                updateRowField(row.rowNum, 'medicineName', e.target.value)
                              }
                              className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 min-w-[120px]">
                            <input
                              type="text"
                              value={row.batchNumber}
                              placeholder="Enter batch..."
                              onChange={(e) =>
                                updateRowField(row.rowNum, 'batchNumber', e.target.value)
                              }
                              className={`w-full font-mono bg-white border rounded px-2 py-1 text-xs focus:outline-none ${
                                !row.batchNumber.trim()
                                  ? 'border-red-400 focus:border-red-600'
                                  : 'border-slate-200 focus:border-teal-600'
                              }`}
                            />
                          </td>
                          <td className="py-2.5 px-3 min-w-[130px]">
                            <input
                              type="date"
                              value={row.expiryDate}
                              onChange={(e) =>
                                updateRowField(row.rowNum, 'expiryDate', e.target.value)
                              }
                              className="w-full font-mono bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 min-w-[85px]">
                            <input
                              type="number"
                              value={row.quantity}
                              onChange={(e) =>
                                updateRowField(row.rowNum, 'quantity', e.target.value)
                              }
                              className={`w-full font-mono tabular-nums text-right bg-white border rounded px-2 py-1 text-xs focus:outline-none ${
                                Number(row.quantity) <= 0
                                  ? 'border-red-400 focus:border-red-600'
                                  : 'border-slate-200 focus:border-teal-600'
                              }`}
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-700 whitespace-nowrap">
                            {formatINR(Number(row.purchasePrice) || 0)}
                          </td>
                          <td className="py-2.5 px-3 min-w-[170px]">
                            <select
                              value={resolveSupplier(row.supplierName)?.name || row.supplierName}
                              onChange={(e) =>
                                updateRowField(row.rowNum, 'supplierName', e.target.value)
                              }
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-600"
                            >
                              {!resolveSupplier(row.supplierName) && (
                                <option value={row.supplierName}>
                                  Unmatched: {row.supplierName}
                                </option>
                              )}
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 min-w-[190px]">
                            {isDuplicate ? (
                              <div className="text-amber-700 font-medium">
                                Duplicate batch detected (skipped)
                              </div>
                            ) : errors.length > 0 ? (
                              <div className="text-red-700 font-medium">{errors.join(', ')}</div>
                            ) : (
                              <div className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Valid</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Duplicate batches are never silently added to inventory.
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
            {step === 'preview' && (
              <button
                onClick={handleConfirm}
                disabled={validationSummary.validToImport === 0}
                className="h-9 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
              >
                Confirm Import ({validationSummary.validToImport} Batches)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
