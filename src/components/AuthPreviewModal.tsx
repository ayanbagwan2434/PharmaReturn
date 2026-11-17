import React, { useState } from 'react';
import { CheckCircle2, FileSpreadsheet, X } from 'lucide-react';

interface AuthPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthPreviewModal: React.FC<AuthPreviewModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reset') {
      setFeedback('Password reset instructions dispatched to the registered business email.');
    } else if (mode === 'register') {
      setFeedback('Business account preview validated. Returning to live workspace.');
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 900);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-teal-600 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="font-display font-semibold text-base text-slate-900">
              PharmaReturn
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
            aria-label="Close auth preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode Tabs */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-md text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setFeedback(null);
                }}
                className={`py-1.5 rounded transition-colors ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Distributor Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setFeedback(null);
                }}
                className={`py-1.5 rounded transition-colors ${
                  mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Register Business
              </button>
            </div>
          )}

          {feedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Distributor / Business Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., MedVantage Pharma Distributors Pvt. Ltd."
                    className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="27AABCM4821K1Z5"
                      className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Contact Phone <span className="text-red-600">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="+91 98200 11223"
                      className="w-full h-9 px-3 font-mono border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Business Email <span className="text-red-600">*</span>
              </label>
              <input
                required
                type="email"
                defaultValue="rajesh.mehta@medvantagepharma.in"
                className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">
                    Password <span className="text-red-600">*</span>
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="text-teal-700 hover:text-teal-800 font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  required
                  type="password"
                  defaultValue="••••••••••••"
                  className="w-full h-9 px-3 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full h-9 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-md transition-colors"
            >
              {mode === 'login'
                ? 'Sign In to Workspace'
                : mode === 'register'
                  ? 'Create Distributor Account'
                  : 'Send Password Reset Link'}
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setFeedback(null);
                }}
                className="w-full text-center text-slate-600 hover:text-slate-900 font-medium pt-1"
              >
                Back to Sign In
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
