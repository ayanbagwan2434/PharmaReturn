import React from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NavSection } from '../types/pharma';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  unreadNotifications: number;
  discrepancyCount: number;
  eligibleBatchCount: number;
  businessName: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  unreadNotifications,
  discrepancyCount,
  eligibleBatchCount,
  businessName,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: {
    id: NavSection;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    count?: number;
    countTone?: 'amber' | 'red' | 'teal';
  }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', Icon: Package },
    {
      id: 'eligibility',
      label: 'Return Eligibility',
      Icon: ShieldCheck,
      count: eligibleBatchCount,
      countTone: 'teal',
    },
    { id: 'suppliers', label: 'Suppliers', Icon: Building2 },
    { id: 'returns', label: 'Return Requests', Icon: ClipboardCheck },
    {
      id: 'credits',
      label: 'Credit Notes',
      Icon: ReceiptIndianRupee,
      count: discrepancyCount,
      countTone: 'red',
    },
    { id: 'reports', label: 'Reports', Icon: BarChart3 },
    {
      id: 'notifications',
      label: 'Notifications',
      Icon: Bell,
      count: unreadNotifications,
      countTone: 'amber',
    },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 w-64 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <button
          onClick={() => handleNav('dashboard')}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          <div className="w-7 h-7 rounded-md bg-teal-600 flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="font-display font-semibold text-base tracking-tight text-white whitespace-nowrap">
            PharmaReturn
          </span>
        </button>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Business Context */}
      <div className="px-5 py-3.5 border-b border-slate-800/70">
        <div className="text-[11px] font-medium text-slate-400 mb-0.5">Distributor Account</div>
        <div className="text-xs font-medium text-slate-100 truncate" title={businessName}>
          {businessName}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
        {navItems.map(({ id, label, Icon, count, countTone }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                isActive
                  ? 'bg-teal-600/15 text-teal-300'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-teal-400' : 'text-slate-400'
                  }`}
                />
                <span className="truncate whitespace-nowrap">{label}</span>
              </span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`font-mono tabular-nums text-xs font-medium ml-2 shrink-0 ${
                    countTone === 'red'
                      ? 'text-red-400'
                      : countTone === 'amber'
                        ? 'text-amber-400'
                        : 'text-teal-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quiet Footer */}
      <div className="px-5 py-3.5 border-t border-slate-800/80 text-xs text-slate-500">
        <div className="truncate">Returns &amp; Credit Recovery</div>
        <div className="text-[11px] text-slate-600 mt-0.5">INR Ledger · FY 2026–27</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
