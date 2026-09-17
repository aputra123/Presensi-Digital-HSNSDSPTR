import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  X,
  School,
  Scissors,
  CheckCircle2,
  FileDown,
  Layers,
  Sparkles,
  RefreshCw,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import { SchoolConfig, Student, Teacher } from '../types';
import { generateQrDataUrl, exportCardsToPdf } from '../utils/qrCardGenerator';

interface CardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: (Student | Teacher)[];
  type: 'student' | 'teacher';
  config: SchoolConfig;
}

export const CardPrintModal: React.FC<CardPrintModalProps> = ({
  isOpen,
  onClose,
  items,
  type,
  config,
}) => {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [qrStatus, setQrStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [qrError, setQrError] = useState<string | null>(null);
  const [showCutGuides, setShowCutGuides] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  const isStudent = type === 'student';

  // Pre-generate real QR codes for all items in the print batch with full error handling and progress
  const loadQrs = useCallback(async () => {
    if (items.length === 0) {
      setQrStatus('success');
      return;
    }

    setQrStatus('loading');
    setQrError(null);

    try {
      const map: Record<string, string> = {};
      for (const item of items) {
        const payload = isStudent
          ? `STD-${(item as Student).nisn}`
          : `ASN-${(item as Teacher).nip}`;
        const url = await generateQrDataUrl(payload);
        if (!url) {
          throw new Error(`Gagal menghasilkan QR untuk ${item.name}`);
        }
        map[item.id] = url;
      }
      setQrMap(map);
      setQrStatus('success');
    } catch (err: any) {
      console.error('Error generating card QR codes:', err);
      setQrError(err?.message || 'Gagal menghasilkan kode QR kartu.');
      setQrStatus('error');
    }
  }, [items, isStudent]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      loadQrs();
    }
  }, [isOpen, items, loadQrs]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (qrStatus === 'loading') {
      alert('Mohon tunggu sejenak, kode QR kartu sedang diproses...');
      return;
    }
    if (qrStatus === 'error') {
      alert('Terdapat kendala pada pembuatan QR. Silakan klik "Coba Lagi" terlebih dahulu.');
      return;
    }
    window.print();
  };

  const handleExportPdf = async () => {
    if (qrStatus === 'loading') {
      alert('Mohon tunggu hingga semua kode QR selesai dimuat.');
      return;
    }
    try {
      setIsExportingPdf(true);
      setExportProgress(0);
      await exportCardsToPdf(items, type, config, (cur, total) => {
        setExportProgress(Math.round((cur / total) * 100));
      });
    } catch (e) {
      console.error('Export PDF error:', e);
      alert('Gagal mengekspor PDF kartu. Silakan coba kembali.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const readyCount = Object.keys(qrMap).length;
  const isAllQrReady = qrStatus === 'success' && readyCount >= items.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print-modal-container">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col border border-slate-200 print:shadow-none print:border-none print:max-h-none print:w-full print:max-w-none print:rounded-none">
        {/* Modal Top Control Bar (Hidden when Printing) */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-300">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight flex items-center space-x-2">
                <span>Pratinjau & Cetak Kartu {isStudent ? 'Siswa' : 'Guru / GTK'}</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold">
                  {items.length} Kartu
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Format standar lembar A4 siap laminating atau potong presisi
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Visual Status Indicator for QR Generation */}
            {qrStatus === 'loading' && (
              <div
                id="qr-loading-indicator"
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center space-x-1.5 animate-pulse"
                title="Sistem sedang membuat gambar QR code beresolusi tinggi"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Memuat QR ({readyCount}/{items.length})...</span>
              </div>
            )}

            {qrStatus === 'success' && (
              <div
                id="qr-success-indicator"
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center space-x-1.5"
                title="Semua QR code telah siap dan dapat dicetak tanpa hambatan"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>QR Lengkap ({readyCount}/{items.length})</span>
              </div>
            )}

            {qrStatus === 'error' && (
              <div
                id="qr-error-indicator"
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center space-x-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Kendala QR</span>
                <button
                  type="button"
                  onClick={loadQrs}
                  className="underline ml-1 font-bold hover:text-white cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Toggle Cut Guides */}
            <button
              type="button"
              onClick={() => setShowCutGuides(!showCutGuides)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                showCutGuides
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Garis Potong</span>
            </button>

            {/* Export PDF Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || !isAllQrReady}
              className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isAllQrReady ? 'Menunggu semua QR siap' : 'Unduh berkas PDF siap cetak'}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? `PDF (${exportProgress}%)` : 'Download PDF'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!isAllQrReady}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm ${
                isAllQrReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
              }`}
              title={!isAllQrReady ? 'Mohon tunggu hingga seluruh QR selesai dimuat' : 'Cetak sekarang'}
            >
              {qrStatus === 'loading' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>{qrStatus === 'loading' ? 'Menyiapkan QR...' : 'Cetak (Print)'}</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="printable-area" className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 print:bg-white print:p-0">
          {/* Printable School Kop (Only shown when printing) */}
          <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900 text-center">
            <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
              {config.schoolName}
            </h2>
            <p className="text-xs text-slate-600">
              NPSN: {config.npsn} • {config.address || 'Kabupaten Pulau Taliabu, Maluku Utara'}
            </p>
            <p className="text-[11px] font-bold text-slate-800 mt-1 uppercase tracking-wider">
              LEMBAR CETAK IDENTITAS DIGITAL BER-QR RESMI ({isStudent ? 'PESERTA DIDIK' : 'PEGAWAI / GTK'})
            </p>
          </div>

          {/* Cards Grid formatted for A4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print-card-grid">
            {items.map((person) => {
              const student = isStudent ? (person as Student) : null;
              const teacher = !isStudent ? (person as Teacher) : null;
              const qrUrl = qrMap[person.id];
              const qrLabel = isStudent ? `STD-${student?.nisn}` : `ASN-${teacher?.nip}`;

              return (
                <div
                  key={person.id}
                  className={`bg-white rounded-2xl overflow-hidden flex flex-col justify-between transition-all id-card-print ${
                    showCutGuides
                      ? 'border-2 border-dashed border-slate-300 print:border-slate-400'
                      : 'border border-slate-200 shadow-sm'
                  }`}
                  style={{
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                  }}
                >
                  {/* Card Header */}
                  <div
                    className={`p-3 text-white flex items-center justify-between relative overflow-hidden ${
                      isStudent
                        ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900'
                        : 'bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950'
                    }`}
                  >
                    <div className="flex items-center space-x-2 z-10 min-w-0">
                      {config.logoUrl ? (
                        <img
                          src={config.logoUrl}
                          alt="Logo"
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-lg object-contain bg-white/90 p-0.5 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
                          <School className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-[10px] uppercase tracking-wider leading-tight truncate text-white">
                          {config.schoolName}
                        </h4>
                        <p className="text-[8px] text-blue-200">
                          {isStudent ? 'KARTU TANDA PELAJAR DIGITAL' : 'KARTU IDENTITAS GTK / PEGAWAI'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md font-extrabold text-[8px] z-10 shadow-xs ${
                        isStudent
                          ? 'bg-amber-400 text-slate-950'
                          : teacher?.employmentStatus === 'PNS'
                          ? 'bg-emerald-400 text-emerald-950'
                          : 'bg-purple-400 text-purple-950'
                      }`}
                    >
                      {isStudent ? 'SISWA' : teacher?.employmentStatus || 'GTK'}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 flex items-start justify-between gap-3">
                    {/* Photo + Info */}
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <img
                        src={person.avatar}
                        alt={person.name}
                        className="w-16 h-20 rounded-xl object-cover border-2 border-slate-200 shadow-2xs shrink-0 bg-slate-100"
                      />

                      <div className="min-w-0 flex-1 space-y-0.5 text-left">
                        <h4 className="font-extrabold text-slate-900 text-xs leading-snug truncate">
                          {person.name}
                        </h4>
                        <div className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[9px]">
                          {isStudent ? student?.className : teacher?.role || teacher?.subject}
                        </div>

                        <div className="pt-1 text-[9px] text-slate-600 space-y-0.5 font-medium leading-tight">
                          <div>
                            <span className="text-slate-400">
                              {isStudent ? 'NISN: ' : 'NIP: '}
                            </span>
                            <span className="font-mono font-bold text-slate-800">
                              {isStudent ? student?.nisn : teacher?.nip}
                            </span>
                          </div>
                          {isStudent && student?.nik && (
                            <div>
                              <span className="text-slate-400">NIK: </span>
                              <span className="font-mono text-slate-700">{student.nik}</span>
                            </div>
                          )}
                          {!isStudent && teacher?.subject && (
                            <div className="truncate">
                              <span className="text-slate-400">Bidang: </span>
                              <span className="text-slate-700">{teacher.subject}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-400">T.A: </span>
                            <span className="text-slate-700">{config.academicYear}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Real QR Code Box */}
                    <div
                      data-qr-container="true"
                      className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col items-center justify-center shrink-0 w-24 qr-code-container"
                    >
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt="QR Presensi"
                          className="w-16 h-16 object-contain rounded bg-white p-0.5 border border-slate-200 qr-code-image"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-white flex items-center justify-center text-slate-400 rounded border border-slate-200">
                          <span className="text-[8px]">Loading...</span>
                        </div>
                      )}
                      <span className="text-[8px] font-mono font-bold text-slate-800 mt-1 block truncate max-w-[85px] text-center">
                        {qrLabel}
                      </span>
                      <span className="text-[7px] text-emerald-600 font-semibold block text-center leading-none mt-0.5">
                        ✓ Terverifikasi
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="bg-slate-100/80 px-3 py-1 text-[8px] text-slate-500 flex items-center justify-between border-t border-slate-200">
                    <span className="truncate">NPSN: {config.npsn}</span>
                    <span className="font-bold text-slate-700">Presensi Digital Resmi</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
