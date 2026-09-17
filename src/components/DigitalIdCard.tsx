import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  QrCode,
  ShieldCheck,
  School,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { SchoolConfig, Student, Teacher } from '../types';
import {
  generateQrDataUrl,
  downloadCardAsPng,
  downloadQrOnly,
} from '../utils/qrCardGenerator';

interface DigitalIdCardProps {
  person: Student | Teacher;
  type: 'student' | 'teacher';
  config: SchoolConfig;
  onPrintSingle: (person: Student | Teacher) => void;
}

export const DigitalIdCard: React.FC<DigitalIdCardProps> = ({
  person,
  type,
  config,
  onPrintSingle,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const isStudent = type === 'student';
  const student = isStudent ? (person as Student) : null;
  const teacher = !isStudent ? (person as Teacher) : null;

  const qrPayload = isStudent ? `STD-${student?.nisn}` : `ASN-${teacher?.nip}`;

  useEffect(() => {
    let isMounted = true;
    generateQrDataUrl(qrPayload).then((url) => {
      if (isMounted) setQrUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [qrPayload]);

  const handleDownloadCard = async () => {
    try {
      setIsDownloading(true);
      await downloadCardAsPng(person, type, config, qrUrl);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (e) {
      console.error('Error downloading card PNG:', e);
      alert('Gagal mengunduh kartu. Silakan coba kembali.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrUrl) return;
    const identifier = isStudent ? student?.nisn : teacher?.nip;
    downloadQrOnly(qrUrl, `QR_Presensi_${identifier}.png`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden relative flex flex-col justify-between hover:shadow-xl transition-all group id-card-print">
      {/* Top Banner */}
      <div
        className={`p-4 text-white flex items-center justify-between relative overflow-hidden ${
          isStudent
            ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900'
            : 'bg-gradient-to-r from-purple-900 via-purple-950 to-indigo-950'
        }`}
      >
        <div className="flex items-center space-x-2.5 z-10 min-w-0">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo Sekolah"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-contain bg-white/95 p-0.5 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shrink-0">
              <School className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-extrabold text-[11px] uppercase tracking-wider leading-none truncate text-white">
              {config.schoolName}
            </h4>
            <p className="text-[9px] text-blue-200 mt-0.5">
              {isStudent ? 'KARTU TANDA PELAJAR DIGITAL' : 'KARTU IDENTITAS GTK / PEGAWAI'}
            </p>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded-md font-extrabold text-[9px] z-10 shadow-xs uppercase ${
            isStudent
              ? 'bg-amber-400 text-slate-950'
              : teacher?.employmentStatus === 'PNS'
              ? 'bg-emerald-400 text-emerald-950'
              : 'bg-purple-300 text-purple-950'
          }`}
        >
          {isStudent ? 'SISWA' : teacher?.employmentStatus || 'GURU GTK'}
        </span>

        {/* Subtle glow */}
        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
        <div className="flex items-start space-x-3.5">
          <img
            src={person.avatar}
            alt={person.name}
            className="w-20 h-24 rounded-2xl object-cover border-2 border-indigo-100 shadow-xs shrink-0 bg-slate-100"
          />

          <div className="flex-1 min-w-0 space-y-1 text-left">
            <h3 className="font-extrabold text-slate-900 text-sm leading-snug truncate">
              {person.name}
            </h3>
            <div
              className={`inline-block px-2 py-0.5 rounded-md font-extrabold text-[10px] border ${
                isStudent
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  : 'bg-purple-50 text-purple-700 border-purple-100'
              }`}
            >
              {isStudent ? student?.className : teacher?.role || teacher?.subject}
            </div>

            <div className="pt-1 text-[11px] text-slate-600 space-y-0.5 font-medium">
              <div>
                <span className="text-slate-400 font-semibold">
                  {isStudent ? 'NISN: ' : 'NIP: '}
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {isStudent ? student?.nisn : teacher?.nip}
                </span>
              </div>
              {isStudent && student?.nik && (
                <div>
                  <span className="text-slate-400 font-semibold">NIK: </span>
                  <span className="font-mono text-slate-700 text-[10px]">{student.nik}</span>
                </div>
              )}
              {!isStudent && teacher?.subject && (
                <div className="truncate">
                  <span className="text-slate-400 font-semibold">Mapel: </span>
                  <span className="text-slate-700">{teacher.subject}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-semibold">Berlaku: </span>
                <span className="text-slate-700">T.A {config.academicYear}</span>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Barcode Area with REAL Scannable QR Code */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5 text-left min-w-0 flex-1 pr-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              QR Presensi Mandiri
            </span>
            <p className="text-[10px] text-slate-700 font-mono font-bold truncate">
              {qrPayload}
            </p>
            <span className="text-[9px] text-emerald-600 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span className="truncate">{isStudent ? 'Terverifikasi Dapodik' : 'SIMPEG Verified'}</span>
            </span>
          </div>

          {/* Real Generated QR Image */}
          <div
            data-qr-container="true"
            className="w-16 h-16 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 qr-code-container"
          >
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR Code"
                className="w-14 h-14 object-contain rounded qr-code-image"
              />
            ) : (
              <div className="w-14 h-14 bg-slate-100 animate-pulse rounded flex items-center justify-center text-slate-400 text-[9px]">
                Loading...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons (Download & Print) - Hidden during print */}
      <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-1.5 print:hidden">
        {/* Download Card PNG */}
        <button
          type="button"
          onClick={handleDownloadCard}
          disabled={isDownloading}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs ${
            downloadSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
          }`}
          title="Download Kartu Lengkap (Format Gambar PNG Resolusi Tinggi)"
        >
          {downloadSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tersimpan!</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Menyiapkan...' : 'Unduh Kartu'}</span>
            </>
          )}
        </button>

        {/* Download QR Only */}
        <button
          type="button"
          onClick={handleDownloadQr}
          className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1"
          title="Download Gambar QR Code Saja (PNG)"
        >
          <QrCode className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden xl:inline text-[11px]">QR</span>
        </button>

        {/* Print Single Card */}
        <button
          type="button"
          onClick={() => onPrintSingle(person)}
          className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1"
          title="Cetak Kartu Ini"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden xl:inline text-[11px]">Cetak</span>
        </button>
      </div>

      {/* ID Card Footer info */}
      <div className="bg-slate-100/70 px-4 py-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-200/80">
        <span className="truncate">NPSN: {config.npsn}</span>
        <span className="font-bold text-slate-700">Kab. Pulau Taliabu</span>
      </div>
    </div>
  );
};
