export type NavSection =
  | 'dashboard'
  | 'inventory'
  | 'eligibility'
  | 'suppliers'
  | 'returns'
  | 'credits'
  | 'reports'
  | 'notifications'
  | 'settings';

export type EligibilityStatus =
  | 'Eligible'
  | 'Approaching eligibility'
  | 'Not yet eligible'
  | 'Expired'
  | 'Ineligible'
  | 'Policy not configured'
  | 'Manual verification required';

export type ReturnStatus =
  | 'Draft'
  | 'Submitted'
  | 'Awaiting supplier response'
  | 'Approved'
  | 'Partially approved'
  | 'Rejected'
  | 'Pickup scheduled'
  | 'Collected'
  | 'Credit pending'
  | 'Partially credited'
  | 'Credited'
  | 'Closed';

export type ReconciliationStatus =
  | 'Not credited'
  | 'Partially credited'
  | 'Fully credited'
  | 'Credit discrepancy'
  | 'Under review'
  | 'Reconciled';

export type PolicyVerificationStatus = 'Verified' | 'Unverified' | 'Not configured';

export interface SupplierPolicy {
  configured: boolean;
  returnWindowDays: number; // e.g., 90 days before expiry
  acceptsExpiredStock: boolean;
  expiredGraceDays: number; // max days past expiry if accepted
  minRemainingShelfLifeDays: number;
  creditMethod: 'Credit note' | 'Replacement' | 'Credit note or replacement';
  policyNotes: string;
  policySource: string;
  verificationStatus: PolicyVerificationStatus;
  lastVerifiedAt: string;
  updatedAt: string;
}

export interface PolicyHistoryEntry {
  id: string;
  changedAt: string;
  changedBy: string;
  summary: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin?: string;
  address: string;
  status: 'Active' | 'Inactive';
  policy: SupplierPolicy;
  policyHistory: PolicyHistoryEntry[];
}

export interface EligibilityOverride {
  status: EligibilityStatus;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

export interface InventoryBatch {
  id: string;
  medicineName: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  purchasePrice: number; // INR per unit
  supplierId: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  archived?: boolean;
  createdAt: string;
  manualOverride?: EligibilityOverride;
}

export interface ImportHistoryRecord {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  importedCount: number;
  skippedDuplicates: number;
  errorsFixed: number;
  status: 'Completed' | 'Partial';
}

export interface ReturnRequestItem {
  id: string;
  batchId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  requestedQuantity: number;
  approvedQuantity: number;
  unitPrice: number;
  expectedCredit: number;
  approvedCredit: number;
  rejectionReason?: string;
}

export interface StatusLogEntry {
  id: string;
  status: ReturnStatus;
  timestamp: string;
  updatedBy: string;
  note?: string;
}

export interface ReturnRequest {
  id: string;
  requestNumber: string;
  supplierId: string;
  submissionDate: string;
  expectedCredit: number;
  approvedCredit: number;
  status: ReturnStatus;
  remarks: string;
  rejectionReason?: string;
  documents: { name: string; uploadedAt: string; size: string }[];
  items: ReturnRequestItem[];
  statusHistory: StatusLogEntry[];
  createdBy: string;
  createdAt: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  supplierId: string;
  returnRequestId: string;
  creditNoteDate: string;
  creditAmount: number;
  documentName: string;
  reconciliationStatus: ReconciliationStatus;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'near-expiry'
    | 'deadline'
    | 'awaiting-update'
    | 'awaiting-pickup'
    | 'pending-credit'
    | 'discrepancy';
  severity: 'info' | 'warning' | 'critical';
  targetSection: NavSection;
  targetId?: string;
  createdAt: string;
  isRead: boolean;
}

export interface BusinessProfile {
  businessName: string;
  gstin: string;
  drugLicense: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: 'Distributor / Owner' | 'Inventory Manager' | 'Accountant';
  status: 'Active' | 'Invited';
  lastActive: string;
}
