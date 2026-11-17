import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  HelpCircle,
  PackageCheck,
  Send,
  ShieldAlert,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  EligibilityStatus,
  PolicyVerificationStatus,
  ReconciliationStatus,
  ReturnStatus,
} from '../types/pharma';

export function EligibilityLabel({ status }: { status: EligibilityStatus }) {
  const config: Record<
    EligibilityStatus,
    { color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    Eligible: { color: 'text-emerald-700', Icon: CheckCircle2 },
    'Approaching eligibility': { color: 'text-amber-700', Icon: Clock },
    'Not yet eligible': { color: 'text-slate-600', Icon: Clock },
    Expired: { color: 'text-red-700', Icon: XCircle },
    Ineligible: { color: 'text-red-700', Icon: XCircle },
    'Policy not configured': { color: 'text-slate-600', Icon: HelpCircle },
    'Manual verification required': { color: 'text-amber-700', Icon: ShieldAlert },
  };
  const { color, Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function ReturnStatusLabel({ status }: { status: ReturnStatus }) {
  const config: Record<
    ReturnStatus,
    { color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    Draft: { color: 'text-slate-600', Icon: Clock },
    Submitted: { color: 'text-sky-700', Icon: Send },
    'Awaiting supplier response': { color: 'text-amber-700', Icon: Clock },
    Approved: { color: 'text-emerald-700', Icon: CheckCircle2 },
    'Partially approved': { color: 'text-amber-700', Icon: AlertTriangle },
    Rejected: { color: 'text-red-700', Icon: XCircle },
    'Pickup scheduled': { color: 'text-sky-700', Icon: Truck },
    Collected: { color: 'text-teal-700', Icon: PackageCheck },
    'Credit pending': { color: 'text-amber-700', Icon: Clock },
    'Partially credited': { color: 'text-amber-700', Icon: AlertTriangle },
    Credited: { color: 'text-emerald-700', Icon: FileCheck2 },
    Closed: { color: 'text-slate-700', Icon: CheckCircle2 },
  };
  const { color, Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function ReconciliationLabel({ status }: { status: ReconciliationStatus }) {
  const config: Record<
    ReconciliationStatus,
    { color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    'Not credited': { color: 'text-slate-600', Icon: Clock },
    'Partially credited': { color: 'text-amber-700', Icon: AlertTriangle },
    'Fully credited': { color: 'text-emerald-700', Icon: CheckCircle2 },
    'Credit discrepancy': { color: 'text-red-700', Icon: AlertTriangle },
    'Under review': { color: 'text-amber-700', Icon: ShieldAlert },
    Reconciled: { color: 'text-emerald-700', Icon: CheckCircle2 },
  };
  const { color, Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function PolicyVerificationLabel({ status }: { status: PolicyVerificationStatus }) {
  const config: Record<
    PolicyVerificationStatus,
    { color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    Verified: { color: 'text-emerald-700', Icon: CheckCircle2 },
    Unverified: { color: 'text-amber-700', Icon: ShieldAlert },
    'Not configured': { color: 'text-red-700', Icon: HelpCircle },
  };
  const { color, Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
