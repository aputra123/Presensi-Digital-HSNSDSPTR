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
  Smartphone,
  CreditCard,
  ShieldCheck,
  ArrowLeftRight,
} from 'lucide-react';
import { SchoolConfig, Student, Teacher } from '../types';
import { generateQrDataUrl, exportCardsToPdf, CardOrientation } from '../utils/qrCardGenerator';

interface CardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: (Student | Teacher)[];
  type: 'student' | 'teacher';
  config: SchoolConfig;
  initialOrientation?: CardOrientation;
}

export const CardPrintModal: React.FC<CardPrintModalProps> = ({
  isOpen,
  onClose,
  items,
  type,
  config,
  initialOrientation,
}) => {
  const defaultOrientation: CardOrientation = type === 'teacher' ? 'portrait' : 'landscape';
  const [orientation, setOrientation] = useState<CardOrientation>(initialOrientation || defaultOrientation);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [qrStatus, setQrStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [qrError, setQrError] = useState<string | null>(null);
  const [showCutGuides, setShowCutGuides] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  useEffect(() => {
    setOrientation(initialOrientation || (type === 'teacher' ? 'portrait' : 'landscape'));
  }, [initialOrientation, isOpen, type]);

  const isStudent = type === 'student';

  // Aligned details using flexbox with consistent gap
  const renderPrintDetails = (person: Student | Teacher) => {
    if (isStudent) {
      const student = person as Student;
      return (
        <div className="flex flex-col gap-0.5 mt-1 text-[8.5px] text-left">
          <div className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 text-slate-500 font-medium">NISN</span>
            <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
            <span className="flex-1 font-mono font-bold text-slate-800 truncate">{student.nisn}</span>
          </div>
          {student.nik && (
            <div className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-slate-500 font-medium">NIK</span>
              <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
              <span className="flex-1 font-mono text-slate-700 truncate">{student.nik}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 text-slate-500 font-medium">Kelas</span>
            <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
            <span className="flex-1 font-semibold text-slate-800 truncate">{student.className || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 text-slate-500 font-medium">T. Ajaran</span>
            <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
            <span className="flex-1 text-slate-700 truncate">{config.academicYear || '-'}</span>
          </div>
        </div>
      );
    }

    const teacher = person as Teacher;
    return (
      <div className="flex flex-col gap-0.5 mt-1 text-[8.5px] text-left">
        <div className="flex items-center gap-1.5">
          <span className="w-24 shrink-0 text-slate-500 font-medium">NIP</span>
          <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
          <span className="flex-1 font-mono font-bold text-slate-900 truncate">{teacher.nip || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-24 shrink-0 text-slate-500 font-medium">Mata Pelajaran</span>
          <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
          <span className="flex-1 font-semibold text-slate-800 truncate">{teacher.subject || teacher.role || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-24 shrink-0 text-slate-500 font-medium">Status Kepegawaian</span>
          <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
          <div className="flex-1">
            <span
              className={`inline-block px-1 py-0.2 rounded font-extrabold text-[8px] uppercase leading-none ${
                teacher.employmentStatus === 'PNS'
                  ? 'bg-emerald-100 text-emerald-800'
                  : teacher.employmentStatus === 'PPPK'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {teacher.employmentStatus || 'GTK'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-24 shrink-0 text-slate-500 font-medium">Tahun Ajaran</span>
          <span className="w-1.5 shrink-0 text-slate-400 font-bold text-center">:</span>
          <span className="flex-1 text-slate-700 truncate">T.A {config.academicYear || '-'}</span>
        </div>
      </div>
    );
  };

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
      await exportCardsToPdf(
        items,
        type,
        config,
        (cur, total) => {
          setExportProgress(Math.round((cur / total) * 100));
        },
        orientation
      );
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
                Format standar lembar A4 ({orientation === 'landscape' ? 'Landscape / Mendatar' : 'Potret / Tegak'}) siap cetak presisi
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

            {/* Dedicated Button to switch between 'Portrait' and 'Landscape' viewing modes dynamically before printing */}
            <button
              type="button"
              id="btn-switch-orientation-mode"
              onClick={() => setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-95"
              title={`Klik untuk berganti ke mode ${orientation === 'portrait' ? 'Landscape (Mendatar)' : 'Portrait (Tegak)'}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-300" />
              <span>Ganti Mode:</span>
              <span className="px-2 py-0.5 rounded bg-white/20 font-black uppercase text-[10px] tracking-wider text-amber-300">
                {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
              </span>
            </button>

            {/* Orientation Selector Buttons */}
            <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/20" id="orientation-selector-pills">
              <button
                type="button"
                id="btn-select-portrait"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Format Cetak Portrait (Tegak)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Portrait</span>
              </button>
              <button
                type="button"
                id="btn-select-landscape"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  orientation === 'landscape'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Format Cetak Landscape (Mendatar)"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Landscape</span>
              </button>
            </div>

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
              <span>{isExportingPdf ? `PDF (${exportProgress}%)` : `Download PDF (${orientation === 'landscape' ? 'Mendatar' : 'Potret'})`}</span>
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
              LEMBAR CETAK IDENTITAS DIGITAL BER-QR RESMI ({isStudent ? 'PESERTA DIDIK' : 'PEGAWAI / GTK'}) — FORMAT {orientation.toUpperCase()}
            </p>
          </div>

          {/* Cards Grid formatted for A4 - Responsive 2x2 grid for portrait to maximize paper usage */}
          <div
            id="printable-card-grid"
            data-orientation={orientation}
            className={`grid gap-6 print:gap-4 print-card-grid ${
              orientation === 'portrait'
                ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2 portrait-card-grid'
                : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2 landscape-card-grid'
            }`}
          >
            {items.map((person) => {
              const student = isStudent ? (person as Student) : null;
              const teacher = !isStudent ? (person as Teacher) : null;
              const qrUrl = qrMap[person.id];
              const qrLabel = isStudent ? `STD-${student?.nisn}` : `ASN-${teacher?.nip}`;

              return (
                <div
                  key={person.id}
                  id={`id-card-print-${person.id}`}
                  className="bg-white rounded-2xl overflow-hidden flex flex-col justify-between transition-all id-card-print border-2 border-dashed border-slate-300 print:border-slate-400 shadow-sm"
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
                      className={`px-2 py-0.5 rounded-md font-extrabold text-[8px] z-10 shadow-xs shrink-0 ${
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

                  {/* Card Body - Dual Orientation Layout */}
                  {orientation === 'landscape' ? (
                    /* Landscape Card Layout */
                    <div className="p-3.5 flex items-start justify-between gap-3 flex-1">
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

                          {renderPrintDetails(person)}
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
                  ) : (
                    /* Portrait Card Layout */
                    <div className="p-3.5 flex flex-col items-center space-y-3 flex-1 text-center">
                      {/* Photo + Identity Information */}
                      <div className="flex items-center space-x-3 w-full text-left bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <img
                          src={person.avatar}
                          alt={person.name}
                          className="w-14 h-16 rounded-xl object-cover border-2 border-slate-200 shadow-2xs shrink-0 bg-slate-100"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <h4 className="font-extrabold text-slate-900 text-xs leading-snug truncate">
                            {person.name}
                          </h4>
                          <div className="inline-block px-1.5 py-0.5 rounded bg-white text-slate-800 font-bold text-[9px] border border-slate-200">
                            {isStudent ? student?.className : teacher?.role || teacher?.subject}
                          </div>
                          {renderPrintDetails(person)}
                        </div>
                      </div>

                      {/* Centered Large QR Code */}
                      <div
                        data-qr-container="true"
                        className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col items-center justify-center w-full max-w-[200px] qr-code-container shadow-2xs"
                      >
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt="QR Presensi"
                            className="w-28 h-28 object-contain rounded-xl bg-white p-1.5 border border-slate-200 qr-code-image shadow-xs"
                          />
                        ) : (
                          <div className="w-28 h-28 bg-white flex items-center justify-center text-slate-400 rounded-xl border border-slate-200">
                            <span className="text-[9px]">Loading QR...</span>
                          </div>
                        )}
                        <span className="text-[9px] font-mono font-bold text-slate-800 mt-1.5 block truncate max-w-[180px]">
                          {qrLabel}
                        </span>
                        <div className="flex items-center space-x-1 text-[8px] text-emerald-600 font-bold mt-0.5">
                          <ShieldCheck className="w-3 h-3" />
                          <span>QR Presensi Valid & Resmi</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="bg-slate-100/80 px-3 py-1.5 text-[8px] text-slate-500 flex items-center justify-between border-t border-slate-200">
                    <span className="truncate">NPSN: {config.npsn}</span>
                    <span className="font-bold text-slate-700">Presensi Digital Resmi • T.A {config.academicYear}</span>
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
