import React, { useState } from 'react';
import {
  Cloud,
  FileSpreadsheet,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Database,
  LogIn,
  LogOut,
  FolderOpen,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  AttendanceRecord,
  SchoolConfig,
  AcademicEvent,
  GtkServiceRequest,
  UserRole,
} from '../types';
import {
  signInWithGoogleWorkspace,
  logoutGoogle,
  getCachedAccessToken,
  auth,
} from '../lib/firebase';
import {
  exportToGoogleSheet,
  saveReportToGoogleDrive,
  openGooglePicker,
  PickedGoogleFile,
  GoogleSyncResult,
} from '../lib/googleWorkspace';
import { GoogleMapsAttendanceView } from './GoogleMapsAttendanceView';

interface GoogleWorkspaceTabProps {
  records: AttendanceRecord[];
  config: SchoolConfig;
  events: AcademicEvent[];
  gtkServices: GtkServiceRequest[];
  userRole: UserRole;
}

export const GoogleWorkspaceTab: React.FC<GoogleWorkspaceTabProps> = ({
  records = [],
  config,
  events = [],
  gtkServices = [],
  userRole,
}) => {
  const [googleUser, setGoogleUser] = useState<any>(auth.currentUser);
  const [token, setToken] = useState<string | null>(getCachedAccessToken());
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<GoogleSyncResult | null>(null);
  const [pickedFile, setPickedFile] = useState<PickedGoogleFile | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const res = await signInWithGoogleWorkspace();
      setGoogleUser(res.user);
      setToken(res.token);
      setSyncStatus({
        success: true,
        message: `Terhubung ke Google Workspace sebagai ${res.user.email}!`,
      });
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: err.message || 'Gagal login ke Google Workspace',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setToken(null);
    setSyncStatus(null);
    setPickedFile(null);
  };

  // Google Picker Handler
  const handleOpenGooglePicker = async (viewType: 'all' | 'sheets' | 'docs' = 'all') => {
    if (!token) {
      alert('Silakan hubungkan akun Google Workspace terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      await openGooglePicker(
        token,
        (file) => {
          setPickedFile(file);
          setSyncStatus({
            success: true,
            message: `Berkas "${file.name}" berhasil dipilih melalui Google Picker!`,
            link: file.url,
          });
        },
        viewType
      );
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: err.message || 'Gagal membuka Google Picker',
      });
    } finally {
      setLoading(false);
    }
  };

  // 1. Export to Google Sheets
  const handleExportSheets = async () => {
    if (!token) {
      alert('Silakan hubungkan akun Google Workspace terlebih dahulu.');
      return;
    }

    setLoading(true);
    const header = [
      'ID Presensi',
      'Tanggal',
      'Waktu (WIB)',
      'Tipe',
      'Nama Siswa / Guru',
      'Identitas (NISN/NIP)',
      'Kelas / Jabatan',
      'Status Kehadiran',
      'Metode',
      'Catatan',
    ];

    const rows = records.map((r) => [
      r.id,
      r.date,
      r.time,
      r.type.toUpperCase(),
      r.personName,
      r.identifier,
      r.classOrSubject,
      r.status.toUpperCase(),
      r.method,
      r.note || '-',
    ]);

    const title = `Rekap Presensi ${config.schoolName} - ${new Date().toISOString().split('T')[0]}`;
    const result = await exportToGoogleSheet(token, title, [header, ...rows]);
    setSyncStatus(result);
    setLoading(false);
  };

  // 2. Save Report to Google Drive
  const handleSaveDrive = async () => {
    if (!token) {
      alert('Silakan hubungkan akun Google Workspace terlebih dahulu.');
      return;
    }

    setLoading(true);
    const reportText = `======================================================
LAPORAN RESMI PRESENSI & PERIZINAN GTK
${config.schoolName} (NPSN: ${config.npsn})
Tahun Ajaran: ${config.academicYear} • Semester: ${config.semester}
Dicetak: ${new Date().toLocaleString('id-ID')}
======================================================

TOTAL REKAMAN PRESENSI: ${records.length}
STATUS LAYANAN GTK RESMI:
${gtkServices
  .map(
    (g, idx) =>
      `${idx + 1}. [${g.category.toUpperCase()}] ${g.teacherName} (NIP: ${g.nip}) - Status: ${
        g.status
      } - No Surat: ${g.officialLetterNumber || 'Draft'}`
  )
  .join('\n')}

======================================================
Kepala Sekolah: ${config.principalName || 'Dr. H. Mulyadi, M.Pd.'}
Administrator: ${config.adminName || 'Siti Aminah, S.Kom.'}
`;

    const fileName = `Laporan_Presensi_${config.npsn}_${new Date().toISOString().split('T')[0]}.txt`;
    const result = await saveReportToGoogleDrive(token, fileName, reportText);
    setSyncStatus(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-indigo-600 to-sky-600 flex items-center justify-center text-white shadow-md">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg text-slate-900">
              Integrasi Google Workspace, Google Picker & Firebase
            </h2>
            <p className="text-xs text-slate-500">
              Sinkronkan data presensi ke Google Sheets, Google Drive, Google Calendar, Google Maps Platform & Google Picker
            </p>
          </div>
        </div>

        {/* Google Auth Status / Button */}
        <div>
          {googleUser ? (
            <div className="flex items-center space-x-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                {googleUser.email?.[0].toUpperCase() || 'G'}
              </div>
              <div className="text-left">
                <p className="text-xs font-extrabold text-emerald-950 truncate max-w-[150px]">
                  {googleUser.displayName || googleUser.email}
                </p>
                <span className="text-[10px] text-emerald-700 font-semibold block">
                  Workspace Terhubung
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                title="Putuskan Hubungan"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Hubungkan Google Workspace</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 ${
            syncStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {syncStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>

          {syncStatus.link && (
            <a
              href={syncStatus.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 underline text-indigo-700 hover:text-indigo-900"
            >
              <span>Buka Dokumen</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Picked File Preview */}
      {pickedFile && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-indigo-950">Berkas Terpilih (Google Picker): {pickedFile.name}</div>
              <div className="text-[11px] text-indigo-700 font-mono">MIME: {pickedFile.mimeType} • ID: {pickedFile.id}</div>
            </div>
          </div>
          {pickedFile.url && (
            <a
              href={pickedFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1"
            >
              <span>Buka di Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Service Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. GOOGLE PICKER */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Google Picker</h3>
                <p className="text-xs text-slate-500">Pilih berkas dari Google Drive secara interaktif</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Buka dialog Google Picker untuk memilih spreadsheet data siswa/guru, dokumen SK perizinan GTK, atau berkas arsip langsung dari Google Drive.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleOpenGooglePicker('all')}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Buka Google Picker (Semua Berkas)</span>
            </button>
            <button
              onClick={() => handleOpenGooglePicker('sheets')}
              disabled={loading}
              className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs border border-indigo-200 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Pilih Khusus Google Sheets</span>
            </button>
          </div>
        </div>

        {/* 2. GOOGLE SHEETS */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Google Sheets</h3>
                <p className="text-xs text-slate-500">Ekspor data presensi ke spreadsheet online</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Membuat spreadsheet baru di Google Drive Anda dengan seluruh data {records.length} log presensi siswa & guru lengkap dengan timestamp dan status.
            </p>
          </div>

          <button
            onClick={handleExportSheets}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor ke Google Sheets</span>
          </button>
        </div>

        {/* 3. GOOGLE DRIVE */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Google Drive</h3>
                <p className="text-xs text-slate-500">Simpan arsip laporan berkala & berkas izin GTK</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Mengunggah file laporan resmi presensi dan daftar Surat Tugas/Perizinan GTK yang disetujui langsung ke folder Google Drive sekolah.
            </p>
          </div>

          <button
            onClick={handleSaveDrive}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <HardDrive className="w-4 h-4" />
            <span>Simpan Laporan ke Drive</span>
          </button>
        </div>
      </div>

      {/* GOOGLE MAPS PLATFORM EMBEDDED PREVIEW */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900">Google Maps Platform Integration</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">SMPN 4 Taliabu Barat (Radius: {config.geofenceRadius || 150}m)</span>
        </div>
        <GoogleMapsAttendanceView
          records={records}
          config={config}
          height="380px"
        />
      </div>

      {/* FIREBASE FIRESTORE CLOUD STATUS */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Firebase Cloud Firestore</h3>
              <p className="text-xs text-slate-300">Project ID: gen-lang-client-0720074210 (Region: asia-southeast1)</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Database Terhubung</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px]">Koleksi Presensi:</span>
            <span className="font-extrabold text-sm text-white">{records.length} Dokumen</span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px]">Koleksi Layanan GTK:</span>
            <span className="font-extrabold text-sm text-white">{gtkServices.length} Permohonan</span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px]">Keamanan & Hak Akses:</span>
            <span className="font-extrabold text-sm text-emerald-300">Firestore Rules Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
};

