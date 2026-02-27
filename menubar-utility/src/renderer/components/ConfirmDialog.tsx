import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../hooks/useI18n';

interface ConfirmDialogProps {
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl p-4 mx-4 w-full max-w-[280px]"
      >
        <h3 className="text-sm font-semibold mb-1">
          {title ?? t('common.confirmDelete')}
        </h3>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {description ?? t('common.confirmDeleteDesc')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface)] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-1.5 text-sm font-medium text-white rounded-md transition-colors ${
              variant === 'danger'
                ? 'bg-[var(--danger)] hover:opacity-90'
                : 'bg-[var(--primary)] hover:opacity-90'
            }`}
          >
            {confirmLabel ?? t('common.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
