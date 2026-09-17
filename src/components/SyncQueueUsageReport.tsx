import React, { useState } from 'react';
import {
  Database,
  RefreshCw,
  Trash2,
  Download,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Users,
  GraduationCap,
  Sparkles,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { SyncQueueItem, AttendanceRecord, SchoolConfig } from '../types';
import { generateSyncQueueUsageReport, cleanupOldSyncQueue } from '../utils/syncQueueReport';
import { formatDateIndo } from '../utils/soundAndDate';
import confetti from 'canvas-confetti';

interface SyncQueueUsageReportProps {
  queue: SyncQueueItem[];
  config: SchoolConfig;
  onManualSync: () => void;
  isSyncing: boolean;
  onQueueUpdated?: () => void;
  onNotify?: (title: string, message: string) => void;
}

export const SyncQueueUsageReportComponent: React.FC<SyncQueueUsageReportProps> = ({
  queue,
  config,
  onManualSync,
  isSyncing,
  onQueueUpdated,
  onNotify,
}) => {
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'teacher'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    cleanedCount: number;
    remainingCount: number;
    freedBytes: number;
  } | null>(null);

  const report = generateSyncQueueUsageReport(queue);

  // Filtered queue items for detail table
  const filteredItems = queue.filter((item) => {
    const rec = item.record;
    if (filterRole === 'student' && rec.personType !== 'student') return false;
    if (filterRole === 'teacher' && rec.personType !== 'teacher') return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        rec.personName.toLowerCase().includes(q) ||
        rec.identifier.toLowerCase().includes(q) ||
        (rec.classOrSubject && rec.classOrSubject.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCleanup = () => {
    const confirmClean = window.confirm(
      'Apakah Anda yakin ingin membersihkan data antrian offline yang sudah tersinkronisasi atau berumur lebih dari 30 hari? Tindakan ini akan mengoptimalkan memori lokal browser.'
    );
    if (!confirmClean) return;

    setIsCleaning(true);
    setTimeout(() => {
      const res = cleanupOldSyncQueue(30);
      setCleanupResult({
        cleanedCount: res.cleanedCount,
        remainingCount: res.remainingCount,
        freedBytes: res.freedBytesEstimated,
      });
      setIsCleaning(false);
      if (onQueueUpdated) onQueueUpdated();
      if (onNotify) {
        onNotify(
          'Pembersihan Cache Berhasil',
          `Berhasil membersihkan ${res.cleanedCount} data antrian lama. ${res.remainingCount} data tersisa aktif.`
        );
      }
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
    }, 400);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute(
      'download',
      `Laporan_Pola_Presensi_Offline_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">
              <Database className="w-3.5 h-3.5" />
              <span>OFFLINE SYNC QUEUE INTELLIGENCE</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Laporan Pola Presensi Offline (Usage Report)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Analisis komprehensif data presensi yang tercatat secara lokal di Pulau Taliabu saat kondisi jaringan internet terputus, sebelum data didorong secara aman ke Firebase Cloud.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor JSON</span>
            </button>

            <button
              onClick={handleCleanup}
              disabled={isCleaning}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Hapus antrian yang sudah tersinkron atau berusia >30 hari"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{isCleaning ? 'Membersihkan...' : 'Bersihkan Antrian Lama (>30 Hari)'}</span>
            </button>

            <button
              onClick={onManualSync}
              disabled={isSyncing || queue.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-indigo-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkronisasi...' : 'Sinkronkan Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* Cleanup Notification if triggered */}
        {cleanupResult && (
          <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-800/70 text-emerald-200 rounded-2xl text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Pembersihan selesai: <strong>{cleanupResult.cleanedCount} record</strong> dihapus,{' '}
                <strong>{cleanupResult.remainingCount} record</strong> tetap aktif di antrian lokal.
              </span>
            </div>
            <button
              onClick={() => setCleanupResult(null)}
              className="text-emerald-400 hover:text-white font-bold ml-2 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-[11px] block">Total Antrian Offline:</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-black font-mono text-amber-400">
                {report.totalQueued}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">record</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-[11px] block">Siswa vs GTK Guru:</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5 font-mono">
              <span className="text-base font-extrabold text-blue-400">{report.studentsCount} Siswa</span>
              <span className="text-slate-500">/</span>
              <span className="text-base font-extrabold text-emerald-400">{report.teachersCount} GTK</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-[11px] block">GPS Geofence Valid:</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-black font-mono text-emerald-400">
                {report.gpsStats.inRadiusCount}
              </span>
              <span className="text-[10px] text-slate-400">
                / {report.gpsStats.withGpsCount} valid ({report.gpsStats.averageDistanceMeter}m avg)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-[11px] block">Rata-rata Waktu Tunggu:</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-2xl font-black font-mono text-indigo-300">
                {report.ageAnalysis.averageWaitMinutes}
              </span>
              <span className="text-[10px] text-slate-400">menit</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI & Analytical Insights Strip */}
      <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-950 space-y-2 shadow-2xs">
        <div className="flex items-center space-x-2 font-bold text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Wawasan & Temuan Pola Presensi Offline:</span>
        </div>
        <ul className="space-y-1.5 pl-5 list-disc text-slate-700">
          {report.insights.map((insight, idx) => (
            <li key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          ))}
        </ul>
      </div>

      {/* Grid: Hourly Time Distribution & Attendance Method Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hourly Pattern Chart Bars */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Distribusi Jam Pencatatan Offline
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">WITA (Zona Waktu Taliabu)</span>
          </div>

          <div className="space-y-3 text-xs">
            {report.timeDistribution.map((item) => (
              <div key={item.hourRange} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>{item.hourRange}</span>
                  <span className="font-mono text-slate-900">
                    {item.count} presensi ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(item.percentage, item.count > 0 ? 5 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Method & Status Breakdown */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Metode & Status Kehadiran Antrian
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Biometrik & QR Code</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <span className="text-[11px] text-slate-500 font-semibold block">Metode Pencatatan:</span>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-700">Selfie & GPS:</span>
                  <strong className="text-indigo-600">{report.methodBreakdown.selfie_gps}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">QR Code Scan:</span>
                  <strong className="text-blue-600">{report.methodBreakdown.qrcode}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Input Manual:</span>
                  <strong className="text-slate-600">{report.methodBreakdown.manual}</strong>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <span className="text-[11px] text-slate-500 font-semibold block">Status Kehadiran:</span>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-emerald-700">Hadir Tepat Waktu:</span>
                  <strong className="text-emerald-700">{report.statusBreakdown.hadir}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Terlambat:</span>
                  <strong className="text-amber-700">{report.statusBreakdown.terlambat}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Sakit / Izin:</span>
                  <strong className="text-blue-700">
                    {report.statusBreakdown.sakit + report.statusBreakdown.izin}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Age Analysis Note */}
          <div className="p-3 bg-slate-900 text-white rounded-2xl text-[11px] space-y-1 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Antrian Pertama:</span>
              <span className="text-slate-200 font-bold">{report.ageAnalysis.oldestTimestamp || '-'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Antrian Terbaru:</span>
              <span className="text-slate-200 font-bold">{report.ageAnalysis.newestTimestamp || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Queue Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, NISN/NIP, kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 w-52 sm:w-64"
              />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
              <button
                onClick={() => setFilterRole('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  filterRole === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua ({queue.length})
              </button>
              <button
                onClick={() => setFilterRole('student')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  filterRole === 'student' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Siswa ({report.studentsCount})
              </button>
              <button
                onClick={() => setFilterRole('teacher')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  filterRole === 'teacher' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                GTK ({report.teachersCount})
              </button>
            </div>
          </div>

          <span className="text-slate-500 font-medium text-[11px]">
            Menampilkan {filteredItems.length} dari {queue.length} antrian
          </span>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Nama & Identitas</th>
                <th className="py-3 px-3">Tipe & Kelas/Mapel</th>
                <th className="py-3 px-3">Waktu Pencatatan</th>
                <th className="py-3 px-3">Metode & Status</th>
                <th className="py-3 px-3">Lokasi Geofence</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada record antrian offline yang cocok.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const rec = item.record;
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                rec.personType === 'student' ? 'bg-blue-500' : 'bg-emerald-500'
                              }`}
                            />
                            <div>
                              <div className="font-bold text-slate-900">{rec.personName}</div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {rec.identifier || rec.personId}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-100 text-slate-700">
                            {rec.classOrSubject}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          <div>{rec.date}</div>
                          <div className="text-[10px] text-slate-400">{rec.time} WITA</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.status === 'hadir'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.status === 'terlambat'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {rec.status.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {rec.method === 'selfie_gps' ? '📸 Selfie' : '⚡ QR'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-[11px]">
                          {rec.location ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                rec.location.inRadius
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {rec.location.inRadius ? '✓ Valid' : '✕ Luar'} ({rec.location.distanceMeter}m)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Detail View */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="p-4 border-t border-slate-100">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                              <div>
                                <span className="text-slate-400 text-[10px] block font-semibold">Alamat / Titik GPS:</span>
                                <p className="text-slate-700 mt-0.5 leading-snug">
                                  {rec.location?.address || 'SMPN 4 Satu Atap Taliabu Barat, Desa Pancoran'}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block font-semibold">Waktu Masuk Antrian Lokal:</span>
                                <span className="font-mono text-slate-800 font-bold block mt-0.5">
                                  {new Date(item.queuedAt).toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block font-semibold">Status Transmisi:</span>
                                <span className="text-amber-700 font-bold block mt-0.5">
                                  Menunggu Sinyal Internet (Pending Firebase Push)
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
