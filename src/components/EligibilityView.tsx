import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Info,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  EligibilityStatus,
  InventoryBatch,
  Supplier,
} from '../types/pharma';
import { evaluateBatchEligibility } from '../utils/eligibility';
import { formatDate, formatINR } from '../utils/formatters';
import { EligibilityLabel, PolicyVerificationLabel } from './StatusIndicator';

interface EligibilityViewProps {
  batches: InventoryBatch[];
  suppliers: Supplier[];
  initialStatusFilter?: string;
  onOverrideEligibility: (
    batchId: string,
    override: { status: EligibilityStatus; reason: string } | null
  ) => void;
  onCreateReturnForSupplier: (supplierId: string, batchId: string) => void;
}

const ALL_STATUSES: EligibilityStatus[] = [
  'Eligible',
  'Approaching eligibility',
  'Manual verification required',
  'Policy not configured',
  'Expired',
  'Not yet eligible',
  'Ineligible',
];

export const EligibilityView: React.FC<EligibilityViewProps> = ({
  batches,
  suppliers,
  initialStatusFilter,
  onOverrideEligibility,
  onCreateReturnForSupplier,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | EligibilityStatus>(
    ALL_STATUSES.includes(initialStatusFilter as EligibilityStatus)
      ? (initialStatusFilter as EligibilityStatus)
      : 'all'
  );
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Override Modal State
  const [overrideTarget, setOverrideTarget] = useState<InventoryBatch | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<EligibilityStatus>('Eligible');
  const [overrideReason, setOverrideReason] = useState('');

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const evaluatedRows = useMemo(() => {
    return batches
      .filter((b) => !b.archived)
      .map((batch) => {
        const supplier = supplierMap.get(batch.supplierId);
        const evaluation = evaluateBatchEligibility(batch, supplier);
        const value = batch.quantity * batch.purchasePrice;
        return { batch, supplier, evaluation, value };
      });
  }, [batches, supplierMap]);

  const countsByStatus = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    evaluatedRows.forEach(({ evaluation, value }) => {
      if (!counts[evaluation.status]) {
        counts[evaluation.status] = { count: 0, value: 0 };
      }
      counts[evaluation.status].count += 1;
      counts[evaluation.status].value += value;
    });
    return counts;
  }, [evaluatedRows]);

  const filteredRows = useMemo(() => {
    return evaluatedRows.filter(({ batch, evaluation }) => {
      if (statusFilter !== 'all' && evaluation.status !== statusFilter) return false;
      if (supplierFilter !== 'all' && batch.supplierId !== supplierFilter) return false;
      return true;
    });
  }, [evaluatedRows, statusFilter, supplierFilter]);

  const openOverride = (batch: InventoryBatch, currentStatus: EligibilityStatus) => {
    setOverrideTarget(batch);
    setOverrideStatus(batch.manualOverride?.status || currentStatus);
    setOverrideReason(batch.manualOverride?.reason || '');
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTarget || !overrideReason.trim()) return;
    onOverrideEligibility(overrideTarget.id, {
      status: overrideStatus,
      reason: overrideReason.trim(),
    });
    setOverrideTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Return Eligibility Engine
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Automated batch classification evaluated against each supplier&apos;s configured return window and expiry rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            aria-label="Filter eligibility by supplier"
            className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Important Business Rule Notice */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-lg px-4 py-3 flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Internal Policy Estimate: </span>
          Eligibility classifications reflect configured supplier policies and internal verification status.
          Final return acceptance and credit issuance remain subject to supplier inspection and approval.
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Batches ({evaluatedRows.length})
        </button>
        {ALL_STATUSES.map((status) => {
          const stat = countsByStatus[status] || { count: 0, value: 0 };
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === status
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {status} ({stat.count})
            </button>
          );
        })}
      </div>

      {/* Eligibility Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No batches currently fall under &ldquo;{statusFilter}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Medicine &amp; Batch</th>
                  <th className="py-3 px-4">Supplier &amp; Policy</th>
                  <th className="py-3 px-4">Expiry / Deadline</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Eligibility Rationale</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRows.map(({ batch, supplier, evaluation, value }) => (
                  <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{batch.medicineName}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                        {batch.batchNumber} · {batch.quantity} units
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">
                        {supplier?.name || 'Unknown'}
                      </div>
                      <div className="mt-0.5">
                        {supplier && (
                          <PolicyVerificationLabel status={supplier.policy.verificationStatus} />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono tabular-nums text-slate-900">
                        Exp: {formatDate(batch.expiryDate)}
                      </div>
                      <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                        {evaluation.returnDeadlineDate
                          ? `Cutoff: ${formatDate(evaluation.returnDeadlineDate)}`
                          : 'No cutoff configured'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatINR(value)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <EligibilityLabel status={evaluation.status} />
                      {evaluation.isOverridden && (
                        <div className="text-[11px] text-slate-500 mt-0.5">Manual override</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs leading-relaxed">
                      {evaluation.reason}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openOverride(batch, evaluation.status)}
                          className="h-7 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-medium rounded inline-flex items-center gap-1"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Override</span>
                        </button>
                        {(evaluation.status === 'Eligible' ||
                          evaluation.status === 'Manual verification required') && (
                          <button
                            onClick={() => onCreateReturnForSupplier(batch.supplierId, batch.id)}
                            className="h-7 px-2.5 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-medium rounded inline-flex items-center gap-1"
                          >
                            <span>Create Return</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override Eligibility Modal */}
      {overrideTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Override Eligibility Classification
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {overrideTarget.medicineName} ({overrideTarget.batchNumber})
                </p>
              </div>
              <button
                onClick={() => setOverrideTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOverride} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  New Eligibility Status
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as EligibilityStatus)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Override Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Written email exception granted by Area Sales Manager on 16 Nov 2026."
                  className="w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                />
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Overrides are logged with user attribution for audit review.</span>
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {overrideTarget.manualOverride ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOverrideEligibility(overrideTarget.id, null);
                      setOverrideTarget(null);
                    }}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Revert to Auto-Calculated</span>
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideTarget(null)}
                    className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md"
                  >
                    Save Override
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
