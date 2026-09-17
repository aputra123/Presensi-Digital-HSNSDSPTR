import React, { useState } from 'react';
import {
  History,
  ShieldCheck,
  X,
  Smartphone,
  Laptop,
  CheckCircle2,
  Search,
  Trash2,
  Download,
} from 'lucide-react';
import { SignatureAuditLog } from '../types';
import { formatDateIndo } from '../utils/soundAndDate';

interface SignatureAuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SignatureAuditLog[];
  onVerifyLog: (logId: string, verifierName: string) => void;
  onClearLogs: () => void;
  adminName: string;
}

export const SignatureAuditLogsModal: React.FC<SignatureAuditLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onVerifyLog,
  onClearLogs,
  adminName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<'all' | 'created' | 'updated' | 'removed'>('all');
  const [filterSession, setFilterSession] = useState<'all' | 'masuk' | 'pulang'>('all');

  if (!isOpen) return null;

  // Filtered logs sorted newest first
  const filteredLogs = logs
    .filter((log) => {
      const matchSearch =
        log.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.nip.includes(searchQuery) ||
        (log.reason && log.reason.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchAction = filterAction === 'all' || log.actionType === filterAction;
      const matchSession = filterSession === 'all' || log.sessionType === filterSession;

      return matchSearch && matchAction && matchSession;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Export audit trail to CSV
  const handleExportCsv = () => {
    if (logs.length === 0) return;

    const headers = [
      'ID Log',
      'Waktu & Tanggal',
      'Nama Guru',
      'NIP',
      'Sesi Absen',
      'Jenis Tindakan',
      'Perangkat',
      'Alasan Revisi',
      'Status Verifikasi Admin',
      'Diverifikasi Oleh',
    ];

    const rows = logs.map((l) => [
      l.id,
      `${l.date} ${l.time}`,
      `"${l.teacherName}"`,
      `'${l.nip}`,
      l.sessionType === 'masuk' ? 'Absen Masuk' : 'Absen Pulang',
      l.actionType.toUpperCase(),
      l.deviceType,
      `"${l.reason || '-'}"`,
      l.isValidatedByAdmin ? 'TERVERIFIKASI SAH' : 'BELUM DIVERIFIKASI',
      `"${l.validatedBy || '-'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Log_TandaTangan_ASN_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                  Log Riwayat & Audit Trail Tanda Tangan ASN
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {logs.length} Catatan
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Mencatat riwayat pembuatan baru, perubahan, dan revisi tanda tangan digital guru untuk verifikasi keabsahan data
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari guru, NIP, atau alasan revisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
            />
          </div>

          {/* Action Filter */}
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 font-bold text-[11px] hidden sm:inline">Aksi:</span>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'created', label: 'Baru' },
              { id: 'updated', label: 'Revisi' },
              { id: 'removed', label: 'Dihapus' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterAction(f.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  filterAction === f.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Session Filter */}
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 font-bold text-[11px] hidden sm:inline">Sesi:</span>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'masuk', label: 'Masuk' },
              { id: 'pulang', label: 'Pulang' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFilterSession(s.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  filterSession === s.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Logs List Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3.5 bg-slate-50/50">
          {filteredLogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <ShieldCheck className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="font-bold text-slate-700 text-sm">
                Belum ada log riwayat perubahan tanda tangan
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Semua goresan tanda tangan baru, perbaikan, maupun revisi di tabel absensi ASN akan otomatis tercatat lengkap di sini.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isUpdated = log.actionType === 'updated';
              const isCreated = log.actionType === 'created';

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-4.5 transition-all hover:border-indigo-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                    {/* Teacher & Session Badge */}
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                          isCreated
                            ? 'bg-emerald-600'
                            : isUpdated
                            ? 'bg-amber-600'
                            : 'bg-rose-600'
                        }`}
                      >
                        {isCreated ? '＋' : isUpdated ? '✎' : '✕'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-sm text-slate-900">
                            {log.teacherName}
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">
                            NIP: {log.nip}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span
                            className={`px-2 py-0.2 rounded-md font-extrabold uppercase text-[9.5px] ${
                              log.sessionType === 'masuk'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            Absen {log.sessionType}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-600">
                            {formatDateIndo(log.date)} • {log.time}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action & Verification Status */}
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold border ${
                          isCreated
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isUpdated
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {isCreated
                          ? 'Tanda Tangan Baru'
                          : isUpdated
                          ? 'Revisi / Pembaruan TTD'
                          : 'Tanda Tangan Dihapus'}
                      </span>

                      {log.isValidatedByAdmin ? (
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10.5px] font-extrabold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Terverifikasi Sah</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onVerifyLog(log.id, adminName)}
                          className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold shadow-2xs flex items-center space-x-1 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verifikasi Keabsahan</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body Comparison / Visual Signature Thumbnails */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    {/* Left: Metadata & Device */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center space-x-1.5 text-slate-700">
                        {log.deviceType.toLowerCase().includes('hp') ||
                        log.deviceType.toLowerCase().includes('touchscreen') ? (
                          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                        )}
                        <span className="font-semibold">
                          Perangkat: <span className="font-bold text-slate-900">{log.deviceType}</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500">Alasan Revisi / Catatan:</span>
                        <p className="font-medium text-slate-800 italic mt-0.5">
                          "{log.reason || 'Penyempurnaan goresan tanda tangan digital'}"
                        </p>
                      </div>

                      {log.validatedBy && (
                        <div className="text-[11px] text-indigo-700 font-medium pt-1">
                          Divalidasi oleh: <span className="font-bold">{log.validatedBy}</span>
                        </div>
                      )}
                    </div>

                    {/* Middle: Previous Signature if Updated */}
                    {isUpdated && log.previousSignatureUrl && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Tanda Tangan Sebelumnya
                        </span>
                        <div className="w-full h-14 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                          <img
                            src={log.previousSignatureUrl}
                            alt="Tanda Tangan Lama"
                            className="max-h-full object-contain opacity-60"
                          />
                        </div>
                      </div>
                    )}

                    {/* Right: New Signature */}
                    {log.newSignatureUrl ? (
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col items-center ${
                          isUpdated
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-slate-50 border-slate-200 md:col-span-2'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-emerald-800 uppercase mb-1">
                          {isUpdated ? 'Tanda Tangan Hasil Revisi' : 'Tanda Tangan Sah'}
                        </span>
                        <div className="w-full h-14 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden p-1 shadow-2xs">
                          <img
                            src={log.newSignatureUrl}
                            alt="Tanda Tangan Baru"
                            className="max-h-full object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-center text-xs font-bold md:col-span-2">
                        Tanda tangan telah dibatalkan / dihapus dari tabel presensi
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 disabled:opacity-40 transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan Log Riwayat</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
