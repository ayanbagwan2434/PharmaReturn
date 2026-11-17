import { EligibilityStatus, InventoryBatch, Supplier } from '../types/pharma';
import { daysUntilDate, formatDate } from './formatters';

export interface EligibilityEvaluation {
  status: EligibilityStatus;
  computedStatus: EligibilityStatus;
  isOverridden: boolean;
  daysToExpiry: number;
  returnDeadlineDate: string | null;
  daysToDeadline: number | null;
  reason: string;
  policyVerified: boolean;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function evaluateBatchEligibility(
  batch: InventoryBatch,
  supplier?: Supplier
): EligibilityEvaluation {
  const daysToExpiry = daysUntilDate(batch.expiryDate);

  if (!supplier || !supplier.policy.configured) {
    const computedStatus: EligibilityStatus = 'Policy not configured';
    const finalStatus = batch.manualOverride ? batch.manualOverride.status : computedStatus;
    return {
      status: finalStatus,
      computedStatus,
      isOverridden: Boolean(batch.manualOverride),
      daysToExpiry,
      returnDeadlineDate: null,
      daysToDeadline: null,
      policyVerified: false,
      reason: batch.manualOverride
        ? `Manual override (${batch.manualOverride.reason}). Supplier policy is not configured.`
        : 'Supplier return policy is not configured. Configure return rules before claiming eligibility.',
    };
  }

  const { policy } = supplier;
  const policyVerified = policy.verificationStatus === 'Verified';

  let computedStatus: EligibilityStatus;
  let reason = '';
  let returnDeadlineDate: string | null = null;
  let daysToDeadline: number | null = null;

  if (daysToExpiry < 0) {
    const daysExpired = Math.abs(daysToExpiry);
    if (policy.acceptsExpiredStock) {
      returnDeadlineDate = addDays(batch.expiryDate, policy.expiredGraceDays);
      daysToDeadline = daysUntilDate(returnDeadlineDate);
      if (daysExpired <= policy.expiredGraceDays) {
        if (!policyVerified) {
          computedStatus = 'Manual verification required';
          reason = `Expired ${daysExpired}d ago. Unverified policy notes up to ${policy.expiredGraceDays}d post-expiry acceptance; verify with ${supplier.name}.`;
        } else {
          computedStatus = 'Eligible';
          reason = `Expired ${daysExpired}d ago, within ${supplier.name}'s ${policy.expiredGraceDays}-day post-expiry grace window (deadline ${formatDate(returnDeadlineDate)}).`;
        }
      } else {
        computedStatus = 'Expired';
        reason = `Expired ${daysExpired}d ago, exceeding ${supplier.name}'s ${policy.expiredGraceDays}-day post-expiry acceptance limit.`;
      }
    } else {
      computedStatus = 'Expired';
      reason = `Expired ${daysExpired}d ago (${formatDate(batch.expiryDate)}). ${supplier.name} policy does not accept expired stock.`;
    }
  } else {
    // Not yet expired
    returnDeadlineDate = policy.acceptsExpiredStock
      ? addDays(batch.expiryDate, policy.expiredGraceDays)
      : batch.expiryDate;
    daysToDeadline = daysUntilDate(returnDeadlineDate);

    if (daysToExpiry <= policy.returnWindowDays) {
      if (!policyVerified) {
        computedStatus = 'Manual verification required';
        reason = `Expires in ${daysToExpiry}d (${formatDate(batch.expiryDate)}). Fits ${policy.returnWindowDays}-day rule, but supplier policy is unverified.`;
      } else {
        computedStatus = 'Eligible';
        reason = `Expires in ${daysToExpiry}d (${formatDate(batch.expiryDate)}), inside ${supplier.name}'s ${policy.returnWindowDays}-day return window.`;
      }
    } else if (daysToExpiry <= policy.returnWindowDays + 30) {
      computedStatus = 'Approaching eligibility';
      const opensIn = daysToExpiry - policy.returnWindowDays;
      reason = `Return window opens in ${opensIn}d (${policy.returnWindowDays}d before ${formatDate(batch.expiryDate)} expiry).`;
    } else {
      computedStatus = 'Not yet eligible';
      const opensIn = daysToExpiry - policy.returnWindowDays;
      reason = `Shelf life remaining: ${daysToExpiry}d. Return window opens in ${opensIn}d.`;
    }
  }

  if (batch.manualOverride) {
    return {
      status: batch.manualOverride.status,
      computedStatus,
      isOverridden: true,
      daysToExpiry,
      returnDeadlineDate,
      daysToDeadline,
      policyVerified,
      reason: `Manual override to "${batch.manualOverride.status}": ${batch.manualOverride.reason} (Auto-check: ${computedStatus}).`,
    };
  }

  return {
    status: computedStatus,
    computedStatus,
    isOverridden: false,
    daysToExpiry,
    returnDeadlineDate,
    daysToDeadline,
    policyVerified,
    reason,
  };
}
