import React, { useState } from 'react';
import { CheckCircle2, LogIn, Plus, Shield, UserCheck } from 'lucide-react';
import { BusinessProfile, StaffMember } from '../types/pharma';
import { formatDateTime } from '../utils/formatters';

interface SettingsViewProps {
  profile: BusinessProfile;
  staffMembers: StaffMember[];
  onUpdateProfile: (profile: BusinessProfile) => void;
  onAddStaff: (member: Omit<StaffMember, 'id' | 'lastActive' | 'status'>) => void;
  onOpenAuthPreview: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  staffMembers,
  onUpdateProfile,
  onAddStaff,
  onOpenAuthPreview,
}) => {
  const [form, setForm] = useState<BusinessProfile>(profile);
  const [savedNotice, setSavedNotice] = useState(false);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] =
    useState<StaffMember['role']>('Inventory Manager');

  const [emailAlerts, setEmailAlerts] = useState({
    nearExpiry: true,
    returnDeadlines: true,
    discrepancies: true,
    weeklyDigest: false,
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleInviteStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;
    onAddStaff({
      fullName: newStaffName.trim(),
      email: newStaffEmail.trim(),
      role: newStaffRole,
    });
    setNewStaffName('');
    setNewStaffEmail('');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Business Profile &amp; Account Settings
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Manage distributor GSTIN details, staff role permissions, and email reminder preferences.
          </p>
        </div>

        <button
          onClick={onOpenAuthPreview}
          className="h-9 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <LogIn className="w-3.5 h-3.5 text-slate-500" />
          <span>Preview Sign-In / Registration UI</span>
        </button>
      </div>

      {/* Business Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Distributor Business Profile
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Used on return request manifests and supplier credit correspondence
            </p>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>Profile updated</span>
            </span>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Legal Business Name
            </label>
            <input
              type="text"
              required
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">GSTIN (Optional)</label>
            <input
              type="text"
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Drug License Number
            </label>
            <input
              type="text"
              value={form.drugLicense}
              onChange={(e) => setForm({ ...form, drugLicense: e.target.value })}
              className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Primary Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Warehouse / Registered Address
            </label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
          >
            Save Business Profile
          </button>
        </div>
      </form>

      {/* Staff Accounts & Role Permissions */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Team Accounts &amp; Role Permissions
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Isolate inventory operations and financial credit reconciliation by role
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-5">Staff Member</th>
                <th className="py-2.5 px-5">Email</th>
                <th className="py-2.5 px-5">Role</th>
                <th className="py-2.5 px-5">Last Active</th>
                <th className="py-2.5 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffMembers.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 px-5 font-medium text-slate-900">{member.fullName}</td>
                  <td className="py-3 px-5 text-slate-600">{member.email}</td>
                  <td className="py-3 px-5 text-slate-800">{member.role}</td>
                  <td className="py-3 px-5 font-mono tabular-nums text-slate-500">
                    {formatDateTime(member.lastActive)}
                  </td>
                  <td className="py-3 px-5">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        member.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{member.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={handleInviteStaff}
          className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5 text-xs"
        >
          <input
            type="text"
            required
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            placeholder="Full name"
            className="h-9 px-3 bg-white border border-slate-200 rounded-md flex-1 focus:outline-none focus:border-teal-600"
          />
          <input
            type="email"
            required
            value={newStaffEmail}
            onChange={(e) => setNewStaffEmail(e.target.value)}
            placeholder="staff@medvantagepharma.in"
            className="h-9 px-3 bg-white border border-slate-200 rounded-md flex-1 focus:outline-none focus:border-teal-600"
          />
          <select
            value={newStaffRole}
            onChange={(e) => setNewStaffRole(e.target.value as StaffMember['role'])}
            className="h-9 px-2.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
          >
            <option value="Inventory Manager">Inventory Manager</option>
            <option value="Accountant">Accountant</option>
            <option value="Distributor / Owner">Distributor / Owner</option>
          </select>
          <button
            type="submit"
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Staff</span>
          </button>
        </form>
      </div>

      {/* Email Reminder Preferences */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Email Reminder Preferences</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {(
            [
              {
                key: 'nearExpiry',
                label: 'Near-expiry stock alerts (90 days prior)',
              },
              {
                key: 'returnDeadlines',
                label: 'Upcoming supplier return window cutoff reminders',
              },
              {
                key: 'discrepancies',
                label: 'Immediate notification on credit note shortfalls',
              },
              {
                key: 'weeklyDigest',
                label: 'Weekly Monday recovery & pending credits digest',
              },
            ] as const
          ).map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={emailAlerts[item.key]}
                onChange={(e) =>
                  setEmailAlerts({ ...emailAlerts, [item.key]: e.target.checked })
                }
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span className="text-slate-700 font-medium">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
