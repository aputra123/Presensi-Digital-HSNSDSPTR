import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Calendar,
  Printer,
  ChevronDown,
  ChevronUp,
  Camera,
  QrCode,
  Users,
  FileText,
  Sparkles,
  ArrowUpDown,
  Building2,
  Phone,
  Mail,
  HardDrive,
  ExternalLink,
  MapPin,
  Fingerprint,
  ShieldCheck,
  X,
  User,
  FileSpreadsheet as ExcelIcon,
  CalendarRange,
  PenTool,
} from 'lucide-react';
import { AttendanceRecord, SchoolClass, SchoolConfig, Student, Teacher, GtkServiceRequest, ActiveTab } from '../types';
import { formatDateIndo, getWitaDateString } from '../utils/soundAndDate';
import {
  exportAttendanceToPdf,
  exportAttendanceToXlsx,
  exportMonthlyAttendanceSummaryPdf,
  exportIndividualAttendancePdf,
  getMonthYearIndo,
} from '../utils/exportUtils';
import { AttendanceRecordMap } from './AttendanceRecordMap';
import { AttendanceDistributionMap } from './AttendanceDistributionMap';
import { saveBlobToGoogleDrive } from '../lib/googleWorkspace';
import { getCachedAccessToken, signInWithGoogleWorkspace } from '../lib/firebase';

interface RekapitulasiViewProps {
  records?: AttendanceRecord[];
  classes?: SchoolClass[];
  config: SchoolConfig;
  onOpenPrintModal?: () => void;
  onDeleteRecord?: (id: string) => void;
  todayDate?: string;
  students?: Student[];
  teachers?: Teacher[];
  gtkServices?: GtkServiceRequest[];
  onNavigateTab?: (tab: ActiveTab) => void;
}

type SortField = 'name' | 'time' | 'status' | 'date' | 'category' | 'classOrSubject' | 'session' | 'method';
type SortOrder = 'asc' | 'desc';

export const RekapitulasiView: React.FC<RekapitulasiViewProps> = ({
  records = [],
  classes = [],
  students = [],
  teachers = [],
  config,
  onOpenPrintModal,
  onDeleteRecord,
  onNavigateTab,
}) => {
  const safeRecords = records || [];
  const safeClasses = classes || [];
  const todayStr = getWitaDateString();

  // Monthly Report Modal State
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [monthlyCategory, setMonthlyCategory] = useState<'all' | 'teachers' | 'students'>('all');

  // Individual Monthly Report Modal State
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [individualPersonType, setIndividualPersonType] = useState<'teacher' | 'student'>('teacher');
  const [selectedIndividualId, setSelectedIndividualId] = useState<string>('');
  const [individualReportMonth, setIndividualReportMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [individualSearchTerm, setIndividualSearchTerm] = useState('');

  // View Mode: Table, Distribution Map, or Both
  const [displayMode, setDisplayMode] = useState<'table' | 'map' | 'both'>('table');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'today' | '7days' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedSessionType, setSelectedSessionType] = useState<string>('ALL'); // 'ALL' | 'masuk' | 'pulang'
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // 'ALL' | 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa'
  const [selectedPersonType, setSelectedPersonType] = useState<string>('ALL'); // 'ALL' | 'student' | 'teacher' | 'PNS' | 'PPPK'
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [isSavingToDrive, setIsSavingToDrive] = useState<boolean>(false);

  // Pagination State for high performance rendering of large datasets
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const toggleExpandRecord = (id: string) => {
    setExpandedRecordId((prev) => (prev === id ? null : id));
  };

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter calculation
  const filteredAndSortedRecords = useMemo(() => {
    const filtered = safeRecords.filter((rec) => {
      // 1. Global Search Query (by Name, NIP, NISN, ID, Class, Note)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rec.personName.toLowerCase().includes(q) ||
        (rec.identifier && rec.identifier.toLowerCase().includes(q)) ||
        (rec.personId && rec.personId.toLowerCase().includes(q)) ||
        (rec.classOrSubject && rec.classOrSubject.toLowerCase().includes(q)) ||
        (rec.employmentStatus && rec.employmentStatus.toLowerCase().includes(q)) ||
        (rec.note && rec.note.toLowerCase().includes(q)) ||
        (rec.location?.address && rec.location.address.toLowerCase().includes(q));

      // 2. Date Filter
      let matchesDate = true;
      if (dateFilterMode === 'today') {
        matchesDate = rec.date === todayStr;
      } else if (dateFilterMode === '7days') {
        const recDate = new Date(rec.date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - recDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        matchesDate = diffDays <= 7;
      } else if (dateFilterMode === 'month') {
        const recMonth = rec.date.substring(0, 7);
        const currentMonth = todayStr.substring(0, 7);
        matchesDate = recMonth === currentMonth;
      } else if (dateFilterMode === 'custom') {
        matchesDate = rec.date >= startDate && rec.date <= endDate;
      }

      // 3. Session Type
      const matchesSession =
        selectedSessionType === 'ALL' || rec.type === selectedSessionType;

      // 4. Status Filter (Hadir, Terlambat, Izin, Sakit, Alpa)
      const matchesStatus =
        selectedStatus === 'ALL' || rec.status === selectedStatus;

      // 5. Person & Employment Category
      let matchesPerson = true;
      if (selectedPersonType === 'student') {
        matchesPerson = rec.personType === 'student';
      } else if (selectedPersonType === 'teacher') {
        matchesPerson = rec.personType === 'teacher';
      } else if (selectedPersonType === 'PNS') {
        matchesPerson = rec.employmentStatus === 'PNS';
      } else if (selectedPersonType === 'PPPK') {
        matchesPerson = rec.employmentStatus === 'PPPK';
      } else if (selectedPersonType === 'PPPK_PW') {
        matchesPerson = rec.employmentStatus === 'PPPK_PW';
      } else if (selectedPersonType === 'HONORER') {
        matchesPerson = rec.employmentStatus === 'HONORER' || rec.employmentStatus === 'GTT_PTT';
      }

      // 6. Class Filter
      const matchesClass =
        selectedClass === 'ALL' || rec.classOrSubject === selectedClass;

      return (
        matchesSearch &&
        matchesDate &&
        matchesSession &&
        matchesStatus &&
        matchesPerson &&
        matchesClass
      );
    });

    // Sorting Logic - Instant Reactivity
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.personName.localeCompare(b.personName, 'id');
      } else if (sortField === 'time') {
        const timeA = `${a.date} ${a.time}`;
        const timeB = `${b.date} ${b.time}`;
        comparison = timeA.localeCompare(timeB);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status, 'id');
      } else if (sortField === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortField === 'category') {
        const catA = a.personType === 'teacher' ? (a.employmentStatus || 'Guru') : 'Siswa';
        const catB = b.personType === 'teacher' ? (b.employmentStatus || 'Guru') : 'Siswa';
        comparison = catA.localeCompare(catB, 'id');
      } else if (sortField === 'classOrSubject') {
        comparison = a.classOrSubject.localeCompare(b.classOrSubject, 'id');
      } else if (sortField === 'session') {
        comparison = a.type.localeCompare(b.type, 'id');
      } else if (sortField === 'method') {
        comparison = a.method.localeCompare(b.method, 'id');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [
    safeRecords,
    searchQuery,
    dateFilterMode,
    todayStr,
    startDate,
    endDate,
    selectedSessionType,
    selectedStatus,
    selectedPersonType,
    selectedClass,
    sortField,
    sortOrder,
  ]);

  // Reset page when filter or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    dateFilterMode,
    startDate,
    endDate,
    selectedSessionType,
    selectedStatus,
    selectedPersonType,
    selectedClass,
    sortField,
    sortOrder,
    pageSize,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / pageSize));

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedRecords, currentPage, pageSize]);

  // Calculate Summary metrics for the filtered view
  const countHadir = filteredAndSortedRecords.filter((r) => r.status === 'hadir').length;
  const countTerlambat = filteredAndSortedRecords.filter((r) => r.status === 'terlambat').length;
  const countIzinSakit = filteredAndSortedRecords.filter((r) => r.status === 'izin' || r.status === 'sakit').length;
  const countAlpa = filteredAndSortedRecords.filter((r) => r.status === 'alpa').length;

  const dateRangeDescription = useMemo(() => {
    if (dateFilterMode === 'today') return `Hari Ini (${formatDateIndo(todayStr)})`;
    if (dateFilterMode === '7days') return '7 Hari Terakhir';
    if (dateFilterMode === 'month') return 'Bulan Ini';
    if (dateFilterMode === 'custom') return `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;
    return 'Semua Periode Rekapitulasi';
  }, [dateFilterMode, todayStr, startDate, endDate]);

  // Export to PDF directly using print format
  const handleExportPdf = () => {
    if (filteredAndSortedRecords.length === 0) {
      alert('Tidak ada data presensi yang sesuai untuk diekspor!');
      return;
    }
    exportAttendanceToPdf(
      filteredAndSortedRecords,
      config,
      `Laporan Rekapitulasi Presensi - ${dateRangeDescription}`,
      dateRangeDescription
    );
  };

  // Export to Excel (.xlsx) Function
  const handleExportExcel = () => {
    if (filteredAndSortedRecords.length === 0) {
      alert('Tidak ada data presensi yang sesuai untuk diekspor ke Excel!');
      return;
    }
    exportAttendanceToXlsx(
      filteredAndSortedRecords,
      config,
      `Rekap_${startDate}_sd_${endDate}`
    );
  };

  // Export Monthly Attendance Summary Report PDF
  const handleDownloadMonthlyPdf = () => {
    exportMonthlyAttendanceSummaryPdf({
      records: safeRecords,
      students: students || [],
      teachers: teachers || [],
      classes: safeClasses,
      config,
      selectedMonth: selectedReportMonth,
      targetCategory: monthlyCategory,
    });
    setIsMonthlyModalOpen(false);
  };

  // Export Individual Monthly Attendance PDF
  const handlePrintIndividualPdf = (personId?: string, type?: 'teacher' | 'student', month?: string) => {
    const targetType = type || individualPersonType;
    const targetId = personId || selectedIndividualId;
    const targetMonth = month || individualReportMonth;

    if (!targetId) {
      alert('Pilih personil (Guru atau Siswa) terlebih dahulu!');
      return;
    }

    const person =
      targetType === 'teacher'
        ? (teachers || []).find((t) => t.id === targetId)
        : (students || []).find((s) => s.id === targetId);

    if (!person) {
      alert('Data personil tidak ditemukan!');
      return;
    }

    exportIndividualAttendancePdf({
      person,
      personType: targetType,
      selectedMonth: targetMonth,
      records: safeRecords,
      config,
    });
  };

  // Simpan Rekapitulasi PDF langsung ke Google Drive Sekolah
  const handleSaveRekapToGoogleDrive = async () => {
    if (filteredAndSortedRecords.length === 0) {
      alert('Tidak ada data presensi yang sesuai untuk diunggah ke Google Drive!');
      return;
    }

    setIsSavingToDrive(true);
    try {
      let token = getCachedAccessToken();
      if (!token) {
        try {
          const authRes = await signInWithGoogleWorkspace();
          token = authRes.token;
        } catch (authErr) {
          alert(
            'Silakan hubungkan akun Google Workspace terlebih dahulu di tab Google Workspace untuk menyimpan langsung ke Google Drive sekolah.'
          );
          setIsSavingToDrive(false);
          return;
        }
      }

      const pdfDoc = exportAttendanceToPdf(
        filteredAndSortedRecords,
        config,
        `Laporan Rekapitulasi Presensi - ${dateRangeDescription}`,
        dateRangeDescription,
        true
      );
      const pdfBlob = pdfDoc.output('blob');
      const safeSchool = config.schoolName ? config.schoolName.replace(/[^a-zA-Z0-9]/g, '_') : 'SMPN4_TB';
      const fileName = `Rekap_Presensi_${safeSchool}_${startDate}_sd_${endDate}.pdf`;

      const res = await saveBlobToGoogleDrive(
        token,
        fileName,
        pdfBlob,
        'application/pdf',
        config.googleDriveFolderId
      );

      if (res.success) {
        alert(`✅ Berhasil! File rekap presensi telah diunggah ke Google Drive sekolah.\n\nFile: ${fileName}`);
        if (res.link) {
          window.open(res.link, '_blank');
        }
      } else {
        alert('Respon Google Drive: ' + res.message);
      }
    } catch (err: any) {
      alert('Gagal mengunggah ke Google Drive: ' + (err.message || 'Koneksi bermasalah'));
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Simpan Rekapitulasi Bulanan ke Google Drive Sekolah
  const handleSaveMonthlyToGoogleDrive = async () => {
    setIsSavingToDrive(true);
    try {
      let token = getCachedAccessToken();
      if (!token) {
        try {
          const authRes = await signInWithGoogleWorkspace();
          token = authRes.token;
        } catch (authErr) {
          alert('Silakan hubungkan akun Google Workspace terlebih dahulu.');
          setIsSavingToDrive(false);
          return;
        }
      }

      const pdfDoc = exportMonthlyAttendanceSummaryPdf({
        records: safeRecords,
        students: students || [],
        teachers: teachers || [],
        classes: safeClasses,
        config,
        selectedMonth: selectedReportMonth,
        targetCategory: monthlyCategory,
        returnDocOnly: true,
      });
      const pdfBlob = pdfDoc.output('blob');
      const safeSchool = config.schoolName ? config.schoolName.replace(/[^a-zA-Z0-9]/g, '_') : 'SMPN4_TB';
      const fileName = `Laporan_Bulanan_${selectedReportMonth}_${safeSchool}.pdf`;

      const res = await saveBlobToGoogleDrive(
        token,
        fileName,
        pdfBlob,
        'application/pdf',
        config.googleDriveFolderId
      );

      if (res.success) {
        alert(`✅ Berhasil! Laporan Bulanan ${selectedReportMonth} disimpan ke Google Drive sekolah.`);
        if (res.link) {
          window.open(res.link, '_blank');
        }
        setIsMonthlyModalOpen(false);
      } else {
        alert('Respon Google Drive: ' + res.message);
      }
    } catch (err: any) {
      alert('Gagal mengunggah ke Google Drive: ' + (err.message || 'Koneksi bermasalah'));
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Monthly Preview Stats for the Modal
  const monthlyPreviewRecords = useMemo(() => {
    return safeRecords.filter((r) => {
      if (!r.date.startsWith(selectedReportMonth)) return false;
      if (monthlyCategory === 'students') return r.personType === 'student';
      if (monthlyCategory === 'teachers') return r.personType === 'teacher';
      return true;
    });
  }, [safeRecords, selectedReportMonth, monthlyCategory]);

  const monthHadir = monthlyPreviewRecords.filter((r) => r.status === 'hadir').length;
  const monthTerlambat = monthlyPreviewRecords.filter((r) => r.status === 'terlambat').length;
  const monthSakitIzin = monthlyPreviewRecords.filter((r) => r.status === 'sakit' || r.status === 'izin').length;
  const monthAlpa = monthlyPreviewRecords.filter((r) => r.status === 'alpa').length;
  const monthTotal = monthlyPreviewRecords.length;
  const monthRate = monthTotal > 0 ? Math.round(((monthHadir + monthTerlambat) / monthTotal) * 100) : 0;

  // Export to CSV Function
  const exportToCSV = () => {
    if (filteredAndSortedRecords.length === 0) {
      alert('Tidak ada data yang sesuai filter untuk diekspor!');
      return;
    }

    const headers = [
      'No',
      'Tanggal',
      'Waktu_WITA',
      'Nama_Lengkap',
      'Tipe_Personil',
      'NISN_NIP',
      'Status_Kepegawaian_Rombel',
      'Sesi_Presensi',
      'Status_Kehadiran',
      'Metode_Presensi',
      'Lokasi_Koordinat',
      'Catatan_Keterangan',
    ];

    const rows = filteredAndSortedRecords.map((r, index) => [
      index + 1,
      r.date,
      `${r.time} WITA`,
      `"${r.personName.replace(/"/g, '""')}"`,
      r.personType === 'teacher' ? 'Guru/GTK' : 'Siswa',
      `'${r.identifier}`,
      `"${(r.employmentStatus || r.classOrSubject).replace(/"/g, '""')}"`,
      r.type === 'masuk' ? 'Presensi Masuk' : 'Presensi Pulang',
      r.status.toUpperCase(),
      r.method === 'selfie_gps' ? 'Selfie + GPS' : 'QR Code',
      `"${(r.location?.address || 'Sekolah').replace(/"/g, '""')}"`,
      `"${(r.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + // UTF-8 BOM for Excel support
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `rekap_presensi_${config.schoolName.toLowerCase().replace(/\s+/g, '_')}_${startDate}_sd_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Kirim Rekapitulasi ASN ke WhatsApp BKD
  const handleQuickSendBkdWa = () => {
    const rawNumber = config.bkdWhatsAppNumber || config.bkdWhatsApp || '6281340001234';
    const cleanNumber = rawNumber.replace(/\D/g, '');
    const driveLink = config.bkdGoogleDriveLink || 'https://drive.google.com/drive/folders/1aBcD_Taliabu_SIMPEG_BKD_2026';
    
    const message = `*LAPORAN REKAPITULASI PRESENSI ASN / GTK*\n*${config.schoolName}*\n\n` +
      `📅 *Periode:* ${dateRangeDescription}\n` +
      `📊 *Total Rekord:* ${filteredAndSortedRecords.length} Data\n` +
      `✅ *Hadir:* ${countHadir} | ⚠️ *Terlambat:* ${countTerlambat}\n` +
      `📝 *Izin/Sakit:* ${countIzinSakit} | ❌ *Alpa:* ${countAlpa}\n` +
      `📁 *Link Google Drive BKD:* ${driveLink}\n\n` +
      `_Terkirim melalui Sistem Informasi Presensi Digital Kab. Pulau Taliabu._`;

    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  // Kirim Rekapitulasi ASN ke Email BKD
  const handleQuickSendBkdEmail = () => {
    const email = config.bkdEmail || 'bkd@pulautaliabukab.go.id';
    const driveLink = config.bkdGoogleDriveLink || 'https://drive.google.com/drive/folders/1aBcD_Taliabu_SIMPEG_BKD_2026';
    const subject = `[REKAPITULASI ASN] ${config.schoolName} - Periode ${startDate} sd ${endDate}`;
    const body = `Yth. Tim SIMPEG BKD Kab. Pulau Taliabu,\n\n` +
      `Berikut kami sampaikan ringkasan data rekapitulasi presensi GTK/ASN ${config.schoolName} periode ${dateRangeDescription}:\n` +
      `- Total Rekord: ${filteredAndSortedRecords.length}\n` +
      `- Hadir: ${countHadir}\n` +
      `- Terlambat: ${countTerlambat}\n` +
      `- Izin/Sakit: ${countIzinSakit}\n` +
      `- Link Arsip Drive: ${driveLink}\n\n` +
      `Hormat kami,\n` +
      `${config.principalName || 'Kepala Sekolah'}\n` +
      `${config.schoolName}`;

    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 inline-block ml-1 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-600 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 inline-block ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Clean Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Rekapitulasi & Log Presensi Digital
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {dateRangeDescription} • Filter, urutkan, ekspor PDF & CSV
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Akses Cepat Tabel Absensi ASN dengan Tanda Tangan */}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('asn_attendance_table')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Buka Tabel Format Absensi Guru ASN dengan Tanda Tangan Masuk & Pulang"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Tabel Guru ASN</span>
            </button>
          )}

          {/* Kirim Rekap ASN ke WhatsApp BKD */}
          <button
            onClick={handleQuickSendBkdWa}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={`Kirim Rekapitulasi ASN ke WhatsApp BKD (${config.bkdWhatsAppNumber || config.bkdWhatsApp || '6281340001234'})`}
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>WA BKD</span>
          </button>

          {/* Kirim Rekap ASN ke Email BKD */}
          <button
            onClick={handleQuickSendBkdEmail}
            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={`Kirim Rekapitulasi ASN ke Email Resmi BKD (${config.bkdEmail || 'bkd@pulautaliabukab.go.id'})`}
          >
            <Mail className="w-3.5 h-3.5 text-purple-600" />
            <span>Email BKD</span>
          </button>

          {/* Buka Google Drive BKD */}
          {config.bkdGoogleDriveLink && (
            <a
              href={config.bkdGoogleDriveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Buka Folder Arsip Google Drive BKD"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Drive BKD</span>
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </a>
          )}

          {/* Laporan Bulanan PDF */}
          <button
            onClick={() => setIsMonthlyModalOpen(true)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Buka Generator Laporan Bulanan Resmi PDF"
          >
            <CalendarRange className="w-3.5 h-3.5 text-slate-600" />
            <span>Bulanan PDF</span>
          </button>

          {/* Cetak Lembar Presensi Individu PDF */}
          <button
            onClick={() => {
              if (teachers.length > 0 && !selectedIndividualId) {
                setSelectedIndividualId(teachers[0].id);
              }
              setIsIndividualModalOpen(true);
            }}
            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Cetak lembar log presensi bulanan detail per individu guru atau siswa (PDF)"
          >
            <User className="w-3.5 h-3.5 text-sky-600" />
            <span>PDF Individu</span>
          </button>

          {/* Export to Excel (.xlsx) */}
          <button
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Download seluruh data presensi dalam format spreadsheet Excel (.xlsx)"
          >
            <ExcelIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF</span>
          </button>

          {/* Simpan Langsung ke Google Drive */}
          <button
            id="btn-rekap-save-to-drive"
            onClick={handleSaveRekapToGoogleDrive}
            disabled={isSavingToDrive}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Unggah laporan PDF presensi langsung ke folder Google Drive sekolah"
          >
            <HardDrive className={`w-3.5 h-3.5 ${isSavingToDrive ? 'animate-spin' : ''}`} />
            <span>{isSavingToDrive ? 'Menyimpan...' : 'Ke Drive'}</span>
          </button>

          {onOpenPrintModal && (
            <button
              onClick={onOpenPrintModal}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Berita Acara</span>
            </button>
          )}

          <button
            onClick={exportToCSV}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV ({filteredAndSortedRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Matrix Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        {/* Row 1: Global Search Bar & Quick Date Presets */}
        <div className="flex flex-col lg:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="global-rekap-search-input"
              type="text"
              placeholder="Cari nama, NIP, NISN, rombel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-16 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-indigo-500 font-medium transition-colors"
            />
            {searchQuery && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                  {filteredAndSortedRecords.length}
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  title="Hapus pencarian"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center space-x-1 overflow-x-auto w-full lg:w-auto pb-0.5 lg:pb-0">
            <span className="text-[10.5px] font-semibold text-slate-400 mr-1 hidden sm:inline">
              Rentang:
            </span>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'custom', label: 'Kustom' },
              { id: 'all', label: 'Semua' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDateFilterMode(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  dateFilterMode === p.id
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Custom Date Pickers if 'custom' is active */}
        {dateFilterMode === 'custom' && (
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-slate-700 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tanggal:</span>
            </span>
            <div className="flex items-center space-x-1.5">
              <label className="text-slate-500 font-medium">Dari:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1 bg-white border border-slate-200 rounded-md text-xs font-mono font-semibold text-slate-800"
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <label className="text-slate-500 font-medium">Sampai:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1 bg-white border border-slate-200 rounded-md text-xs font-mono font-semibold text-slate-800"
              />
            </div>
          </div>
        )}

        {/* Row 3: Dropdown Category Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Status Kehadiran Filter */}
          <div className="space-y-0.5">
            <label className="font-semibold text-slate-500 text-[10.5px]">Status Kehadiran</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white text-xs"
            >
              <option value="ALL">Semua Status</option>
              <option value="hadir">Hadir Tepat Waktu</option>
              <option value="terlambat">Terlambat</option>
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
              <option value="alpa">Alpa / Tanpa Keterangan</option>
            </select>
          </div>

          {/* Sesi Presensi: Masuk / Pulang */}
          <div className="space-y-0.5">
            <label className="font-semibold text-slate-500 text-[10.5px]">Sesi Presensi</label>
            <select
              value={selectedSessionType}
              onChange={(e) => setSelectedSessionType(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white text-xs"
            >
              <option value="ALL">Semua Sesi</option>
              <option value="masuk">Presensi Masuk</option>
              <option value="pulang">Presensi Pulang</option>
            </select>
          </div>

          {/* Kategori Personil / ASN */}
          <div className="space-y-0.5">
            <label className="font-semibold text-slate-500 text-[10.5px]">Kategori Personil</label>
            <select
              value={selectedPersonType}
              onChange={(e) => setSelectedPersonType(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white text-xs"
            >
              <option value="ALL">Semua Personil</option>
              <option value="student">Hanya Siswa</option>
              <option value="teacher">Semua Guru & GTK</option>
              <option value="PNS">Guru/GTK PNS</option>
              <option value="PPPK">Guru/GTK PPPK</option>
              <option value="PPPK_PW">Guru/GTK PPPK PW</option>
              <option value="HONORER">Guru/GTK Honorer</option>
            </select>
          </div>

          {/* Kelas / Rombel */}
          <div className="space-y-0.5">
            <label className="font-semibold text-slate-500 text-[10.5px]">Rombel / Kelas</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white text-xs"
            >
              <option value="ALL">Semua Kelas</option>
              {safeClasses.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Metric Counter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-medium">Hadir Tepat</span>
            <span className="font-mono font-bold text-emerald-900 text-xs">{countHadir}</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/70 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-medium">Terlambat</span>
            <span className="font-mono font-bold text-amber-900 text-xs">{countTerlambat}</span>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200/70 flex items-center justify-between text-xs">
            <span className="text-indigo-700 font-medium">Izin / Sakit</span>
            <span className="font-mono font-bold text-indigo-900 text-xs">{countIzinSakit}</span>
          </div>
          <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/70 flex items-center justify-between text-xs">
            <span className="text-rose-700 font-medium">Alpa / Nihil</span>
            <span className="font-mono font-bold text-rose-900 text-xs">{countAlpa}</span>
          </div>
        </div>
      </div>

      {/* View Switcher Controls (Table / Map / Both) */}
      <div className="flex items-center justify-between bg-white p-1 rounded-lg border border-slate-200">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setDisplayMode('table')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
              displayMode === 'table'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Tabel ({filteredAndSortedRecords.length})</span>
          </button>
          <button
            onClick={() => setDisplayMode('map')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
              displayMode === 'map'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Peta Lokasi & Geofence</span>
          </button>
          <button
            onClick={() => setDisplayMode('both')}
            className={`hidden sm:flex px-2.5 py-1 rounded-md text-xs font-medium transition-colors items-center space-x-1.5 cursor-pointer ${
              displayMode === 'both'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tabel & Peta</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-medium px-2 hidden md:inline">
          {filteredAndSortedRecords.length} data ditemukan
        </span>
      </div>

      {/* Interactive Map View */}
      {(displayMode === 'map' || displayMode === 'both') && (
        <AttendanceDistributionMap
          records={filteredAndSortedRecords}
          config={config}
          students={students}
          teachers={teachers}
          title="Peta Sebaran GPS Hasil Filter Rekapitulasi"
          subtitle={`Menampilkan sebaran lokasi kehadiran ${filteredAndSortedRecords.length} personil terfilter dengan lingkaran geofencing ${config?.maxRadiusMeters ?? 100}m.`}
          height="450px"
        />
      )}

      {/* Main Table with interactive Sorting Headers */}
      {(displayMode === 'table' || displayMode === 'both') && (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider select-none">
                <th
                  onClick={() => handleHeaderSort('name')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Personil</span>
                    {renderSortIndicator('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('category')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Kategori</span>
                    {renderSortIndicator('category')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('classOrSubject')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Rombel / Jabatan</span>
                    {renderSortIndicator('classOrSubject')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('time')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Waktu (WITA)</span>
                    {renderSortIndicator('time')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('session')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Sesi</span>
                    {renderSortIndicator('session')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('status')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {renderSortIndicator('status')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('method')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                >
                  <div className="flex items-center space-x-1">
                    <span>Metode & Lokasi</span>
                    {renderSortIndicator('method')}
                  </div>
                </th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecords.map((rec) => {
                const isExpanded = expandedRecordId === rec.id;
                return (
                  <React.Fragment key={rec.id}>
                    <tr
                      onClick={() => toggleExpandRecord(rec.id)}
                      className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 text-xs">{rec.personName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {rec.identifier}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            rec.personType === 'teacher'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {rec.personType === 'teacher' ? rec.employmentStatus || 'Guru/GTK' : 'Siswa'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{rec.classOrSubject}</td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800 text-xs">{rec.date}</div>
                        <div className="font-mono text-slate-400 text-[10px]">{rec.time} WITA</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            rec.type === 'masuk'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {rec.type === 'masuk' ? 'Masuk' : 'Pulang'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${
                            rec.status === 'hadir'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.status === 'terlambat'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : rec.status === 'sakit' || rec.status === 'izin'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5 text-slate-600">
                          {rec.method === 'webauthn_biometric' ? (
                            <Fingerprint className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : rec.method === 'selfie_gps' ? (
                            <Camera className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <QrCode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[130px] text-[11px]">
                            {rec.location?.address || 'Sekolah'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-[160px] truncate">
                        {rec.note || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandRecord(rec.id);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center space-x-1 cursor-pointer ${
                              isExpanded
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Lihat Detail Presensi & Peta Lokasi"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const type = rec.personType === 'student' ? 'student' : 'teacher';
                              const monthStr = rec.date.substring(0, 7);
                              handlePrintIndividualPdf(rec.personId, type, monthStr);
                            }}
                            className="p-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer"
                            title="Cetak Lembar Presensi Bulanan Individu (PDF)"
                          >
                            <Printer className="w-3.5 h-3.5 text-sky-600" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details View with Leaflet Map */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 border-b border-indigo-100">
                        <td colSpan={9} className="p-3 sm:p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                            {/* Left Column: Details & Verification Stats */}
                            <div className="lg:col-span-5 space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900">
                                    Detail Rekaman Presensi
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ID: {rec.id}
                                  </span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    rec.status === 'hadir'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {rec.status.toUpperCase()}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Personil</span>
                                  <div className="font-semibold text-slate-900 truncate">{rec.personName}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{rec.identifier}</div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Waktu & Sesi</span>
                                  <div className="font-semibold text-slate-900">
                                    {rec.time} WITA ({rec.type === 'masuk' ? 'Masuk' : 'Pulang'})
                                  </div>
                                  <div className="text-[10px] text-slate-500">{rec.date}</div>
                                </div>
                              </div>

                              {/* Biometric & Geofencing Security Verification Badge */}
                              <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-200/70 space-y-1.5 text-xs">
                                <div className="flex items-center space-x-1.5 text-indigo-900 font-semibold">
                                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Otentikasi & Verifikasi Lokasi</span>
                                </div>

                                <div className="space-y-1 text-[11px] text-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Metode:</span>
                                    <span className="font-semibold text-slate-900 capitalize">
                                      {rec.method === 'webauthn_biometric'
                                        ? 'WebAuthn Biometrik'
                                        : rec.method === 'selfie_gps'
                                        ? 'Foto Selfie & GPS'
                                        : 'QR-Code Digital'}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Radius Sekolah:</span>
                                    <span
                                      className={`font-semibold ${
                                        rec.location?.inRadius
                                          ? 'text-emerald-700'
                                          : 'text-rose-700'
                                      }`}
                                    >
                                      {rec.location?.inRadius
                                        ? `Dalam Radius (${rec.location?.distanceMeter || 0}m)`
                                        : `Diluar Radius (${rec.location?.distanceMeter || 0}m)`}
                                    </span>
                                  </div>

                                  {rec.location?.address && (
                                    <div className="pt-1 border-t border-indigo-100">
                                      <span className="text-slate-500 text-[10px] block">Alamat GPS:</span>
                                      <span className="text-slate-800 text-[11px] leading-tight block">
                                        {rec.location.address}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Captured Selfie Preview if available */}
                              {rec.photoUrl && (
                                <div className="space-y-1">
                                  <span className="text-[10.5px] font-semibold text-slate-600 flex items-center space-x-1">
                                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Bukti Foto Selfie:</span>
                                  </span>
                                  <div className="relative rounded-lg overflow-hidden border border-slate-200 max-w-[200px] bg-slate-900">
                                    <img
                                      src={rec.photoUrl}
                                      alt="Bukti Selfie"
                                      referrerPolicy="no-referrer"
                                      className="w-full h-auto object-cover max-h-40"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right Column: Leaflet Interactive Mini Map */}
                            <div className="lg:col-span-7 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800 text-xs flex items-center space-x-1">
                                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Verifikasi Lokasi (Leaflet)</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Batas: {config.maxRadiusMeters || config.geofenceRadius || 150}m
                                </span>
                              </div>

                              <AttendanceRecordMap
                                record={rec}
                                schoolConfig={config}
                                height="260px"
                              />

                              <p className="text-[10px] text-slate-400 text-center">
                                Titik koordinat perangkat saat presensi dengan radius geofencing sekolah.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rekapitulasi Pagination Bar */}
        {filteredAndSortedRecords.length > 0 && (
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Menampilkan</span>
              <span className="font-semibold text-slate-900">
                {Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedRecords.length)}
              </span>
              <span>-</span>
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, filteredAndSortedRecords.length)}
              </span>
              <span>dari</span>
              <span className="font-bold text-indigo-600">{filteredAndSortedRecords.length}</span>
              <span>data presensi</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-slate-500 text-[11px]">Per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer"
                  title="Halaman Pertama"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-3 py-1 font-semibold text-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Berikutnya
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer"
                  title="Halaman Terakhir"
                >
                  &raquo;
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredAndSortedRecords.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">Tidak ada data presensi yang cocok</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Coba sesuaikan filter pencarian, rentang tanggal, atau kategori personil.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Monthly Attendance Report PDF Generator Modal */}
      {isMonthlyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 border border-slate-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Laporan Presensi Bulanan Resmi (PDF)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Format resmi rekapitulasi kehadiran dengan statistik lengkap
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMonthlyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Month Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Bulan & Tahun:
                </label>
                <input
                  type="month"
                  value={selectedReportMonth}
                  onChange={(e) => setSelectedReportMonth(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 font-medium text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Periode: <strong>{getMonthYearIndo(selectedReportMonth)}</strong>
                </p>
              </div>

              {/* Target Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Personil:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMonthlyCategory('all')}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                      monthlyCategory === 'all'
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyCategory('teachers')}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                      monthlyCategory === 'teachers'
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Guru / GTK
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyCategory('students')}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                      monthlyCategory === 'students'
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Peserta Didik
                  </button>
                </div>
              </div>

              {/* Monthly Stats Quick Preview */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Ringkasan {getMonthYearIndo(selectedReportMonth)}:</span>
                  <span className="text-indigo-600 font-mono text-xs">{monthTotal} Rekaman</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center pt-0.5">
                  <div className="p-1.5 rounded-md bg-white border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">Hadir</span>
                    <span className="text-xs font-mono font-bold text-emerald-600">{monthHadir}</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-white border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">Terlambat</span>
                    <span className="text-xs font-mono font-bold text-amber-600">{monthTerlambat}</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-white border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">Izin/Sakit</span>
                    <span className="text-xs font-mono font-bold text-indigo-600">{monthSakitIzin}</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-white border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">Alpa</span>
                    <span className="text-xs font-mono font-bold text-rose-600">{monthAlpa}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-600">
                  <span>Persentase Kehadiran:</span>
                  <span className="font-mono font-bold text-slate-900">{monthRate}%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveMonthlyToGoogleDrive}
                disabled={isSavingToDrive}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <HardDrive className={`w-3.5 h-3.5 ${isSavingToDrive ? 'animate-spin' : ''}`} />
                <span>{isSavingToDrive ? 'Menyimpan...' : 'Ke Drive'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMonthlyPdf}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Cetak Lembar Presensi Detail Per Individu (PDF) */}
      {isIndividualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 border border-slate-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cetak Presensi Individu (PDF)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Log absensi bulanan lengkap, durasi jam kerja, dan tanda tangan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIndividualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Kategori: Guru atau Siswa */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Kategori Personil
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIndividualPersonType('teacher');
                      if (teachers.length > 0) setSelectedIndividualId(teachers[0].id);
                    }}
                    className={`py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center space-x-1.5 border transition-colors cursor-pointer ${
                      individualPersonType === 'teacher'
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Guru & Pegawai ({teachers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIndividualPersonType('student');
                      if (students.length > 0) setSelectedIndividualId(students[0].id);
                    }}
                    className={`py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center space-x-1.5 border transition-colors cursor-pointer ${
                      individualPersonType === 'student'
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Peserta Didik ({students.length})</span>
                  </button>
                </div>
              </div>

              {/* Pilih Periode Bulan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Periode Bulan
                </label>
                <input
                  type="month"
                  value={individualReportMonth}
                  onChange={(e) => setIndividualReportMonth(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Filter & Pilih Nama Individu */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Pilih Nama {individualPersonType === 'teacher' ? 'Guru/Pegawai' : 'Siswa'}
                </label>
                <input
                  type="text"
                  placeholder="Cari nama atau NIP/NISN..."
                  value={individualSearchTerm}
                  onChange={(e) => setIndividualSearchTerm(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 mb-1.5 focus:bg-white focus:outline-none"
                />
                <select
                  value={selectedIndividualId}
                  onChange={(e) => setSelectedIndividualId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                >
                  {individualPersonType === 'teacher'
                    ? teachers
                        .filter(
                          (t) =>
                            !individualSearchTerm ||
                            t.name.toLowerCase().includes(individualSearchTerm.toLowerCase()) ||
                            (t.nip && t.nip.includes(individualSearchTerm))
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} • {t.nip ? `NIP ${t.nip}` : t.employmentStatus || 'Guru'} ({t.subject})
                          </option>
                        ))
                    : students
                        .filter(
                          (s) =>
                            !individualSearchTerm ||
                            s.name.toLowerCase().includes(individualSearchTerm.toLowerCase()) ||
                            (s.nisn && s.nisn.includes(individualSearchTerm))
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} • NISN {s.nisn || '-'} (Kelas {s.className || safeClasses.find((c) => c.id === s.classId)?.name || 'Siswa'})
                          </option>
                        ))}
                </select>
              </div>

              {/* Ringkasan Kehadiran Orang Terpilih pada Bulan Ini */}
              {selectedIndividualId && (
                <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200/80 space-y-1.5">
                  {(() => {
                    const person =
                      individualPersonType === 'teacher'
                        ? teachers.find((t) => t.id === selectedIndividualId)
                        : students.find((s) => s.id === selectedIndividualId);
                    const pRecords = safeRecords.filter(
                      (r) => r.personId === selectedIndividualId && r.date.startsWith(individualReportMonth)
                    );
                    const pHadir = pRecords.filter((r) => r.status === 'hadir').length;
                    const pTerlambat = pRecords.filter((r) => r.status === 'terlambat').length;
                    const pIzinSakit = pRecords.filter((r) => r.status === 'izin' || r.status === 'sakit').length;
                    const pAlpa = pRecords.filter((r) => r.status === 'alpa').length;

                    return (
                      <div>
                        <div className="flex items-center justify-between font-semibold text-sky-950 text-xs">
                          <span>{person?.name}</span>
                          <span className="text-slate-500 font-mono text-[10.5px]">
                            {getMonthYearIndo(individualReportMonth)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center mt-1.5">
                          <div className="bg-white p-1 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-500 block">Hadir</span>
                            <span className="text-xs font-bold text-emerald-600 font-mono">{pHadir}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-500 block">Terlambat</span>
                            <span className="text-xs font-bold text-amber-600 font-mono">{pTerlambat}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-500 block">Izin/Sakit</span>
                            <span className="text-xs font-bold text-indigo-600 font-mono">{pIzinSakit}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-500 block">Alpa</span>
                            <span className="text-xs font-bold text-rose-600 font-mono">{pAlpa}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsIndividualModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePrintIndividualPdf();
                }}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
