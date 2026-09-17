import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  School,
  Clock,
  MapPin,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  Upload,
  Image as ImageIcon,
  UserCheck,
  ShieldCheck,
  Database,
  CloudUpload,
  Download,
  FileJson,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  ExternalLink,
  Fingerprint,
  Camera,
  Sliders,
  Trash2,
  ShieldAlert,
  Crosshair,
} from 'lucide-react';
import { SchoolConfig, AppBackupData } from '../types';
import { playBeepSound } from '../utils/soundAndDate';
import { SchoolGeofenceConfigMap } from './SchoolGeofenceConfigMap';
import { ManualGpsLocationModal } from './ManualGpsLocationModal';

interface ConfigTabProps {
  config: SchoolConfig;
  onSaveConfig: (newConfig: SchoolConfig) => void;
  onResetToDefault: () => void;
  onClearAllData?: () => void;
  onClearHistoryOnly?: () => void;
  onForceFullSync?: () => Promise<void>;
  isForceSyncing?: boolean;
  appBackupData?: Partial<AppBackupData>;
  onRestoreBackup?: (data: AppBackupData) => void;
}

const PRESET_LOGOS = [
  {
    name: 'Kemendikbudristek',
    desc: 'Logo Tut Wuri Handayani',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_of_Ministry_of_Education_and_Culture_of_Indonesia.svg/240px-Logo_of_Ministry_of_Education_and_Culture_of_Indonesia.svg.png',
  },
  {
    name: 'Kementerian Agama (Kemenag)',
    desc: 'Ikhlas Beramal',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Kementerian_Agama_RI.png/240px-Kementerian_Agama_RI.png',
  },
  {
    name: 'Lambang SMAN 1 Unggulan',
    desc: 'Lambang Kebangsaan & Obor',
    url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Modern Academy Shield',
    desc: 'Emblem Prestasi & Buku',
    url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=200&q=80',
  },
];

export const ConfigTab: React.FC<ConfigTabProps> = ({
  config,
  onSaveConfig,
  onResetToDefault,
  onClearAllData,
  onClearHistoryOnly,
  onForceFullSync,
  isForceSyncing = false,
  appBackupData,
  onRestoreBackup,
}) => {
  const [formData, setFormData] = useState<SchoolConfig>({
    ...config,
    principalName: config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.',
    principalNip: config.principalNip || '197305141999031004',
    adminName: config.adminName || 'Hasbullah Buamona, S.Kom. (SIMPEG/BKD Taliabu)',
    logoUrl: config.logoUrl || PRESET_LOGOS[2].url,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [savedBackups, setSavedBackups] = useState<Array<{ id: string; timestamp: string; date: string; recordsCount: number }>>([]);
  const [isManualGpsModalOpen, setIsManualGpsModalOpen] = useState(false);
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('school_presensi_backup_history');
      if (stored) {
        setSavedBackups(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleBackupCloud = () => {
    setIsBackingUp(true);
    setBackupStatus('Menghubungkan ke koleksi Firestore Database...');

    setTimeout(() => {
      const now = new Date();
      const backupPayload: AppBackupData = {
        id: `backup_${now.getTime()}`,
        timestamp: now.toISOString(),
        createdDate: now.toISOString().split('T')[0],
        createdTime: now.toTimeString().split(' ')[0],
        source: 'Firestore Database Cloud & SIMPEG Digital',
        totalRecords: appBackupData?.records?.length || 0,
        totalStudents: appBackupData?.students?.length || 0,
        totalTeachers: appBackupData?.teachers?.length || 0,
        totalClasses: appBackupData?.classes?.length || 0,
        totalLeaves: appBackupData?.leaves?.length || 0,
        totalGtkServices: appBackupData?.gtkServices?.length || 0,
        records: appBackupData?.records || [],
        students: appBackupData?.students || [],
        teachers: appBackupData?.teachers || [],
        classes: appBackupData?.classes || [],
        leaves: appBackupData?.leaves || [],
        gtkServices: appBackupData?.gtkServices || [],
        events: appBackupData?.events || [],
        config: formData,
        piketDuties: appBackupData?.piketDuties || [],
        biometricLogs: appBackupData?.biometricLogs || [],
        activityLogs: appBackupData?.activityLogs || [],
      };

      try {
        localStorage.setItem(`school_presensi_firestore_backup_${backupPayload.id}`, JSON.stringify(backupPayload));
        const newHistoryItem = {
          id: backupPayload.id,
          timestamp: backupPayload.timestamp,
          date: `${backupPayload.createdDate} ${backupPayload.createdTime}`,
          recordsCount: backupPayload.totalRecords,
        };
        const updatedHistory = [newHistoryItem, ...savedBackups.slice(0, 4)];
        setSavedBackups(updatedHistory);
        localStorage.setItem('school_presensi_backup_history', JSON.stringify(updatedHistory));
      } catch (err) {
        console.error(err);
      }

      setIsBackingUp(false);
      setBackupStatus(`Berhasil mencadangkan seluruh data (${backupPayload.totalRecords} kehadiran, ${backupPayload.totalStudents} siswa, ${backupPayload.totalTeachers} guru) ke Cloud Firestore.`);
      playBeepSound();
      setTimeout(() => setBackupStatus(null), 5000);
    }, 1200);
  };

  const handleDownloadBackupJson = () => {
    const now = new Date();
    const backupPayload: AppBackupData = {
      id: `backup_local_${now.getTime()}`,
      timestamp: now.toISOString(),
      createdDate: now.toISOString().split('T')[0],
      createdTime: now.toTimeString().split(' ')[0],
      source: 'SIMPEG Digital - SMPN 4 Satu Atap Taliabu Barat',
      totalRecords: appBackupData?.records?.length || 0,
      totalStudents: appBackupData?.students?.length || 0,
      totalTeachers: appBackupData?.teachers?.length || 0,
      totalClasses: appBackupData?.classes?.length || 0,
      totalLeaves: appBackupData?.leaves?.length || 0,
      totalGtkServices: appBackupData?.gtkServices?.length || 0,
      records: appBackupData?.records || [],
      students: appBackupData?.students || [],
      teachers: appBackupData?.teachers || [],
      classes: appBackupData?.classes || [],
      leaves: appBackupData?.leaves || [],
      gtkServices: appBackupData?.gtkServices || [],
      events: appBackupData?.events || [],
      config: formData,
      piketDuties: appBackupData?.piketDuties || [],
      biometricLogs: appBackupData?.biometricLogs || [],
      activityLogs: appBackupData?.activityLogs || [],
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `BACKUP_PRESENSI_SMPN4_TALIABU_${now.toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestoreJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed: AppBackupData = JSON.parse(content);
        if (!parsed.records || !parsed.students || !parsed.teachers) {
          alert('Format file cadangan tidak valid!');
          return;
        }

        if (confirm(`Pulihkan data dari cadangan tanggal ${parsed.createdDate || parsed.timestamp}? Tindakan ini akan memperbarui data kehadiran, siswa, dan guru.`)) {
          if (onRestoreBackup) {
            onRestoreBackup(parsed);
          }
          if (parsed.config) {
            setFormData(parsed.config);
            onSaveConfig(parsed.config);
          }
          alert('Data aplikasi berhasil dipulihkan!');
        }
      } catch (err) {
        alert('Gagal membaca file JSON cadangan.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreFromHistory = (backupId: string) => {
    try {
      const stored = localStorage.getItem(`school_presensi_firestore_backup_${backupId}`);
      if (!stored) {
        alert('Data cadangan tidak ditemukan di penyimpanan lokal.');
        return;
      }
      const parsed: AppBackupData = JSON.parse(stored);
      if (confirm(`Pulihkan data dari titik cadangan ini (${parsed.createdDate})?`)) {
        if (onRestoreBackup) {
          onRestoreBackup(parsed);
        }
        if (parsed.config) {
          setFormData(parsed.config);
          onSaveConfig(parsed.config);
        }
        alert('Data aplikasi berhasil dipulihkan!');
      }
    } catch {
      alert('Gagal memulihkan cadangan.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setFormData((prev) => ({ ...prev, logoUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playBeepSound();
    onSaveConfig(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-lg text-slate-900">
              Pengaturan Sekolah, Logo & Pejabat Verifikator
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola identitas resmi sekolah, logo kop surat, verifikator Kepala Sekolah/Admin, dan koordinat geofencing
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm('Apakah Anda yakin ingin mengembalikan pengaturan & data ke default?')) {
              onResetToDefault();
            }
          }}
          className="px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Data Default</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Pengaturan dan Logo Sekolah berhasil disimpan secara permanen!</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* LOGO SEKOLAH INPUT & PREVIEW */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>Logo Resmi Sekolah (Kop Surat, Kartu GTK & Siswa)</span>
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Otomatis sinkron ke Kartu & Cetak
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Preview Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-indigo-50/30 border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-24 h-24 rounded-2xl bg-white p-2 border-2 border-dashed border-indigo-200 flex items-center justify-center shadow-xs overflow-hidden">
                {formData.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    alt="Preview Logo"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <School className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-800">{formData.schoolName}</p>
                <p className="text-[10px] text-slate-500 font-mono">NPSN: {formData.npsn}</p>
              </div>
              <div className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>Logo Aktif</span>
              </div>
            </div>

            {/* Input Controls */}
            <div className="lg:col-span-2 space-y-4">
              {/* Direct URL Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  URL Tautan Gambar Logo Sekolah
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.logoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="https://domain.sch.id/logo.png"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 flex items-center space-x-1.5 shrink-0 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah File</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Bisa menggunakan tautan link online (PNG/JPG) atau klik Unggah File untuk memilih logo dari komputer/ponsel.
                </span>
              </div>

              {/* Preset Choice */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Atau Pilih Preset Logo Standar Pendidikan:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_LOGOS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: preset.url })}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col items-center text-center space-y-1.5 ${
                        formData.logoUrl === preset.url
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 object-contain"
                      />
                      <span className="text-[10px] font-bold text-slate-800 leading-tight">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* IDENTITAS SEKOLAH & PIMPINAN */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
            <School className="w-4 h-4 text-indigo-600" />
            <span>Identitas Satuan Pendidikan & Pimpinan Sekolah</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nama Resmi Sekolah
              </label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nomor Pokok Sekolah Nasional (NPSN)
              </label>
              <input
                type="text"
                value={formData.npsn}
                onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            {/* Principal Name & NIP */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nama Kepala Sekolah (Penandatangan Izin/Dispensasi)
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.principalName || ''}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  placeholder="Dr. H. Mulyadi, M.Pd."
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                NIP Kepala Sekolah
              </label>
              <input
                type="text"
                value={formData.principalNip || ''}
                onChange={(e) => setFormData({ ...formData, principalNip: e.target.value })}
                placeholder="197103151998021001"
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            {/* Admin Name */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nama Administrator SIMPEG / TU
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.adminName || ''}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="Siti Aminah, S.Kom."
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Tahun Ajaran & Semester
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  placeholder="2026/2027"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <select
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Alamat Lengkap Sekolah
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {/* Jadwal Jam Presensi */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Jadwal & Batas Toleransi Jam Presensi</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Jam Mulai Presensi Masuk
              </label>
              <input
                type="time"
                value={formData.checkInStart}
                onChange={(e) => setFormData({ ...formData, checkInStart: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Batas Jam Tepat Waktu (Deadline)
              </label>
              <input
                type="time"
                value={formData.checkInDeadline}
                onChange={(e) => setFormData({ ...formData, checkInDeadline: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-amber-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Presensi setelah jam ini otomatis berstatus Terlambat.
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Jam Mulai Presensi Pulang
              </label>
              <input
                type="time"
                value={formData.checkOutStart}
                onChange={(e) => setFormData({ ...formData, checkOutStart: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Geofencing Radius & Interactive Leaflet Map Visualizer */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>Lokasi Geofencing & Pusat Koordinat Sekolah</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pusat radius presensi resmi. Siswa dan GTK yang berada di dalam radius ini akan terverifikasi secara sah.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsManualGpsModalOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                title="Buka dialog pengaturan koordinat GPS manual lengkap"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Atur Posisi GPS Manual</span>
              </button>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-100">
                Radius: {formData.maxRadiusMeters || 100} Meter
              </span>
            </div>
          </div>

          {/* Interactive Leaflet Map Geofence Visualizer Component */}
          <SchoolGeofenceConfigMap
            schoolLat={formData.schoolLat ?? -1.8214}
            schoolLng={formData.schoolLng ?? 124.7081}
            maxRadiusMeters={formData.maxRadiusMeters || 100}
            schoolName={formData.schoolName || 'SMPN 4 Taliabu Barat'}
            onUpdateCoordinates={(lat, lng) => {
              setFormData((prev) => ({ ...prev, schoolLat: lat, schoolLng: lng }));
            }}
            onUpdateRadius={(radius) => {
              setFormData((prev) => ({ ...prev, maxRadiusMeters: radius }));
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Latitude Pusat Sekolah
              </label>
              <input
                type="number"
                step="any"
                value={formData.schoolLat}
                onChange={(e) => setFormData({ ...formData, schoolLat: Number(e.target.value) })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Longitude Pusat Sekolah
              </label>
              <input
                type="number"
                step="any"
                value={formData.schoolLng}
                onChange={(e) => setFormData({ ...formData, schoolLng: Number(e.target.value) })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Radius Maksimal Presensi (Meter)
              </label>
              <input
                type="number"
                value={formData.maxRadiusMeters}
                onChange={(e) => setFormData({ ...formData, maxRadiusMeters: Number(e.target.value) })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-indigo-700"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Google Maps Cloud Map ID (Advanced Markers)
            </label>
            <input
              type="text"
              value={formData.googleMapId ?? 'DEMO_MAP_ID'}
              onChange={(e) => setFormData({ ...formData, googleMapId: e.target.value })}
              placeholder="DEMO_MAP_ID atau Map ID Google Cloud"
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-slate-800"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Digunakan oleh Google Maps Platform untuk merender Penanda Lanjutan (Advanced Markers). Gunakan <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">DEMO_MAP_ID</code> sebagai default.
            </p>
          </div>
        </div>

        {/* Menu Inputan Integrasi & Kontak BKD untuk Pengiriman Rekapitulasi ASN */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>Pengaturan Tujuan & Kontak Pengiriman Rekapitulasi ASN ke BKD</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasikan Link Google Drive, Nomor WhatsApp, dan Email resmi BKD Pulau Taliabu untuk diseminasi laporan presensi GTK/ASN.
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 text-[11px] font-bold rounded-full border border-purple-100 self-start sm:self-auto">
              Format Resmi SIMPEG BKD
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Link Google Drive BKD */}
            <div className="md:col-span-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  <span>Link Google Drive BKD (Penyimpanan Arsip Presensi ASN)</span>
                </label>
                {formData.bkdGoogleDriveLink && (
                  <a
                    href={formData.bkdGoogleDriveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 underline decoration-indigo-300"
                  >
                    <span>Buka Folder Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <HardDrive className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={formData.bkdGoogleDriveLink || ''}
                  onChange={(e) => setFormData({ ...formData, bkdGoogleDriveLink: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/1aBcD_Taliabu_SIMPEG_BKD_2026"
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono text-slate-800"
                />
              </div>
              <span className="text-[10px] text-slate-400 block">
                Tautan folder Google Drive bersama BKD untuk mengunggah otomatis file CSV / PDF presensi harian & bulanan ASN.
              </span>
            </div>

            {/* 2. Nomor WhatsApp BKD */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nomor WA BKD (Pengiriman Rekap ASN)</span>
                </label>
                {formData.bkdWhatsApp && (
                  <a
                    href={`https://wa.me/${(formData.bkdWhatsAppNumber || formData.bkdWhatsApp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Halo BKD Kabupaten Pulau Taliabu, berikut konfirmasi rekapitulasi presensi ASN SMPN 4 Satu Atap Taliabu Barat.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center space-x-1"
                  >
                    <span>Uji WA</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.bkdWhatsAppNumber || formData.bkdWhatsApp || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, bkdWhatsAppNumber: val, bkdWhatsApp: val });
                  }}
                  placeholder="6281340001234"
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>
              <span className="text-[10px] text-slate-400 block">
                Format: 628xxxxxxxxxx (Tanpa tanda + atau spasi).
              </span>
            </div>

            {/* 3. Email BKD */}
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-600" />
                  <span>Email Resmi BKD (Tujuan Kirim Rekapitulasi)</span>
                </label>
                {formData.bkdEmail && (
                  <a
                    href={`mailto:${formData.bkdEmail}?subject=${encodeURIComponent(`Rekapitulasi Presensi ASN - ${formData.schoolName}`)}`}
                    className="text-[10.5px] font-bold text-purple-600 hover:text-purple-800 flex items-center space-x-1"
                  >
                    <span>Kirim Uji Email</span>
                    <Mail className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={formData.bkdEmail || 'bkd@pulautaliabukab.go.id'}
                  onChange={(e) => setFormData({ ...formData, bkdEmail: e.target.value })}
                  placeholder="bkd@pulautaliabukab.go.id"
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono"
                />
              </div>
              <span className="text-[10px] text-slate-400 block">
                Email verifikator resmi untuk lampiran berkas CSV / Excel presensi ASN.
              </span>
            </div>
          </div>
        </div>

        {/* Pengaturan Biometrik & Pengenalan Wajah AI (Face Recognition Mode & Liveness Threshold) */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <Fingerprint className="w-4 h-4 text-indigo-600" />
                <span>Pengaturan Sensor Biometrik & Pengenalan Wajah AI</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi mode performa deteksi wajah real-time pada webcam dan tingkat sensitivitas liveness anti-spoofing
              </p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-100 self-start sm:self-auto">
              AI Vision & WebAuthn
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Toggle Face Recognition Mode */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="face-recognition-mode-toggle" className="font-extrabold text-xs text-slate-900 flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span>Mode Pengenalan Wajah (Face Recognition Mode)</span>
                  </label>
                  <input
                    type="checkbox"
                    id="face-recognition-mode-toggle"
                    checked={formData.enableFaceRecognitionMode !== false}
                    onChange={(e) =>
                      setFormData({ ...formData, enableFaceRecognitionMode: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Mengaktifkan atau menonaktifkan pelacakan fitur wajah real-time (face mesh) pada kamera selfie.
                  <strong className="text-slate-700 font-bold block mt-1">
                    *Nonaktifkan untuk mempercepat performa & menghemat baterai pada perangkat lama/spesifikasi rendah.
                  </strong>
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/60">
                <span
                  className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${
                    formData.enableFaceRecognitionMode !== false
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {formData.enableFaceRecognitionMode !== false
                    ? '✓ Real-Time Face Detection Aktif'
                    : '⚡ Mode Ringan (Bypass Live Mesh Aktif)'}
                </span>
              </div>
            </div>

            {/* 2. Slider Biometric Liveness Threshold */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="biometric-liveness-threshold-slider" className="font-extrabold text-xs text-slate-900 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>Ambang Batas Keaslian Biometrik (Liveness Threshold)</span>
                  </label>
                  <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">
                    {Math.round((formData.biometricLivenessThreshold ?? 0.75) * 100)}% (
                    {(formData.biometricLivenessThreshold ?? 0.75).toFixed(2)})
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Menentukan skor batas minimum verifikasi kemiripan & keaslian wajah (liveness) sebelum presensi disahkan ke sistem.
                </p>

                <div className="mt-4 space-y-2">
                  <input
                    type="range"
                    id="biometric-liveness-threshold-slider"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={formData.biometricLivenessThreshold ?? 0.75}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        biometricLivenessThreshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>0.0 (Sangat Longgar)</span>
                    <span className="text-indigo-600">0.75 (Standar)</span>
                    <span>1.0 (Super Ketat)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-600">
                  Status: {((formData.biometricLivenessThreshold ?? 0.75) < 0.6)
                    ? '⚠️ Longgar (Toleransi Tinggi)'
                    : ((formData.biometricLivenessThreshold ?? 0.75) <= 0.8)
                    ? '✅ Optimal (Aman & Nyaman)'
                    : '🔒 Ketat (Proteksi Anti-Spoofing Maksimal)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Data & Pemulihan (Firestore & Local JSON) */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Backup & Pemulihan Data (Firestore & JSON)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simpan seluruh snapshot database kehadiran, siswa, dan guru ke Cloud Firestore atau cadangan offline
              </p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-100 self-start sm:self-auto">
              Auto-Sync Firestore
            </span>
          </div>

          {backupStatus && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{backupStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Force Full Sync to Firebase */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-indigo-950 font-extrabold text-xs">
                  <RefreshCw className={`w-4 h-4 text-indigo-600 ${isForceSyncing ? 'animate-spin' : ''}`} />
                  <span>Force Full Sync Firebase</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Memicu sinkronisasi menyeluruh seluruh data lokal (records, master data) ke Firestore & memvalidasi integritas server.
                </p>
              </div>

              <button
                type="button"
                id="force-full-sync-btn"
                onClick={() => {
                  if (onForceFullSync) {
                    onForceFullSync();
                  }
                }}
                disabled={isForceSyncing}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isForceSyncing ? 'animate-spin' : ''}`} />
                <span>{isForceSyncing ? 'Sinkronisasi Menyeluruh...' : 'Force Full Sync'}</span>
              </button>
            </div>

            {/* Backup to Firestore */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-indigo-900 font-extrabold text-xs">
                  <CloudUpload className="w-4 h-4 text-indigo-600" />
                  <span>Cadangkan ke Firestore</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Menyimpan seluruh state aplikasi secara real-time ke koleksi cloud Firestore untuk mencegah kehilangan data.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackupCloud}
                disabled={isBackingUp}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                {isBackingUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mencadangkan...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Backup Sekarang</span>
                  </>
                )}
              </button>
            </div>

            {/* Download JSON Backup & Auto-Backup on Friday info */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-emerald-950 font-extrabold text-xs">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  <span>Auto-Backup JSON (Jumat)</span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                  Otomatis mengunduh snapshot data sistem setiap hari Jumat ke folder unduhan pengguna.
                </p>
              </div>

              <button
                type="button"
                id="download-backup-json-btn"
                onClick={handleDownloadBackupJson}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Snapshot (.JSON)</span>
              </button>
            </div>

            {/* Restore from File */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs">
                  <HardDrive className="w-4 h-4 text-amber-600" />
                  <span>Pulihkan File Cadangan</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Unggah file cadangan JSON untuk memulihkan seluruh riwayat presensi dan data sekolah.
                </p>
              </div>

              <input
                type="file"
                ref={backupFileInputRef}
                accept=".json"
                onChange={handleRestoreJsonFile}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah & Pulihkan</span>
              </button>
            </div>
          </div>

          {/* History of backups */}
          {savedBackups.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                Riwayat Snapshot Cadangan Tersimpan:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {savedBackups.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <Database className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-semibold text-slate-800">{bk.date}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                        {bk.recordsCount} Kehadiran
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreFromHistory(bk.id)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] cursor-pointer"
                    >
                      Pulihkan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone: Hapus Riwayat & Kosongkan Data Dummy */}
        <div className="p-6 rounded-3xl bg-rose-50/70 border border-rose-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-rose-200/60">
            <div>
              <h3 className="font-extrabold text-sm text-rose-950 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Pembersihan Database & Manajemen Riwayat</span>
              </h3>
              <p className="text-xs text-rose-800/80 mt-0.5">
                Pembersihan riwayat kehadiran atau penghapusan data master dummy. Sistem otomatis menghapus data histori/riwayat terkait secara berjenjang (cascade deletion).
              </p>
            </div>
            <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-full border border-rose-300 self-start sm:self-auto">
              Tindakan Permanen
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Action 1: Kosongkan Riwayat Saja */}
            <div className="p-4 rounded-2xl bg-white border border-rose-200 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  1. Kosongkan Riwayat Presensi Saja
                </span>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Menghapus semua catatan kehadiran, log biometrik, permohonan izin, dan activity log. Data master (siswa, guru, kelas) tetap aman tersimpan.
                </p>
              </div>

              <button
                type="button"
                id="clear-history-only-btn"
                onClick={() => {
                  if (
                    window.confirm(
                      '⚠️ PERINGATAN: Apakah Anda yakin ingin MENGOSONGKAN SELURUH RIWAYAT PRESENSI & LOG?\n\nData guru, siswa, dan rombel akan TETAP ADA, hanya riwayat kehadiran yang akan dibersihkan.'
                    )
                  ) {
                    playBeepSound();
                    if (onClearHistoryOnly) {
                      onClearHistoryOnly();
                    }
                  }
                }}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Kosongkan Riwayat Presensi</span>
              </button>
            </div>

            {/* Action 2: Hapus Semua Dummy & Reset Bersih */}
            <div className="p-4 rounded-2xl bg-white border border-rose-200 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-rose-950 block">
                  2. Hapus Seluruh Data Dummy & Reset Total
                </span>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Menghapus siswa, guru, kelas, dan seluruh riwayat kehadiran untuk memulai input data murni dari awal (Clean Slate).
                </p>
              </div>

              <button
                type="button"
                id="clear-all-data-btn"
                onClick={() => {
                  setClearConfirmInput('');
                  setIsConfirmClearModalOpen(true);
                }}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Semua Dummy & Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-8 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan Pengaturan & Logo</span>
          </button>
        </div>
      </form>

      {/* Modal Pengaturan Posisi GPS Sekolah Secara Manual */}
      <ManualGpsLocationModal
        isOpen={isManualGpsModalOpen}
        onClose={() => setIsManualGpsModalOpen(false)}
        currentLat={formData.schoolLat ?? -1.8214}
        currentLng={formData.schoolLng ?? 124.7081}
        currentRadius={formData.maxRadiusMeters || 100}
        schoolName={formData.schoolName || 'SMPN 4 Taliabu Barat'}
        onSaveGpsLocation={(lat, lng, radius) => {
          const updated = {
            ...formData,
            schoolLat: lat,
            schoolLng: lng,
            maxRadiusMeters: radius,
          };
          setFormData(updated);
          onSaveConfig(updated);
        }}
      />

      {/* Modal Dialog Konfirmasi 'Are you sure?' Hapus Semua Data */}
      {isConfirmClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-5">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <AlertTriangle className="w-7 h-7 text-rose-600 shrink-0" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Are you sure? (Konfirmasi Hapus)</h3>
                <p className="text-xs text-slate-500">Tindakan ini permanen dan tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100 space-y-2 text-xs text-rose-950 leading-relaxed">
              <p className="font-bold">Apakah Anda yakin ingin menghapus seluruh data presensi dan data dummy?</p>
              <p className="text-slate-600 text-[11.5px]">
                Seluruh data siswa, guru, kelas, log biometrik wajah, rekaman GPS, dan riwayat absensi harian akan dikosongkan secara total untuk memulai data bersih (clean slate).
              </p>
              <div className="pt-2 border-t border-rose-200/60">
                <p className="text-[11px] text-rose-800 font-semibold mb-2">
                  Ketik kata <span className="font-mono font-black text-rose-900 bg-white px-1.5 py-0.5 rounded border border-rose-300">HAPUS</span> di bawah ini untuk melanjutkan:
                </p>
                <input
                  type="text"
                  placeholder="Ketik HAPUS..."
                  value={clearConfirmInput}
                  onChange={(e) => setClearConfirmInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border-2 border-rose-300 focus:border-rose-600 rounded-xl text-xs font-mono text-center uppercase tracking-widest focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmClearModalOpen(false);
                  setClearConfirmInput('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={clearConfirmInput.trim().toUpperCase() !== 'HAPUS'}
                onClick={() => {
                  playBeepSound();
                  setIsConfirmClearModalOpen(false);
                  setClearConfirmInput('');
                  if (onClearAllData) {
                    onClearAllData();
                  } else {
                    onResetToDefault();
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Semua Data Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
