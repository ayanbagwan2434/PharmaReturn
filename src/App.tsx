import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Menu, Plus, User } from 'lucide-react';
import {
  initialBusinessProfile,
  initialCreditNotes,
  initialImportHistory,
  initialInventoryBatches,
  initialNotifications,
  initialReturnRequests,
  initialStaffMembers,
  initialSuppliers,
} from './data/mockData';
import {
  AppNotification,
  BusinessProfile,
  CreditNote,
  EligibilityStatus,
  ImportHistoryRecord,
  InventoryBatch,
  NavSection,
  ReconciliationStatus,
  ReturnRequest,
  ReturnStatus,
  StaffMember,
  Supplier,
} from './types/pharma';
import { evaluateBatchEligibility } from './utils/eligibility';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { InventoryImportModal } from './components/InventoryImportModal';
import { EligibilityView } from './components/EligibilityView';
import { SuppliersView } from './components/SuppliersView';
import { ReturnsView } from './components/ReturnsView';
import { CreditNotesView } from './components/CreditNotesView';
import { ReportsView } from './components/ReportsView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { AuthPreviewModal } from './components/AuthPreviewModal';

const SECTION_LABELS: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory & Batches',
  eligibility: 'Return Eligibility Engine',
  suppliers: 'Suppliers & Policies',
  returns: 'Return Requests',
  credits: 'Credit Note Reconciliation',
  reports: 'Financial Reports',
  notifications: 'Notifications',
  settings: 'Settings',
};

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [sectionHint, setSectionHint] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Application State
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile>(initialBusinessProfile);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(initialStaffMembers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [batches, setBatches] = useState<InventoryBatch[]>(initialInventoryBatches);
  const [importHistory, setImportHistory] =
    useState<ImportHistoryRecord[]>(initialImportHistory);
  const [returnRequests, setReturnRequests] =
    useState<ReturnRequest[]>(initialReturnRequests);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(initialCreditNotes);
  const [notifications, setNotifications] =
    useState<AppNotification[]>(initialNotifications);

  // Cross-module Modal & Selection States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthPreviewOpen, setIsAuthPreviewOpen] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>(
    undefined
  );
  const [createReturnContext, setCreateReturnContext] = useState<{
    open: boolean;
    supplierId?: string;
    batchId?: string;
  }>({ open: false });
  const [uploadCnContext, setUploadCnContext] = useState<{
    open: boolean;
    returnRequestId?: string;
  }>({ open: false });

  // Transient confirmation toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // Computed sidebar counters
  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const eligibleBatchCount = useMemo(
    () =>
      batches.filter(
        (b) =>
          !b.archived &&
          evaluateBatchEligibility(b, supplierMap.get(b.supplierId)).status === 'Eligible'
      ).length,
    [batches, supplierMap]
  );

  const discrepancyCount = useMemo(
    () =>
      creditNotes.filter((cn) => cn.reconciliationStatus === 'Credit discrepancy').length,
    [creditNotes]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Navigation handler
  const handleNavigate = (section: NavSection, hint?: string) => {
    setActiveSection(section);
    setSectionHint(hint);
  };

  // Inventory Handlers
  const handleConfirmImport = (
    newBatches: Omit<InventoryBatch, 'id' | 'createdAt'>[],
    historyEntry: Omit<ImportHistoryRecord, 'id'>
  ) => {
    const created: InventoryBatch[] = newBatches.map((b, idx) => ({
      ...b,
      id: `bat-imp-${Date.now()}-${idx}`,
      createdAt: '2026-11-17',
    }));
    setBatches((prev) => [...created, ...prev]);
    setImportHistory((prev) => [
      { ...historyEntry, id: `imp-${Date.now()}` },
      ...prev,
    ]);
    showToast(`Imported ${created.length} medicine batch(es) into inventory.`);
  };

  const handleAddBatch = (batch: Omit<InventoryBatch, 'id' | 'createdAt'>) => {
    setBatches((prev) => [
      { ...batch, id: `bat-${Date.now()}`, createdAt: '2026-11-17' },
      ...prev,
    ]);
    showToast(`Added batch ${batch.batchNumber} (${batch.medicineName}).`);
  };

  const handleUpdateBatch = (updated: InventoryBatch) => {
    setBatches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    showToast(`Updated batch ${updated.batchNumber}.`);
  };

  const handleToggleArchiveBatch = (batchId: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, archived: !b.archived } : b))
    );
  };

  // Eligibility Override Handler
  const handleOverrideEligibility = (
    batchId: string,
    override: { status: EligibilityStatus; reason: string } | null
  ) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              manualOverride: override
                ? {
                    ...override,
                    overriddenBy: 'Rajesh Mehta',
                    overriddenAt: '2026-11-17',
                  }
                : undefined,
            }
          : b
      )
    );
    showToast(
      override
        ? `Eligibility manually overridden to "${override.status}".`
        : 'Reverted batch to automated supplier policy calculation.'
    );
  };

  // Supplier Handlers
  const handleAddSupplier = (sup: Omit<Supplier, 'id' | 'policyHistory'>) => {
    const newSup: Supplier = {
      ...sup,
      id: `sup-${Date.now()}`,
      policyHistory: [],
    };
    setSuppliers((prev) => [...prev, newSup]);
    setSelectedSupplierId(newSup.id);
    showToast(`Added supplier ${newSup.name}.`);
  };

  const handleUpdateSupplier = (updated: Supplier, policyChangeSummary?: string) => {
    const enriched: Supplier = policyChangeSummary
      ? {
          ...updated,
          policyHistory: [
            {
              id: `ph-${Date.now()}`,
              changedAt: '2026-11-17',
              changedBy: 'Rajesh Mehta',
              summary: policyChangeSummary,
            },
            ...updated.policyHistory,
          ],
        }
      : updated;

    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? enriched : s)));
    showToast(
      policyChangeSummary
        ? `Updated ${updated.name} return policy and recalculated batch eligibility.`
        : `Updated ${updated.name} details.`
    );
  };

  // Return Request Handlers
  const handleCreateReturnRequest = (
    req: Omit<ReturnRequest, 'id' | 'requestNumber' | 'createdAt'>
  ) => {
    const nextNum = 152 + returnRequests.length;
    const newReq: ReturnRequest = {
      ...req,
      id: `rr-${Date.now()}`,
      requestNumber: `PR-2026-0${nextNum}`,
      createdAt: '2026-11-17',
    };
    setReturnRequests((prev) => [newReq, ...prev]);
    setActiveSection('returns');
    setSelectedReturnId(newReq.id);
    showToast(
      `Created return request ${newReq.requestNumber} (${newReq.status}).`
    );
  };

  const handleUpdateRequestStatus = (
    requestId: string,
    newStatus: ReturnStatus,
    approvedCredit: number,
    note?: string,
    rejectionReason?: string
  ) => {
    setReturnRequests((prev) =>
      prev.map((r) => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          status: newStatus,
          approvedCredit,
          rejectionReason: rejectionReason || r.rejectionReason,
          statusHistory: [
            ...r.statusHistory,
            {
              id: `sh-${Date.now()}`,
              status: newStatus,
              timestamp: new Date().toISOString(),
              updatedBy: 'Rajesh Mehta',
              note,
            },
          ],
        };
      })
    );
    showToast(`Return request status updated to "${newStatus}".`);
  };

  const handleAttachDocument = (requestId: string, fileName: string) => {
    setReturnRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              documents: [
                ...r.documents,
                { name: fileName, uploadedAt: '2026-11-17', size: '320 KB' },
              ],
            }
          : r
      )
    );
    showToast(`Attached ${fileName} to return request.`);
  };

  // Credit Note Handlers
  const handleAddCreditNote = (cn: Omit<CreditNote, 'id' | 'createdAt'>) => {
    const newCn: CreditNote = {
      ...cn,
      id: `cn-${Date.now()}`,
      createdAt: '2026-11-17',
    };
    const updatedCns = [newCn, ...creditNotes];
    setCreditNotes(updatedCns);

    // Sync linked Return Request status automatically based on cumulative credits
    const totalForReq = updatedCns
      .filter((x) => x.returnRequestId === cn.returnRequestId)
      .reduce((s, x) => s + x.creditAmount, 0);

    setReturnRequests((prev) =>
      prev.map((r) => {
        if (r.id !== cn.returnRequestId) return r;
        const baseline = r.approvedCredit > 0 ? r.approvedCredit : r.expectedCredit;
        const targetStatus: ReturnStatus =
          totalForReq >= baseline ? 'Credited' : 'Partially credited';
        return {
          ...r,
          status: targetStatus,
          statusHistory: [
            ...r.statusHistory,
            {
              id: `sh-cn-${Date.now()}`,
              status: targetStatus,
              timestamp: new Date().toISOString(),
              updatedBy: 'Vikram Deshmukh',
              note: `Recorded ${cn.creditNoteNumber} for ₹${cn.creditAmount.toLocaleString('en-IN')}.`,
            },
          ],
        };
      })
    );

    showToast(`Recorded credit note ${cn.creditNoteNumber}.`);
  };

  const handleResolveDiscrepancy = (
    creditNoteId: string,
    newStatus: ReconciliationStatus,
    resolutionNotes: string
  ) => {
    setCreditNotes((prev) =>
      prev.map((cn) =>
        cn.id === creditNoteId
          ? {
              ...cn,
              reconciliationStatus: newStatus,
              resolutionNotes,
              resolvedBy: 'Vikram Deshmukh',
              resolvedAt: '2026-11-17',
            }
          : cn
      )
    );
    showToast(`Updated credit note reconciliation to "${newStatus}".`);
  };

  // Notification Handlers
  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleOpenNotificationTarget = (section: NavSection, targetId?: string) => {
    setActiveSection(section);
    if (section === 'returns' && targetId) {
      setSelectedReturnId(targetId);
    } else if (section === 'suppliers' && targetId) {
      setSelectedSupplierId(targetId);
    }
  };

  // Staff Handler
  const handleAddStaff = (
    member: Omit<StaffMember, 'id' | 'lastActive' | 'status'>
  ) => {
    setStaffMembers((prev) => [
      ...prev,
      {
        ...member,
        id: `usr-${Date.now()}`,
        status: 'Invited',
        lastActive: new Date().toISOString(),
      },
    ]);
    showToast(`Invitation sent to ${member.fullName} (${member.role}).`);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setSectionHint(undefined);
        }}
        unreadNotifications={unreadNotifications}
        discrepancyCount={discrepancyCount}
        eligibleBatchCount={eligibleBatchCount}
        businessName={businessProfile.businessName}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Right Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb Left — Actions Right */}
        <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-10 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs min-w-0">
              <button
                onClick={() => handleNavigate('dashboard')}
                className="text-slate-500 hover:text-slate-800 whitespace-nowrap"
              >
                PharmaReturn
              </button>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {SECTION_LABELS[activeSection]}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleNavigate('notifications')}
              className="h-9 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              aria-label={`Notifications (${unreadNotifications} unread)`}
            >
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              {unreadNotifications > 0 && (
                <span className="font-mono tabular-nums font-semibold text-amber-700">
                  {unreadNotifications}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsAuthPreviewOpen(true)}
              className="hidden sm:inline-flex h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-xs font-medium text-slate-700 items-center gap-2 transition-colors whitespace-nowrap"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Rajesh Mehta</span>
            </button>

            <button
              onClick={() => setCreateReturnContext({ open: true })}
              className="h-9 px-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Return Request</span>
              <span className="sm:hidden">New Return</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              batches={batches}
              suppliers={suppliers}
              returnRequests={returnRequests}
              creditNotes={creditNotes}
              onNavigate={handleNavigate}
              onOpenReturnDetail={(reqId) => {
                setActiveSection('returns');
                setSelectedReturnId(reqId);
              }}
              onOpenCreateReturn={() => setCreateReturnContext({ open: true })}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView
              batches={batches}
              suppliers={suppliers}
              importHistory={importHistory}
              initialFilterHint={sectionHint}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onAddBatch={handleAddBatch}
              onUpdateBatch={handleUpdateBatch}
              onToggleArchiveBatch={handleToggleArchiveBatch}
            />
          )}

          {activeSection === 'eligibility' && (
            <EligibilityView
              batches={batches}
              suppliers={suppliers}
              initialStatusFilter={sectionHint}
              onOverrideEligibility={handleOverrideEligibility}
              onCreateReturnForSupplier={(supplierId, batchId) =>
                setCreateReturnContext({ open: true, supplierId, batchId })
              }
            />
          )}

          {activeSection === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              batches={batches}
              initialSelectedSupplierId={selectedSupplierId}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
            />
          )}

          {activeSection === 'returns' && (
            <ReturnsView
              returnRequests={returnRequests}
              suppliers={suppliers}
              batches={batches}
              creditNotes={creditNotes}
              selectedRequestId={selectedReturnId}
              onSelectRequest={setSelectedReturnId}
              createDraftContext={createReturnContext}
              onCloseCreateModal={() => setCreateReturnContext({ open: false })}
              onOpenCreateModal={() => setCreateReturnContext({ open: true })}
              onCreateRequest={handleCreateReturnRequest}
              onUpdateRequestStatus={handleUpdateRequestStatus}
              onAttachDocument={handleAttachDocument}
              onOpenRecordCreditNote={(reqId) => {
                setSelectedReturnId(null);
                setActiveSection('credits');
                setUploadCnContext({ open: true, returnRequestId: reqId });
              }}
            />
          )}

          {activeSection === 'credits' && (
            <CreditNotesView
              creditNotes={creditNotes}
              returnRequests={returnRequests}
              suppliers={suppliers}
              uploadContext={uploadCnContext}
              onCloseUploadModal={() => setUploadCnContext({ open: false })}
              onOpenUploadModal={(reqId) =>
                setUploadCnContext({ open: true, returnRequestId: reqId })
              }
              onAddCreditNote={handleAddCreditNote}
              onResolveDiscrepancy={handleResolveDiscrepancy}
            />
          )}

          {activeSection === 'reports' && (
            <ReportsView
              batches={batches}
              suppliers={suppliers}
              returnRequests={returnRequests}
              creditNotes={creditNotes}
            />
          )}

          {activeSection === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllRead}
              onOpenTarget={handleOpenNotificationTarget}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              profile={businessProfile}
              staffMembers={staffMembers}
              onUpdateProfile={(p) => {
                setBusinessProfile(p);
                showToast('Business profile saved.');
              }}
              onAddStaff={handleAddStaff}
              onOpenAuthPreview={() => setIsAuthPreviewOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <InventoryImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingBatches={batches}
        suppliers={suppliers}
        onConfirmImport={handleConfirmImport}
      />

      <AuthPreviewModal
        isOpen={isAuthPreviewOpen}
        onClose={() => setIsAuthPreviewOpen(false)}
      />

      {/* Clean Transient Action Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-md shadow-lg border border-slate-800 text-xs font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
