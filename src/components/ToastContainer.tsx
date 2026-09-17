import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ToastNotification, ToastSeverity } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onDismissAll?: () => void;
  onActionClick?: (toast: ToastNotification) => void;
}

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onActionClick?: (toast: ToastNotification) => void;
}

const resolveSeverity = (toast: ToastNotification): ToastSeverity => {
  if (toast.severity) return toast.severity;
  if (toast.type === 'leave_request') return 'info';
  if (toast.type === 'gtk_service') return 'info';
  if (toast.type === 'attendance') return 'success';
  if (toast.type === 'system') return 'info';
  if (toast.type === 'error') return 'error';
  if (toast.type === 'warning') return 'warning';
  if (toast.type === 'success') return 'success';
  return 'info';
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onActionClick }) => {
  const duration = toast.duration ?? 4500;
  const [remainingTime, setRemainingTime] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);

  const severity = resolveSeverity(toast);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingTime);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, remainingTime, toast.id, onDismiss]);

  const handleMouseEnter = () => {
    const elapsed = Date.now() - startTimeRef.current;
    setRemainingTime((prev) => Math.max(0, prev - elapsed));
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  const severityConfigs = {
    success: {
      bg: 'bg-slate-900/95 backdrop-blur-md',
      border: 'border-emerald-500/70',
      shadow: 'shadow-lg shadow-emerald-950/20',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      badgeText: 'Sukses',
      barColor: 'bg-emerald-400',
    },
    info: {
      bg: 'bg-slate-900/95 backdrop-blur-md',
      border: 'border-blue-500/70',
      shadow: 'shadow-lg shadow-blue-950/20',
      icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      badgeText: 'Info',
      barColor: 'bg-blue-400',
    },
    warning: {
      bg: 'bg-slate-900/95 backdrop-blur-md',
      border: 'border-amber-500/70',
      shadow: 'shadow-lg shadow-amber-950/20',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      badgeText: 'Peringatan',
      barColor: 'bg-amber-400',
    },
    error: {
      bg: 'bg-slate-900/95 backdrop-blur-md',
      border: 'border-rose-500/80',
      shadow: 'shadow-lg shadow-rose-950/25',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      badgeText: 'Gagal / Error',
      barColor: 'bg-rose-400',
    },
  };

  const cfg = severityConfigs[severity] || severityConfigs.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.2 } }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${cfg.border} ${cfg.bg} ${cfg.shadow} text-white p-3.5 sm:p-4 text-xs select-none`}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        <div className="mt-0.5">{cfg.icon}</div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${cfg.badgeBg}`}
            >
              {cfg.badgeText}
            </span>
            <span className="text-[10px] text-slate-400">
              {toast.timestamp ||
                new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
            </span>
          </div>

          <h4 className="font-bold text-slate-100 text-xs sm:text-sm leading-snug break-words">
            {toast.title}
          </h4>

          {toast.message && (
            <p className="text-slate-300 text-[11px] sm:text-xs mt-1 leading-relaxed break-words">
              {toast.message}
            </p>
          )}

          {(toast.leaveId || toast.serviceId) && onActionClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActionClick(toast);
              }}
              className="mt-2.5 inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] transition-colors cursor-pointer"
            >
              <span>{toast.leaveId ? 'Tinjau Izin' : 'Tinjau Layanan'}</span>
              <ArrowRight className="w-3 h-3 text-indigo-300" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Tutup notifikasi"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-Dismiss Animated Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80 overflow-hidden">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: isPaused ? undefined : '0%' }}
          transition={{
            duration: remainingTime / 1000,
            ease: 'linear',
          }}
          className={`h-full ${cfg.barColor}`}
        />
      </div>
    </motion.div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onDismissAll,
  onActionClick,
}) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifikasi Sistem Presensi"
      className="fixed top-4 sm:top-5 right-4 sm:right-5 z-[200] flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] sm:w-96 pointer-events-none"
    >
      {toasts.length > 1 && (
        <div className="flex justify-end pointer-events-auto">
          <button
            type="button"
            onClick={onDismissAll}
            className="px-3 py-1 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white text-[11px] font-semibold rounded-full border border-slate-700 shadow-md backdrop-blur-xs transition-colors cursor-pointer"
          >
            Tutup Semua ({toasts.length})
          </button>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            onActionClick={onActionClick}
          />
        ))}
      </AnimatePresence>
    </aside>
  );
};
