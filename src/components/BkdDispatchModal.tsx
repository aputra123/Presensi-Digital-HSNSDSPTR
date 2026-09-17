import React, { useState } from 'react';
import {
  X,
  Send,
  Phone,
  Mail,
  HardDrive,
  Copy,
  ExternalLink,
  Download,
  Camera,
  Check,
} from 'lucide-react';
import { SchoolConfig, AsnAttendanceRow, DailyApelDocumentation } from '../types';
import { formatDateIndo } from '../utils/soundAndDate';
import { exportAsnSignedAttendanceManualPdf } from '../utils/exportUtils';

interface BkdDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableRows: AsnAttendanceRow[];
  config: SchoolConfig;
  selectedDate: string;
  apelDocumentation: DailyApelDocumentation;
  stats: {
    total: number;
    bothSigned: number;
    signedCheckIn: number;
    signedCheckOut: number;
    countDinasLuar: number;
    countIzinSakit: number;
    countTanpaKet: number;
  };
}

export const BkdDispatchModal: React.FC<BkdDispatchModalProps> = ({
  isOpen,
  onClose,
  tableRows,
  config,
  selectedDate,
  apelDocumentation,
  stats,
}) => {
  // Editable configuration fields
  const [waNumber, setWaNumber] = useState<string>(
    config.bkdWhatsAppNumber || config.bkdWhatsApp || '6281234567890'
  );
  const [driveLink, setDriveLink] = useState<string>(
    config.bkdGoogleDriveLink || 'https://drive.google.com/drive/folders/bkd-taliabu-presensi-gtk'
  );
  const [targetEmail, setTargetEmail] = useState<string>(
    config.bkdEmail || 'bkd@pulautaliabukab.go.id'
  );

  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const hasApelPagi = !!apelDocumentation.apelPagi?.photoUrl;
  const hasApelSiang = !!apelDocumentation.apelSiang?.photoUrl;

  // Format Official WA Message
  const waMessageText = `*LAPORAN PRESENSI & DOKUMENTASI HARIAN GTK ASN*
*${(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT').toUpperCase()}*
*KABUPATEN PULAU TALIABU - MALUKU UTARA*

📅 *Hari / Tanggal:* ${formatDateIndo(selectedDate)}
👥 *Total Personil GTK:* ${stats.total} Pegawai
✅ *Tanda Tangan Lengkap (Masuk & Pulang):* ${stats.bothSigned} Orang
📝 *Hadir Masuk:* ${stats.signedCheckIn} | *Hadir Pulang:* ${stats.signedCheckOut}
🏢 *Dinas Luar:* ${stats.countDinasLuar} Orang
📋 *Izin / Sakit:* ${stats.countIzinSakit} Orang
⚠️ *Tanpa Keterangan:* ${stats.countTanpaKet} Orang

📸 *STATUS LAMPIRAN DOKUMENTASI APEL (GPS STAMP):*
• Apel Pagi: ${hasApelPagi ? 'TERLAMPIR (Koordinat GPS Valid)' : 'Belum Ada Dokumentasi'}
• Apel Siang: ${hasApelSiang ? 'TERLAMPIR (Koordinat GPS Valid)' : 'Belum Ada Dokumentasi'}

📁 *Link Folder Google Drive BKD:*
${driveLink}

Dokumen rekapitulasi bertanda tangan digital dan durasi kerja GTK telah diverifikasi oleh Kepala Sekolah:
${config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.'} (NIP. ${config.principalNip || '197305141999031004'})

_Sistem Informasi Presensi GTK Digital SIMPEG BKD Taliabu_`;

  // Format Email Subject & Body
  const emailSubject = `[LAPORAN PRESENSI ASN] ${config.schoolName || 'SMPN 4 SATAP TALIABU BARAT'} - ${formatDateIndo(selectedDate)}`;
  const emailBody = `Kepada Yth.
Kepala Badan Kepegawaian Daerah (BKD) Kab. Pulau Taliabu
Bidang Pengadaan, Mutasi dan Informasi Kepegawaian

Dengan hormat,
Bersama surat elektronik ini kami sampaikan Rekapitulasi Presensi Harian Guru & GTK ASN berserta Lampiran Dokumentasi Apel Berstempel GPS:

1. Identitas Sekolah:
   - Nama Satuan Pendidikan: ${config.schoolName || 'SMP Negeri 4 Satu Atap Taliabu Barat'}
   - NPSN: ${config.npsn || '69989800'}
   - Tanggal Presensi: ${formatDateIndo(selectedDate)}

2. Ringkasan Kehadiran & Tanda Tangan Digital:
   - Total GTK ASN: ${stats.total} Orang
   - Hadir TTD Lengkap: ${stats.bothSigned} Orang
   - Hadir Masuk: ${stats.signedCheckIn} | Pulang: ${stats.signedCheckOut}
   - Dinas Luar / Tugas Resmi: ${stats.countDinasLuar} Orang
   - Izin / Cuti / Sakit: ${stats.countIzinSakit} Orang
   - Tanpa Keterangan: ${stats.countTanpaKet} Orang

3. Lampiran Dokumentasi Kegiatan:
   - Foto Apel Pagi Berstempel GPS: ${hasApelPagi ? 'Lengkap' : 'Belum Tersedia'}
   - Foto Apel Siang Berstempel GPS: ${hasApelSiang ? 'Lengkap' : 'Belum Tersedia'}
   - Arsip Google Drive: ${driveLink}

Berkas daftar hadir lengkap dengan lembar tanda tangan digital dan foto dokumentasi dapat diakses melalui link Google Drive di atas atau berkas PDF terlampir.

Demikian laporan ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.

Hormat kami,
Kepala Sekolah,
${config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.'}
NIP. ${config.principalNip || '197305141999031004'}`;

  // Copy helper
  const handleCopy = (text: string, channel: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(channel);
    setTimeout(() => setCopiedChannel(null), 2500);
  };

  // Direct WA send
  const handleSendWa = () => {
    const cleanPhone = waNumber.replace(/[^\d]/g, '');
    const encoded = encodeURIComponent(waMessageText);
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  // Direct Mailto send
  const handleSendEmailMailto = () => {
    const encodedSub = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);
    window.location.href = `mailto:${targetEmail}?subject=${encodedSub}&body=${encodedBody}`;
  };

  // Gmail Web send
  const handleSendEmailGmail = () => {
    const encodedSub = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodedSub}&body=${encodedBody}`;
    window.open(gmailUrl, '_blank');
  };

  // Export PDF with Photos & Signatures
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportAsnSignedAttendanceManualPdf(
        tableRows,
        config,
        selectedDate,
        apelDocumentation,
        false
      );
    } catch (e) {
      console.error('Failed to export PDF:', e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="bkd-dispatch-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold tracking-tight text-white">
                  Kirim Presensi & Dokumentasi ke BKD
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Kabupaten Pulau Taliabu
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kirim tabel absensi, bukti tanda tangan digital, dan dokumentasi apel GPS via WA, Google Drive, & Email
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Summary Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Tanggal</span>
              <span className="text-xs font-extrabold text-slate-900 font-mono">
                {selectedDate}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Total GTK ASN</span>
              <span className="text-xs font-extrabold text-indigo-600 font-mono">
                {stats.total} Pegawai
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">TTD Lengkap</span>
              <span className="text-xs font-extrabold text-emerald-600 font-mono">
                {stats.bothSigned} / {stats.total}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Status Lampiran</span>
              <span className={`text-xs font-extrabold font-mono ${hasApelPagi && hasApelSiang ? 'text-emerald-600' : 'text-amber-600'}`}>
                {hasApelPagi && hasApelSiang ? '2 Foto Sah' : hasApelPagi || hasApelSiang ? '1 Foto Sah' : '0 Foto'}
              </span>
            </div>
          </div>

          {/* Documentation Status Cards */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <Camera className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-indigo-950">
                  Dokumentasi Foto Apel Pagi & Siang (Stempel GPS)
                </p>
                <p className="text-[11px] text-indigo-700/80">
                  {hasApelPagi && hasApelSiang
                    ? 'Foto apel pagi dan siang siap dilampirkan otomatis ke dokumen resmi BKD'
                    : 'Disarankan mengunggah foto sesi apel terlebih dahulu di tab Lampiran Apel'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 text-indigo-600 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                <span>{isExportingPdf ? 'Membuat PDF...' : 'Unduh PDF (+Foto)'}</span>
              </button>
            </div>
          </div>

          {/* CHANNEL 1: WHATSAPP BKD */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    1. Saluran WhatsApp Resmi BKD Taliabu
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    Kirim ringkasan laporan presensi dan tautan berkas langsung ke kontak admin BKD
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Paling Cepat
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 w-24 shrink-0">
                  Nomor WA BKD:
                </span>
                <input
                  type="text"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  placeholder="Contoh: 6281234567890"
                  className="flex-1 text-xs font-mono font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendWa}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka WhatsApp & Kirim</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(waMessageText, 'wa')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border border-slate-200"
                >
                  {copiedChannel === 'wa' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Format Pesan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CHANNEL 2: GOOGLE DRIVE BKD */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    2. Folder Google Drive BKD Taliabu
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    Pusat penyimpanan arsip digital resmi untuk verifikasi lembar absensi dan lampiran
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Arsip Cloud
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 w-24 shrink-0">
                  Link Drive BKD:
                </span>
                <input
                  type="text"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.open(driveLink, '_blank')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Folder Google Drive</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(driveLink, 'drive')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border border-slate-200"
                >
                  {copiedChannel === 'drive' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Link Drive</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CHANNEL 3: EMAIL RESMI BKD */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    3. Surat Elektronik / Email Resmi BKD
                  </h4>
                  <p className="text-[10.5px] text-slate-500">
                    Pengiriman formal melalui pos elektronik resmi pemerintah daerah
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Formal Kedinasan
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 w-24 shrink-0">
                  Email Tujuan:
                </span>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="bkd@pulautaliabukab.go.id"
                  className="flex-1 text-xs font-mono font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendEmailGmail}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Web Gmail</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendEmailMailto}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Buka Aplikasi Email (Mailto)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(`${emailSubject}\n\n${emailBody}`, 'email')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border border-slate-200"
                >
                  {copiedChannel === 'email' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Draft Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Draft Surat</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Terverifikasi oleh SIMPEG BKD Kabupaten Pulau Taliabu
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Tutup Dialog
          </button>
        </div>
      </div>
    </div>
  );
};
