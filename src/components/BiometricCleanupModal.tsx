import React, { useState, useMemo } from 'react';
import {
  Archive,
  AlertTriangle,
  Download,
  CheckCircle2,
  Calendar,
  X,
  ShieldCheck,
} from 'lucide-react';
import { BiometricLog, ToastNotification } from '../types';
import { formatDateIndo } from '../utils/soundAndDate';

interface BiometricCleanupModalProps {
  logs: BiometricLog[];
  onUpdateLogs: (newLogs: BiometricLog[]) => void;
  onAddNotification?: (notification: ToastNotification) => void;
  onClose: () => void;
  activeAutoCleanupPolicy?: 'off' | '30' | '90' | '180';
  onUpdateAutoCleanupPolicy?: (policy: 'off' | '30' | '90' | '180') => void;
}

export const BiometricCleanupModal: React.FC<BiometricCleanupModalProps> = ({
  logs,
  onUpdateLogs,
  onAddNotification,
  onClose,
  activeAutoCleanupPolicy = '90',
  onUpdateAutoCleanupPolicy,
}) => {
  const [retentionDays, setRetentionDays] = useState<number>(
    activeAutoCleanupPolicy !== 'off' ? Number(activeAutoCleanupPolicy) : 90
  );
  const [autoPolicy, setAutoPolicy] = useState<'off' | '30' | '90' | '180'>(activeAutoCleanupPolicy);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'both'>('both');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cleanupResult, setCleanupResult] = useState<{
    archivedCount: number;
    remainingCount: number;
    archiveTimestamp: string;
    fileName: string;
  } | null>(null);

  // Calculate cutoff timestamp based on retention days
  const { cutoffDateStr, oldLogs, keepLogs } = useMemo(() => {
    const now = new Date();
    const cutoffTime = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffTime);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const oldLogs: BiometricLog[] = [];
    const keepLogs: BiometricLog[] = [];

    logs.forEach((log) => {
      const logDateStr = log.date || log.timestamp?.split(' ')[0] || '1970-01-01';
      const logTimeStr = log.time || log.timestamp?.split(' ')[1] || '00:00:00';
      const logTimestamp = new Date(`${logDateStr}T${logTimeStr}`).getTime();

      if (logTimestamp < cutoffTime) {
        oldLogs.push(log);
      } else {
        keepLogs.push(log);
      }
    });

    return { cutoffDateStr, oldLogs, keepLogs };
  }, [logs, retentionDays]);

  // Execute Cleanup & Archive
  const handleExecuteCleanup = async () => {
    if (oldLogs.length === 0) return;

    setIsProcessing(true);
    const dateStamp = new Date().toISOString().split('T')[0];
    const timeStamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const baseFileName = `arsip_biometrik_${retentionDays}hari_${dateStamp}_${timeStamp}`;

    try {
      // 1. Export JSON Archive if requested
      if (exportFormat === 'json' || exportFormat === 'both') {
        const jsonPayload = JSON.stringify(
          {
            archivedAt: new Date().toISOString(),
            retentionDays,
            cutoffDate: cutoffDateStr,
            totalArchived: oldLogs.length,
            schoolName: 'SMA Negeri 1 Taliabu Barat',
            records: oldLogs,
          },
          null,
          2
        );
        const blob = new Blob([jsonPayload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseFileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // 2. Export CSV Archive if requested
      if (exportFormat === 'csv' || exportFormat === 'both') {
        const csvHeaders = [
          'ID Transaksi',
          'Tanggal',
          'Waktu WITA',
          'ID Pengguna',
          'Nama Personil',
          'Kategori',
          'Tipe Presensi',
          'Metode Sensor',
          'Skor Akurasi (%)',
          'Status Verifikasi',
          'Tingkat Severity',
          'Latitude',
          'Longitude',
          'Jarak (m)',
          'Dalam Radius Geofence',
          'Alamat GPS',
          'Perangkat',
          'Alamat IP',
          'Catatan',
        ];

        const csvRows = oldLogs.map((l) => [
          l.id,
          l.date || l.timestamp?.split(' ')[0] || '',
          l.time || l.timestamp?.split(' ')[1] || '',
          l.personId || '',
          `"${(l.personName || '').replace(/"/g, '""')}"`,
          l.personType === 'student' ? 'Siswa' : 'Guru/GTK',
          l.type || 'masuk',
          l.method === 'face_scan' ? 'Face Scan' : 'WebAuthn Passkey',
          l.matchScore ?? '',
          l.status === 'success' ? 'Lolos' : 'Gagal',
          l.severity || (l.status === 'failed' ? 'error' : 'info'),
          l.location?.lat ?? '',
          l.location?.lng ?? '',
          l.location?.distanceMeter ?? '',
          l.location?.inRadius !== false ? 'Ya' : 'Tidak',
          `"${(l.location?.address || '').replace(/"/g, '""')}"`,
          `"${(l.deviceInfo || '').replace(/"/g, '""')}"`,
          l.ipAddress || '',
          `"${(l.notes || '').replace(/"/g, '""')}"`,
        ]);

        const csvContent = '\uFEFF' + [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
        const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `${baseFileName}.csv`;
        document.body.appendChild(csvLink);
        csvLink.click();
        document.body.removeChild(csvLink);
        URL.revokeObjectURL(csvUrl);
      }

      // 3. Save Archive History in localStorage for auditing
      try {
        const pastArchivesRaw = localStorage.getItem('school_biometric_archive_history');
        const pastArchives = pastArchivesRaw ? JSON.parse(pastArchivesRaw) : [];
        const newArchiveRecord = {
          id: `archive_${Date.now()}`,
          timestamp: new Date().toISOString(),
          retentionDays,
          cutoffDate: cutoffDateStr,
          archivedCount: oldLogs.length,
          remainingCount: keepLogs.length,
          fileName: baseFileName,
        };
        localStorage.setItem(
          'school_biometric_archive_history',
          JSON.stringify([newArchiveRecord, ...pastArchives])
        );
      } catch (err) {
        console.warn('Gagal menyimpan riwayat arsip ke localStorage:', err);
      }

      // 4. Update the primary table logs
      onUpdateLogs(keepLogs);

      // 5. Send Toast Notification
      if (onAddNotification) {
        onAddNotification({
          id: `archive_success_${Date.now()}`,
          title: '🗄️ Arsip & Pembersihan Log Biometrik Berhasil',
          message: `Sebanyak ${oldLogs.length} rekaman log biometrik yang berumur lebih dari ${retentionDays} hari (sebelum ${formatDateIndo(cutoffDateStr)}) telah berhasil diarsipkan dan dibersihkan dari memori aktif untuk menjaga performa optimal sistem.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }

      setCleanupResult({
        archivedCount: oldLogs.length,
        remainingCount: keepLogs.length,
        archiveTimestamp: new Date().toLocaleString('id-ID'),
        fileName: baseFileName,
      });
    } catch (error) {
      console.error('Error during cleanup & archiving:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="biometric-cleanup-modal-backdrop"
      className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="biometric-cleanup-modal-content"
        className="bg-white rounded-[2.5rem] max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Pembersihan & Pengarsipan Log Usang (Cleanup Old Logs)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatisasi pengarsipan rekaman log biometrik &gt; 90 hari untuk performa maksimal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!cleanupResult ? (
          <div className="space-y-4 text-xs">
            {/* Retention Selector Presets */}
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pilih Batas Waktu Retensi Pembersihan:</span>
                </label>
                <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {retentionDays} Hari
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { days: 30, label: '30 Hari' },
                  { days: 60, label: '60 Hari' },
                  { days: 90, label: '90 Hari' },
                  { days: 180, label: '180 Hari' },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => {
                      setRetentionDays(opt.days);
                      if (autoPolicy !== 'off') {
                        setAutoPolicy(String(opt.days) as any);
                      }
                    }}
                    className={`py-2.5 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border text-center ${
                      retentionDays === opt.days
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Log yang tercatat sebelum <strong>{formatDateIndo(cutoffDateStr)}</strong> akan diarsipkan ke file
                terkompresi dan dibersihkan dari tabel aktif.
              </p>

              {/* Set Auto-Cleanup Policy Checkbox / Radio */}
              <div className="pt-2 border-t border-slate-200/70 mt-2 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kebijakan Auto-Cleanup Berkala (Otomatis):</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                  {[
                    { id: '30', label: 'Set 30 Hari' },
                    { id: '90', label: 'Set 90 Hari' },
                    { id: '180', label: 'Set 180 Hari' },
                    { id: 'off', label: 'Nonaktif' },
                  ].map((pol) => (
                    <button
                      key={pol.id}
                      type="button"
                      onClick={() => {
                        const newPol = pol.id as any;
                        setAutoPolicy(newPol);
                        if (onUpdateAutoCleanupPolicy) {
                          onUpdateAutoCleanupPolicy(newPol);
                        }
                        if (newPol !== 'off') {
                          setRetentionDays(Number(newPol));
                        }
                      }}
                      className={`px-2 py-1.5 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                        autoPolicy === pol.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pol.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  {autoPolicy === 'off'
                    ? 'Kebijakan nonaktif: pembersihan hanya berjalan secara manual.'
                    : `Kebijakan aktif: sistem secara otomatis mendeteksi dan memberi rekomendasi bersihkan log yang berusia lebih dari ${autoPolicy} hari.`}
                </p>
              </div>
            </div>

            {/* Impact Calculation Preview Card */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-3xl bg-indigo-50/70 border border-indigo-100 text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-indigo-900 tracking-wider">
                  Log Akan Diarsipkan
                </span>
                <div className="text-2xl font-black text-indigo-700">{oldLogs.length} Rekaman</div>
                <span className="text-[10px] font-semibold text-indigo-600 block">
                  {oldLogs.length > 0 ? 'Siap diekspor & dibersihkan' : 'Tidak ada log > 90 hari'}
                </span>
              </div>

              <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                  Log Tetap di Tabel
                </span>
                <div className="text-2xl font-black text-slate-800">{keepLogs.length} Rekaman</div>
                <span className="text-[10px] font-semibold text-slate-500 block">
                  Presensi aktif &lt; {retentionDays} hari
                </span>
              </div>
            </div>

            {/* Archive Format Preferences */}
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                Format File Cadangan Arsip Offline:
              </span>
              <div className="flex items-center space-x-3 text-xs">
                <label className="flex items-center space-x-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'both'}
                    onChange={() => setExportFormat('both')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>JSON &amp; CSV Excel (Lengkap)</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'json'}
                    onChange={() => setExportFormat('json')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>JSON Saja</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'csv'}
                    onChange={() => setExportFormat('csv')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>CSV Excel</span>
                </label>
              </div>
            </div>

            {/* Warning Note */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-start space-x-2.5 text-amber-900 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Perhatian:</strong> Seluruh data log yang dibersihkan akan otomatis diunduh ke komputer Anda
                sebagai file arsip mandiri. Anda tidak akan kehilangan data riwayat historis.
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm-execute-cleanup-btn"
                onClick={handleExecuteCleanup}
                disabled={oldLogs.length === 0 || isProcessing}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isProcessing
                    ? 'Mengarsipkan...'
                    : oldLogs.length === 0
                    ? 'Tidak Ada Log Usang'
                    : `Arsipkan & Bersihkan (${oldLogs.length} Log)`}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Success Screen */
          <div className="text-center py-4 space-y-4 text-xs animate-in fade-in duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">
                Pengarsipan & Pembersihan Selesai!
              </h4>
              <p className="text-slate-500 text-xs">
                Sebanyak <strong>{cleanupResult.archivedCount} rekaman</strong> log usang telah berhasil diunduh ke
                folder Download dan dibersihkan dari database aktif browser.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-1.5 text-[11px] font-mono">
              <div>
                <span className="text-slate-400">Nama File Arsip:</span>{' '}
                <span className="font-bold text-slate-800">{cleanupResult.fileName}</span>
              </div>
              <div>
                <span className="text-slate-400">Jumlah Log Tersisa:</span>{' '}
                <span className="font-bold text-emerald-700">{cleanupResult.remainingCount} Sesi Aktif</span>
              </div>
              <div>
                <span className="text-slate-400">Waktu Proses:</span>{' '}
                <span className="font-bold text-slate-800">{cleanupResult.archiveTimestamp}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Selesai & Kembali ke Log
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
