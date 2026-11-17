import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  History,
  Plus,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  InventoryBatch,
  PolicyVerificationStatus,
  Supplier,
  SupplierPolicy,
} from '../types/pharma';
import { formatDate, formatINR } from '../utils/formatters';
import { PolicyVerificationLabel } from './StatusIndicator';

interface SuppliersViewProps {
  suppliers: Supplier[];
  batches: InventoryBatch[];
  initialSelectedSupplierId?: string;
  onAddSupplier: (
    supplier: Omit<Supplier, 'id' | 'policyHistory'>
  ) => void;
  onUpdateSupplier: (supplier: Supplier, policyChangeSummary?: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  batches,
  initialSelectedSupplierId,
  onAddSupplier,
  onUpdateSupplier,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<
    'all' | PolicyVerificationStatus
  >('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    initialSelectedSupplierId || suppliers[0]?.id || null
  );

  // Add / Edit Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    address: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Policy Editor Modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState<SupplierPolicy>({
    configured: true,
    returnWindowDays: 90,
    acceptsExpiredStock: false,
    expiredGraceDays: 0,
    minRemainingShelfLifeDays: 15,
    creditMethod: 'Credit note',
    policyNotes: '',
    policySource: '',
    verificationStatus: 'Verified',
    lastVerifiedAt: '2026-11-17',
    updatedAt: '2026-11-17',
  });

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (
        verificationFilter !== 'all' &&
        s.policy.verificationStatus !== verificationFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          (s.gstin || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [suppliers, verificationFilter, searchQuery]);

  const selectedSupplier = useMemo(
    () =>
      suppliers.find((s) => s.id === selectedSupplierId) ||
      filteredSuppliers[0] ||
      null,
    [suppliers, selectedSupplierId, filteredSuppliers]
  );

  const supplierStats = useMemo(() => {
    const map = new Map<string, { batchCount: number; totalValue: number }>();
    batches
      .filter((b) => !b.archived)
      .forEach((b) => {
        const prev = map.get(b.supplierId) || { batchCount: 0, totalValue: 0 };
        map.set(b.supplierId, {
          batchCount: prev.batchCount + 1,
          totalValue: prev.totalValue + b.quantity * b.purchasePrice,
        });
      });
    return map;
  }, [batches]);

  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      gstin: '',
      address: '',
      status: 'Active',
    });
    setIsSupplierModalOpen(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      gstin: supplier.gstin || '',
      address: supplier.address,
      status: supplier.status,
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        ...supplierForm,
        gstin: supplierForm.gstin.trim() || undefined,
      });
    } else {
      onAddSupplier({
        ...supplierForm,
        gstin: supplierForm.gstin.trim() || undefined,
        policy: {
          configured: false,
          returnWindowDays: 0,
          acceptsExpiredStock: false,
          expiredGraceDays: 0,
          minRemainingShelfLifeDays: 0,
          creditMethod: 'Credit note',
          policyNotes: 'Policy pending confirmation with supplier.',
          policySource: 'Pending onboarding',
          verificationStatus: 'Not configured',
          lastVerifiedAt: '',
          updatedAt: '2026-11-17',
        },
      });
    }
    setIsSupplierModalOpen(false);
  };

  const openPolicyEditor = (supplier: Supplier) => {
    setPolicyForm({
      ...supplier.policy,
      configured: true,
      returnWindowDays: supplier.policy.returnWindowDays || 90,
    });
    setIsPolicyModalOpen(true);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const updatedPolicy: SupplierPolicy = {
      ...policyForm,
      configured: true,
      updatedAt: '2026-11-17',
      lastVerifiedAt:
        policyForm.verificationStatus === 'Verified'
          ? policyForm.lastVerifiedAt || '2026-11-17'
          : policyForm.lastVerifiedAt,
    };
    const summary = `Updated policy: ${updatedPolicy.returnWindowDays}d pre-expiry · ${
      updatedPolicy.acceptsExpiredStock
        ? `Accepts expired (${updatedPolicy.expiredGraceDays}d)`
        : 'No expired stock'
    } · Status: ${updatedPolicy.verificationStatus}`;
    onUpdateSupplier(
      {
        ...selectedSupplier,
        policy: updatedPolicy,
      },
      summary
    );
    setIsPolicyModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Suppliers &amp; Return Policy Rules
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Maintain distributor-specific return windows, expired stock acceptance, and policy verification status.
          </p>
        </div>
        <button
          onClick={openAddSupplier}
          className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supplier name, contact person, or GSTIN..."
            className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-md overflow-x-auto">
          {(['all', 'Verified', 'Unverified', 'Not configured'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setVerificationFilter(status)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                verificationFilter === status
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'all' ? 'All Policies' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Split Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No suppliers match your search.
            </div>
          ) : (
            filteredSuppliers.map((sup) => {
              const stats = supplierStats.get(sup.id) || { batchCount: 0, totalValue: 0 };
              const isSelected = selectedSupplier?.id === sup.id;
              return (
                <button
                  key={sup.id}
                  onClick={() => setSelectedSupplierId(sup.id)}
                  className={`w-full text-left p-4 transition-colors focus:outline-none ${
                    isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-slate-900">{sup.name}</div>
                    <PolicyVerificationLabel status={sup.policy.verificationStatus} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{sup.contactPerson}</span>
                    <span>·</span>
                    <span className="font-mono">{sup.phone}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {sup.policy.configured
                        ? `${sup.policy.returnWindowDays}d window · ${
                            sup.policy.acceptsExpiredStock
                              ? `${sup.policy.expiredGraceDays}d expired grace`
                              : 'Pre-expiry only'
                          }`
                        : 'Return policy not configured'}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-slate-800">
                      {stats.batchCount} lots ({formatINR(stats.totalValue)})
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {!selectedSupplier ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Select a supplier to inspect contact details and return rules.
            </div>
          ) : (
            <>
              {/* Supplier Info Header */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-teal-700" />
                    <h2 className="text-base font-semibold text-slate-900">
                      {selectedSupplier.name}
                    </h2>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Contact: </span>
                      <span className="text-slate-800 font-medium">
                        {selectedSupplier.contactPerson}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Email: </span>
                      <span>{selectedSupplier.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Phone: </span>
                      <span className="font-mono">{selectedSupplier.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">GSTIN: </span>
                      <span className="font-mono">{selectedSupplier.gstin || 'Not provided'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400">Depot Address: </span>
                      <span>{selectedSupplier.address}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openEditSupplier(selectedSupplier)}
                  className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 rounded-md inline-flex items-center gap-1.5 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>

              {/* Unverified / Unconfigured Warning */}
              {selectedSupplier.policy.verificationStatus !== 'Verified' && (
                <div className="px-5 py-3 bg-amber-50/70 flex items-start gap-2.5 text-xs text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">
                      {selectedSupplier.policy.verificationStatus === 'Not configured'
                        ? 'Return Policy Not Configured: '
                        : 'Unverified Policy Rules: '}
                    </span>
                    {selectedSupplier.policy.verificationStatus === 'Not configured'
                      ? 'Batches from this supplier will not be marked eligible until return terms are configured.'
                      : 'These terms are provisional and not yet backed by a verified supplier circular. Eligibility Engine flags affected batches for manual verification.'}
                  </div>
                </div>
              )}

              {/* Return Policy Configuration Grid */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Configured Return Policy
                    </h3>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <PolicyVerificationLabel
                        status={selectedSupplier.policy.verificationStatus}
                      />
                      <span>·</span>
                      <span>Source: {selectedSupplier.policy.policySource}</span>
                      {selectedSupplier.policy.lastVerifiedAt && (
                        <>
                          <span>·</span>
                          <span>
                            Verified {formatDate(selectedSupplier.policy.lastVerifiedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openPolicyEditor(selectedSupplier)}
                    className="h-8 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>
                      {selectedSupplier.policy.configured ? 'Update Policy' : 'Configure Policy'}
                    </span>
                  </button>
                </div>

                {selectedSupplier.policy.configured ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-200 rounded-md p-4 bg-slate-50/60">
                    <div>
                      <div className="text-slate-500">Pre-Expiry Return Window</div>
                      <div className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900">
                        {selectedSupplier.policy.returnWindowDays} days before expiry
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Expired Stock Accepted</div>
                      <div className="mt-0.5 font-semibold text-slate-900">
                        {selectedSupplier.policy.acceptsExpiredStock
                          ? `Yes (up to ${selectedSupplier.policy.expiredGraceDays} days post-expiry)`
                          : 'No — pre-expiry cutoff only'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Minimum Remaining Shelf Life</div>
                      <div className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900">
                        {selectedSupplier.policy.minRemainingShelfLifeDays} days
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Credit Settlement Method</div>
                      <div className="mt-0.5 font-semibold text-slate-900">
                        {selectedSupplier.policy.creditMethod}
                      </div>
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                      <div className="text-slate-500 mb-1">Return Conditions &amp; Notes</div>
                      <div className="text-slate-800 leading-relaxed">
                        {selectedSupplier.policy.policyNotes || 'No special conditions recorded.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border border-dashed border-slate-300 rounded-md text-center text-xs text-slate-500">
                    No return rules configured yet. Click &ldquo;Configure Policy&rdquo; to set return windows
                    and recalculate eligibility for {selectedSupplier.name} batches.
                  </div>
                )}
              </div>

              {/* Policy Audit History */}
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-3">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Policy Change History</span>
                </div>
                {selectedSupplier.policyHistory.length === 0 ? (
                  <div className="text-xs text-slate-500">No policy updates recorded yet.</div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedSupplier.policyHistory.map((entry) => (
                      <div key={entry.id} className="text-xs flex items-start justify-between gap-4">
                        <div className="text-slate-700">{entry.summary}</div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap font-mono shrink-0">
                          {formatDate(entry.changedAt)} · {entry.changedBy}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {isSupplierModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}
              </h2>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Supplier / CFA Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Contact Person <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, contactPerson: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Phone <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={supplierForm.gstin}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                    className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Depot / Billing Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={supplierForm.address}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, address: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md"
                >
                  {editingSupplier ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy Configuration Modal */}
      {isPolicyModalOpen && selectedSupplier && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Configure Return Policy — {selectedSupplier.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Saving updates automatically recalculates eligibility for all batches from this supplier.
                </p>
              </div>
              <button
                onClick={() => setIsPolicyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePolicy} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Return Window (Days Before Expiry)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={policyForm.returnWindowDays}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        returnWindowDays: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Min Remaining Shelf Life (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyForm.minRemainingShelfLifeDays}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        minRemainingShelfLifeDays: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Accepts Expired Stock?
                  </label>
                  <select
                    value={policyForm.acceptsExpiredStock ? 'yes' : 'no'}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        acceptsExpiredStock: e.target.value === 'yes',
                      })
                    }
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  >
                    <option value="no">No — Pre-expiry only</option>
                    <option value="yes">Yes — Post-expiry grace allowed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Post-Expiry Grace Window (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={!policyForm.acceptsExpiredStock}
                    value={policyForm.acceptsExpiredStock ? policyForm.expiredGraceDays : 0}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        expiredGraceDays: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 font-mono tabular-nums border border-slate-200 rounded-md disabled:bg-slate-100 focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Credit Method</label>
                  <select
                    value={policyForm.creditMethod}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        creditMethod: e.target.value as SupplierPolicy['creditMethod'],
                      })
                    }
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  >
                    <option value="Credit note">Credit note</option>
                    <option value="Replacement">Replacement</option>
                    <option value="Credit note or replacement">Credit note or replacement</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Verification Status
                  </label>
                  <select
                    value={policyForm.verificationStatus}
                    onChange={(e) =>
                      setPolicyForm({
                        ...policyForm,
                        verificationStatus: e.target.value as PolicyVerificationStatus,
                      })
                    }
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  >
                    <option value="Verified">Verified (Confirmed with Supplier)</option>
                    <option value="Unverified">Unverified (Provisional)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Policy Source Document / Confirmation Reference
                  </label>
                  <input
                    type="text"
                    value={policyForm.policySource}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, policySource: e.target.value })
                    }
                    placeholder="e.g., Supplier Policy Circular FY 2026-27"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Return Conditions &amp; Exclusions
                  </label>
                  <textarea
                    rows={3}
                    value={policyForm.policyNotes}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, policyNotes: e.target.value })
                    }
                    className="w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save &amp; Recalculate Eligibility</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
