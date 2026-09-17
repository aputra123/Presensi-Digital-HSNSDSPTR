import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Briefcase,
  ClipboardList,
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  User,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  School,
  Sparkles,
  ArrowRight,
  Shield,
  Key,
  Mail,
  Check,
  X,
  HelpCircle,
  Send,
} from 'lucide-react';
import { UserRole, TokenSession, SchoolConfig, Student } from '../types';
import {
  verifyAdminLogin,
  verifyRoleCredentials,
  verifyAccountLogin,
  updateAdminAccountPassword,
  createTokenSession,
  requestPasswordReset,
  verifyResetCode,
  resetPasswordWithCode,
} from '../utils/auth';
import { authRateLimiter } from '../utils/rateLimiter';

interface LoginPageProps {
  config: SchoolConfig;
  students?: Student[];
  onLoginSuccess: (session: TokenSession, role: UserRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  config,
  students = [],
  onLoginSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');

  // Form states - Username & Password per role
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');

  const [guruUsername, setGuruUsername] = useState('guru');
  const [guruPassword, setGuruPassword] = useState('guru123');

  const [piketUsername, setPiketUsername] = useState('piket');
  const [piketPassword, setPiketPassword] = useState('piket123');

  const [siswaUsername, setSiswaUsername] = useState('siswa');
  const [siswaPassword, setSiswaPassword] = useState('siswa123');
  const [siswaNisn, setSiswaNisn] = useState('');

  // Password visibility toggles (Eye / EyeOff)
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showGuruPassword, setShowGuruPassword] = useState(false);
  const [showPiketPassword, setShowPiketPassword] = useState(false);
  const [showSiswaPassword, setShowSiswaPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password / Reset Kata Sandi States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotDevCode, setForgotDevCode] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);

  // States for forced password change on newly added admin accounts
  const [mustChangePasswordState, setMustChangePasswordState] = useState<{
    required: boolean;
    username: string;
    accountId?: string;
  } | null>(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  // Status & validation states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Cek rate limiter saat peran berganti
  useEffect(() => {
    setErrorMessage(null);
    const status = authRateLimiter.check(selectedRole);
    if (!status.allowed) {
      setLockoutSeconds(status.retryAfterSeconds);
      setErrorMessage(status.message || 'Akses terkunci sementara karena banyak percobaan gagal.');
    } else {
      setLockoutSeconds(0);
    }
  }, [selectedRole]);

  // Countdown timer untuk rate limiting
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Submit Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      let username = '';
      let password = '';

      if (selectedRole === 'admin') {
        username = adminUsername.trim();
        password = adminPassword;
      } else if (selectedRole === 'guru') {
        username = guruUsername.trim();
        password = guruPassword;
      } else if (selectedRole === 'piket') {
        username = piketUsername.trim();
        password = piketPassword;
      } else if (selectedRole === 'siswa') {
        username = siswaUsername.trim();
        password = siswaPassword;
      }

      if (!username) {
        setErrorMessage('Silakan masukkan nama pengguna (username / NIP / NISN).');
        setIsLoading(false);
        return;
      }

      if (!password) {
        setErrorMessage('Silakan masukkan kata sandi.');
        setIsLoading(false);
        return;
      }

      const result = await verifyAccountLogin(username, password, selectedRole);
      if (!result.success) {
        setErrorMessage(result.message);
        const status = authRateLimiter.check(selectedRole);
        if (!status.allowed) setLockoutSeconds(status.retryAfterSeconds);
        setIsLoading(false);
        return;
      }

      // Cek jika akun ini wajib mengubah kata sandi terlebih dahulu (misal admin baru)
      if (result.mustChangePassword && result.account) {
        setMustChangePasswordState({
          required: true,
          username: result.account.username,
          accountId: result.account.id,
        });
        setIsLoading(false);
        return;
      }

      if (result.session) {
        onLoginSuccess(result.session, selectedRole);
      }
    } catch (err: any) {
      setErrorMessage('Terjadi kesalahan saat memproses login: ' + (err?.message || 'Error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handler untuk penyelesaian kewajiban ubah password admin baru
  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);

    if (newAdminPassword.length < 6) {
      setChangePasswordError('Kata sandi baru minimal 6 karakter/angka.');
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setChangePasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);
    try {
      const usernameOrId = mustChangePasswordState?.username || 'admin';
      const updateResult = await updateAdminAccountPassword(
        usernameOrId,
        adminPassword,
        newAdminPassword
      );

      if (!updateResult.success) {
        setChangePasswordError(updateResult.message);
        setIsLoading(false);
        return;
      }

      // Berhasil diubah, otomatis terbitkan sesi login admin
      const session = await createTokenSession('admin', `Admin (${usernameOrId})`);
      onLoginSuccess(session, 'admin');
    } catch (err: any) {
      setChangePasswordError('Gagal memperbarui kata sandi: ' + (err?.message || 'Error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Handlers
  const handleOpenForgotModal = (prefillUsername?: string) => {
    setIsForgotModalOpen(true);
    setForgotStep(1);
    setForgotError(null);
    setForgotSuccessMessage(null);
    setForgotOtpCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    if (prefillUsername) {
      setForgotInput(prefillUsername);
    } else {
      if (selectedRole === 'admin') setForgotInput(adminUsername);
      else if (selectedRole === 'guru') setForgotInput(guruUsername);
      else if (selectedRole === 'piket') setForgotInput(piketUsername);
      else if (selectedRole === 'siswa') setForgotInput(siswaUsername || siswaNisn);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await requestPasswordReset(forgotInput);
      if (!res.success) {
        setForgotError(res.message);
        setForgotLoading(false);
        return;
      }
      setForgotResetToken(res.resetToken || '');
      setForgotMaskedEmail(res.maskedEmail || '');
      setForgotDevCode(res.devCode || '');
      setForgotStep(2);
    } catch (err: any) {
      setForgotError('Gagal memproses pemulihan kata sandi: ' + (err?.message || 'Error'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const cleanCode = forgotOtpCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setForgotError('Harap masukkan 6 digit kode verifikasi.');
      return;
    }

    const res = verifyResetCode(forgotResetToken, cleanCode);
    if (!res.success) {
      setForgotError(res.message);
      return;
    }

    setForgotStep(3);
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (forgotNewPassword.length < 4) {
      setForgotError('Kata sandi baru minimal harus 4 karakter.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await resetPasswordWithCode(forgotResetToken, forgotOtpCode, forgotNewPassword);
      if (!res.success) {
        setForgotError(res.message);
        setForgotLoading(false);
        return;
      }

      setForgotSuccessMessage(res.message);

      // Auto update state form login
      if (selectedRole === 'admin') setAdminPassword(forgotNewPassword);
      else if (selectedRole === 'guru') setGuruPassword(forgotNewPassword);
      else if (selectedRole === 'piket') setPiketPassword(forgotNewPassword);
      else if (selectedRole === 'siswa') setSiswaPassword(forgotNewPassword);

      setTimeout(() => {
        setIsForgotModalOpen(false);
        setForgotStep(1);
        setForgotSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      setForgotError('Gagal menyimpan kata sandi baru: ' + (err?.message || 'Error'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Decorative Lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 backdrop-blur-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide">
              {config.schoolName || 'Sistem Presensi Sekolah Digital'}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Portal Akses Terintegrasi & Multi-Peran
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/60">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Keamanan Sesi SHA-256 Aktif</span>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-4">
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative">
          {/* Card Top Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Autentikasi Presensi Digital</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Selamat Datang Kembali
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Silakan pilih peran Anda untuk masuk ke sistem presensi
            </p>
          </div>

          {/* Dialog Wajib Ganti Password Jika Akun Admin Baru Terdeteksi */}
          {mustChangePasswordState?.required ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3">
                <Key className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">
                    Wajib Perbarui Kata Sandi
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    Sistem mewajibkan akun admin baru (<strong>{mustChangePasswordState.username}</strong>) untuk menetapkan kata sandi baru pribadi sebelum melanjutkan.
                  </p>
                </div>
              </div>

              {changePasswordError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{changePasswordError}</span>
                </div>
              )}

              <form onSubmit={handleForceChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kata Sandi Baru:
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="Minimal 6 karakter..."
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Konfirmasi Kata Sandi Baru:
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru..."
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMustChangePasswordState(null)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Simpan & Lanjutkan</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Dynamic 4-Role Navigation Selector */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-800/60 rounded-2xl border border-slate-700/60 mb-6">
                <button
                  type="button"
                  id="role-btn-admin"
                  onClick={() => {
                    setSelectedRole('admin');
                    setErrorMessage(null);
                  }}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 mb-1" />
                  <span className="truncate">Admin</span>
                </button>

                <button
                  type="button"
                  id="role-btn-guru"
                  onClick={() => {
                    setSelectedRole('guru');
                    setErrorMessage(null);
                  }}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    selectedRole === 'guru'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                  }`}
                >
                  <Briefcase className="w-4 h-4 mb-1" />
                  <span className="truncate">Guru</span>
                </button>

                <button
                  type="button"
                  id="role-btn-piket"
                  onClick={() => {
                    setSelectedRole('piket');
                    setErrorMessage(null);
                  }}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    selectedRole === 'piket'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                  }`}
                >
                  <ClipboardList className="w-4 h-4 mb-1" />
                  <span className="truncate">Piket</span>
                </button>

                <button
                  type="button"
                  id="role-btn-siswa"
                  onClick={() => {
                    setSelectedRole('siswa');
                    setErrorMessage(null);
                  }}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    selectedRole === 'siswa'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 mb-1" />
                  <span className="truncate">Siswa</span>
                </button>
              </div>

              {/* Error / Rate Limiting Alert */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2 text-xs text-rose-300 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{errorMessage}</p>
                    {lockoutSeconds > 0 && (
                      <p className="text-[11px] text-rose-400 mt-1 font-mono font-bold">
                        Akses terkunci: {lockoutSeconds} detik
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Form Sesuai Peran */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* 1. ADMIN FORM */}
                {selectedRole === 'admin' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username / Email Admin:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          placeholder="admin"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Kata Sandi Admin:
                        </label>
                        <span className="text-[10px] text-indigo-400 font-mono">
                          Default: admin123
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Masukkan kata sandi..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                        />
                        {/* Eye / EyeOff Icon Toggle */}
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                          title={showAdminPassword ? 'Sembunyikan password' : 'Lihat password'}
                        >
                          {showAdminPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Quick credential filler helper & Forgot Password */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminUsername('admin');
                          setAdminPassword('admin123');
                        }}
                        className="text-[10px] text-slate-400 hover:text-indigo-300 transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <KeyRound className="w-3 h-3 text-indigo-400" />
                        <span>Kredensial Default (admin / admin123)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenForgotModal(adminUsername)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>
                  </>
                )}

                {/* 2. GURU & KEPALA SEKOLAH FORM */}
                {selectedRole === 'guru' && (
                  <>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] text-emerald-300 space-y-1">
                      <div>
                        Masuk sebagai <strong>Dewan Guru, GTK, atau Kepala Sekolah</strong> menggunakan akun terdaftar.
                      </div>
                      <div className="text-[10px] text-emerald-400 font-medium">
                        ⚖️ <em>Persetujuan, pengembalian berkas, dan penolakan izin GTK hanya berwenang dilakukan melalui <strong>Akun Kepala Sekolah</strong> (username: kepsek) atau <strong>Akun Admin</strong> (username: admin).</em>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username / NIP Guru / Kepala Sekolah:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={guruUsername}
                          onChange={(e) => setGuruUsername(e.target.value)}
                          placeholder="kepsek / guru / guru.hasbullah / 197305141999031004"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Kata Sandi:
                        </label>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          Default: guru123
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showGuruPassword ? 'text' : 'password'}
                          required
                          value={guruPassword}
                          onChange={(e) => setGuruPassword(e.target.value)}
                          placeholder="Masukkan kata sandi..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        {/* Eye / EyeOff Icon Toggle */}
                        <button
                          type="button"
                          onClick={() => setShowGuruPassword(!showGuruPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                          title={showGuruPassword ? 'Sembunyikan password' : 'Lihat password'}
                        >
                          {showGuruPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">Pilih:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setGuruUsername('kepsek');
                            setGuruPassword('guru123');
                          }}
                          className="text-[10px] text-amber-300 font-bold hover:text-amber-200 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded cursor-pointer flex items-center space-x-1"
                          title="Masuk sebagai Kepala Sekolah (Drs. La Ode Muhammad Syafei, M.Pd.)"
                        >
                          <span>👑 kepsek (Kepala Sekolah)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGuruUsername('guru');
                            setGuruPassword('guru123');
                          }}
                          className="text-[10px] text-slate-400 hover:text-emerald-300 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                        >
                          guru
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGuruUsername('guru.hasbullah');
                            setGuruPassword('guru123');
                          }}
                          className="text-[10px] text-slate-400 hover:text-emerald-300 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                        >
                          guru.hasbullah
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenForgotModal(guruUsername)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>
                  </>
                )}

                {/* 3. PIKET FORM */}
                {selectedRole === 'piket' && (
                  <>
                    <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-[11px] text-sky-300">
                      Masuk sebagai <strong>Petugas Guru Piket</strong> untuk memindai QR Code gerbang, input izin siswa, dan rekap piket harian.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username / NIP Petugas Piket:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={piketUsername}
                          onChange={(e) => setPiketUsername(e.target.value)}
                          placeholder="piket / piket.ahmad"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Kata Sandi / PIN Piket:
                        </label>
                        <span className="text-[10px] text-sky-400 font-mono">
                          Default: piket123
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPiketPassword ? 'text' : 'password'}
                          required
                          value={piketPassword}
                          onChange={(e) => setPiketPassword(e.target.value)}
                          placeholder="Masukkan PIN piket..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                        />
                        {/* Eye / EyeOff Icon Toggle */}
                        <button
                          type="button"
                          onClick={() => setShowPiketPassword(!showPiketPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                          title={showPiketPassword ? 'Sembunyikan password' : 'Lihat password'}
                        >
                          {showPiketPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">Pilih:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPiketUsername('piket');
                            setPiketPassword('piket123');
                          }}
                          className="text-[10px] text-slate-400 hover:text-sky-300 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                        >
                          piket
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPiketUsername('piket.ahmad');
                            setPiketPassword('piket123');
                          }}
                          className="text-[10px] text-slate-400 hover:text-sky-300 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                        >
                          piket.ahmad
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenForgotModal(piketUsername)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>
                  </>
                )}

                {/* 4. SISWA FORM */}
                {selectedRole === 'siswa' && (
                  <>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300">
                      Portal <strong>Peserta Didik (Siswa)</strong>. Masuk menggunakan akun terdaftar yang dibuat oleh Administrator dengan Username atau NISN.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username / NISN Siswa:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={siswaUsername}
                          onChange={(e) => {
                            setSiswaUsername(e.target.value);
                            setSiswaNisn(e.target.value);
                          }}
                          placeholder="siswa / 0081234567"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Kata Sandi Siswa:
                        </label>
                        <span className="text-[10px] text-amber-400 font-mono">
                          Default: siswa123
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showSiswaPassword ? 'text' : 'password'}
                          required
                          value={siswaPassword}
                          onChange={(e) => setSiswaPassword(e.target.value)}
                          placeholder="Masukkan kata sandi..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        {/* Eye / EyeOff Icon Toggle */}
                        <button
                          type="button"
                          onClick={() => setShowSiswaPassword(!showSiswaPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                          title={showSiswaPassword ? 'Sembunyikan password' : 'Lihat password'}
                        >
                          {showSiswaPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSiswaUsername('siswa');
                          setSiswaPassword('siswa123');
                          setSiswaNisn('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-amber-300 transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <KeyRound className="w-3 h-3 text-amber-400" />
                        <span>Default (siswa / siswa123)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenForgotModal(siswaUsername)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>

                    {students.length > 0 && (
                      <div className="pt-2 border-t border-slate-700/60 mt-1">
                        <span className="text-[10px] text-slate-400 block mb-1">
                          Atau masuk cepat dengan akun siswa sekolah:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {students.slice(0, 3).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSiswaUsername(s.nisn);
                                setSiswaNisn(s.nisn);
                                setSiswaPassword('siswa123');
                              }}
                              className="text-[10px] bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 cursor-pointer"
                            >
                              {s.name} ({s.nisn})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  id="submit-login-btn"
                  disabled={isLoading || lockoutSeconds > 0}
                  className={`w-full py-3 rounded-2xl text-xs font-bold text-white transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg cursor-pointer disabled:opacity-50 ${
                    selectedRole === 'admin'
                      ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                      : selectedRole === 'guru'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : selectedRole === 'piket'
                      ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                  }`}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        Login sebagai{' '}
                        {selectedRole === 'admin'
                          ? 'Administrator'
                          : selectedRole === 'guru'
                          ? 'Guru'
                          : selectedRole === 'piket'
                          ? 'Petugas Piket'
                          : 'Siswa'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* FORGOT PASSWORD MODAL */}
        {isForgotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Pemulihan Kata Sandi</h3>
                    <p className="text-[11px] text-slate-400">Verifikasi email terdaftar akun sekolah</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Step indicator */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-[11px]">
                  <span className={`font-semibold ${forgotStep === 1 ? 'text-indigo-400' : 'text-slate-500'}`}>
                    1. Identitas Akun
                  </span>
                  <span className="text-slate-600">→</span>
                  <span className={`font-semibold ${forgotStep === 2 ? 'text-indigo-400' : 'text-slate-500'}`}>
                    2. Verifikasi 6-Digit
                  </span>
                  <span className="text-slate-600">→</span>
                  <span className={`font-semibold ${forgotStep === 3 ? 'text-indigo-400' : 'text-slate-500'}`}>
                    3. Sandi Baru
                  </span>
                </div>

                {forgotError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                {forgotSuccessMessage && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{forgotSuccessMessage}</span>
                  </div>
                )}

                {/* STEP 1: Masukkan Identitas Akun */}
                {forgotStep === 1 && (
                  <form onSubmit={handleRequestReset} className="space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Masukkan <strong>Email terdaftar</strong>, <strong>Username</strong>, <strong>NIP</strong>, atau <strong>NISN</strong> akun Anda. Sistem akan mengirimkan kode verifikasi 6-digit untuk keamanan.
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Username, Email, NIP, atau NISN:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={forgotInput}
                          onChange={(e) => setForgotInput(e.target.value)}
                          placeholder="contoh: guru / guru@guru.sekolah.sch.id"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsForgotModalOpen(false)}
                        className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {forgotLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Lanjut Kirim Kode</span>
                            <Send className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: Verifikasi Kode OTP 6-Digit */}
                {forgotStep === 2 && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                      Kode verifikasi telah dikirim ke: <strong className="text-white">{forgotMaskedEmail}</strong>.
                      Masa berlaku 10 menit.
                    </div>

                    {forgotDevCode && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Simulasi Kode Verifikasi (Offline Server):</span>
                          <span className="font-mono text-base font-bold tracking-widest text-amber-300">
                            {forgotDevCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForgotOtpCode(forgotDevCode)}
                          className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2 py-1 rounded cursor-pointer font-semibold"
                        >
                          Salin Otomatis
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Masukkan 6-Digit Kode Verifikasi:
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={forgotOtpCode}
                        onChange={(e) => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full py-2.5 text-center tracking-[0.4em] font-mono text-base font-bold bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setForgotStep(1)}
                        className="text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        ← Ganti Email / Akun
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verifikasi Kode</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 3: Masukkan Password Baru */}
                {forgotStep === 3 && (
                  <form onSubmit={handleCompleteReset} className="space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Verifikasi identitas berhasil! Buat kata sandi baru untuk akun Anda (minimal 4 karakter).
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Kata Sandi Baru:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showForgotNewPassword ? 'text' : 'password'}
                          required
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="Minimal 4 karakter..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Ulangi Kata Sandi Baru:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showForgotConfirmPassword ? 'text' : 'password'}
                          required
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="Ketik ulang kata sandi baru..."
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsForgotModalOpen(false)}
                        className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {forgotLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Simpan Kata Sandi Baru</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Assurances */}
      <footer className="p-4 text-center border-t border-slate-800/80 text-[11px] text-slate-500 z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <span>© {new Date().getFullYear()} Presensi Sekolah Digital • Versi 2.5</span>
        <span className="hidden sm:inline">•</span>
        <span>Proteksi Rate Limiting Token Bucket & Enkripsi Web Crypto API</span>
      </footer>
    </div>
  );
};
