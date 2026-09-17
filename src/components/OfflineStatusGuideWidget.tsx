import React, { useState, useEffect } from 'react';
import {
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  CloudOff,
  RefreshCw,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineStatusGuideWidgetProps {
  isOnline: boolean;
  syncQueueCount: number;
  onRetryConnection?: () => void;
  onViewSyncQueue?: () => void;
}

export const OfflineStatusGuideWidget: React.FC<OfflineStatusGuideWidgetProps> = ({
  isOnline,
  syncQueueCount = 0,
  onRetryConnection,
  onViewSyncQueue,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [prevOnlineState, setPrevOnlineState] = useState(isOnline);

  // When transition occurs from online to offline, auto open the widget
  useEffect(() => {
    if (prevOnlineState && !isOnline) {
      setIsOpen(true);
      setIsDismissed(false);
    }
    setPrevOnlineState(isOnline);
  }, [isOnline, prevOnlineState]);

  const handleRetry = async () => {
    setIsRetrying(true);
    if (onRetryConnection) {
      await onRetryConnection();
    }
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  };

  // If online and closed or dismissed, do not render
  if (isOnline && !isOpen) {
    return null;
  }

  // If dismissed and offline, show a small unobtrusive pill button in bottom right
  if (isDismissed && !isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => {
            setIsDismissed(false);
            setIsOpen(true);
          }}
          className="flex items-center space-x-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-full shadow-lg transition-all animate-pulse active:scale-95 cursor-pointer border border-amber-400/50"
          title="Buka panduan batasan mode offline"
        >
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode ({syncQueueCount} antrean)</span>
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-4 right-4 z-50 w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-800 dark:text-slate-100"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
                <WifiOff className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold leading-tight">Status: Mode Offline Aktif</h4>
                <p className="text-[11px] text-amber-100 leading-tight">Koneksi internet terputus di perangkat Anda</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                title="Sembunyikan ke ikon kecil"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Body: Guidance on Offline Limitations */}
          <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Panduan Batasan Fitur Offline:</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                Aplikasi tetap dapat digunakan untuk mencatat presensi dan operasional sekolah dengan ketentuan berikut:
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white font-semibold block">Presensi QR & Selfie GPS Tetap Berjalan</strong>
                  <span>Scan barcode kartu pelajar dan presensi guru disimpan aman di database lokal browser.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white font-semibold block">Antrean Sinkronisasi Otomatis</strong>
                  <span>
                    Saat ini ada <span className="font-bold text-indigo-600 dark:text-indigo-400">{syncQueueCount} data presensi</span> dalam antrean lokal. Begitu terhubung kembali ke internet, data akan otomatis dikirim ke Cloud Firestore.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0">
                  <CloudOff className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white font-semibold block">Fitur Cloud Tertunda</strong>
                  <span>Pengiriman otomatis email/WhatsApp BKD, ekspor real-time Google Drive, dan live backup cloud ditunda sampai sinyal kembali pulih.</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Memeriksa Jaringan...' : 'Tes Koneksi Ulang'}</span>
              </button>

              {onViewSyncQueue && (
                <button
                  onClick={onViewSyncQueue}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Lihat Antrean ({syncQueueCount})
                </button>
              )}

              <button
                onClick={() => setIsDismissed(true)}
                className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
