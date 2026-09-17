import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  Calendar,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Save,
  LogOut,
  Briefcase,
  GraduationCap,
  ClipboardList,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Check,
  Copy,
  FileText,
  Camera,
  Users2,
  Award,
  Eye,
  EyeOff,
  QrCode,
  School,
} from 'lucide-react';
import {
  UserRole,
  UserAccount,
  TokenSession,
  SchoolConfig,
  AttendanceRecord,
  Student,
  Teacher,
  SchoolClass,
  LeaveRequest,
  GtkServiceRequest,
  TeacherPiketDuty,
  ActiveTab,
} from '../types';
import { getUserAccountBySession, updateOwnProfile } from '../utils/auth';

interface ProfileViewProps {
  userRole: UserRole;
  tokenSession: TokenSession | null;
  config: SchoolConfig;
  records: AttendanceRecord[];
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  leaves: LeaveRequest[];
  gtkServices: GtkServiceRequest[];
  piketDuties: TeacherPiketDuty[];
  onOpenToast: (title: string, message: string, severity?: 'success' | 'info' | 'warning' | 'error') => void;
  onLogout?: () => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userRole,
  tokenSession,
  config,
  records,
  students,
  teachers,
  classes,
  leaves,
  gtkServices,
  piketDuties,
  onOpenToast,
  onLogout,
  onNavigateTab,
}) => {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // Edit Profile Form State
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Load user account details linked to current session
  useEffect(() => {
    let isMounted = true;
    async function loadAccount() {
      setIsLoadingAccount(true);
      try {
        const acc = await getUserAccountBySession(tokenSession);
        if (isMounted) {
          setAccount(acc);
          if (acc) {
            setNameInput(acc.name || '');
            setEmailInput(acc.email || '');
          }
        }
      } catch (err) {
        console.error('Gagal memuat detail akun:', err);
      } finally {
        if (isMounted) {
          setIsLoadingAccount(false);
        }
      }
    }
    loadAccount();
    return () => {
      isMounted = false;
    };
  }, [tokenSession]);

  // Handle Save Profile Information (Name & Recovery Email)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    if (!nameInput.trim()) {
      onOpenToast('Validasi Gagal', 'Nama lengkap tidak boleh kosong.', 'warning');
      return;
    }

    if (emailInput.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      onOpenToast('Validasi Gagal', 'Format email pemulihan tidak valid.', 'warning');
      return;
    }

    setIsSavingProfile(true);
    try {
      const result = await updateOwnProfile(account.id, {
        name: nameInput.trim(),
        email: emailInput.trim().toLowerCase(),
      });

      if (result.success && result.account) {
        setAccount(result.account);
        onOpenToast('Profil Diperbarui', result.message, 'success');
      } else {
        onOpenToast('Gagal Memperbarui', result.message, 'error');
      }
    } catch (err) {
      onOpenToast('Kesalahan Sistem', 'Terjadi gangguan saat menyimpan profil.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!account) return;

    if (!newPassword) {
      setPasswordError('Kata sandi baru wajib diisi.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Kata sandi baru minimal harus 4 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const result = await updateOwnProfile(account.id, {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (result.success && result.account) {
        setAccount(result.account);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onOpenToast('Kata Sandi Diperbarui', 'Kata sandi akun Anda berhasil diperbarui dengan aman.', 'success');
      } else {
        setPasswordError(result.message);
        onOpenToast('Pembaruan Ditolak', result.message, 'error');
      }
    } catch (err) {
      setPasswordError('Gagal memproses penggantian kata sandi.');
      onOpenToast('Kesalahan Sistem', 'Terjadi kesalahan sistem saat memperbarui kata sandi.', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Usage statistics calculation based on session and role
  const usageStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    if (userRole === 'siswa') {
      const iden = account?.identifier || tokenSession?.claims?.identifier;
      const personId = account?.personId;
      const myRecords = records.filter(
        (r) =>
          (iden && r.identifier === iden) ||
          (personId && r.personId === personId) ||
          (account?.name && r.personName.toLowerCase() === account.name.toLowerCase())
      );
      const hadirCount = myRecords.filter((r) => r.status === 'hadir').length;
      const sakitCount = myRecords.filter((r) => r.status === 'sakit').length;
      const izinCount = myRecords.filter((r) => r.status === 'izin').length;
      const totalRecorded = myRecords.length;
      const attendanceRate = totalRecorded > 0 ? ((hadirCount / totalRecorded) * 100).toFixed(1) : '100.0';

      const myLeaves = leaves.filter(
        (l) =>
          (iden && (l.personId === iden || l.personId === personId)) ||
          (account?.name && l.personName.toLowerCase() === account.name.toLowerCase())
      );

      const lastRecord = myRecords[0];

      return {
        roleLabel: 'Peserta Didik (Siswa)',
        primaryMetric: { label: 'Tingkat Kehadiran', value: `${attendanceRate}%`, desc: `${hadirCount} dari ${totalRecorded} pertemuan` },
        secondaryMetric: { label: 'Riwayat Sakit & Izin', value: `${sakitCount + izinCount} Kali`, desc: `${myLeaves.length} permohonan diajukan` },
        tertiaryMetric: { label: 'Presensi Terakhir', value: lastRecord ? `${lastRecord.time} WITA` : 'Belum Ada', desc: lastRecord ? lastRecord.date : '-' },
        quaternaryMetric: { label: 'Status Verifikasi', value: 'Terhubung QR', desc: `NISN: ${iden || '-'}` },
      };
    }

    if (userRole === 'guru') {
      const iden = account?.identifier || tokenSession?.claims?.identifier;
      const personId = account?.personId;
      const myTeacherObj = teachers.find(
        (t) => (iden && t.nip === iden) || (personId && t.id === personId) || (account?.name && t.name === account.name)
      );
      const myGtkRequests = gtkServices.filter(
        (g) => (iden && g.nip === iden) || (account?.name && g.teacherName.toLowerCase() === account.name.toLowerCase())
      );
      const totalRombel = classes.length;
      const isAsn = myTeacherObj?.employmentStatus === 'PNS' || myTeacherObj?.employmentStatus === 'PPPK' || myTeacherObj?.employmentStatus === 'PPPK_PW';

      return {
        roleLabel: 'Bapak / Ibu Guru GTK',
        primaryMetric: { label: 'Status Kepegawaian', value: isAsn ? 'PNS / ASN' : 'Non-ASN (GTK)', desc: `NIP: ${iden || '-'}` },
        secondaryMetric: { label: 'Rombel Tersedia', value: `${totalRombel} Kelas`, desc: 'Siap input presensi manual & QR' },
        tertiaryMetric: { label: 'Pengajuan Layanan GTK', value: `${myGtkRequests.length} Berkas`, desc: `${myGtkRequests.filter(g => g.status === 'approved').length} disetujui` },
        quaternaryMetric: { label: 'Akses Khusus', value: 'Kartu Guru GTK', desc: 'Metode Selfie GPS & Rombel' },
      };
    }

    if (userRole === 'piket') {
      const todayScans = records.filter((r) => r.date === todayStr).length;
      const pendingIzinCount = leaves.filter((l) => l.status === 'pending').length;
      const todayPikets = piketDuties.filter((d) => d.date === todayStr).length;

      return {
        roleLabel: 'Petugas Guru Piket',
        primaryMetric: { label: 'Presensi Hari Ini', value: `${todayScans} Orang`, desc: 'Diproses lewat QR & Selfie' },
        secondaryMetric: { label: 'Izin Perlu Verifikasi', value: `${pendingIzinCount} Permohonan`, desc: 'Menunggu validasi piket' },
        tertiaryMetric: { label: 'Jadwal Piket Hari Ini', value: `${todayPikets} Petugas`, desc: 'Siap piket gerbang & rombel' },
        quaternaryMetric: { label: 'Hak Operasional', value: 'QR Gate & ASN', desc: 'Verifikasi presensi sekolah' },
      };
    }

    // Role Admin
    return {
      roleLabel: 'Administrator / Proktor',
      primaryMetric: { label: 'Total Siswa Aktif', value: `${students.length} Siswa`, desc: `Dari ${classes.length} rombongan belajar` },
      secondaryMetric: { label: 'Total Guru & GTK', value: `${teachers.length} Guru`, desc: `${teachers.filter(t => t.employmentStatus === 'PNS' || t.employmentStatus === 'PPPK' || t.employmentStatus === 'PPPK_PW').length} ASN terdaftar` },
      secondaryTotalRecords: { label: 'Total Rekam Presensi', value: `${records.length} Baris`, desc: 'Tersimpan lokal & cloud' },
      primaryMetricSub: { label: 'Keamanan Sistem', value: '5 Pilar Enkripsi', desc: 'CSRF & Token HMAC Aktif' },
    };
  }, [userRole, account, tokenSession, records, students, teachers, classes, leaves, gtkServices, piketDuties]);

  // Permitted features by role matrix
  const rolePermissions = useMemo(() => {
    switch (userRole) {
      case 'siswa':
        return {
          roleName: 'Role Siswa',
          tagColor: 'bg-sky-100 text-sky-800 border-sky-200',
          allowed: [
            { name: 'Kamera Selfie & GPS Siswa', desc: 'Presensi mandiri radius sekolah', tab: 'selfie' as ActiveTab },
            { name: 'Kartu Pelajar & QR Siswa', desc: 'Melihat & mengunduh kartu siswa pribadi', tab: 'cards' as ActiveTab },
            { name: 'Pengajuan Izin / Sakit Siswa', desc: 'Mengajukan izin sakit ke sekolah', tab: 'leaves' as ActiveTab },
            { name: 'Profil & Keamanan Akun', desc: 'Informasi akun dan ubah kata sandi', tab: 'profile' as ActiveTab },
          ],
          restricted: [
            'Scanner QR Code Gerbang',
            'Absensi Guru ASN',
            'Manajemen Akun Siswa & Guru',
            'Pengaturan Sekolah & Database',
            'Cetak Kartu GTK Guru',
          ],
        };
      case 'guru':
        return {
          roleName: 'Role Guru GTK',
          tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          allowed: [
            { name: 'Kamera Selfie & GPS Guru', desc: 'Presensi mandiri guru dengan GPS radius', tab: 'selfie' as ActiveTab },
            { name: 'Absensi Kelas (Rombel)', desc: 'Input manual & scan QR siswa di kelas', tab: 'batch_class' as ActiveTab },
            { name: 'Kartu Guru GTK & QR', desc: 'Kartu identitas QR khusus GTK', tab: 'cards' as ActiveTab },
            { name: 'Layanan & Izin GTK', desc: 'Pengajuan cuti & dinas luar guru', tab: 'layanan_gtk' as ActiveTab },
            { name: 'Profil & Keamanan Akun', desc: 'Informasi akun dan ganti kata sandi', tab: 'profile' as ActiveTab },
          ],
          restricted: [
            'Scanner QR Code Gerbang (Hanya Piket)',
            'Absensi Guru ASN BKD',
            'Manajemen Master Data Siswa/Guru',
            'Pengaturan Sekolah & Cloud BKD',
          ],
        };
      case 'piket':
        return {
          roleName: 'Role Petugas Piket',
          tagColor: 'bg-amber-100 text-amber-800 border-amber-200',
          allowed: [
            { name: 'Scanner QR Code Gerbang', desc: 'Scan kedatangan siswa & GTK gerbang', tab: 'scan' as ActiveTab },
            { name: 'Absensi Kelas (Rombel)', desc: 'Monitoring & input presensi rombel', tab: 'batch_class' as ActiveTab },
            { name: 'Kamera Selfie & GPS', desc: 'Presensi selfie mandiri petugas', tab: 'selfie' as ActiveTab },
            { name: 'Jadwal Guru Piket', desc: 'Jadwal pembagian tugas piket harian', tab: 'piket' as ActiveTab },
            { name: 'Absensi Guru ASN', desc: 'Pencatatan tanda tangan kehadiran ASN', tab: 'asn_attendance_table' as ActiveTab },
            { name: 'Layanan & Izin GTK', desc: 'Verifikasi surat tugas / izin dinas GTK', tab: 'layanan_gtk' as ActiveTab },
            { name: 'Izin & Sakit Siswa', desc: 'Disposisi surat sakit & permohonan siswa', tab: 'leaves' as ActiveTab },
            { name: 'Profil & Keamanan Akun', desc: 'Informasi akun dan ubah kata sandi', tab: 'profile' as ActiveTab },
          ],
          restricted: [
            'Manajemen Akun Pengguna (Admin Only)',
            'Pengaturan Inti Sekolah & SIMPEG BKD',
            'Pusat Audit Keamanan Sistem',
          ],
        };
      case 'admin':
      default:
        return {
          roleName: 'Role Administrator',
          tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          allowed: [
            { name: 'Dashboard Ringkasan & Grafik', desc: 'Statistik eksekutif kehadiran sekolah', tab: 'dashboard' as ActiveTab },
            { name: 'Manajemen Akun Guru, Piket & Siswa', desc: 'Pembuatan & reset kredensial semua pengguna', tab: 'accounts' as ActiveTab },
            { name: 'Master Data Siswa, Guru & Rombel', desc: 'Kelola seluruh direktori data sekolah', tab: 'students' as ActiveTab },
            { name: 'Cetak Kartu Siswa & Guru GTK', desc: 'Generator kartu identitas barcode & QR', tab: 'cards' as ActiveTab },
            { name: 'Pengaturan Sekolah & Cloud BKD', desc: 'Konfigurasi radius GPS, jam, dan integrasi', tab: 'config' as ActiveTab },
            { name: 'Pusat Keamanan & Audit Sistem', desc: 'Pengawasan 5 pilar integritas data', tab: 'security_center' as ActiveTab },
            { name: 'Profil & Pengaturan Admin', desc: 'Kelola kredensial akun administrator', tab: 'profile' as ActiveTab },
          ],
          restricted: [],
        };
    }
  }, [userRole]);

  const tokenSessionData = useMemo(() => {
    if (!tokenSession) {
      return {
        id: 'SESI-LOKAL-AKTIF',
        issuedAt: new Date().toLocaleString('id-ID'),
        expiresAt: '24 Jam sejak login',
        alg: 'HMAC-SHA256 (Web Crypto API)',
      };
    }
    const iatDate = tokenSession.claims?.iat
      ? new Date(tokenSession.claims.iat * 1000).toLocaleString('id-ID')
      : 'Sesi Aktif';
    const expDate = tokenSession.claims?.exp
      ? new Date(tokenSession.claims.exp * 1000).toLocaleString('id-ID')
      : '24 Jam sejak login';

    return {
      id: tokenSession.claims?.sub || tokenSession.token.substring(0, 18) + '...',
      issuedAt: iatDate,
      expiresAt: expDate,
      alg: 'HMAC-SHA256 (Bearer Token)',
    };
  }, [tokenSession]);

  const handleCopyToken = () => {
    if (tokenSession?.token) {
      navigator.clipboard.writeText(tokenSession.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
      onOpenToast('Tersalin', 'Token sesi kriptografis telah disalin ke papan klip.', 'info');
    }
  };

  return (
    <div className="space-y-6 pb-12" id="profile-view-container">
      {/* 1. Header Profile Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-sm border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar glyph based on role */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 p-0.5 shadow-lg shrink-0 flex items-center justify-center">
              <div className="w-full h-full rounded-2xl bg-slate-900/60 backdrop-blur-xs flex items-center justify-center text-white">
                {userRole === 'admin' ? (
                  <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
                ) : userRole === 'guru' ? (
                  <Briefcase className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                ) : userRole === 'piket' ? (
                  <ClipboardList className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
                ) : (
                  <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-sky-400" />
                )}
              </div>
            </div>

            {/* Account Display Details */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {account?.name || (userRole === 'admin' ? config.adminName || 'Administrator' : 'Pengguna Sekolah')}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  userRole === 'admin'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
                    : userRole === 'guru'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : userRole === 'piket'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                }`}>
                  {userRole}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  @{account?.username || userRole}
                </span>
                {account?.identifier && (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="font-semibold text-indigo-300">
                      {userRole === 'guru' ? 'NIP' : userRole === 'siswa' ? 'NISN' : 'ID'}:
                    </span>
                    {account.identifier}
                  </span>
                )}
                {account?.classOrSubject && (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <School className="w-3.5 h-3.5 text-indigo-300" />
                    {account.classOrSubject}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Sesi Aktif
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer hover:shadow-rose-600/20"
                id="profile-logout-button"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Akun</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Usage Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">{usageStats.primaryMetric.label}</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{usageStats.primaryMetric.value}</p>
          <p className="text-xs text-slate-500 truncate">{usageStats.primaryMetric.desc}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">{usageStats.secondaryMetric.label}</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{usageStats.secondaryMetric.value}</p>
          <p className="text-xs text-slate-500 truncate">{usageStats.secondaryMetric.desc}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {userRole === 'admin' && 'secondaryTotalRecords' in usageStats
                ? usageStats.secondaryTotalRecords.label
                : 'tertiaryMetric' in usageStats
                ? usageStats.tertiaryMetric.label
                : 'Aktivitas'}
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {userRole === 'admin' && 'secondaryTotalRecords' in usageStats
              ? usageStats.secondaryTotalRecords.value
              : 'tertiaryMetric' in usageStats
              ? usageStats.tertiaryMetric.value
              : '-'}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {userRole === 'admin' && 'secondaryTotalRecords' in usageStats
              ? usageStats.secondaryTotalRecords.desc
              : 'tertiaryMetric' in usageStats
              ? usageStats.tertiaryMetric.desc
              : '-'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {userRole === 'admin' && 'primaryMetricSub' in usageStats
                ? usageStats.primaryMetricSub.label
                : 'quaternaryMetric' in usageStats
                ? usageStats.quaternaryMetric.label
                : 'Keamanan'}
            </span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {userRole === 'admin' && 'primaryMetricSub' in usageStats
              ? usageStats.primaryMetricSub.value
              : 'quaternaryMetric' in usageStats
              ? usageStats.quaternaryMetric.value
              : 'Aktif'}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {userRole === 'admin' && 'primaryMetricSub' in usageStats
              ? usageStats.primaryMetricSub.desc
              : 'quaternaryMetric' in usageStats
              ? usageStats.quaternaryMetric.desc
              : 'Terverifikasi'}
          </p>
        </div>
      </div>

      {/* 3. Role-Based Access Control (RBAC) Strict Boundaries Info */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              Perlindungan Hak Akses Berbasis Peran (RBAC)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap pengguna hanya dapat mengakses menu dan fitur khusus yang diizinkan untuk perannya.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 w-fit ${rolePermissions.tagColor}`}>
            <Lock className="w-3 h-3" />
            {rolePermissions.roleName} Terkunci
          </span>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-slate-900">Kebijakan Privasi & Pembatasan Fitur Sekolah:</p>
          <p className="text-slate-600 leading-relaxed">
            Anda masuk ke dalam aplikasi menggunakan akun resmi terdaftar dengan peran <strong className="text-indigo-700 capitalize">{userRole}</strong>.
            Sistem secara otomatis mengisolasi sesi Anda sehingga tidak dapat membuka atau memodifikasi modul peran lain demi integritas data presensi sekolah.
          </p>
        </div>

        {/* Allowed Features vs Restricted Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Allowed features */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Fitur Yang Diizinkan Untuk Akun Anda:
            </h3>
            <div className="space-y-1.5">
              {rolePermissions.allowed.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[11px] text-slate-500">{item.desc}</p>
                  </div>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab(item.tab)}
                      className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      Buka Menu
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Restricted features */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-rose-600" />
              Menu Terkunci (Khusus Peran Lain):
            </h3>
            {rolePermissions.restricted.length > 0 ? (
              <div className="space-y-1.5">
                {rolePermissions.restricted.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-500 opacity-75"
                  >
                    <span className="font-medium">{item}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                      Terkunci
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 font-medium">
                Sebagai Administrator, Anda memiliki otorisasi penuh untuk mengelola semua menu dan konfigurasi sistem.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Edit Profile Information & Change Password Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Ubah Profil (Nama & Email Pemulihan) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Informasi Akun Pribadi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbarui nama tampilan dan email pemulihan terdaftar untuk fitur Lupa Kata Sandi.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Pengguna (Username)
              </label>
              <input
                type="text"
                disabled
                value={account?.username || userRole}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed font-mono"
              />
              <p className="text-[10.5px] text-slate-400 mt-1">
                Username ditetapkan oleh Administrator dan tidak dapat diubah sendiri.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap / Tampilan
              </label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Masukkan nama lengkap Anda..."
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Pemulihan Terdaftar (Untuk Lupa Sandi)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="contoh: nama@sekolah.sch.id"
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1">
                Email ini digunakan untuk menerima kode OTP 6-digit saat Anda menggunakan fitur "Lupa Kata Sandi".
              </p>
            </div>

            {account?.identifier && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Identitas ({userRole === 'guru' ? 'NIP' : 'NISN'})
                </label>
                <input
                  type="text"
                  disabled
                  value={account.identifier}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed font-mono"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                id="save-profile-btn"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingProfile ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Profil'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Form Ubah Kata Sandi Akun */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              Keamanan & Ubah Kata Sandi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ganti kata sandi secara berkala untuk menjaga kerahasiaan akun presensi Anda.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi Saat Ini (Lama)
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama Anda..."
                  className="w-full pl-3.5 pr-10 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 4 karakter/angka..."
                  className="w-full pl-3.5 pr-10 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ulangi Kata Sandi Baru
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru..."
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                id="update-password-btn"
              >
                <Key className="w-4 h-4" />
                <span>{isSavingPassword ? 'Memverifikasi...' : 'Perbarui Kata Sandi'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 5. Session & Token Technical Cryptographic Guard */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Sesi & Kriptografi Keamanan Aktif
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Parameter sesi terenkripsi yang melindungi aktivitas login Anda saat ini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tokenSession?.token && (
              <button
                type="button"
                onClick={handleCopyToken}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Salin Token Sesi"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken ? 'Tersalin' : 'Salin Token'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Subjek / ID Sesi</span>
            <p className="font-mono font-bold text-slate-900 truncate" title={tokenSessionData.id}>
              {tokenSessionData.id}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Algoritma Sesi</span>
            <p className="font-semibold text-slate-900">{tokenSessionData.alg}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Waktu Login Terbit</span>
            <p className="font-semibold text-slate-900">{tokenSessionData.issuedAt}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kedaluwarsa Sesi</span>
            <p className="font-semibold text-slate-900">{tokenSessionData.expiresAt}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
