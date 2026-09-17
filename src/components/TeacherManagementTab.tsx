import React, { useState, useRef } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  UserCheck,
  CreditCard,
  Building,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Download,
  ScanFace,
  QrCode,
  Fingerprint,
} from 'lucide-react';
import { Teacher, EmploymentStatus, ActiveTab, ToastNotification } from '../types';
import { formatDriveUrl, downloadCsv } from '../utils/soundAndDate';
import { generateQRCodeDataUrl } from '../utils/qrGenerator';
import { BiometricRegistrationGuideModal } from './BiometricRegistrationGuideModal';
import { TeacherImportModal } from './TeacherImportModal';

interface TeacherManagementTabProps {
  teachers?: Teacher[];
  onAddTeacher: (teacher: Teacher) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onAddNotification?: (notification: ToastNotification) => void;
}

const PRESET_AVATARS = [
  { label: 'ASN Pria 1', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80' },
  { label: 'ASN Wanita 1 (Hijab)', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80' },
  { label: 'ASN Pria 2', url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80' },
  { label: 'ASN Wanita 2', url: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=300&q=80' },
  { label: 'P3K / Honorer Pria', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80' },
  { label: 'P3K / Honorer Wanita', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80' },
];

export const TeacherManagementTab: React.FC<TeacherManagementTabProps> = ({
  teachers = [],
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  setActiveTab,
  onAddNotification,
}) => {
  const safeTeachers = teachers || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'nip' | 'status' | 'subject'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showBiometricGuide, setShowBiometricGuide] = useState(false);
  const [selectedTeacherForGuide, setSelectedTeacherForGuide] = useState<Teacher | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '',
    nip: '',
    nuptk: '',
    employmentStatus: 'PNS',
    subject: '',
    role: '',
    gender: 'L',
    phone: '',
    email: '',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    department: 'MIPA',
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [qrModalTeacher, setQrModalTeacher] = useState<{ teacher: Teacher; qrUrl: string } | null>(null);

  const handleShowQrCode = async (teacher: Teacher) => {
    const qrUrl = await generateQRCodeDataUrl({
      id: teacher.id,
      name: teacher.name,
      identifier: teacher.nip || teacher.nuptk || teacher.id,
      type: 'teacher',
      classOrSubject: teacher.subject,
      schoolNpsn: '69904123',
    });
    setQrModalTeacher({ teacher, qrUrl });
  };

  const filteredTeachers = safeTeachers
    .filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.nip.includes(searchQuery) ||
        (t.nuptk && t.nuptk.includes(searchQuery)) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.role.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesStatus = true;
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PPPK_ALL') {
          matchesStatus = t.employmentStatus === 'PPPK' || t.employmentStatus === 'PPPK_PW';
        } else {
          matchesStatus = t.employmentStatus === selectedStatus;
        }
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') comp = a.name.localeCompare(b.name, 'id');
      else if (sortBy === 'nip') comp = a.nip.localeCompare(b.nip);
      else if (sortBy === 'status') comp = a.employmentStatus.localeCompare(b.employmentStatus);
      else if (sortBy === 'subject') comp = (a.subject || '').localeCompare(b.subject || '', 'id');
      return sortDir === 'asc' ? comp : -comp;
    });

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormData({
      name: '',
      nip: `198${Math.floor(100000000000000 + Math.random() * 900000000000000)}`,
      nuptk: `${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`,
      employmentStatus: 'PNS',
      subject: '',
      role: 'Guru Mata Pelajaran',
      gender: 'L',
      phone: '0812' + Math.floor(10000000 + Math.random() * 90000000),
      email: '',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
      department: 'Kurikulum & Pengajaran',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({ ...teacher });
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(png|jpeg|jpg|webp)/i)) {
      alert('Mohon pilih file gambar dengan format PNG, JPG, atau WEBP.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Ukuran file maksimal 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormData((prev) => ({
          ...prev,
          avatar: event.target!.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDriveUrlChange = (url: string) => {
    const formatted = formatDriveUrl(url);
    setFormData((prev) => ({
      ...prev,
      avatar: formatted,
    }));
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nip) {
      alert('Nama dan NIP wajib diisi!');
      return;
    }

    const formattedAvatar = formatDriveUrl(formData.avatar) || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80';

    if (editingTeacher) {
      onUpdateTeacher({
        ...editingTeacher,
        ...formData,
        avatar: formattedAvatar,
      } as Teacher);
    } else {
      const newTeacher: Teacher = {
        id: `tch_${Date.now()}`,
        name: formData.name || '',
        nip: formData.nip || '',
        nuptk: formData.nuptk || '',
        employmentStatus: (formData.employmentStatus as EmploymentStatus) || 'PNS',
        subject: formData.subject || 'Guru Mata Pelajaran',
        role: formData.role || 'Guru',
        gender: (formData.gender as 'L' | 'P') || 'L',
        phone: formData.phone || '',
        email: formData.email || `${formData.name?.toLowerCase().replace(/\s+/g, '.')}@sekolah.sch.id`,
        avatar: formattedAvatar,
        department: formData.department || 'Tenaga Pendidik',
      };
      onAddTeacher(newTeacher);
    }

    setIsModalOpen(false);
  };

  const handleExportCsv = () => {
    const headers = ['No', 'Nama Lengkap', 'NIP', 'NUPTK', 'Status Kepegawaian', 'Mata Pelajaran', 'Tugas / Role', 'JK', 'No HP', 'Email', 'URL Foto Drive/PNG'];
    const rows = filteredTeachers.map((t, idx) => [
      idx + 1,
      `"${t.name.replace(/"/g, '""')}"`,
      `'${t.nip}`,
      `'${t.nuptk || '-'}`,
      `"${t.employmentStatus}"`,
      `"${t.subject.replace(/"/g, '""')}"`,
      `"${t.role.replace(/"/g, '""')}"`,
      t.gender,
      `'${t.phone}`,
      t.email,
      `"${t.avatar}"`,
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    downloadCsv(`Master_Guru_GTK_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const getStatusBadge = (status: EmploymentStatus) => {
    switch (status) {
      case 'PNS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">PNS</span>;
      case 'PPPK':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">PPPK</span>;
      case 'PPPK_PW':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300">PPPK PW</span>;
      case 'HONORER':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">Honorer</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">GTT / PTT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 lg:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Master Data Guru & GTK
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola profil ASN (PNS, PPPK, PPPK PW, Honorer/PTT) dan sinkronisasi biometrik foto wajah
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setSelectedTeacherForGuide(null);
              setShowBiometricGuide(true);
            }}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
          >
            <Fingerprint className="w-4 h-4" />
            <span>Panduan Biometrik & Foto</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
            title="Impor data guru dan pegawai massal dari file CSV"
          >
            <Upload className="w-4 h-4" />
            <span>Impor CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Guru / GTK</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, NIP, NUPTK, mapel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Semua GTK' },
            { id: 'PNS', label: 'PNS' },
            { id: 'PPPK', label: 'PPPK' },
            { id: 'PPPK_PW', label: 'PPPK PW' },
            { id: 'HONORER', label: 'Honorer/PTT' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedStatus(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatus === item.id
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2 shrink-0 text-xs">
          <span className="text-[11px] font-bold text-slate-400">Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="name">Nama GTK</option>
            <option value="nip">NIP / NUPTK</option>
            <option value="status">Status ASN</option>
            <option value="subject">Mata Pelajaran</option>
          </select>
          <button
            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
            title={sortDir === 'asc' ? 'Urutan A-Z (Ascending)' : 'Urutan Z-A (Descending)'}
          >
            {sortDir === 'asc' ? '▲ A-Z' : '▼ Z-A'}
          </button>
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeachers.map((teacher) => (
          <div
            key={teacher.id}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src={formatDriveUrl(teacher.avatar) || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'}
                      alt={teacher.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80';
                      }}
                      className="w-13 h-13 rounded-2xl object-cover border-2 border-indigo-100 dark:border-indigo-900 shadow-xs"
                    />
                    <span
                      title="Biometrik Wajah Tersinkronisasi"
                      className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full text-[9px] shadow-xs"
                    >
                      <ScanFace className="w-3 h-3" />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                      {teacher.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      NIP: {teacher.nip}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      setSelectedTeacherForGuide(teacher);
                      setShowBiometricGuide(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Panduan Perekaman Biometrik & Validasi Foto"
                  >
                    <Fingerprint className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleShowQrCode(teacher)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Generate & Unduh QR Code GTK"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(teacher)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Edit Profil"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(teacher.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Hapus Guru"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status and Details */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Kepegawaian:</span>
                  {getStatusBadge(teacher.employmentStatus)}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Mata Pelajaran:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[170px]">
                    {teacher.subject}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tugas / Role:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-right truncate max-w-[170px]">
                    {teacher.role}
                  </span>
                </div>

                {teacher.nuptk && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">NUPTK:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{teacher.nuptk}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delete Confirmation Alert if active */}
            {deleteConfirmId === teacher.id && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  Hapus data {teacher.name} dari sistem?
                </p>
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      onDeleteTeacher(teacher.id);
                      setDeleteConfirmId(null);
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredTeachers.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada data guru yang cocok</p>
          <p className="text-xs text-slate-400 mt-1">
            Coba gunakan kata kunci pencarian lain atau ubah filter status kepegawaian.
          </p>
        </div>
      )}

      {/* Modal Add / Edit Teacher */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingTeacher ? 'Edit Profil Guru / GTK' : 'Tambah Guru / GTK Baru'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="space-y-4 text-xs">
              {/* Photo Upload & Preview section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Foto Profil Wajah Biometrik (PNG / JPG / Link Google Drive)
                </label>
                
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src={formatDriveUrl(formData.avatar) || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'}
                      alt="Preview Foto Guru"
                      referrerPolicy="no-referrer"
                      className="w-18 h-18 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80';
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-600 text-white">
                      HD Face
                    </span>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File (.PNG / .JPG)</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-[11px]">
                        <LinkIcon className="w-3 h-3 text-indigo-500" />
                        <span>Atau tempel Link Foto Google Drive:</span>
                      </div>
                      <input
                        type="text"
                        placeholder="https://drive.google.com/file/d/.../view atau direct URL"
                        value={formData.avatar || ''}
                        onChange={(e) => handleDriveUrlChange(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Preset Avatars */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mb-1.5">
                    Pilihan Preset Foto ASN / Guru Resmi:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, avatar: preset.url }))}
                        className={`flex items-center space-x-1.5 p-1 rounded-xl border transition-all ${
                          formData.avatar === preset.url
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-lg object-cover"
                        />
                        <span className="text-[10px] font-medium whitespace-nowrap pr-1">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Nama Lengkap */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nama Lengkap & Gelar *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dra. Hj. Siti Aminah, M.Pd."
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                  />
                </div>

                {/* Status Kepegawaian */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status Kepegawaian *</label>
                  <select
                    value={formData.employmentStatus || 'PNS'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employmentStatus: e.target.value as EmploymentStatus,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="PNS">PNS (Pegawai Negeri Sipil)</option>
                    <option value="PPPK">PPPK (P3K Penuh Waktu)</option>
                    <option value="PPPK_PW">PPPK PW (P3K Paruh Waktu)</option>
                    <option value="HONORER">Honorer / Tenaga Kontrak</option>
                    <option value="GTT_PTT">GTT / PTT Sekolah</option>
                  </select>
                </div>

                {/* NIP */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">NIP (Nomor Induk Pegawai) *</label>
                  <input
                    type="text"
                    required
                    placeholder="18 Digit NIP"
                    value={formData.nip || ''}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                {/* NUPTK */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">NUPTK (Opsional)</label>
                  <input
                    type="text"
                    placeholder="16 Digit NUPTK"
                    value={formData.nuptk || ''}
                    onChange={(e) => setFormData({ ...formData, nuptk: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Jenis Kelamin *</label>
                  <select
                    value={formData.gender || 'L'}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                {/* Jabatan / Mata Pelajaran */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Mata Pelajaran / Bidang Tugas *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Matematika Peminatan"
                    value={formData.subject || ''}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Role / Tugas Tambahan */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tugas Tambahan / Role *</label>
                  <input
                    type="text"
                    placeholder="Contoh: Wali Kelas X MIPA 1, Guru Piket"
                    value={formData.role || ''}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* No WhatsApp */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    placeholder="Contoh: 081288991122"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Email Resmi / Akun Belajar</label>
                  <input
                    type="email"
                    placeholder="nama@sekolah.sch.id"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {editingTeacher ? 'Simpan Perubahan' : 'Tambah Guru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code GTK */}
      {qrModalTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-left">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  QR Presensi Guru & GTK
                </h3>
              </div>
              <button
                onClick={() => setQrModalTeacher(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              {qrModalTeacher.qrUrl ? (
                <img
                  src={qrModalTeacher.qrUrl}
                  alt={`QR Code ${qrModalTeacher.teacher.name}`}
                  className="w-48 h-48 rounded-xl object-contain bg-white p-2 shadow-inner"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                  Membuat QR Code...
                </div>
              )}
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-3">
                {qrModalTeacher.teacher.name}
              </h4>
              <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                NIP: {qrModalTeacher.teacher.nip || '-'}
              </p>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {qrModalTeacher.teacher.subject} • {qrModalTeacher.teacher.employmentStatus}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <a
                href={qrModalTeacher.qrUrl}
                download={`QR_GTK_${qrModalTeacher.teacher.nip || qrModalTeacher.teacher.id}_${qrModalTeacher.teacher.name}.png`}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh PNG</span>
              </a>
              <button
                onClick={() => {
                  setQrModalTeacher(null);
                  setActiveTab('cards');
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Cetak ID Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric & Photo Registration Guide Modal */}
      <BiometricRegistrationGuideModal
        isOpen={showBiometricGuide}
        onClose={() => {
          setShowBiometricGuide(false);
          setSelectedTeacherForGuide(null);
        }}
        userRole="teacher"
        userName={selectedTeacherForGuide?.name || 'Bapak/Ibu Guru GTK'}
        userId={selectedTeacherForGuide?.id || 'tch_sample'}
      />

      {/* Modal Impor Data Guru & Pegawai Massal dari CSV */}
      {showImportModal && (
        <TeacherImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingTeachers={safeTeachers}
          onImportTeachers={(newTeachers) => {
            newTeachers.forEach((teacher) => {
              onAddTeacher(teacher);
            });
          }}
          onAddNotification={onAddNotification}
        />
      )}
    </div>
  );
};
