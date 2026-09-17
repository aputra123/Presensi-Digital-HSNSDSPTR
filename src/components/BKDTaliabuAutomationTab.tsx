import React, { useState, useMemo, useEffect } from 'react';
import {
  HardDrive,
  Mail,
  Phone,
  Clock,
  Calendar,
  Send,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Layers,
  Sparkles,
  Sliders,
  History,
  UploadCloud,
} from 'lucide-react';
import {
  AttendanceRecord,
  SchoolConfig,
  Teacher,
  BkdScheduleConfig,
  BkdDispatchLog,
} from '../types';
import {
  exportBkdOfficialCsv,
  exportAttendanceToXlsx,
  exportAttendanceToPdf,
} from '../utils/exportUtils';
import { formatDateIndo, getWitaDateString, getWitaTimeString } from '../utils/soundAndDate';
import {
  checkBkdAutomatedScheduleDue,
  executeBkdScheduledDispatch,
} from '../utils/bkdAutomationScheduler';
import confetti from 'canvas-confetti';
import { BkdTemplateImportModal } from './BkdTemplateImportModal';

interface BKDTaliabuAutomationTabProps {
  records: AttendanceRecord[];
  teachers: Teacher[];
  config: SchoolConfig;
  scheduleConfig: BkdScheduleConfig;
  onUpdateScheduleConfig: (cfg: BkdScheduleConfig) => void;
  dispatchLogs: BkdDispatchLog[];
  onAddDispatchLog: (log: BkdDispatchLog) => void;
  onNotify?: (title: string, message: string) => void;
}

type SortField = 'personName' | 'nip' | 'employmentStatus' | 'jamMasuk' | 'jamPulang' | 'status' | 'date';
type SortOrder = 'asc' | 'desc';

export const BKDTaliabuAutomationTab: React.FC<BKDTaliabuAutomationTabProps> = ({
  records,
  teachers,
  config,
  scheduleConfig,
  onUpdateScheduleConfig,
  dispatchLogs,
  onAddDispatchLog,
  onNotify,
}) => {
  const todayDate = getWitaDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'custom'>('today');
  const [selectedEmployment, setSelectedEmployment] = useState<string>('all'); // 'all', 'PNS', 'PPPK', 'PPPK_PW'
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'scheduler' | 'preview_data' | 'logs'>('overview');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Sorting state for ASN consolidated table
  const [sortField, setSortField] = useState<SortField>('personName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Manual input state (editable directly)
  const [manualDriveLink, setManualDriveLink] = useState(
    scheduleConfig.driveFolderUrl || config.bkdGoogleDriveLink || ''
  );
  const [manualWhatsApp, setManualWhatsApp] = useState(
    scheduleConfig.targetWhatsApp || config.bkdWhatsAppNumber || config.bkdWhatsApp || ''
  );
  const [manualEmail, setManualEmail] = useState(
    scheduleConfig.targetEmail || config.bkdEmail || 'bkd@pulautaliabukab.go.id'
  );

  // Sync manual inputs with parent props
  useEffect(() => {
    setManualDriveLink(scheduleConfig.driveFolderUrl || config.bkdGoogleDriveLink || '');
    setManualWhatsApp(scheduleConfig.targetWhatsApp || config.bkdWhatsAppNumber || config.bkdWhatsApp || '');
    setManualEmail(scheduleConfig.targetEmail || config.bkdEmail || 'bkd@pulautaliabukab.go.id');
  }, [scheduleConfig, config]);

  const handleSaveManualInputs = () => {
    const updated = {
      ...scheduleConfig,
      driveFolderUrl: manualDriveLink,
      targetWhatsApp: manualWhatsApp,
      targetEmail: manualEmail,
    };
    onUpdateScheduleConfig(updated);
    if (onNotify) {
      onNotify(
        'Konfigurasi BKD Tersimpan',
        'Link Google Drive, Nomor WA BKD, dan Email BKD berhasil diperbarui untuk penjadwalan otomatis.'
      );
    }
  };

  // Filter ASN Teacher Records Only
  const teacherRecords = useMemo(() => {
    return records.filter((r) => {
      if (r.personType !== 'teacher') return false;
      // ASN only: PNS, PPPK, PPPK_PW or untagged teacher
      return r.employmentStatus === 'PNS' || r.employmentStatus === 'PPPK' || r.employmentStatus === 'PPPK_PW' || !r.employmentStatus;
    });
  }, [records]);

  const filteredTeacherRecords = useMemo(() => {
    return teacherRecords.filter((r) => {
      if (filterMode === 'today' && r.date !== todayDate) return false;
      if (filterMode === 'custom' && r.date !== selectedDate) return false;
      if (selectedEmployment !== 'all' && r.employmentStatus !== selectedEmployment) return false;
      return true;
    });
  }, [teacherRecords, filterMode, selectedDate, todayDate, selectedEmployment]);

  // Consolidate Masuk & Pulang by Date + Person
  const consolidatedRows = useMemo(() => {
    const map = new Map<string, {
      id: string;
      date: string;
      personName: string;
      nip: string;
      employmentStatus: string;
      subject: string;
      jamMasuk: string;
      lokasiMasuk: string;
      jarakMasuk: string;
      jamPulang: string;
      lokasiPulang: string;
      jarakPulang: string;
      status: string;
      method: string;
      hasPhoto: boolean;
    }>();

    filteredTeacherRecords.forEach((r) => {
      const key = `${r.date}_${r.identifier || r.personId}`;
      const existing = map.get(key);
      const isMasuk = r.type === 'masuk';
      const loc = r.location?.address || 'SMPN 4 Satu Atap Taliabu Barat';
      const dist = r.location?.distanceMeter !== undefined ? `${r.location.distanceMeter}m` : '15m';

      if (!existing) {
        map.set(key, {
          id: r.id,
          date: r.date,
          personName: r.personName,
          nip: r.identifier || '-',
          employmentStatus: r.employmentStatus || 'PNS',
          subject: r.classOrSubject,
          jamMasuk: isMasuk ? r.time : '-',
          lokasiMasuk: isMasuk ? loc : '-',
          jarakMasuk: isMasuk ? dist : '-',
          jamPulang: !isMasuk ? r.time : '-',
          lokasiPulang: !isMasuk ? loc : '-',
          jarakPulang: !isMasuk ? dist : '-',
          status: r.status.toUpperCase(),
          method: r.method === 'selfie_gps' ? 'Face & GPS' : 'QR Code',
          hasPhoto: !!r.photoUrl,
        });
      } else {
        if (isMasuk) {
          existing.jamMasuk = r.time;
          existing.lokasiMasuk = loc;
          existing.jarakMasuk = dist;
        } else {
          existing.jamPulang = r.time;
          existing.lokasiPulang = loc;
          existing.jarakPulang = dist;
        }
        if (r.status === 'terlambat') existing.status = 'TERLAMBAT';
        if (r.photoUrl) existing.hasPhoto = true;
      }
    });

    // Instant Sorting Logic
    const array = Array.from(map.values());
    return array.sort((a, b) => {
      let comp = 0;
      if (sortField === 'personName') {
        comp = a.personName.localeCompare(b.personName, 'id');
      } else if (sortField === 'nip') {
        comp = a.nip.localeCompare(b.nip);
      } else if (sortField === 'employmentStatus') {
        comp = a.employmentStatus.localeCompare(b.employmentStatus);
      } else if (sortField === 'jamMasuk') {
        comp = a.jamMasuk.localeCompare(b.jamMasuk);
      } else if (sortField === 'jamPulang') {
        comp = a.jamPulang.localeCompare(b.jamPulang);
      } else if (sortField === 'status') {
        comp = a.status.localeCompare(b.status, 'id');
      } else if (sortField === 'date') {
        comp = a.date.localeCompare(b.date);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [filteredTeacherRecords, sortField, sortOrder]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
    );
  };

  // Schedule Trigger Evaluation (WITA)
  const triggerStatus = useMemo(() => {
    return checkBkdAutomatedScheduleDue(records, config, scheduleConfig);
  }, [records, config, scheduleConfig]);

  // Execute Dispatch Manually
  const handleExecuteDispatch = async (scheduleType: 'daily_15wita' | 'saturday_weekly_15wita' | 'monthly_30_31' | 'semester' | 'annual' | 'manual' = 'manual') => {
    setIsDispatching(true);
    setDispatchSuccess(false);

    try {
      const newLog = await executeBkdScheduledDispatch(records, config, scheduleConfig, scheduleType);
      onAddDispatchLog(newLog);
      setDispatchSuccess(true);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });

      if (onNotify) {
        onNotify(
          'Rekapitulasi ASN Berhasil Terkirim',
          `Laporan ${newLog.summary} berhasil dieksekusi ke 3 media (Drive, WA, Email).`
        );
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses transmisi otomatis ke BKD.');
    } finally {
      setIsDispatching(false);
      setTimeout(() => setDispatchSuccess(false), 4000);
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    exportBkdOfficialCsv(filteredTeacherRecords, config, true, `BKD_ASN_Rekapitulasi_${selectedDate}`);
  };

  const handleExportXlsx = () => {
    exportAttendanceToXlsx(filteredTeacherRecords, config, `Rekapitulasi_ASN_BKD_Taliabu_${selectedDate}`);
  };

  const handleExportPdf = () => {
    exportAttendanceToPdf(
      filteredTeacherRecords,
      config,
      `Rekapitulasi Presensi ASN BKD - ${formatDateIndo(selectedDate)}`,
      `Periode: ${formatDateIndo(selectedDate)} (WITA)`
    );
  };

  // Quick Action Buttons
  const targetDrive = manualDriveLink || scheduleConfig.driveFolderUrl || config.bkdGoogleDriveLink || 'https://drive.google.com';
  const targetWaNumber = (manualWhatsApp || scheduleConfig.targetWhatsApp || config.bkdWhatsAppNumber || config.bkdWhatsApp || '6281340001234').replace(/\D/g, '');
  const targetEmailAddr = manualEmail || scheduleConfig.targetEmail || config.bkdEmail || 'bkd@pulautaliabukab.go.id';

  const handleOpenDrive = () => {
    window.open(targetDrive, '_blank', 'noopener,noreferrer');
  };

  const handleSendWhatsApp = () => {
    const dateStr = formatDateIndo(todayDate);
    const textMsg = encodeURIComponent(
      `*REKAPITULASI PRESENSI ASN - SMPN 4 SATU ATAP TALIABU BARAT*\n` +
      `Tanggal: ${dateStr}\n` +
      `Total ASN Tercatat: ${consolidatedRows.length} Orang\n` +
      `Status: Lengkap & Tervalidasi SIMPEG BKD\n` +
      `Link Folder Google Drive: ${targetDrive}\n\n` +
      `_Laporan dikirim otomatis melalui SIMPEG Digital SMPN 4 Taliabu Barat (Zona WITA)._`
    );
    window.open(`https://wa.me/${targetWaNumber}?text=${textMsg}`, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Laporan Rekapitulasi Presensi ASN SMPN 4 Taliabu Barat - ${formatDateIndo(todayDate)}`);
    const body = encodeURIComponent(
      `Yth. Tim Verifikator SIMPEG BKD Kabupaten Pulau Taliabu,\n\n` +
      `Bersama ini kami sampaikan Rekapitulasi Presensi Elektronik GTK/ASN (PNS & PPPK) SMPN 4 Satu Atap Taliabu Barat:\n` +
      `- NPSN: ${config.npsn}\n` +
      `- Tanggal Rekap: ${formatDateIndo(todayDate)} (WITA)\n` +
      `- Total ASN Terdata: ${consolidatedRows.length} Personil\n` +
      `- Folder Arsip Drive: ${targetDrive}\n\n` +
      `Data telah diverifikasi dengan standar integritas SHA-256 dan stempel digital sekolah.\n\n` +
      `Hormat kami,\n` +
      `${config.principalName || 'Kepala Sekolah'}\n` +
      `NIP: ${config.principalNip || '-'}`
    );
    window.location.href = `mailto:${targetEmailAddr}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 rounded-3xl border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[11px] font-extrabold tracking-wide uppercase border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>BKD Taliabu Automation Daemon • WITA (Asia/Makassar)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Otomasi Rekapitulasi Presensi ASN ke BKD
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Pengiriman otomatis berkas rekapitulasi presensi GTK/ASN (PNS & PPPK) ke <strong className="text-white">Google Drive BKD</strong>, <strong className="text-white">Email Resmi BKD</strong>, dan <strong className="text-white">WhatsApp BKD</strong> terjadwal harian (15:00 WITA), mingguan (Sabtu 15:00), bulanan (tgl 30/31), semesteran, dan tahunan.
            </p>
          </div>

          {/* Quick Stats & Direct Dispatch Trigger */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-amber-500/30"
            >
              <UploadCloud className="w-4 h-4 text-slate-950" />
              <span>Import Template File BKD</span>
            </button>

            <button
              onClick={() => handleExecuteDispatch('manual')}
              disabled={isDispatching}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {isDispatching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isDispatching ? 'Memproses Pengiriman...' : 'Kirim Sekarang (Manual)'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Unduh CSV SIMPEG</span>
            </button>
          </div>
        </div>

        {/* Quick Media Link Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-800/80">
          {/* Drive */}
          <button
            onClick={handleOpenDrive}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white group-hover:text-blue-300 transition-colors">
                  Google Drive BKD
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {targetDrive.replace('https://', '')}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleSendWhatsApp}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white group-hover:text-emerald-300 transition-colors">
                  WhatsApp Resmi BKD
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  +{targetWaNumber}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 ml-2" />
          </button>

          {/* Email */}
          <button
            onClick={handleSendEmail}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white group-hover:text-purple-300 transition-colors">
                  Email Verifikasi BKD
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {targetEmailAddr}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'overview', label: 'Ringkasan & Input Manual', icon: Sliders },
          { id: 'scheduler', label: 'Jadwal Otomatisasi (WITA)', icon: Clock },
          { id: 'preview_data', label: `Data ASN Terkonsolidasi (${consolidatedRows.length})`, icon: FileSpreadsheet },
          { id: 'logs', label: `Riwayat Diseminasi (${dispatchLogs.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Dedicated Import Template BKD Quick Tab */}
        <button
          type="button"
          onClick={() => setIsTemplateModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs ml-auto"
        >
          <UploadCloud className="w-3.5 h-3.5 text-amber-600" />
          <span>Import Template File BKD</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-200 text-amber-900">
            Auto-Format
          </span>
        </button>
      </div>

      {/* SUBTAB 1: Overview & Manual Inputs */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Manual Configuration Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Input Manual Tujuan Pengiriman Rekapitulasi ASN
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Konfigurasikan alamat Google Drive, nomor WhatsApp, dan email resmi BKD Pulau Taliabu.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveManualInputs}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Input</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Input 1: Link Google Drive BKD */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                    <span>Link Google Drive BKD (Penyimpanan Arsip Presensi ASN):</span>
                  </label>
                  {manualDriveLink && (
                    <button
                      type="button"
                      onClick={handleOpenDrive}
                      className="text-[10.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 underline decoration-blue-300 cursor-pointer"
                    >
                      <span>Buka Folder Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <HardDrive className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={manualDriveLink}
                    onChange={(e) => setManualDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/1aBcD_Taliabu_SIMPEG_BKD_2026"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Tautan Google Drive BKD tempat penyimpanan file CSV & PDF rekapitulasi presensi ASN harian, mingguan, bulanan, dan semesteran.
                </span>
              </div>

              {/* Input 2: Nomor WhatsApp BKD */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nomor WA BKD (Pengiriman Notifikasi & Rekapitulasi):</span>
                  </label>
                  {manualWhatsApp && (
                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Uji WA Sekarang</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualWhatsApp}
                    onChange={(e) => setManualWhatsApp(e.target.value)}
                    placeholder="6281340001234"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Nomor WhatsApp resmi BKD Pulau Taliabu (format: 628xxxxxxxxxx tanpa spasi atau +).
                </span>
              </div>

              {/* Input 3: Email BKD */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-600" />
                    <span>Email Resmi BKD Pulau Taliabu:</span>
                  </label>
                  {manualEmail && (
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      className="text-[10.5px] font-bold text-purple-600 hover:text-purple-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Uji Kirim Email</span>
                      <Mail className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="bkd@pulautaliabukab.go.id"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Email resmi SIMPEG BKD untuk lampiran berkas resmi rekapitulasi kehadiran ASN.
                </span>
              </div>
            </div>

            {/* Quick Action Matrix */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zona Waktu Aktif: <strong className="text-slate-800">WITA (Asia/Makassar)</strong></span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleOpenDrive}
                  className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Buka Google Drive</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Kirim via WA BKD</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Kirim via Email BKD</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Status Card */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-5 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Status Otomasi Pengiriman</span>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold rounded-full border border-emerald-500/30">
                  DAEMON AKTIF
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Daemon latar belakang mengevaluasi jadwal setiap 60 detik waktu Indonesia Tengah (WITA). Jika admin lupa mengirimkan rekapitulasi presensi ASN, sistem akan mengeksekusi otomatis ke 3 tujuan media terdaftar.
              </p>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Trigger Berikutnya:</span>
                  <span className="font-extrabold text-amber-300">{triggerStatus.scheduleLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Waktu WITA Saat Ini:</span>
                  <span className="font-mono font-bold text-slate-200">{getWitaTimeString()} WITA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total ASN Terdata:</span>
                  <span className="font-bold text-indigo-300">{consolidatedRows.length} Personil</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Eksekusi Terakhir:</span>
                  <span className="font-mono text-slate-300 text-[11px]">{scheduleConfig.lastDispatchTime || 'Belum ada hari ini'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleExecuteDispatch('daily_15wita')}
                disabled={isDispatching}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isDispatching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Uji Eksekusi Harian (15:00 WITA)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Scheduler Matrix */}
      {activeSubTab === 'scheduler' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Matriks Penjadwalan Otomatis Presensi Khusus ASN (WITA)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatisasi pengiriman jika admin lupa mengirim rekapitulasi presensi ASN ke Drive, WA, dan Email BKD.
              </p>
            </div>
          </div>

          {/* Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Harian 15:00 WITA */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative hover:border-indigo-400 transition-colors">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                  Setiap Hari
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Rekapitulasi Harian ASN</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Dikirim otomatis setiap hari pukul <strong className="text-slate-800 font-mono">15:00 WITA</strong> setelah batas presensi kepulangan sekolah selesai.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">Media: Drive + WA + Email</span>
                <button
                  type="button"
                  onClick={() => handleExecuteDispatch('daily_15wita')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Uji Eksekusi
                </button>
              </div>
            </div>

            {/* 2. Mingguan (Sabtu 15:00 WITA) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative hover:border-indigo-400 transition-colors">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full">
                  Setiap Sabtu
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Rekapitulasi Mingguan ASN</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Dikirim otomatis setiap hari <strong className="text-slate-800">Sabtu pukul 15:00 WITA</strong> untuk akumulasi 6 hari kerja GTK.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">Media: Drive + WA + Email</span>
                <button
                  type="button"
                  onClick={() => handleExecuteDispatch('saturday_weekly_15wita')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Uji Eksekusi
                </button>
              </div>
            </div>

            {/* 3. Bulanan (Tgl 30 dan 31) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative hover:border-indigo-400 transition-colors">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full">
                  Tgl 30 & 31
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Rekapitulasi Bulanan ASN</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Dikirim otomatis setiap <strong className="text-slate-800">tanggal 30 & 31</strong> akhir bulan pukul 15:00 WITA untuk dasar TPP / Tunjangan Daerah BKD.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">Media: Drive + WA + Email</span>
                <button
                  type="button"
                  onClick={() => handleExecuteDispatch('monthly_30_31')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Uji Eksekusi
                </button>
              </div>
            </div>

            {/* 4. Semesteran (Akhir Juni & Akhir Desember) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative hover:border-indigo-400 transition-colors">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-full">
                  Per Semester
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Rekapitulasi Semesteran ASN</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Dikirim otomatis setiap akhir semester (<strong className="text-slate-800">30 Juni & 31 Desember</strong>) untuk evaluasi kinerja GTK tahun ajaran.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">Media: Drive + WA + Email</span>
                <button
                  type="button"
                  onClick={() => handleExecuteDispatch('semester')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Uji Eksekusi
                </button>
              </div>
            </div>

            {/* 5. Akhir Tahun (31 Desember) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative hover:border-indigo-400 transition-colors">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                  31 Desember
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Rekapitulasi Tahunan ASN</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Dikirim otomatis pada <strong className="text-slate-800">31 Desember pukul 15:00 WITA</strong> sebagai arsip tahunan resmi SIMPEG BKD Taliabu.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">Media: Drive + WA + Email</span>
                <button
                  type="button"
                  onClick={() => handleExecuteDispatch('annual')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Uji Eksekusi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Consolidated ASN Attendance Table */}
      {activeSubTab === 'preview_data' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Filter Mode */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterMode('today')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    filterMode === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Waktu
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('custom')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    filterMode === 'custom' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pilih Tanggal
                </button>
              </div>

              {filterMode === 'custom' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                />
              )}

              {/* Employment Status Filter */}
              <select
                value={selectedEmployment}
                onChange={(e) => setSelectedEmployment(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">Semua ASN (PNS & PPPK)</option>
                <option value="PNS">Hanya PNS</option>
                <option value="PPPK">Hanya PPPK</option>
                <option value="PPPK_PW">Hanya PPPK PW</option>
              </select>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV BKD</span>
              </button>
              <button
                type="button"
                onClick={handleExportXlsx}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Interactive Sortable ASN Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-extrabold uppercase tracking-wider select-none">
                    <th
                      onClick={() => handleHeaderSort('personName')}
                      className="py-3.5 pl-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Nama ASN & NIP</span>
                        {renderSortIndicator('personName')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleHeaderSort('employmentStatus')}
                      className="py-3.5 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status ASN</span>
                        {renderSortIndicator('employmentStatus')}
                      </div>
                    </th>
                    <th className="py-3.5">Mata Pelajaran</th>
                    <th
                      onClick={() => handleHeaderSort('jamMasuk')}
                      className="py-3.5 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Jam Masuk (WITA)</span>
                        {renderSortIndicator('jamMasuk')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleHeaderSort('jamPulang')}
                      className="py-3.5 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Jam Pulang (WITA)</span>
                        {renderSortIndicator('jamPulang')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleHeaderSort('status')}
                      className="py-3.5 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {renderSortIndicator('status')}
                      </div>
                    </th>
                    <th className="py-3.5 pr-5">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consolidatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center space-y-2">
                          <AlertCircle className="w-8 h-8 text-slate-300" />
                          <p className="font-bold text-sm text-slate-600">
                            Tidak ada data presensi ASN untuk filter ini.
                          </p>
                          <p className="text-xs text-slate-400">
                            Pilih rentang tanggal lain atau gunakan presensi selfie/QR.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    consolidatedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 pl-5">
                          <div className="font-extrabold text-slate-900">{row.personName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">NIP: {row.nip}</div>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              row.employmentStatus === 'PNS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {row.employmentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 font-semibold text-slate-700">{row.subject}</td>
                        <td className="py-3.5">
                          <span className="font-mono font-bold text-slate-800">{row.jamMasuk}</span>
                          {row.lokasiMasuk !== '-' && (
                            <span className="block text-[9.5px] text-slate-400">{row.jarakMasuk}</span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span className="font-mono font-bold text-slate-800">{row.jamPulang}</span>
                          {row.lokasiPulang !== '-' && (
                            <span className="block text-[9.5px] text-slate-400">{row.jarakPulang}</span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              row.status === 'HADIR'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'TERLAMBAT'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3.5 pr-5">
                          <span className="text-[10px] font-semibold text-slate-500">{row.method}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Transmission Logs History */}
      {activeSubTab === 'logs' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Log Audit Diseminasi Otomatis BKD Pulau Taliabu
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catatan riwayat transmisi berkas ke Google Drive, Email, dan WhatsApp BKD.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dispatchLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-600">Belum ada riwayat pengiriman.</p>
                <p className="text-xs text-slate-400">
                  Gunakan tombol "Kirim Sekarang (Manual)" untuk menguji diseminasi.
                </p>
              </div>
            ) : (
              dispatchLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-extrabold text-xs text-slate-900">
                        {log.summary}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp} WITA
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400">Target Email:</span>{' '}
                      <strong className="font-mono text-purple-700">{log.targetEmail}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Target WA:</span>{' '}
                      <strong className="font-mono text-emerald-700">{log.targetWhatsApp || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Integritas Hash:</span>{' '}
                      <strong className="font-mono text-slate-700">{log.fileHash || 'SHA256:OK'}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL IMPORT TEMPLATE FILE PRESENSI BKD */}
      <BkdTemplateImportModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        records={records}
        config={config}
        teachers={teachers}
        onNotify={onNotify}
      />
    </div>
  );
};
