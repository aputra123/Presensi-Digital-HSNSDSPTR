import React, { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  UserCheck,
  Building2,
  Printer,
  ShieldCheck,
  Send,
  AlertCircle,
  School,
  Bell,
  BellRing,
  RotateCcw,
  X,
  Undo2,
  Lock,
} from 'lucide-react';
import {
  GtkServiceRequest,
  GtkServiceCategory,
  Teacher,
  SchoolConfig,
  UserRole,
  UserAccount,
} from '../types';
import { formatDateIndo, playBeepSound } from '../utils/soundAndDate';
import { generateGtkLetterNumber } from '../utils/gtkLetterNumbering';
import {
  notifyGtkStatusChange,
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  getStoredNotifications,
  StoredNotificationItem,
} from '../utils/browserPushNotification';
import { canManageGtkPermissions, isPrincipalUser, isAdminUser } from '../utils/auth';

interface GtkServicesTabProps {
  services: GtkServiceRequest[];
  teachers: Teacher[];
  config: SchoolConfig;
  userRole: UserRole;
  currentAccount?: UserAccount;
  onAddService: (service: GtkServiceRequest) => void;
  onApproveKepsek: (serviceId: string, note?: string) => void;
  onApproveAdmin: (serviceId: string, letterNumber?: string, note?: string) => void;
  onRejectService: (
    serviceId: string,
    reason: string,
    actionType?: 'reject' | 'return',
    reviewerRole?: 'kepala_sekolah' | 'admin' | 'both'
  ) => void;
}

const CATEGORY_LABELS: Record<GtkServiceCategory, { label: string; color: string }> = {
  izin_cuti: { label: 'Cuti & Izin Sakit', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  surat_tugas: { label: 'Surat Tugas Dinas Luar', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  rekomendasi_akademik: { label: 'Rekomendasi PPG & Studi', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  tukar_jadwal: { label: 'Tukar Jadwal Mengajar / Piket', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  keterangan_aktif: { label: 'Surat Keterangan Aktif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const REJECT_QUICK_REASONS = [
  'Bertabrakan dengan agenda penting sekolah / KBM / Ujian Semester',
  'Hak kuota izin/cuti pada periode berjalan telah melampaui ketentuan',
  'Tidak memenuhi syarat administratif kualifikasi kedinasan instansi',
  'Disposisi Pimpinan: Tugas dialihkan kepada personil GTK pengganti',
  'Batas waktu pengajuan telah terlewat dari tanggal kegiatan dinas',
];

const RETURN_QUICK_REASONS = [
  'Dokumen lampiran / surat undangan resmi belum diunggah atau tidak jelas',
  'Jadwal dan rincian lokasi instansi tujuan tugas dinas belum lengkap',
  'Perlu rekomendasi tertulis / persetujuan dari Koordinator Kurikulum atau Wakasek',
  'Perihal permohonan kurang spesifik, mohon perbaiki maksud layanan',
  'Tukar jadwal mengajar belum disertai surat kesediaan dari guru pengganti',
];

export const GtkServicesTab: React.FC<GtkServicesTabProps> = ({
  services = [],
  teachers = [],
  config,
  userRole,
  currentAccount,
  onAddService,
  onApproveKepsek,
  onApproveAdmin,
  onRejectService,
}) => {
  const safeServices = services || [];
  const safeTeachers = teachers || [];

  // Hitung wewenang izin GTK: Hanya Kepala Sekolah & Admin
  const {
    allowed: canManageGtk,
    isKepsek,
    isAdmin,
    actorTitle,
  } = useMemo(() => {
    return canManageGtkPermissions(
      userRole,
      currentAccount,
      config?.principalNip,
      config?.principalName
    );
  }, [userRole, currentAccount, config?.principalNip, config?.principalName]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<GtkServiceRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Reject & Return Dedicated Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    service: GtkServiceRequest | null;
    actionType: 'reject' | 'return';
  }>({
    isOpen: false,
    service: null,
    actionType: 'return',
  });
  const [actionReason, setActionReason] = useState('');
  const [actionReviewer, setActionReviewer] = useState<'kepala_sekolah' | 'admin' | 'both'>('both');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Form State for new GTK Request
  const [teacherId, setTeacherId] = useState('');
  const [category, setCategory] = useState<GtkServiceCategory>('surat_tugas');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [destination, setDestination] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Approval review note
  const [reviewNote, setReviewNote] = useState('');
  const [letterNumberInput, setLetterNumberInput] = useState('');

  // Browser Push Notification State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    () => getBrowserNotificationPermission()
  );
  const [recentNotifs, setRecentNotifs] = useState<StoredNotificationItem[]>(() => getStoredNotifications());
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  const handleRequestNotificationPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      await notifyGtkStatusChange({
        teacherName: 'Bapak/Ibu Guru GTK',
        serviceTitle: 'Aktivasi Notifikasi SIMPEG',
        status: 'approved',
        reviewerName: config.principalName || 'Kepala Sekolah',
        note: 'Notifikasi browser aktif! Anda akan menerima pesan langsung saat status izin/tugas Anda disetujui atau ditolak.',
      });
      setRecentNotifs(getStoredNotifications());
      alert('🔔 Notifikasi browser berhasil diaktifkan! Notifikasi akan muncul saat status pengajuan Anda diperbarui.');
    } else if (res === 'denied') {
      alert('⚠️ Izin notifikasi ditolak di browser. Silakan aktifkan izin notifikasi pada ikon gembok di bilah alamat browser.');
    }
  };

  const handleSendTestNotification = async () => {
    await notifyGtkStatusChange({
      teacherName: teachers[0]?.name || 'Guru SMPN 4',
      serviceTitle: 'Simulasi Surat Tugas Dinas Luar',
      status: 'approved',
      reviewerName: config.principalName || 'Kepala Sekolah',
      note: 'Contoh: Pengajuan Surat Tugas telah disetujui oleh Kepala Sekolah.',
      letterNumber: '421.3/099/SMPN4-TB/DISDIK/2025',
    });
    setRecentNotifs(getStoredNotifications());
  };

  const filteredServices = safeServices.filter((s) => {
    const matchQuery =
      s.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.officialLetterNumber || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory = filterCategory === 'all' || s.category === filterCategory;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;

    return matchQuery && matchCategory && matchStatus;
  });

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !title || !purpose) {
      alert('Mohon lengkapi guru pemohon, perihal, dan maksud layanan.');
      return;
    }

    const selectedTeacher = safeTeachers.find((t) => t.id === teacherId);
    if (!selectedTeacher) return;

    const newReq: GtkServiceRequest = {
      id: `gtk_srv_${Date.now()}`,
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      nip: selectedTeacher.nip,
      employmentStatus: selectedTeacher.employmentStatus,
      category,
      title,
      purpose,
      startDate,
      endDate,
      destinationOrLocation: destination,
      attachmentName: attachmentName || 'dokumen_pendukung_gtk.pdf',
      status: 'pending',
      kepsekApproval: {
        approvedBy: config.principalName || 'Dr. H. Mulyadi, M.Pd.',
        role: 'kepala_sekolah',
        status: 'pending',
      },
      adminApproval: {
        approvedBy: config.adminName || 'Siti Aminah, S.Kom. (SIMPEG)',
        role: 'admin',
        status: 'pending',
      },
      createdAt: `${formatDateIndo(new Date().toISOString().split('T')[0])} 08:00 WIB`,
    };

    onAddService(newReq);
    playBeepSound();
    setIsModalOpen(false);
    // Reset
    setTitle('');
    setPurpose('');
    setDestination('');
  };

  const handleOpenActionModal = (
    service: GtkServiceRequest,
    actionType: 'reject' | 'return'
  ) => {
    if (!canManageGtk) {
      alert(
        'Akses Dibatasi: Hanya Kepala Sekolah (melalui akun kepala sekolah) dan Admin (melalui akun admin) yang berwenang menyetujui, mengembalikan, atau menolak izin GTK.'
      );
      return;
    }
    setActionModal({
      isOpen: true,
      service,
      actionType,
    });
    setActionReason('');
    setActionError(null);
    setActionReviewer(isAdmin ? 'admin' : 'kepala_sekolah');
  };

  const handleConfirmRejectOrReturn = async () => {
    if (!actionModal.service) return;
    if (!canManageGtk) {
      setActionError(
        'Akses Ditolak: Hanya Kepala Sekolah (melalui akun kepala sekolah) dan Admin (melalui akun admin) yang berwenang memproses izin GTK.'
      );
      return;
    }
    if (!actionReason.trim()) {
      setActionError(
        actionModal.actionType === 'return'
          ? 'Mohon tuliskan catatan perbaikan atau dokumen yang perlu dilengkapi oleh GTK.'
          : 'Mohon tuliskan alasan penolakan permohonan layanan GTK.'
      );
      return;
    }

    const { service, actionType } = actionModal;
    const isReturn = actionType === 'return';
    const reasonText = actionReason.trim();

    // Call prop callback with updated signature
    onRejectService(service.id, reasonText, actionType, actionReviewer);

    // Send push notification & sound
    const reviewerTitle =
      actionReviewer === 'admin'
        ? config.adminName || 'Admin SIMPEG'
        : actionReviewer === 'kepala_sekolah'
        ? config.principalName || 'Kepala Sekolah'
        : `${config.principalName || 'Kepala Sekolah'} & Admin SIMPEG`;

    await notifyGtkStatusChange({
      teacherName: service.teacherName,
      serviceTitle: service.title,
      status: isReturn ? 'returned' : 'rejected',
      reviewerName: reviewerTitle,
      note: reasonText,
    });

    setRecentNotifs(getStoredNotifications());
    playBeepSound();

    // Show temporary inline notification notice
    setActionSuccessNotice(
      isReturn
        ? `Berkas pengajuan "${service.title}" berhasil dikembalikan untuk revisi.`
        : `Permohonan "${service.title}" telah resmi ditolak.`
    );
    setTimeout(() => setActionSuccessNotice(null), 5000);

    // Close action modal and detail modal if matching
    setActionModal({ isOpen: false, service: null, actionType: 'return' });
    if (selectedService?.id === service.id) {
      setSelectedService(null);
    }
  };

  const handleEditAndResubmit = (service: GtkServiceRequest) => {
    setTeacherId(service.teacherId);
    setCategory(service.category);
    setTitle(service.title);
    setPurpose(service.purpose);
    setStartDate(service.startDate);
    setEndDate(service.endDate);
    setDestination(service.destinationOrLocation || '');
    setAttachmentName(service.attachmentName || '');
    setIsModalOpen(true);
  };

  const getStatusBadge = (s: GtkServiceRequest) => {
    if (s.status === 'approved') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Disetujui Kepsek & Admin (Resmi)</span>
        </span>
      );
    }
    if (s.status === 'approved_by_kepsek') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
          <Clock className="w-3 h-3 text-blue-600" />
          <span>Disetujui Kepsek (Menunggu Admin)</span>
        </span>
      );
    }
    if (s.status === 'approved_by_admin') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
          <Clock className="w-3 h-3 text-indigo-600" />
          <span>Disetujui Admin (Menunggu Kepsek)</span>
        </span>
      );
    }
    if (s.status === 'returned') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
          <RotateCcw className="w-3 h-3 text-amber-700" />
          <span>Dikembalikan (Perlu Revisi)</span>
        </span>
      );
    }
    if (s.status === 'rejected') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          <span>Ditolak</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Menunggu Persetujuan Ganda</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900">
                Layanan & Perizinan Resmi Guru/GTK
              </h2>
              <p className="text-xs text-slate-500">
                Alur verifikasi & persetujuan ganda oleh <strong className="text-slate-700">Kepala Sekolah ({config.principalName || 'Kepsek'})</strong> dan <strong className="text-slate-700">Administrator SIMPEG</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setIsNotifModalOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer relative"
            title="Buka Pusat Notifikasi Push Browser Guru"
          >
            <Bell className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Pusat Notifikasi</span>
            {recentNotifs.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ml-1">
                {recentNotifs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Layanan / Izin GTK</span>
          </button>
        </div>
      </div>

      {/* Browser Push Notification Activation Banner */}
      <div className="p-4 rounded-3xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start sm:items-center space-x-3">
          <div className={`p-2.5 rounded-2xl shrink-0 ${
            notifPermission === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
          }`}>
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-extrabold text-slate-900">
                Notifikasi Push Browser Real-Time untuk Guru & Staf
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                notifPermission === 'granted'
                  ? 'bg-emerald-100 text-emerald-800'
                  : notifPermission === 'denied'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {notifPermission === 'granted'
                  ? 'Aktif (Disetujui)'
                  : notifPermission === 'denied'
                  ? 'Diblokir di Browser'
                  : 'Belum Diaktifkan'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Menerima pop-up notifikasi desktop seketika saat perizinan atau layanan Anda disetujui atau ditolak Kepala Sekolah.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={handleRequestNotificationPermission}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Aktifkan Notifikasi
            </button>
          )}
          <button
            type="button"
            onClick={handleSendTestNotification}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-colors cursor-pointer"
            title="Kirim contoh notifikasi ke peramban untuk pengujian"
          >
            Uji Notifikasi Browser
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500">Total Pengajuan</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{safeServices.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-700">Menunggu Verifikasi</span>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">
            {safeServices.filter((s) => s.status !== 'approved' && s.status !== 'rejected' && s.status !== 'returned').length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-700">Disetujui Lengkap (Resmi)</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {safeServices.filter((s) => s.status === 'approved').length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-700">Dikembalikan / Ditolak</span>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">
            {safeServices.filter((s) => s.status === 'rejected' || s.status === 'returned').length}
          </p>
        </div>
      </div>

      {/* Policy & Authority Notice */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs text-indigo-950">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-extrabold text-[12px] text-slate-900">
              Otoritas Persetujuan GTK: Khusus Kepala Sekolah & Administrator
            </p>
            <p className="text-[11px] text-slate-600">
              Yang berhak menyetujui, mengembalikan berkas (revisi), dan menolak izin GTK hanya <strong>Kepala Sekolah</strong> (melalui akun kepala sekolah) dan <strong>Admin</strong> (melalui akun admin).
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-1.5">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              canManageGtk
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {canManageGtk ? `✓ Akses Aktif: ${actorTitle}` : '🔒 Mode Tinjau (Akses Dibatasi)'}
          </span>
        </div>
      </div>

      {actionSuccessNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama guru, NIP, atau no surat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-bold text-slate-700"
          >
            <option value="all">Semua Kategori Layanan</option>
            <option value="surat_tugas">Surat Tugas Dinas Luar</option>
            <option value="izin_cuti">Cuti & Izin Sakit</option>
            <option value="rekomendasi_akademik">Rekomendasi PPG / Beasiswa</option>
            <option value="tukar_jadwal">Tukar Jam / Piket</option>
            <option value="keterangan_aktif">Surat Keterangan Aktif</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-bold text-slate-700"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Persetujuan</option>
            <option value="approved_by_kepsek">Disetujui Kepsek Saja</option>
            <option value="approved">Disetujui Penuh (Resmi)</option>
            <option value="returned">Dikembalikan (Perlu Revisi)</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
      </div>

      {/* Services List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Kategori & Tanggal</th>
                <th className="px-5 py-3.5">Guru / GTK Pemohon</th>
                <th className="px-5 py-3.5">Perihal & Tujuan</th>
                <th className="px-5 py-3.5 text-center">Persetujuan Kepsek</th>
                <th className="px-5 py-3.5 text-center">Persetujuan Admin</th>
                <th className="px-5 py-3.5 text-center">Status Akhir</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Tidak ada pengajuan layanan GTK yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredServices.map((req) => {
                  const cat = CATEGORY_LABELS[req.category] || CATEGORY_LABELS.surat_tugas;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border mb-1 ${cat.color}`}>
                          {cat.label}
                        </span>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {formatDateIndo(req.startDate)} {req.startDate !== req.endDate ? `s.d ${formatDateIndo(req.endDate)}` : ''}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="font-extrabold text-slate-900">{req.teacherName}</p>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-500">NIP {req.nip}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-700 font-bold rounded">
                            {req.employmentStatus}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top max-w-xs">
                        <p className="font-bold text-slate-800 leading-snug">{req.title}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{req.purpose}</p>
                        {req.officialLetterNumber && (
                          <span className="inline-block mt-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            No: {req.officialLetterNumber}
                          </span>
                        )}
                      </td>

                      {/* Kepsek Status */}
                      <td className="px-5 py-4 align-top text-center">
                        {req.kepsekApproval?.status === 'approved' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700 mt-1">Disetujui</span>
                          </div>
                        ) : req.kepsekApproval?.status === 'returned' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-amber-100 text-amber-800">
                              <RotateCcw className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-amber-700 mt-1">Kembali</span>
                          </div>
                        ) : req.kepsekApproval?.status === 'rejected' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-rose-100 text-rose-700">
                              <XCircle className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-rose-700 mt-1">Ditolak</span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-amber-50 text-amber-700">
                              <Clock className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-amber-700 mt-1">Menunggu</span>
                          </div>
                        )}
                      </td>

                      {/* Admin Status */}
                      <td className="px-5 py-4 align-top text-center">
                        {req.adminApproval?.status === 'approved' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700 mt-1">Disetujui</span>
                          </div>
                        ) : req.adminApproval?.status === 'returned' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-amber-100 text-amber-800">
                              <RotateCcw className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-amber-700 mt-1">Kembali</span>
                          </div>
                        ) : req.adminApproval?.status === 'rejected' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-rose-100 text-rose-700">
                              <XCircle className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-rose-700 mt-1">Ditolak</span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="p-1 rounded-full bg-amber-50 text-amber-700">
                              <Clock className="w-4 h-4" />
                            </span>
                            <span className="text-[9px] font-bold text-amber-700 mt-1">Menunggu</span>
                          </div>
                        )}
                      </td>

                      {/* Overall Status */}
                      <td className="px-5 py-4 align-top text-center">
                        {getStatusBadge(req)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 align-top text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedService(req)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 font-bold text-[11px] transition-all cursor-pointer inline-flex items-center space-x-1"
                          title="Tinjau detail berkas dan disposisi layanan"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Tinjau</span>
                        </button>

                        {req.status !== 'approved' && req.status !== 'rejected' && req.status !== 'returned' && (
                          <>
                            <button
                              onClick={() => handleOpenActionModal(req, 'return')}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[11px] transition-all cursor-pointer inline-flex items-center space-x-1"
                              title="Kembalikan berkas ke GTK untuk perbaikan/revisi"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-700" />
                              <span>Kembalikan</span>
                            </button>
                            <button
                              onClick={() => handleOpenActionModal(req, 'reject')}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-all cursor-pointer inline-flex items-center space-x-1"
                              title="Tolak pengajuan permohonan layanan"
                            >
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Tolak</span>
                            </button>
                          </>
                        )}

                        {req.status === 'returned' && (
                          <button
                            onClick={() => handleEditAndResubmit(req)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] transition-all cursor-pointer inline-flex items-center space-x-1"
                            title="Lengkapi atau perbaiki data permohonan dan ajukan ulang"
                          >
                            <Undo2 className="w-3 h-3 text-indigo-600" />
                            <span>Perbaiki</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL / APPROVAL MODAL */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                  Detail Layanan & Verifikasi GTK
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-0.5">
                  {selectedService.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">Nama Guru / GTK:</span>
                <span className="font-extrabold text-slate-900">{selectedService.teacherName}</span>
                <p className="text-[10px] font-mono text-slate-500">NIP: {selectedService.nip}</p>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px]">Kategori Layanan:</span>
                <span className="font-bold text-indigo-700">
                  {CATEGORY_LABELS[selectedService.category]?.label}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px]">Periode Pelaksanaan:</span>
                <span className="font-bold text-slate-800">
                  {formatDateIndo(selectedService.startDate)} s.d {formatDateIndo(selectedService.endDate)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px]">Lokasi / Instansi Tujuan:</span>
                <span className="font-bold text-slate-800">
                  {selectedService.destinationOrLocation || 'SMAN 1 Nusantara'}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-400 font-bold block text-[10px]">Maksud / Uraian Tugas:</span>
                <p className="text-slate-700 mt-0.5 leading-relaxed">{selectedService.purpose}</p>
              </div>

              {selectedService.officialLetterNumber && (
                <div className="col-span-2 bg-indigo-100/50 p-2.5 rounded-xl border border-indigo-200">
                  <span className="text-[10px] font-bold text-indigo-800 block">Nomor Surat Resmi Sekolah:</span>
                  <span className="font-mono font-extrabold text-indigo-950 text-xs">
                    {selectedService.officialLetterNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Persetujuan Ganda Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Box Persetujuan Kepala Sekolah */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-extrabold text-slate-900">Kepala Sekolah</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedService.kepsekApproval?.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedService.kepsekApproval?.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-800">
                  {selectedService.kepsekApproval?.approvedBy || config.principalName}
                </p>
                {selectedService.kepsekApproval?.note && (
                  <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded-lg">
                    "{selectedService.kepsekApproval.note}"
                  </p>
                )}
                {selectedService.kepsekApproval?.signatureStamp && (
                  <div className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                    ✓ {selectedService.kepsekApproval.signatureStamp}
                  </div>
                )}
              </div>

              {/* Box Persetujuan Admin SIMPEG */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-extrabold text-slate-900">Admin SIMPEG / TU</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedService.adminApproval?.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedService.adminApproval?.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-800">
                  {selectedService.adminApproval?.approvedBy || config.adminName}
                </p>
                {selectedService.adminApproval?.note && (
                  <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded-lg">
                    "{selectedService.adminApproval.note}"
                  </p>
                )}
                {selectedService.adminApproval?.signatureStamp && (
                  <div className="text-[9px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                    ✓ {selectedService.adminApproval.signatureStamp}
                  </div>
                )}
              </div>
            </div>

            {/* Returned or Rejected Banner if applicable */}
            {selectedService.status === 'returned' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Berkas Layanan Dikembalikan untuk Perbaikan / Revisi</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Catatan Perbaikan: "{selectedService.returnReason || selectedService.kepsekApproval?.note || selectedService.adminApproval?.note || 'Mohon lengkapi atau perbaiki berkas persyaratan.'}"
                </p>
                {selectedService.returnedBy && (
                  <p className="text-[10px] text-amber-700 font-semibold">
                    Diputuskan oleh: {selectedService.returnedBy}
                  </p>
                )}
              </div>
            )}

            {selectedService.status === 'rejected' && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Permohonan Layanan Ditolak</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Alasan Penolakan: "{selectedService.rejectionReason || selectedService.kepsekApproval?.note || selectedService.adminApproval?.note || 'Tidak memenuhi kriteria perizinan resmi instansi.'}"
                </p>
                {selectedService.rejectedBy && (
                  <p className="text-[10px] text-rose-600 font-semibold">
                    Ditolak oleh: {selectedService.rejectedBy}
                  </p>
                )}
              </div>
            )}

            {/* Approval Action Form (Khusus Kepala Sekolah & Admin) */}
            {canManageGtk ? (
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Panel Verifikasi & Persetujuan Pejabat</span>
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Otoritas: {isKepsek ? '👑 Kepala Sekolah' : '🛡️ Administrator'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Catatan / Disposisi Pejabat..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      placeholder="Nomor Surat (cth: 421.3/001/SMPN4-TB/DISDIK/...)"
                      value={letterNumberInput}
                      onChange={(e) => setLetterNumberInput(e.target.value)}
                      className="text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none font-mono flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const autoNum = generateGtkLetterNumber(
                          config,
                          selectedService?.category,
                          safeServices.length + 1
                        );
                        setLetterNumberInput(autoNum);
                      }}
                      title="Buat nomor surat otomatis berdasarkan format standar instansi sekolah"
                      className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-xl border border-indigo-200 cursor-pointer whitespace-nowrap"
                    >
                      Auto No
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {(isKepsek || isAdmin) && selectedService.kepsekApproval?.status !== 'approved' && (
                    <button
                      onClick={async () => {
                        const noteText = reviewNote || 'Disetujui Kepala Sekolah untuk kelancaran tugas dinas/pengembangan profesi.';
                        onApproveKepsek(selectedService.id, noteText);
                        await notifyGtkStatusChange({
                          teacherName: selectedService.teacherName,
                          serviceTitle: selectedService.title,
                          status: 'approved_by_kepsek',
                          reviewerName: config.principalName || 'Kepala Sekolah',
                          note: noteText,
                        });
                        setRecentNotifs(getStoredNotifications());
                        setSelectedService(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Setujui sbg Kepala Sekolah</span>
                    </button>
                  )}

                  {isAdmin && selectedService.adminApproval?.status !== 'approved' && (
                    <button
                      onClick={async () => {
                        const officialNum =
                          letterNumberInput ||
                          generateGtkLetterNumber(
                            config,
                            selectedService.category,
                            safeServices.length + 1
                          );
                        const noteText = reviewNote || 'Diverifikasi oleh SIMPEG dan dicatat ke data presensi resmi.';
                        onApproveAdmin(selectedService.id, officialNum, noteText);
                        await notifyGtkStatusChange({
                          teacherName: selectedService.teacherName,
                          serviceTitle: selectedService.title,
                          status: 'approved',
                          reviewerName: `${config.principalName || 'Kepala Sekolah'} & SIMPEG`,
                          note: noteText,
                          letterNumber: officialNum,
                        });
                        setRecentNotifs(getStoredNotifications());
                        setSelectedService(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Setujui sbg Admin SIMPEG</span>
                    </button>
                  )}

                  {selectedService.status !== 'approved' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenActionModal(selectedService, 'return')}
                        className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-300 flex items-center space-x-1.5 cursor-pointer transition-colors"
                        title="Kembalikan berkas ke guru/GTK untuk dilengkapi atau direvisi"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                        <span>Kembalikan Berkas (Revisi)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenActionModal(selectedService, 'reject')}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center space-x-1.5 cursor-pointer transition-colors"
                        title="Tolak permohonan layanan GTK secara definitif"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Tolak Permohonan</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs text-amber-900">
                <div className="flex items-center space-x-2 font-bold">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Panel Verifikasi Terkunci (Khusus Kepala Sekolah & Admin)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Permohonan izin dan layanan GTK hanya dapat <strong>disetujui</strong>, <strong>dikembalikan (revisi)</strong>, atau <strong>ditolak</strong> melalui <strong>Akun Kepala Sekolah</strong> (username: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950">kepsek</code>) dan <strong>Akun Admin</strong> (username: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950">admin</code>).
                </p>
                <div className="text-[10px] text-amber-700">
                  Akun Anda saat ini: <span className="font-semibold text-slate-800">{currentAccount?.name || userRole}</span> ({userRole.toUpperCase()})
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsPrintModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Dokumen Resmi (Surat Tugas)</span>
              </button>

              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT OFFICIAL SURAT TUGAS / IZIN GTK MODAL */}
      {isPrintModalOpen && selectedService && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 space-y-6 text-slate-900 border border-slate-200 shadow-2xl">
            {/* Header Kop Surat Resmi dengan Logo Sekolah */}
            <div className="flex items-center space-x-4 border-b-2 border-slate-900 pb-4">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt="Logo Sekolah"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <School className="w-14 h-14 text-indigo-700" />
              )}
              <div className="text-center flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  PEMERINTAH PROVINSI DAERAH KHUSUS JAKARTA • DINAS PENDIDIKAN
                </p>
                <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                  {config.schoolName}
                </h2>
                <p className="text-[11px] text-slate-600">{config.address}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  NPSN: {config.npsn} • Website: https://sman1nusantara.sch.id
                </p>
              </div>
            </div>

            {/* Judul Surat Resmi */}
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-sm uppercase underline decoration-2">
                {selectedService.category === 'surat_tugas'
                  ? 'SURAT PERINTAH TUGAS (SPT)'
                  : selectedService.category === 'izin_cuti'
                  ? 'SURAT IZIN / CUTI GTK'
                  : 'SURAT KETERANGAN / REKOMENDASI'}
              </h3>
              <p className="text-xs font-mono font-bold text-slate-700">
                Nomor: {selectedService.officialLetterNumber || '800/042/SMAN1-DISDIK/VIII/2026'}
              </p>
            </div>

            {/* Isi Surat */}
            <div className="text-xs leading-relaxed space-y-3">
              <p>
                Kepala {config.schoolName} dengan ini memberikan tugas / izin resmi kepada:
              </p>
              <table className="w-full text-xs font-medium ml-4">
                <tbody>
                  <tr>
                    <td className="w-36 py-1 font-bold">Nama</td>
                    <td>: {selectedService.teacherName}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">NIP</td>
                    <td className="font-mono">: {selectedService.nip}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">Status Kepegawaian</td>
                    <td>: {selectedService.employmentStatus}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">Untuk Keperluan</td>
                    <td>: {selectedService.purpose}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">Waktu Pelaksanaan</td>
                    <td>: {formatDateIndo(selectedService.startDate)} s.d {formatDateIndo(selectedService.endDate)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-bold">Tempat / Tujuan</td>
                    <td>: {selectedService.destinationOrLocation || 'SMAN 1 Nusantara'}</td>
                  </tr>
                </tbody>
              </table>

              <p className="pt-2">
                Demikian surat perizinan ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan dilaporkan hasilnya kepada Kepala Sekolah.
              </p>
            </div>

            {/* Tanda Tangan Ganda (Kepsek & Admin) */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
              <div className="space-y-1">
                <p className="font-medium text-slate-500">Mengetahui Admin SIMPEG / TU,</p>
                <div className="h-16 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-extrabold text-purple-700 border border-purple-300 bg-purple-50 px-2 py-1 rounded">
                    TERVERIFIKASI SISTEM SIMPEG
                  </span>
                </div>
                <p className="font-bold underline">{config.adminName || 'Siti Aminah, S.Kom.'}</p>
                <p className="text-[10px] text-slate-500">Administrator Data Presensi</p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-slate-500">
                  Jakarta, {formatDateIndo(new Date().toISOString().split('T')[0])}
                </p>
                <p className="font-bold">Kepala Sekolah,</p>
                <div className="h-16 flex items-center justify-center">
                  <div className="border-2 border-indigo-600 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase rotate-[-2deg]">
                    ★ TTD & STEMPEL RESMI DIGITAL ★
                  </div>
                </div>
                <p className="font-bold underline">{config.principalName || 'Dr. H. Mulyadi, M.Pd.'}</p>
                <p className="text-[10px] font-mono text-slate-500">NIP. {config.principalNip || '197103151998021001'}</p>
              </div>
            </div>

            {/* Print Dialog Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </button>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW GTK SERVICE REQUEST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Formulir Layanan & Perizinan Guru/GTK</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pilih Guru / GTK Pemohon</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-medium"
                >
                  <option value="">-- Pilih Guru / GTK --</option>
                  {safeTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employmentStatus} - {t.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Jenis / Kategori Layanan</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GtkServiceCategory)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-bold text-indigo-700"
                >
                  <option value="surat_tugas">Surat Tugas Dinas Luar / Workshop / MGMP</option>
                  <option value="izin_cuti">Cuti Sakit / Cuti Tahunan / Alasan Penting</option>
                  <option value="rekomendasi_akademik">Surat Rekomendasi PPG / Beasiswa / Studi Lanjut</option>
                  <option value="tukar_jadwal">Dispensasi / Tukar Jadwal Piket & Jam Mengajar</option>
                  <option value="keterangan_aktif">Surat Keterangan Aktif Mengajar</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Perihal / Judul Permohonan</label>
                <input
                  type="text"
                  placeholder="Contoh: Surat Tugas Narasumber Bimtek Kurikulum Merdeka"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Maksud & Uraian Lengkap</label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan alasan, dasar surat undangan, atau keperluan dinas..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Instansi / Lokasi Tujuan</label>
                <input
                  type="text"
                  placeholder="Contoh: Balai Guru Penggerak (BGP) DKI Jakarta"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pengajuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Push Notification History & Settings Modal */}
      {isNotifModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-600">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Pusat Notifikasi Push Browser GTK
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Riwayat pemberitahuan persetujuan & penolakan layanan guru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notification Status info */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-700">Status Perizinan Browser:</span>
                <p className="text-slate-500 text-[11px]">
                  {notifPermission === 'granted'
                    ? 'Browser diizinkan menampilkan notifikasi popup desktop'
                    : notifPermission === 'denied'
                    ? 'Notifikasi diblokir oleh browser'
                    : 'Izin belum diberikan'}
                </p>
              </div>
              {notifPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleRequestNotificationPermission}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Izinkan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Kirim Uji Coba
                </button>
              )}
            </div>

            {/* Recent Notifications List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {recentNotifs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada riwayat notifikasi baru. Notifikasi akan muncul otomatis saat Kepala Sekolah atau Admin memproses perizinan GTK.
                </div>
              ) : (
                recentNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1 transition-all ${
                      n.type === 'approved'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : n.type === 'rejected'
                        ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                        : 'bg-indigo-50/50 border-indigo-200 text-indigo-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[11px]">{n.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{n.timestamp}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNotifModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED REJECT / RETURN ACTION MODAL */}
      {actionModal.isOpen && actionModal.service && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    actionModal.actionType === 'return'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  {actionModal.actionType === 'return' ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {actionModal.actionType === 'return'
                      ? 'Kembalikan Berkas ke Guru / GTK'
                      : 'Tolak Permohonan Layanan GTK'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {actionModal.actionType === 'return'
                      ? 'Berkas dikembalikan dengan status revisi agar GTK dapat memperbaiki atau melengkapi dokumen.'
                      : 'Permohonan akan ditolak secara definitif dan tercatat di buku verifikasi SIMPEG.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, service: null, actionType: 'return' })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Service Information Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{actionModal.service.teacherName}</span>
                <span className="font-mono text-[10px] text-slate-500">NIP {actionModal.service.nip}</span>
              </div>
              <p className="font-bold text-slate-800 leading-snug">{actionModal.service.title}</p>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-700">
                  {CATEGORY_LABELS[actionModal.service.category]?.label}
                </span>
                <span>•</span>
                <span>{formatDateIndo(actionModal.service.startDate)}</span>
              </div>
            </div>

            {/* Verifier Role Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Pihak yang Memutuskan Verifikasi:
              </label>
              {isKepsek && !isAdmin ? (
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900 flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Kepala Sekolah ({config.principalName || currentAccount?.name || 'Kepala Sekolah'})</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionReviewer('kepala_sekolah')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      actionReviewer === 'kepala_sekolah'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Kepala Sekolah
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionReviewer('admin')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      actionReviewer === 'admin'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Admin SIMPEG
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionReviewer('both')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      actionReviewer === 'both'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Kepsek & Admin
                  </button>
                </div>
              )}
            </div>

            {/* Quick Reason Presets */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Pilihan Cepat Alasan / Catatan Disposisi:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(actionModal.actionType === 'return' ? RETURN_QUICK_REASONS : REJECT_QUICK_REASONS).map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActionReason(reason);
                      setActionError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors text-left cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason / Note Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {actionModal.actionType === 'return'
                  ? 'Catatan Bagian yang Perlu Dilengkapi / Diperbaiki *'
                  : 'Alasan Resmi Penolakan Permohonan *'}
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => {
                  setActionReason(e.target.value);
                  if (actionError) setActionError(null);
                }}
                placeholder={
                  actionModal.actionType === 'return'
                    ? 'Contoh: Harap lampirkan surat tugas/undangan resmi dari dinas atau perbaiki rincian jadwal kegiatan...'
                    : 'Contoh: Tidak dapat diizinkan karena bertepatan dengan pelaksanaan Ujian Semester sekolah...'
                }
                className={`w-full text-xs p-3 bg-slate-50 border rounded-2xl focus:outline-none focus:ring-2 transition-all ${
                  actionError
                    ? 'border-rose-300 focus:ring-rose-500/20 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-indigo-500/20'
                }`}
              />
              {actionError && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{actionError}</span>
                </p>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, service: null, actionType: 'return' })}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmRejectOrReturn}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                  actionModal.actionType === 'return'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionModal.actionType === 'return' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Kembalikan Berkas (Revisi)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tolak Permohonan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
