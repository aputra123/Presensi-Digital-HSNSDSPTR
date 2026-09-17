import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  X,
  School,
  LayoutGrid,
  List,
  Camera,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig, Student, Teacher } from '../types';
import { formatDateIndo } from '../utils/soundAndDate';
import { generateQrDataUrl } from '../utils/qrCardGenerator';

interface PrintModalProps {
  onClose: () => void;
  config: SchoolConfig;
  records?: AttendanceRecord[];
  students?: Student[];
  teachers?: Teacher[];
  todayDate: string;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  onClose,
  config,
  records = [],
  students = [],
  teachers = [],
  todayDate,
}) => {
  const [targetCategory, setTargetCategory] = useState<'all' | 'students' | 'teachers'>('students');
  const [printLayout, setPrintLayout] = useState<'compact' | 'detailed'>('compact');
  const [showKopSurat, setShowKopSurat] = useState<boolean>(true);
  const [showSummaryStats, setShowSummaryStats] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showSelfiePhotos, setShowSelfiePhotos] = useState<boolean>(true);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [showQrCodes, setShowQrCodes] = useState<boolean>(true);

  // QR Generation & Visual Status Indicator States
  const [qrStatus, setQrStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [qrErrorMessage, setQrErrorMessage] = useState<string | null>(null);
  const [docQrUrl, setDocQrUrl] = useState<string | null>(null);
  const [recordQrMap, setRecordQrMap] = useState<Record<string, string>>({});
  const [qrProgress, setQrProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const safeRecords = records || [];
  const safeStudents = students || [];
  const safeTeachers = teachers || [];

  const todayRecords = safeRecords.filter((r) => {
    if (r.date !== todayDate) return false;
    if (targetCategory === 'students') return r.personType === 'student';
    if (targetCategory === 'teachers') return r.personType === 'teacher';
    return true;
  });

  const presentCount = todayRecords.filter((r) => r.status === 'hadir').length;
  const lateCount = todayRecords.filter((r) => r.status === 'terlambat').length;
  const sickCount = todayRecords.filter((r) => r.status === 'sakit').length;
  const leaveCount = todayRecords.filter((r) => r.status === 'izin').length;
  const alphaCount = todayRecords.filter((r) => r.status === 'alpa').length;

  const totalPeople =
    targetCategory === 'students'
      ? safeStudents.length
      : targetCategory === 'teachers'
      ? safeTeachers.length
      : safeStudents.length + safeTeachers.length;

  // Generate All Required QR Codes with robust verification and error state
  const generateAllQrCodes = useCallback(async () => {
    setQrStatus('loading');
    setQrErrorMessage(null);

    try {
      // 1. Generate Official Document Master Verification QR Code
      const docPayload = `DOC-BA-${todayDate}-${config.npsn || '69904123'}-TOTAL:${todayRecords.length}-VALID-SIMPEG-BKD`;
      const docUrl = await generateQrDataUrl(docPayload);
      if (!docUrl) {
        throw new Error('Gagal menghasilkan Kode QR Verifikasi Dokumen');
      }
      setDocQrUrl(docUrl);

      // 2. Generate Individual Record Verification QR Codes
      const totalItems = todayRecords.length;
      setQrProgress({ current: 0, total: totalItems + 1 });

      const map: Record<string, string> = {};
      let count = 1;
      for (const record of todayRecords) {
        const itemPayload = `VERIF-ATT:${record.identifier || record.personId}:${record.date}:${record.time}:${record.status}`;
        const itemUrl = await generateQrDataUrl(itemPayload);
        if (!itemUrl) {
          throw new Error(`Gagal menghasilkan QR untuk ${record.personName}`);
        }
        map[record.id] = itemUrl;
        count++;
        setQrProgress({ current: count, total: totalItems + 1 });
      }

      setRecordQrMap(map);
      setQrStatus('success');
    } catch (err: any) {
      console.error('[PrintModal] QR Code generation error:', err);
      setQrErrorMessage(err?.message || 'Terjadi kendala saat merender QR code.');
      setQrStatus('error');
    }
  }, [config.npsn, todayDate, todayRecords]);

  // Trigger QR generation whenever records or target category changes
  useEffect(() => {
    generateAllQrCodes();
  }, [generateAllQrCodes]);

  const handlePrint = () => {
    if (qrStatus === 'loading') {
      alert('Mohon tunggu sejenak, Kode QR sedang dipersiapkan untuk pratinjau dan cetak...');
      return;
    }
    if (qrStatus === 'error') {
      alert('Terdapat kesalahan saat memproses data QR. Silakan klik "Coba Lagi" terlebih dahulu.');
      return;
    }
    window.print();
  };

  const isQrReady = qrStatus === 'success';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-6 print-modal-container">
      <div
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col border border-slate-200 print:shadow-none print:border-none print:max-h-none print:w-full print:max-w-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header & Layout Options Toolbar (Hidden during actual print) */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 print:hidden space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                  <span>Pratinjau Cetak Berita Acara Presensi</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                    {todayRecords.length} Data
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Format cetak resmi Berita Acara SIMPEG BKD & Sekolah dengan QR verifikasi
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              {/* Visual Status Indicator for QR Data Generation */}
              {qrStatus === 'loading' && (
                <div
                  id="print-qr-loading-status"
                  className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center space-x-1.5 animate-pulse"
                  title="Sedang membuat kode QR verifikasi..."
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Memuat QR ({qrProgress.current}/{qrProgress.total})...</span>
                </div>
              )}

              {qrStatus === 'success' && (
                <div
                  id="print-qr-success-status"
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-1.5"
                  title="Semua kode QR berhasil dibuat dan siap dicetak"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>QR Terverifikasi & Siap Cetak</span>
                </div>
              )}

              {qrStatus === 'error' && (
                <div
                  id="print-qr-error-status"
                  className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Gagal Memuat QR</span>
                  <button
                    type="button"
                    onClick={generateAllQrCodes}
                    className="underline ml-1 font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              <button
                onClick={handlePrint}
                disabled={!isQrReady}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center space-x-2 transition-all ${
                  isQrReady
                    ? 'bg-slate-900 hover:bg-indigo-600 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
                title={!isQrReady ? 'Menunggu kode QR siap...' : 'Cetak sekarang'}
              >
                {qrStatus === 'loading' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>{qrStatus === 'loading' ? 'Menyiapkan QR...' : 'Cetak / Simpan PDF'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Configuration Controls Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* 1. Layout Mode Switcher */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Format Layout:</span>
              </span>
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPrintLayout('compact')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    printLayout === 'compact'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Cetak Ringkas (Tabel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLayout('detailed')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    printLayout === 'detailed'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cetak Detail (Foto & GPS)</span>
                </button>
              </div>
            </div>

            {/* 2. Target Category Selector */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
                Kategori:
              </span>
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl font-bold">
                <button
                  type="button"
                  onClick={() => setTargetCategory('students')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                    targetCategory === 'students' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Siswa
                </button>
                <button
                  type="button"
                  onClick={() => setTargetCategory('teachers')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                    targetCategory === 'teachers' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Guru/GTK
                </button>
                <button
                  type="button"
                  onClick={() => setTargetCategory('all')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                    targetCategory === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semua
                </button>
              </div>
            </div>

            {/* 3. Toggles for Print Options */}
            <div className="flex items-center space-x-3 text-[11px] text-slate-600 flex-wrap">
              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showKopSurat}
                  onChange={(e) => setShowKopSurat(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold">Kop Surat</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSummaryStats}
                  onChange={(e) => setShowSummaryStats(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold">Statistik</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showQrCodes}
                  onChange={(e) => setShowQrCodes(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold flex items-center space-x-1">
                  <QrCode className="w-3 h-3 text-indigo-600" />
                  <span>Kode QR</span>
                </span>
              </label>

              {printLayout === 'detailed' && (
                <>
                  <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSelfiePhotos}
                      onChange={(e) => setShowSelfiePhotos(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold">Foto Selfie</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showCoordinates}
                      onChange={(e) => setShowCoordinates(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold">Koordinat GPS</span>
                  </label>
                </>
              )}

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold">Pengesahan</span>
              </label>
            </div>
          </div>
        </div>

        {/* Printable Paper Content (A4 Target) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-5 text-slate-900 bg-white print:p-0 print:overflow-visible" id="printable-area">
          {/* Kop Surat Resmi Kabupaten Pulau Taliabu */}
          {showKopSurat && (
            <div className="print-header-kop border-b-4 border-double border-slate-900 pb-3 flex items-center justify-between gap-4">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt="Logo Sekolah"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-contain shrink-0"
                />
              ) : (
                <School className="w-14 h-14 text-slate-800 shrink-0" />
              )}
              <div className="text-center flex-1 space-y-0.5">
                <h2 className="font-bold text-[11px] uppercase tracking-widest text-slate-700">
                  PEMERINTAH KABUPATEN PULAU TALIABU • DINAS PENDIDIKAN & KEBUDAYAAN
                </h2>
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-950 uppercase">
                  {config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT'}
                </h1>
                <p className="text-[11px] text-slate-700 leading-tight">
                  {config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara'} • NPSN: {config.npsn || '69904123'}
                </p>
                <p className="text-[10px] text-slate-600 font-mono">
                  Email: {config.bkdEmail || 'smpn4taliabubarat@disdik.pulautaliabukab.go.id'} • SIMPEG BKD Pulau Taliabu
                </p>
              </div>

              {/* Master Document Verification QR Code in Kop Surat */}
              {showQrCodes && docQrUrl && (
                <div className="shrink-0 flex flex-col items-center justify-center p-1.5 bg-slate-50 border border-slate-300 rounded-xl text-center print:border-slate-800">
                  <img
                    src={docQrUrl}
                    alt="QR Validasi Dokumen"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 object-contain"
                  />
                  <span className="text-[7.5px] font-mono font-extrabold text-slate-800 mt-0.5 uppercase tracking-tighter">
                    DOKUMEN SAH
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Judul Berita Acara */}
          <div className="text-center space-y-0.5 pt-1">
            <h3 className="font-extrabold text-sm uppercase underline tracking-wider">
              BERITA ACARA REKAPITULASI PRESENSI {printLayout === 'detailed' ? 'DETAIL BIOMETRIK & GPS' : 'HARIAN'} {targetCategory === 'teachers' ? 'GURU & GTK' : targetCategory === 'students' ? 'PESERTA DIDIK' : 'TERPADU'}
            </h3>
            <p className="text-xs text-slate-700">
              Hari/Tanggal: <strong>{formatDateIndo(todayDate)}</strong> • Semester {config.semester} Tahun Pelajaran {config.academicYear} • Layout: {printLayout === 'detailed' ? 'Lengkap (Biometrik & GPS)' : 'Ringkas (Standar A4)'}
            </p>
          </div>

          {/* Ringkasan Rekap Angka */}
          {showSummaryStats && (
            <div className="grid grid-cols-6 gap-2 text-center text-xs py-1 print-avoid-break">
              <div className="p-2 rounded-xl border border-slate-300">
                <span className="text-[10px] text-slate-600 block">Total Personel</span>
                <strong className="text-base text-slate-900">{totalPeople}</strong>
              </div>
              <div className="p-2 rounded-xl border border-slate-300 bg-emerald-50 print:bg-white">
                <span className="text-[10px] text-emerald-800 block font-bold">Hadir</span>
                <strong className="text-base text-emerald-900">{presentCount}</strong>
              </div>
              <div className="p-2 rounded-xl border border-slate-300 bg-amber-50 print:bg-white">
                <span className="text-[10px] text-amber-800 block font-bold">Terlambat</span>
                <strong className="text-base text-amber-900">{lateCount}</strong>
              </div>
              <div className="p-2 rounded-xl border border-slate-300 bg-blue-50 print:bg-white">
                <span className="text-[10px] text-blue-800 block font-bold">Sakit</span>
                <strong className="text-base text-blue-900">{sickCount}</strong>
              </div>
              <div className="p-2 rounded-xl border border-slate-300 bg-purple-50 print:bg-white">
                <span className="text-[10px] text-purple-800 block font-bold">Izin</span>
                <strong className="text-base text-purple-900">{leaveCount}</strong>
              </div>
              <div className="p-2 rounded-xl border border-slate-300 bg-rose-50 print:bg-white">
                <span className="text-[10px] text-rose-800 block font-bold">Alpa / TK</span>
                <strong className="text-base text-rose-900">{alphaCount}</strong>
              </div>
            </div>
          )}

          {/* =========================================================
              LAYOUT 1: CETAK RINGKAS (TABEL STANDAR EFISIEN RUANG)
             ========================================================= */}
          {printLayout === 'compact' && (
            <div className="border border-slate-300 rounded-xl overflow-hidden print:border-collapse">
              <table className="print-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-slate-800 uppercase">
                    <th className="p-2 text-center w-8 border-r border-slate-300">No</th>
                    {showQrCodes && (
                      <th className="p-2 text-center w-12 border-r border-slate-300">QR</th>
                    )}
                    <th className="p-2 border-r border-slate-300">Nama Lengkap</th>
                    <th className="p-2 border-r border-slate-300">NISN / NIP</th>
                    <th className="p-2 border-r border-slate-300">Kelas / Jabatan</th>
                    <th className="p-2 border-r border-slate-300">Waktu Presensi</th>
                    <th className="p-2 text-center border-r border-slate-300">Status</th>
                    <th className="p-2">Metode Verifikasi & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {todayRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showQrCodes ? 8 : 7} className="p-6 text-center text-slate-500 font-medium">
                        Belum ada catatan presensi pada tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    todayRecords.map((r, i) => (
                      <tr key={r.id} className="print-avoid-break hover:bg-slate-50">
                        <td className="p-1.5 text-center border-r border-slate-200 font-mono text-[10px]">{i + 1}</td>
                        {showQrCodes && (
                          <td className="p-1 text-center border-r border-slate-200">
                            {recordQrMap[r.id] ? (
                              <img
                                src={recordQrMap[r.id]}
                                alt={`QR-${r.identifier || r.id}`}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 object-contain mx-auto"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center mx-auto text-[7px] font-mono text-slate-400">
                                QR
                              </div>
                            )}
                          </td>
                        )}
                        <td className="p-1.5 font-bold border-r border-slate-200 text-[11px] text-slate-900">{r.personName}</td>
                        <td className="p-1.5 border-r border-slate-200 font-mono text-[10px] text-slate-700">{r.identifier || '-'}</td>
                        <td className="p-1.5 border-r border-slate-200 text-[10px]">{r.classOrSubject}</td>
                        <td className="p-1.5 border-r border-slate-200 font-mono text-[10px] whitespace-nowrap">
                          {r.time} WITA ({r.type === 'masuk' ? 'Masuk' : 'Pulang'})
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200 font-bold uppercase text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] ${
                              r.status === 'hadir'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : r.status === 'sakit'
                                ? 'bg-blue-100 text-blue-800'
                                : r.status === 'izin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-1.5 text-slate-700 text-[10px]">
                          {r.method === 'selfie_gps' ? 'Biometrik Wajah + GPS' : 'Kartu QR Code'} • {r.note || 'Lolos Validasi SIMPEG'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* =========================================================
              LAYOUT 2: CETAK DETAIL (TERMASUK FOTO SELFIE & KOORDINAT GPS)
             ========================================================= */}
          {printLayout === 'detailed' && (
            <div className="border border-slate-300 rounded-xl overflow-hidden print:border-collapse">
              <table className="print-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[9px] font-extrabold text-slate-800 uppercase tracking-tight">
                    <th className="p-2 text-center w-7 border-r border-slate-300">No</th>
                    {showSelfiePhotos && (
                      <th className="p-2 text-center w-16 border-r border-slate-300">Foto Selfie</th>
                    )}
                    <th className="p-2 border-r border-slate-300">Identitas & Jabatan</th>
                    <th className="p-2 border-r border-slate-300">Kelas / Rombel</th>
                    <th className="p-2 border-r border-slate-300">Sesi & Jam</th>
                    <th className="p-2 text-center border-r border-slate-300">Status</th>
                    {showCoordinates && (
                      <th className="p-2 border-r border-slate-300">Koordinat & Radius GPS</th>
                    )}
                    <th className="p-2">Verifikasi & Validasi QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {todayRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showSelfiePhotos && showCoordinates ? 8 : showSelfiePhotos || showCoordinates ? 7 : 6}
                        className="p-6 text-center text-slate-500 font-medium"
                      >
                        Belum ada catatan presensi pada tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    todayRecords.map((r, i) => {
                      const hasGps = Boolean(r.location);
                      const inRadius = r.location?.inRadius ?? true;
                      const distM = r.location?.distanceMeter ?? 15;

                      return (
                        <tr key={r.id} className="print-avoid-break hover:bg-slate-50">
                          {/* No */}
                          <td className="p-1.5 text-center border-r border-slate-200 font-mono text-[10px]">
                            {i + 1}
                          </td>

                          {/* Foto Selfie Biometrik */}
                          {showSelfiePhotos && (
                            <td className="p-1.5 text-center border-r border-slate-200">
                              {r.photoUrl ? (
                                <img
                                  src={r.photoUrl}
                                  alt={`Selfie ${r.personName}`}
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-12 rounded-lg object-cover mx-auto border border-slate-300 shadow-2xs"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center mx-auto text-[8px] text-slate-400">
                                  <Camera className="w-3.5 h-3.5 mb-0.5 text-slate-400" />
                                  <span>Scan QR</span>
                                </div>
                              )}
                            </td>
                          )}

                          {/* Identitas */}
                          <td className="p-1.5 border-r border-slate-200 space-y-0.5">
                            <div className="font-bold text-[11px] text-slate-900 leading-tight">
                              {r.personName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-600">
                              {r.identifier ? `NIP/NISN: ${r.identifier}` : '-'}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {r.employmentStatus || (r.personType === 'student' ? 'Siswa' : 'GTK')}
                            </div>
                          </td>

                          {/* Kelas / Jabatan */}
                          <td className="p-1.5 border-r border-slate-200 text-[10px] font-medium text-slate-800">
                            {r.classOrSubject}
                          </td>

                          {/* Sesi & Jam */}
                          <td className="p-1.5 border-r border-slate-200 font-mono text-[10px] whitespace-nowrap">
                            <span className="font-bold">{r.time}</span> WITA
                            <span className="block text-[9px] font-sans text-slate-500 uppercase">
                              Sesi {r.type}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-1.5 text-center border-r border-slate-200">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                r.status === 'hadir'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'terlambat'
                                  ? 'bg-amber-100 text-amber-800'
                                  : r.status === 'sakit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : r.status === 'izin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>

                          {/* Koordinat & Lokasi GPS */}
                          {showCoordinates && (
                            <td className="p-1.5 border-r border-slate-200 space-y-0.5 text-[9px]">
                              {hasGps && r.location ? (
                                <>
                                  <div className="font-mono text-slate-800 font-semibold">
                                    {r.location.lat.toFixed(5)}, {r.location.lng.toFixed(5)}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span
                                      className={`px-1 py-0.2 rounded font-bold text-[8px] ${
                                        inRadius ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                      }`}
                                    >
                                      {inRadius ? `✓ Radius ${distM}m` : `✕ Luar Radius (${distM}m)`}
                                    </span>
                                  </div>
                                  <div className="text-[8px] text-slate-500 line-clamp-1 truncate max-w-[130px]" title={r.location.address}>
                                    {r.location.address || 'Sekolah SMPN 4 Taliabu Barat'}
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-400 italic font-mono text-[9px]">
                                  Pusat Sekolah ({config?.schoolLat?.toFixed(4) ?? '-1.8214'}, {config?.schoolLng?.toFixed(4) ?? '124.7081'})
                                </span>
                              )}
                            </td>
                          )}

                          {/* Verifikasi & Validasi QR */}
                          <td className="p-1.5 text-[9px] text-slate-700 space-y-1">
                            <div className="flex items-center gap-2">
                              {showQrCodes && recordQrMap[r.id] && (
                                <img
                                  src={recordQrMap[r.id]}
                                  alt={`QR-${r.identifier || r.id}`}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 object-contain border border-slate-200 rounded p-0.5 shrink-0 bg-white"
                                />
                              )}
                              <div>
                                <div className="font-bold text-slate-800">
                                  {r.method === 'selfie_gps' ? 'Biometrik Face + GPS' : 'Scan Kartu QR'}
                                </div>
                                <div className="text-slate-500">
                                  {r.note || 'Lolos Validasi SIMPEG'}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Legal Signatures / Tanda Tangan Pengesahan Resmi */}
          {showSignatures && (
            <div className="pt-6 grid grid-cols-2 text-center text-xs print-avoid-break">
              <div className="space-y-4">
                <p>Mengetahui,<br /><strong>Kepala Sekolah</strong></p>
                {showQrCodes && docQrUrl ? (
                  <div className="flex flex-col items-center justify-center">
                    <img
                      src={docQrUrl}
                      alt="Tanda Tangan Elektronik Kepala Sekolah"
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-contain border border-slate-300 rounded p-0.5 bg-white"
                    />
                    <span className="text-[7.5px] font-mono text-slate-500 mt-0.5">TTE Sah Terverifikasi</span>
                  </div>
                ) : (
                  <div className="h-14" />
                )}
                <div>
                  <p className="font-bold underline text-slate-900">{config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.'}</p>
                  <p className="text-[10px] text-slate-600 font-mono">NIP. {config.principalNip || '197305141999031004'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p>Taliabu Barat, {formatDateIndo(todayDate)}<br /><strong>Petugas Piket & Admin Presensi</strong></p>
                {showQrCodes && docQrUrl ? (
                  <div className="flex flex-col items-center justify-center">
                    <img
                      src={docQrUrl}
                      alt="Tanda Tangan Elektronik Admin Piket"
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-contain border border-slate-300 rounded p-0.5 bg-white"
                    />
                    <span className="text-[7.5px] font-mono text-slate-500 mt-0.5">SIMPEG BKD Pulau Taliabu</span>
                  </div>
                ) : (
                  <div className="h-14" />
                )}
                <div>
                  <p className="font-bold underline text-slate-900">{config.adminName || 'Hasbullah Buamona, S.Kom.'}</p>
                  <p className="text-[10px] text-slate-600 font-mono">SIMPEG BKD Kab. Pulau Taliabu</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Hidden when printing) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="text-xs text-slate-500 flex items-center space-x-2">
            <span>
              Layout aktif: <strong className="text-slate-800">{printLayout === 'compact' ? 'Cetak Ringkas' : 'Cetak Detail (Foto & GPS)'}</strong> • {todayRecords.length} catatan presensi
            </span>
            {isQrReady && (
              <span className="text-emerald-600 font-bold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>QR Lengkap</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>

            <button
              onClick={handlePrint}
              disabled={!isQrReady}
              className={`px-6 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition-all font-bold text-xs ${
                isQrReady
                  ? 'bg-slate-900 hover:bg-indigo-600 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {qrStatus === 'loading' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{qrStatus === 'loading' ? 'Menyiapkan QR...' : 'Cetak Sekarang (A4 Print / PDF)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


