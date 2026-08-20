'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  ShieldAlert,
  Trash2
} from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const addToast = useCallback((type, message, duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast('success', msg),
    error: (msg) => addToast('error', msg),
    info: (msg) => addToast('info', msg),
    warning: (msg) => addToast('warning', msg),
  };

  const confirmModal = useCallback(({
    title = 'ยืนยันการทำรายการ',
    message = 'คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?',
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    type = 'danger', // 'danger' | 'warning' | 'primary'
  }) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        },
      });
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirmModal }}>
      {children}

      {/* Floating Toasts Container */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:top-auto sm:bottom-6 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((t) => {
          let bgClass = 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50';
          let icon = <Info className="w-5 h-5 text-sky-500 shrink-0" />;

          if (t.type === 'success') {
            bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-500/10';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
          } else if (t.type === 'error') {
            bgClass = 'bg-rose-50 border-rose-200 text-rose-900 shadow-rose-500/10';
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
          } else if (t.type === 'warning') {
            bgClass = 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-500/10';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto border rounded-2xl p-3.5 sm:p-4 shadow-xl backdrop-blur flex items-start justify-between gap-3 animate-slide-in text-xs sm:text-sm font-medium ${bgClass}`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5">{icon}</div>
                <p className="leading-snug break-words">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-2xl shadow-slate-900/25 border border-slate-200 space-y-4 animate-scale-up ring-1 ring-slate-900/5">
            <div className="flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                confirmDialog.type === 'danger'
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : confirmDialog.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}>
                {confirmDialog.type === 'danger' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2.5">
              <button
                onClick={confirmDialog.onCancel}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition active:scale-95"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-md transition active:scale-95 ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : confirmDialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : 'bg-line hover:bg-line/90 shadow-line/20'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
