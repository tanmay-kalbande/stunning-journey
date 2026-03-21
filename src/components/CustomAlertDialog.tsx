// src/components/CustomAlertDialog.tsx
import React, { useEffect, useRef } from 'react';
import { X, Info, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface CustomAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | React.ReactNode; // Can be a string or a React node for rich content
  type: 'info' | 'confirm' | 'error' | 'success' | 'warning';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function CustomAlertDialog({
  isOpen,
  onClose,
  title,
  message,
  type,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: CustomAlertDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the dialog when it opens for accessibility
      dialogRef.current?.focus();

      // Trap focus inside the modal
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && dialogRef.current) {
          const focusableElements = dialogRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) { // Backward
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else { // Forward
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      return () => {
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  let icon, headerColor, confirmBtnClass;
  switch (type) {
    case 'info':
      icon = <Info className="w-6 h-6 text-orange-400" />;
      headerColor = 'bg-orange-500/10 border-orange-500/30';
      confirmBtnClass = 'btn-primary';
      break;
    case 'success':
      icon = <CheckCircle2 className="w-6 h-6 text-green-400" />;
      headerColor = 'bg-green-500/10 border-green-500/30';
      confirmBtnClass = 'btn-primary bg-green-600 hover:bg-green-700';
      break;
    case 'error':
      icon = <AlertCircle className="w-6 h-6 text-red-400" />;
      headerColor = 'bg-red-500/10 border-red-500/30';
      confirmBtnClass = 'btn-primary bg-red-600 hover:bg-red-700';
      break;
    case 'warning':
      icon = <AlertTriangle className="w-6 h-6 text-orange-400" />;
      headerColor = 'bg-orange-500/10 border-orange-500/30';
      confirmBtnClass = 'btn-primary bg-orange-600 hover:bg-orange-700';
      break;
    case 'confirm':
    default:
      icon = <AlertCircle className="w-6 h-6 text-yellow-400" />;
      headerColor = 'bg-yellow-500/10 border-yellow-500/30';
      confirmBtnClass = 'btn-primary bg-yellow-600 hover:bg-yellow-700';
      break;
  }

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        tabIndex={-1} // Make it focusable
        className="relative w-full max-w-md bg-[var(--color-sidebar)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 flex items-center gap-4 ${headerColor} border-b border-[var(--color-border)] rounded-t-2xl`}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-[var(--color-border)]">
            {icon}
          </div>
          <h2 id="alert-dialog-title" className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button onClick={handleCancel} className="ml-auto p-2 rounded-full hover:bg-white/10 transition-colors" title="Close">
            <X size={18} className="text-[var(--color-text-secondary)] hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div id="alert-dialog-description" className="p-6 text-sm text-[var(--color-text-secondary)] leading-relaxed overflow-y-auto">
          {message}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-[var(--color-border)] bg-[var(--color-sidebar)]/50 rounded-b-2xl">
          {type === 'confirm' && (
            <button onClick={handleCancel} className="btn btn-secondary">
              {cancelText}
            </button>
          )}
          <button onClick={handleConfirm} className={`btn ${confirmBtnClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
