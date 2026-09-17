import React, { useState, useEffect } from 'react';
import {
  Key,
  Users,
  Briefcase,
  GraduationCap,
  ClipboardList,
  ShieldCheck,
  Plus,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX,
  Sparkles,
  Download,
  Printer,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { UserRole, UserAccount, Teacher, Student } from '../types';
import {
  getUserAccounts,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  bulkGeneratePersonnelAccounts,
} from '../utils/auth';

interface UserAccountsTabProps {
  teachers: Teacher[];
  students: Student[];
  onOpenToast?: (title: string, message: string) => void;
}

export const UserAccountsTab: React.FC<UserAccountsTabProps> = ({
  teachers = [],
  students = [],
  onOpenToast = () => {},
}) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | UserRole>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [resettingPasswordAccount, setResettingPasswordAccount] = useState<UserAccount | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isPrintSlipModalOpen, setIsPrintSlipModalOpen] = useState(false);

  // Form States for Create
  const [formRole, setFormRole] = useState<UserRole>('guru');
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIdentifier, setFormIdentifier] = useState('');
  const [formClassOrSubject, setFormClassOrSubject] = useState('');
  const [formSelectedPersonId, setFormSelectedPersonId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States for Reset Password
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Quick Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk generation state
  const [bulkRole, setBulkRole] = useState<'guru' | 'siswa'>('guru');
  const [bulkDefaultPassword, setBulkDefaultPassword] = useState('guru123');
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const data = await getUserAccounts();
      setAccounts(data);
    } catch (e) {
      console.error('Error loading user accounts:', e);
      onOpenToast('Gagal Memuat Akun', 'Tidak dapat memuat daftar akun pengguna.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // When formSelectedPersonId changes, auto-fill name & identifier & class/subject
  const handleSelectPerson = (personId: string) => {
    setFormSelectedPersonId(personId);
    if (!personId) return;

    if (formRole === 'guru' || formRole === 'piket') {
      const teacher = teachers.find((t) => t.id === personId);
      if (teacher) {
        setFormName(teacher.name);
        setFormIdentifier(teacher.nip || teacher.nuptk || '');
        setFormClassOrSubject(teacher.subject || '');
        if (!formUsername) {
          const clean = teacher.nip && teacher.nip.length >= 4
            ? teacher.nip.trim()
            : `guru.${teacher.name.split(' ')[0].toLowerCase()}`;
          setFormUsername(clean.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
        }
      }
    } else if (formRole === 'siswa') {
      const student = students.find((s) => s.id === personId);
      if (student) {
        setFormName(student.name);
        setFormIdentifier(student.nisn || '');
        setFormClassOrSubject(student.className || '');
        if (!formUsername) {
          const clean = student.nisn && student.nisn.length >= 4
            ? student.nisn.trim()
            : `siswa.${student.name.split(' ')[0].toLowerCase()}`;
          setFormUsername(clean.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
        }
      }
    }
  };

  // Switch role inside create modal
  const handleRoleChange = (role: UserRole) => {
    setFormRole(role);
    setFormSelectedPersonId('');
    if (role === 'guru') {
      setFormPassword('guru123');
    } else if (role === 'piket') {
      setFormPassword('piket123');
    } else if (role === 'siswa') {
      setFormPassword('siswa123');
    } else {
      setFormPassword('admin123');
    }
  };

  const handleOpenCreateModal = () => {
    setFormRole('guru');
    setFormUsername('');
    setFormName('');
    setFormPassword('guru123');
    setFormIdentifier('');
    setFormClassOrSubject('');
    setFormSelectedPersonId('');
    setFormIsActive(true);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUsername.trim()) {
      setFormError('Nama pengguna (username) wajib diisi.');
      return;
    }

    if (formPassword.length < 4) {
      setFormError('Kata sandi minimal 4 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createUserAccount({
        username: formUsername,
        password: formPassword,
        name: formName || formUsername,
        role: formRole,
        identifier: formIdentifier,
        classOrSubject: formClassOrSubject,
        personId: formSelectedPersonId || undefined,
        isActive: formIsActive,
      });

      if (!res.success) {
        setFormError(res.message);
        setIsSubmitting(false);
        return;
      }

      onOpenToast('Akun Berhasil Dibuat', res.message);
      setIsCreateModalOpen(false);
      await loadAccounts();
    } catch (err: any) {
      setFormError('Terjadi kesalahan: ' + (err?.message || 'Gagal menyimpan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsSubmitting(true);
    try {
      const res = await updateUserAccount(editingAccount.id, {
        username: editingAccount.username,
        name: editingAccount.name,
        role: editingAccount.role,
        identifier: editingAccount.identifier,
        classOrSubject: editingAccount.classOrSubject,
        isActive: editingAccount.isActive,
      });

      if (!res.success) {
        onOpenToast('Gagal Memperbarui', res.message);
        setIsSubmitting(false);
        return;
      }

      onOpenToast('Akun Diperbarui', res.message);
      setEditingAccount(null);
      await loadAccounts();
    } catch (err: any) {
      onOpenToast('Error', err?.message || 'Gagal memperbarui akun');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingPasswordAccount) return;

    if (newPasswordInput.length < 4) {
      onOpenToast('Kata Sandi Terlalu Pendek', 'Kata sandi minimal 4 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateUserAccount(resettingPasswordAccount.id, {
        newPassword: newPasswordInput,
      });

      if (!res.success) {
        onOpenToast('Gagal Reset Sandi', res.message);
        setIsSubmitting(false);
        return;
      }

      onOpenToast('Kata Sandi Berhasil Direset', `Kata sandi akun "${resettingPasswordAccount.username}" kini: ${newPasswordInput}`);
      setResettingPasswordAccount(null);
      setNewPasswordInput('');
      await loadAccounts();
    } catch (err: any) {
      onOpenToast('Error', err?.message || 'Gagal mereset kata sandi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (account: UserAccount) => {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus akun "${account.username}" (${account.name})? Pengguna tidak akan dapat masuk kembali.`
    );
    if (!confirmDelete) return;

    try {
      const res = await deleteUserAccount(account.id);
      if (res.success) {
        onOpenToast('Akun Dihapus', res.message);
        await loadAccounts();
      } else {
        onOpenToast('Gagal Menghapus', res.message);
      }
    } catch (err: any) {
      onOpenToast('Error', err?.message || 'Gagal menghapus');
    }
  };

  const handleToggleActive = async (account: UserAccount) => {
    try {
      const newStatus = !account.isActive;
      const res = await updateUserAccount(account.id, { isActive: newStatus });
      if (res.success) {
        onOpenToast(
          newStatus ? 'Akun Diaktifkan' : 'Akun Dinonaktifkan',
          `Akun "${account.username}" kini berstatus ${newStatus ? 'AKTIF' : 'NONAKTIF'}.`
        );
        await loadAccounts();
      }
    } catch (err: any) {
      onOpenToast('Error', err?.message || 'Gagal mengubah status');
    }
  };

  const handleBulkGenerate = async () => {
    setIsBulkGenerating(true);
    try {
      if (bulkRole === 'guru') {
        const personnel = teachers.map((t) => ({
          id: t.id,
          name: t.name,
          nip: t.nip || t.nuptk,
          subject: t.subject,
        }));
        const res = await bulkGeneratePersonnelAccounts('guru', personnel, bulkDefaultPassword);
        onOpenToast(
          'Akun Guru Berhasil Digenerate',
          `Dibuat: ${res.created} akun baru, Dilewati (sudah ada): ${res.skipped}.`
        );
      } else {
        const personnel = students.map((s) => ({
          id: s.id,
          name: s.name,
          nisn: s.nisn || '',
          className: s.className,
        }));
        const res = await bulkGeneratePersonnelAccounts('siswa', personnel, bulkDefaultPassword);
        onOpenToast(
          'Akun Siswa Berhasil Digenerate',
          `Dibuat: ${res.created} akun baru, Dilewati (sudah ada): ${res.skipped}.`
        );
      }
      setIsBulkModalOpen(false);
      await loadAccounts();
    } catch (err: any) {
      onOpenToast('Gagal Generate Massal', err?.message || 'Terjadi kesalahan.');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    // Role filter
    if (selectedRoleFilter !== 'all' && acc.role !== selectedRoleFilter) {
      return false;
    }
    // Status filter
    if (selectedStatusFilter === 'active' && acc.isActive === false) return false;
    if (selectedStatusFilter === 'inactive' && acc.isActive !== false) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchUser = acc.username.toLowerCase().includes(q);
      const matchName = acc.name.toLowerCase().includes(q);
      const matchId = acc.identifier?.toLowerCase().includes(q);
      const matchClass = acc.classOrSubject?.toLowerCase().includes(q);
      return matchUser || matchName || matchId || matchClass;
    }
    return true;
  });

  // Role badge colors & labels
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Administrator',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: ShieldCheck,
        };
      case 'guru':
        return {
          label: 'Guru / GTK',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Briefcase,
        };
      case 'piket':
        return {
          label: 'Guru Piket',
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          icon: ClipboardList,
        };
      case 'siswa':
        return {
          label: 'Peserta Didik',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: GraduationCap,
        };
    }
  };

  const roleStats = {
    total: accounts.length,
    admin: accounts.filter((a) => a.role === 'admin').length,
    guru: accounts.filter((a) => a.role === 'guru').length,
    piket: accounts.filter((a) => a.role === 'piket').length,
    siswa: accounts.filter((a) => a.role === 'siswa').length,
    active: accounts.filter((a) => a.isActive !== false).length,
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-2.5">
              <Key className="w-3.5 h-3.5" />
              <span>Otoritas Administrator & SIM-Akun</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Manajemen Akun Pengguna Terpadu
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Buat, perbarui, dan distribusikan akun dengan username dan password khusus untuk{' '}
              <strong>Guru, Petugas Piket, dan Siswa</strong>. Setiap pengguna hanya dapat masuk dan mengakses fitur sesuai peran resminya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Akun Baru</span>
            </button>

            <button
              onClick={() => {
                setBulkRole('guru');
                setBulkDefaultPassword('guru123');
                setIsBulkModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Generate Massal</span>
            </button>

            <button
              onClick={() => setIsPrintSlipModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Slip Akun / Cetak</span>
            </button>
          </div>
        </div>

        {/* Stats Pill Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
            <span className="text-[11px] text-slate-400 font-medium block">Total Akun</span>
            <span className="text-lg font-black text-white">{roleStats.total}</span>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
            <span className="text-[11px] text-emerald-400 font-medium block">Akun Guru / GTK</span>
            <span className="text-lg font-black text-emerald-300">{roleStats.guru}</span>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
            <span className="text-[11px] text-sky-400 font-medium block">Akun Guru Piket</span>
            <span className="text-lg font-black text-sky-300">{roleStats.piket}</span>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
            <span className="text-[11px] text-amber-400 font-medium block">Akun Siswa</span>
            <span className="text-lg font-black text-amber-300">{roleStats.siswa}</span>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
            <span className="text-[11px] text-purple-400 font-medium block">Administrator</span>
            <span className="text-lg font-black text-purple-300">{roleStats.admin}</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari username, nama, NISN/NIP..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Role Tabs Filter */}
        <div className="flex items-center flex-wrap gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setSelectedRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRoleFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({accounts.length})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('guru')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRoleFilter === 'guru'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Guru ({roleStats.guru})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('piket')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRoleFilter === 'piket'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Piket ({roleStats.piket})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('siswa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRoleFilter === 'siswa'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Siswa ({roleStats.siswa})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRoleFilter === 'admin'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Admin ({roleStats.admin})
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={loadAccounts}
          title="Segarkan daftar akun"
          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-medium">Memuat data akun pengguna...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center px-4">
            <UserX className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Tidak ada akun yang ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {searchQuery
                ? `Tidak ditemukan akun yang cocok dengan kata kunci "${searchQuery}".`
                : 'Belum ada akun pada filter ini. Klik tombol "Tambah Akun Baru" atau "Generate Massal" di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama & Identitas</th>
                  <th className="py-3.5 px-4">Username Akun</th>
                  <th className="py-3.5 px-4">Peran (Role)</th>
                  <th className="py-3.5 px-4">Kata Sandi / Slip</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Tindakan Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredAccounts.map((account) => {
                  const roleConfig = getRoleConfig(account.role);
                  const RoleIcon = roleConfig.icon;
                  const isCopied = copiedId === account.id;

                  return (
                    <tr
                      key={account.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Name & Linked Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                              account.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : account.role === 'guru'
                                ? 'bg-emerald-100 text-emerald-700'
                                : account.role === 'piket'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {account.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{account.name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                              {account.identifier && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  {account.role === 'siswa' ? 'NISN: ' : 'NIP: '}
                                  {account.identifier}
                                </span>
                              )}
                              {account.classOrSubject && (
                                <span className="text-[10px] text-slate-500">
                                  {account.classOrSubject}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 font-mono font-semibold text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-lg border border-indigo-100 w-fit">
                          <span>{account.username}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(account.username, account.id)}
                            title="Salin username"
                            className="text-slate-400 hover:text-indigo-600 cursor-pointer ml-1"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleConfig.bg}`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          <span>{roleConfig.label}</span>
                        </span>
                      </td>

                      {/* Password Hint / Slip */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {account.rawPasswordHint || '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setResettingPasswordAccount(account)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                          >
                            Ganti Sandi
                          </button>
                        </div>
                      </td>

                      {/* Status Aktif */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(account)}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                            account.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title="Klik untuk mengubah status aktif/nonaktif"
                        >
                          {account.isActive !== false ? (
                            <>
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span>AKTIF</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3 text-rose-600" />
                              <span>NONAKTIF</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingAccount(account)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit akun"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(account)}
                            disabled={account.username === 'admin' && accounts.filter((a) => a.role === 'admin').length <= 1}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Hapus akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: TAMBAH AKUN BARU */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Tambah Akun Pengguna Baru</h3>
                  <p className="text-[11px] text-slate-500">Didaftarkan langsung oleh Administrator</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Peran (Role):</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['guru', 'piket', 'siswa', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`py-2 px-1 rounded-xl font-bold text-[11px] uppercase transition-all cursor-pointer border ${
                        formRole === r
                          ? r === 'guru'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : r === 'piket'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                            : r === 'siswa'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Link to Personnel */}
              {(formRole === 'guru' || formRole === 'piket') && teachers.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hubungkan ke Data Guru (Opsional):
                  </label>
                  <select
                    value={formSelectedPersonId}
                    onChange={(e) => handleSelectPerson(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="">-- Buat Akun Lepas / Guru Baru --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.nip ? `NIP ${t.nip}` : t.subject})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formRole === 'siswa' && students.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hubungkan ke Data Siswa (Opsional):
                  </label>
                  <select
                    value={formSelectedPersonId}
                    onChange={(e) => handleSelectPerson(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="">-- Buat Akun Siswa Baru --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.className} - NISN: {s.nisn})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nama Lengkap */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Tampilan:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Drs. La Ode Muhammad Syafei, M.Pd."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Pengguna (Username):
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  placeholder="Contoh: guru.syafei atau 197305141999031004"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/30"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bisa menggunakan NIP (Guru) atau NISN (Siswa) atau nama pengguna huruf kecil unik.
                </p>
              </div>

              {/* Kata Sandi */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi Awal:</label>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimal 4 karakter..."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Nomor Induk & Mapel/Kelas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {formRole === 'siswa' ? 'NISN / NIS:' : 'NIP / NUPTK:'}
                  </label>
                  <input
                    type="text"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    placeholder="Nomor identitas..."
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {formRole === 'siswa' ? 'Kelas (Rombel):' : 'Mata Pelajaran:'}
                  </label>
                  <input
                    type="text"
                    value={formClassOrSubject}
                    onChange={(e) => setFormClassOrSubject(e.target.value)}
                    placeholder={formRole === 'siswa' ? 'Kelas 8A' : 'Matematika'}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Simpan Akun</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT AKUN */}
      {editingAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Edit Akun Pengguna</h3>
                  <p className="text-[11px] text-slate-500">Perbarui data profil & peran</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Pengguna (Username):</label>
                <input
                  type="text"
                  required
                  value={editingAccount.username}
                  onChange={(e) =>
                    setEditingAccount({
                      ...editingAccount,
                      username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''),
                    })
                  }
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Tampilan:</label>
                <input
                  type="text"
                  required
                  value={editingAccount.name}
                  onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Peran (Role):</label>
                <select
                  value={editingAccount.role}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, role: e.target.value as UserRole })
                  }
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                >
                  <option value="admin">Administrator</option>
                  <option value="guru">Guru & Tenaga Kependidikan</option>
                  <option value="piket">Petugas Guru Piket</option>
                  <option value="siswa">Peserta Didik (Siswa)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Induk (NIP/NISN):</label>
                  <input
                    type="text"
                    value={editingAccount.identifier || ''}
                    onChange={(e) =>
                      setEditingAccount({ ...editingAccount, identifier: e.target.value })
                    }
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas / Mapel:</label>
                  <input
                    type="text"
                    value={editingAccount.classOrSubject || ''}
                    onChange={(e) =>
                      setEditingAccount({ ...editingAccount, classOrSubject: e.target.value })
                    }
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editingAccount.isActive !== false}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, isActive: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="edit-is-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Akun Aktif (Bisa masuk ke sistem)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET PASSWORD */}
      {resettingPasswordAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ganti Kata Sandi</h3>
                  <p className="text-[11px] text-slate-500">
                    Akun: <strong>{resettingPasswordAccount.username}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResettingPasswordAccount(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Masukkan Kata Sandi Baru:
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Minimal 4 karakter..."
                    className="w-full py-2 pl-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Kata sandi akan di-hash secara aman menggunakan SHA-256 + Salt.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingPasswordAccount(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Perbarui Sandi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BULK GENERATE ACCOUNTS */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Generate Akun Massal Otomatis</h3>
                  <p className="text-[11px] text-slate-500">Sinkronkan akun dari data Guru atau Siswa</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Personel:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRole('guru');
                      setBulkDefaultPassword('guru123');
                    }}
                    className={`p-3 rounded-2xl border font-bold text-left transition-all cursor-pointer ${
                      bulkRole === 'guru'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 mb-1 text-emerald-600" />
                    <div>Seluruh Guru & GTK</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Tersedia: {teachers.length} data guru
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBulkRole('siswa');
                      setBulkDefaultPassword('siswa123');
                    }}
                    className={`p-3 rounded-2xl border font-bold text-left transition-all cursor-pointer ${
                      bulkRole === 'siswa'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 mb-1 text-amber-600" />
                    <div>Seluruh Siswa</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Tersedia: {students.length} data siswa
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kata Sandi Default Seragam:
                </label>
                <input
                  type="text"
                  value={bulkDefaultPassword}
                  onChange={(e) => setBulkDefaultPassword(e.target.value)}
                  placeholder="Contoh: guru123 atau siswa123"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pengguna yang sudah memiliki akun tidak akan ditimpa (skipped).
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-700">
                Sistem akan otomatis menggunakan NIP guru atau NISN siswa sebagai nama pengguna (username). Jika belum ada NIP/NISN, sistem akan membentuk username otomatis dari nama depan.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkGenerate}
                  disabled={isBulkGenerating}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isBulkGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Mulai Generate Massal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CETAK SLIP KREDENSIAL AKUN */}
      {isPrintSlipModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Cetak Slip Kredensial Pengguna</h3>
                  <p className="text-[11px] text-slate-500">
                    Format cetak siap dibagikan kepada Guru, Piket, dan Siswa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintSlipModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="printable-credential-slips">
                {filteredAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate">{acc.name}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {acc.role}
                      </span>
                    </div>
                    {acc.identifier && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        {acc.role === 'siswa' ? 'NISN: ' : 'NIP: '}
                        {acc.identifier}
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 text-[9px] block">USERNAME</span>
                        <strong className="text-slate-800">{acc.username}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[9px] block">PASSWORD</span>
                        <strong className="text-indigo-600">{acc.rawPasswordHint || '••••••••'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsPrintSlipModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Cetak PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
