import React, { useState, useMemo, useEffect } from 'react';
import {
  ActivityLog,
  ActivityLogCategory,
  SchoolConfig,
  UserRole,
} from '../types';
import {
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  Clock,
  User,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Plus,
  FileText,
  Bug,
  Terminal,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { downloadCsv, formatDateIndo } from '../utils/soundAndDate';
import { exportActivityLogsToPdf } from '../utils/exportUtils';
import { INITIAL_SCHOOL_CONFIG } from '../data/schoolData';

interface ActivityLogsTabProps {
  logs: ActivityLog[];
  onAddLog: (log: Omit<ActivityLog, 'id' | 'timestamp' | 'date' | 'time'>) => void;
  onClearLogs?: () => void;
  schoolConfig?: SchoolConfig;
  userRole?: UserRole;
}

export const ActivityLogsTab: React.FC<ActivityLogsTabProps> = ({
  logs,
  onAddLog,
  onClearLogs,
  schoolConfig = INITIAL_SCHOOL_CONFIG,
  userRole = 'admin',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination state for performance optimization
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus, dateFilter, customStartDate, customEndDate, pageSize]);

  // New log form state
  const [newAction, setNewAction] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<ActivityLogCategory>('system');
  const [newStatus, setNewStatus] = useState<'success' | 'warning' | 'info' | 'error'>('info');
  const [expandedDebugLogIds, setExpandedDebugLogIds] = useState<Record<string, boolean>>({});
  const [expandedDiffLogIds, setExpandedDiffLogIds] = useState<Record<string, boolean>>({});
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const toggleDebugExpand = (id: string) => {
    setExpandedDebugLogIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleDiffExpand = (id: string) => {
    setExpandedDiffLogIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyDebugJson = (id: string, metadata: any) => {
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2500);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        log.actor.name.toLowerCase().includes(q) ||
        log.actor.role.toLowerCase().includes(q) ||
        (log.targetName && log.targetName.toLowerCase().includes(q)) ||
        (log.deviceInfo && log.deviceInfo.toLowerCase().includes(q));

      // Category matching with support for Sistem, User, BKD groups
      let matchCategory = true;
      if (selectedCategory === 'all') {
        matchCategory = true;
      } else if (selectedCategory === 'group_sistem') {
        matchCategory = ['system', 'config', 'workspace', 'auth', 'security'].includes(log.category);
      } else if (selectedCategory === 'group_user') {
        matchCategory = ['attendance', 'leave', 'master_data'].includes(log.category);
      } else if (selectedCategory === 'group_bkd') {
        matchCategory =
          log.category === 'gtk_service' ||
          log.action.toLowerCase().includes('bkd') ||
          log.description.toLowerCase().includes('bkd') ||
          log.actor.name.toLowerCase().includes('bkd') ||
          log.actor.role.toLowerCase().includes('simpeg');
      } else {
        matchCategory = log.category === selectedCategory;
      }

      // Status
      const matchStatus = selectedStatus === 'all' || log.status === selectedStatus;

      // Date
      let matchDate = true;
      if (dateFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchDate = log.date === todayStr;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchDate = new Date(log.date) >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        matchDate = new Date(log.date) >= monthAgo;
      } else if (dateFilter === 'custom') {
        if (customStartDate && customEndDate) {
          matchDate = log.date >= customStartDate && log.date <= customEndDate;
        } else if (customStartDate) {
          matchDate = log.date >= customStartDate;
        } else if (customEndDate) {
          matchDate = log.date <= customEndDate;
        }
      }

      return matchSearch && matchCategory && matchStatus && matchDate;
    });
  }, [logs, searchQuery, selectedCategory, selectedStatus, dateFilter, customStartDate, customEndDate]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleExportCsv = () => {
    const headers = [
      'ID Log',
      'Timestamp',
      'Tanggal',
      'Waktu',
      'Kategori',
      'Aktor / Pelaku',
      'Peran Aktor',
      'Aksi',
      'Deskripsi',
      'Target',
      'Status',
      'Perangkat / IP',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.date}"`,
      `"${l.time}"`,
      `"${l.category}"`,
      `"${l.actor.name.replace(/"/g, '""')}"`,
      `"${l.actor.role.replace(/"/g, '""')}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      `"${(l.targetName || l.targetId || '-').replace(/"/g, '""')}"`,
      `"${l.status.toUpperCase()}"`,
      `"${(l.deviceInfo || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const today = new Date().toISOString().split('T')[0];
    downloadCsv(`Log_Aktivitas_Audit_${schoolConfig.schoolName.replace(/\s+/g, '_')}_${today}.csv`, csvContent);
  };

  const handleExportPdf = () => {
    if (filteredLogs.length === 0) {
      alert('Tidak ada data log aktivitas yang sesuai untuk diekspor!');
      return;
    }
    const dateDesc = dateFilter === 'today'
      ? `Hari Ini (${formatDateIndo(new Date().toISOString().split('T')[0])})`
      : dateFilter === 'week'
      ? '7 Hari Terakhir'
      : dateFilter === 'month'
      ? '30 Hari Terakhir'
      : 'Semua Periode Riwayat Audit';

    exportActivityLogsToPdf(
      filteredLogs,
      schoolConfig,
      `Laporan Audit Trail & Log Aktivitas Sistem - ${dateDesc}`,
      dateDesc
    );
  };

  const handleCreateManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction || !newDesc) return;

    onAddLog({
      category: newCategory,
      actor: {
        name: userRole === 'admin' ? (schoolConfig.adminName || 'Admin SIMPEG') : 'Guru / Petugas Piket',
        role: userRole === 'admin' ? 'Administrator SIMPEG' : 'Petugas Piket Presensi',
      },
      action: newAction,
      description: newDesc,
      status: newStatus,
      deviceInfo: 'Web Admin Dashboard',
    });

    setNewAction('');
    setNewDesc('');
    setShowAddModal(false);
  };

  const getCategoryBadge = (cat: ActivityLogCategory) => {
    switch (cat) {
      case 'attendance':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Presensi</span>;
      case 'gtk_service':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Layanan GTK</span>;
      case 'leave':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Perizinan</span>;
      case 'master_data':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Master Data</span>;
      case 'config':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">Pengaturan</span>;
      case 'workspace':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">Workspace / Cloud</span>;
      case 'auth':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Autentikasi</span>;
      case 'security':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">🛡️ Keamanan / Rate Limit</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">Sistem</span>;
    }
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'info' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  return (
    <div id="activity-logs-container" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Audit Trail & Log Aktivitas Sistem</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Recording
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Merekam setiap riwayat transaksi data, absensi selfie/QR, perubahan master data, serta alur persetujuan ganda GTK (Kepala Sekolah & Admin) untuk akuntabilitas & audit resmi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="export-audit-pdf-btn"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              title="Unduh Laporan Audit Kepatuhan & Akuntabilitas Resmi (PDF)"
            >
              <FileText className="w-4 h-4" />
              <span>Ekspor PDF ({filteredLogs.length})</span>
            </button>

            <button
              id="export-audit-csv-btn"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>

            {userRole === 'admin' && (
              <button
                id="add-manual-log-btn"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Log Manual</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-slate-400">Total Rekaman Log</div>
            <div className="text-xl font-bold text-white mt-0.5">{logs.length}</div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-slate-400">Log Hari Ini</div>
            <div className="text-xl font-bold text-indigo-300 mt-0.5">
              {logs.filter((l) => l.date === new Date().toISOString().split('T')[0]).length}
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-slate-400">Aktivitas GTK & Izin</div>
            <div className="text-xl font-bold text-purple-300 mt-0.5">
              {logs.filter((l) => l.category === 'gtk_service' || l.category === 'leave').length}
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-slate-400">Kejadian Sukses / Valid</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {logs.filter((l) => l.status === 'success').length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-audit-log"
            type="text"
            placeholder="Cari aksi, nama aktor, perangkat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Filter with Sistem, User, BKD groups */}
          <select
            id="filter-category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Kategori</option>
            <optgroup label="Kelompok Kategori Utama">
              <option value="group_sistem">Kategori Sistem (Config, Cloud, Auth, System)</option>
              <option value="group_user">Kategori User (Presensi, Izin, Siswa, Guru)</option>
              <option value="group_bkd">Kategori BKD & SIMPEG (Layanan, Dispatch, Sync)</option>
            </optgroup>
            <optgroup label="Kategori Spesifik">
              <option value="attendance">Presensi Siswa & GTK</option>
              <option value="gtk_service">Layanan & Izin GTK</option>
              <option value="leave">Izin Siswa</option>
              <option value="master_data">Master Data GTK/Siswa</option>
              <option value="config">Pengaturan Sekolah</option>
              <option value="workspace">Google Workspace / Cloud</option>
              <option value="auth">Autentikasi & Login</option>
              <option value="security">🛡️ Keamanan & Rate Limiter</option>
              <option value="system">Sistem</option>
            </optgroup>
          </select>

          {/* Date Filter */}
          <select
            id="filter-date-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Waktu</option>
            <option value="today">Hari Ini</option>
            <option value="week">7 Hari Terakhir</option>
            <option value="month">30 Hari Terakhir</option>
            <option value="custom">Rentang Tanggal Khusus</option>
          </select>

          {/* Custom Date Inputs if custom selected */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                title="Tanggal Mulai"
              />
              <span className="text-xs text-slate-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                title="Tanggal Selesai"
              />
            </div>
          )}

          {/* Status Filter */}
          <select
            id="filter-status-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="success">Sukses / Valid</option>
            <option value="info">Informasi</option>
            <option value="warning">Peringatan</option>
            <option value="error">Gagal / Ditolak</option>
          </select>

          {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || dateFilter !== 'all' || customStartDate || customEndDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setDateFilter('all');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset Filter"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Daftar Riwayat Aktivitas ({filteredLogs.length} entri)
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Diurutkan dari yang terbaru
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Kondisi Awal Bersih (Clean Slate)</span>
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-white">
              Belum Pernah Melakukan Absensi atau Pengajuan Izin
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Riwayat dan histori aktivitas saat ini kosong karena belum ada rekaman absensi siswa/guru ataupun permohonan izin yang dilakukan. Seluruh kronologi presensi, koordinat GPS, verifikasi wajah biometrik, serta status permohonan izin akan otomatis tercatat di sini begitu aktivitas pertama kali dimulai.
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Info className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">Tidak ada data log yang sesuai dengan filter.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau bersihkan filter di atas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                      {getStatusIcon(log.status)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                          {log.action}
                        </span>
                        {getCategoryBadge(log.category)}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {log.description}
                      </p>

                      {log.targetName && (
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          Target: {log.targetName}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-700 dark:text-slate-300 font-medium">{log.actor.name}</strong>
                          <span className="text-slate-400">({log.actor.role})</span>
                        </span>

                        {log.deviceInfo && (
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{log.deviceInfo}</span>
                          </span>
                        )}

                        {log.debugMetadata && (
                          <button
                            type="button"
                            onClick={() => toggleDebugExpand(log.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
                          >
                            <Bug className="w-3 h-3 text-indigo-500" />
                            <span>Metadata Debug Kamera</span>
                            {expandedDebugLogIds[log.id] ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}

                        {(log.prevValue || log.newValue) && (
                          <button
                            type="button"
                            onClick={() => toggleDiffExpand(log.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 transition-all cursor-pointer"
                          >
                            <FileText className="w-3 h-3 text-amber-500" />
                            <span>Rincian Perubahan Nilai (Diff)</span>
                            {expandedDiffLogIds[log.id] ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expandable Debug Inspector */}
                      {log.debugMetadata && expandedDebugLogIds[log.id] && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono space-y-2.5 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[11px]">
                              <Terminal className="w-3.5 h-3.5" />
                              <span>Diagnostik Lingkungan Kamera & Peramban</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyDebugJson(log.id, log.debugMetadata)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-sans font-semibold text-slate-300 flex items-center gap-1 transition-all cursor-pointer border border-slate-700"
                            >
                              {copiedLogId === log.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin JSON</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-400">Browser: </span>
                              <span className="text-white font-semibold">
                                {log.debugMetadata.browserName} {log.debugMetadata.browserVersion}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Sistem Operasi: </span>
                              <span className="text-white font-semibold">{log.debugMetadata.os}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Resolusi Layar: </span>
                              <span className="text-emerald-400">{log.debugMetadata.screenResolution}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Viewport: </span>
                              <span className="text-cyan-400">{log.debugMetadata.viewportSize}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Izin Kamera: </span>
                              <span
                                className={`font-bold ${
                                  log.debugMetadata.permissionStatus === 'granted'
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {log.debugMetadata.permissionStatus}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Sensor Black Screen: </span>
                              <span
                                className={`font-bold ${
                                  log.debugMetadata.blackScreenDetected ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {log.debugMetadata.blackScreenDetected ? 'Terdeteksi (Hitam)' : 'Normal'}
                              </span>
                            </div>
                            {log.debugMetadata.cameraFacingMode && (
                              <div>
                                <span className="text-slate-400">Arah Kamera: </span>
                                <span className="text-amber-300 capitalize">{log.debugMetadata.cameraFacingMode}</span>
                              </div>
                            )}
                            {log.debugMetadata.attemptNumber && (
                              <div>
                                <span className="text-slate-400">Percobaan Ke-: </span>
                                <span className="text-purple-300 font-bold">
                                  {log.debugMetadata.attemptNumber}
                                </span>
                              </div>
                            )}
                          </div>

                          {log.debugMetadata.errorMessage && (
                            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px]">
                              <span className="font-bold">Error [{log.debugMetadata.errorName || 'Exception'}]: </span>
                              {log.debugMetadata.errorMessage}
                            </div>
                          )}

                          {log.debugMetadata.errorStack && (
                            <details className="mt-1">
                              <summary className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer font-sans">
                                Lihat Error Stack Trace Lengkap
                              </summary>
                              <pre className="mt-1 p-2 rounded bg-black/50 text-[10px] text-slate-300 overflow-x-auto max-h-40 whitespace-pre-wrap">
                                {log.debugMetadata.errorStack}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}

                      {/* Expandable Diff Inspector (prevValue -> newValue) */}
                      {(log.prevValue || log.newValue) && expandedDiffLogIds[log.id] && (
                        <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 text-slate-200 text-xs font-sans space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                              <FileText className="w-3.5 h-3.5" />
                              <span>Rincian Nilai Sebelum & Sesudah Edit (Audit Trail)</span>
                            </div>
                            {log.changedFields && log.changedFields.length > 0 && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {log.changedFields.length} field dimodifikasi
                              </span>
                            )}
                          </div>

                          {log.changedFields && log.changedFields.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] text-slate-400">Field yang diubah:</span>
                              {log.changedFields.map((field) => (
                                <span
                                  key={field}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-amber-200 text-[10px] font-mono border border-slate-700"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Nilai Sebelumnya */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-rose-900/40">
                              <div className="text-[11px] font-bold text-rose-400 mb-1.5 flex items-center justify-between">
                                <span>Nilai Sebelum (prevValue)</span>
                                <span className="text-[10px] text-rose-500/80 font-normal">Sebelum Diedit</span>
                              </div>
                              <pre className="text-[11px] font-mono text-rose-200/90 whitespace-pre-wrap overflow-x-auto max-h-48 leading-relaxed bg-black/40 p-2 rounded">
                                {typeof log.prevValue === 'object'
                                  ? JSON.stringify(log.prevValue, null, 2)
                                  : String(log.prevValue || '-')}
                              </pre>
                            </div>

                            {/* Nilai Sesudah */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-emerald-900/40">
                              <div className="text-[11px] font-bold text-emerald-400 mb-1.5 flex items-center justify-between">
                                <span>Nilai Sesudah (newValue)</span>
                                <span className="text-[10px] text-emerald-500/80 font-normal">Setelah Disimpan</span>
                              </div>
                              <pre className="text-[11px] font-mono text-emerald-200/90 whitespace-pre-wrap overflow-x-auto max-h-48 leading-relaxed bg-black/40 p-2 rounded">
                                {typeof log.newValue === 'object'
                                  ? JSON.stringify(log.newValue, null, 2)
                                  : String(log.newValue || '-')}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right flex-shrink-0 pl-11 sm:pl-0">
                    <div className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                      {log.time} WIB
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateIndo(log.date)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {filteredLogs.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Menampilkan</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min((currentPage - 1) * pageSize + 1, filteredLogs.length)}
              </span>
              <span>-</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </span>
              <span>dari</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredLogs.length}</span>
              <span>entri</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-slate-500 text-[11px]">Per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
                  title="Halaman Pertama"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-3 py-1 font-semibold text-slate-800 dark:text-slate-200">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
                >
                  Berikutnya
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
                  title="Halaman Terakhir"
                >
                  &raquo;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add Manual Log */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Catat Aktivitas Audit Manual</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateManualLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Aksi / Peristiwa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Verifikasi Berkas Fisik, Sinkronisasi Manual Dapodik"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ActivityLogCategory)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="gtk_service">Layanan GTK (SK / Izin / SPT)</option>
                  <option value="attendance">Presensi & Kehadiran</option>
                  <option value="master_data">Master Data GTK & Siswa</option>
                  <option value="config">Pengaturan Sekolah</option>
                  <option value="workspace">Google Workspace / Cloud</option>
                  <option value="auth">Keamanan / Otorisasi</option>
                  <option value="system">Sistem & Pemeliharaan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Keterangan & Rincian Log *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Rincian catatan audit atau alasan perubahan..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status Hasil
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['info', 'success', 'warning', 'error'] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setNewStatus(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        newStatus === s
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all"
                >
                  Simpan Log Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
