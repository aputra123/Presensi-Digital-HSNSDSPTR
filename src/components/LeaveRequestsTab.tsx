import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Paperclip,
  Calendar,
  UploadCloud,
  Eye,
  Image as ImageIcon,
  AlertTriangle,
  Pencil,
  Trash2,
  Save,
  X,
  ShieldCheck,
  Lock,
  UserCheck,
  Users,
} from 'lucide-react';
import { LeaveRequest, Student, Teacher, UserRole, UserAccount, SchoolConfig } from '../types';
import { formatDateIndo, playBeepSound } from '../utils/soundAndDate';
import { DocumentViewer, DocumentItem } from './DocumentViewer';
import { isPrincipalUser, isAdminUser } from '../utils/auth';

interface LeaveRequestsTabProps {
  leaves?: LeaveRequest[];
  students?: Student[];
  teachers?: Teacher[];
  todayDate: string;
  config?: SchoolConfig;
  onAddLeaveRequest: (req: LeaveRequest) => void;
  onUpdateLeaveStatus: (
    id: string,
    status: 'approved' | 'rejected' | 'returned',
    reviewNote?: string,
    reviewerInfo?: { name: string; role: string }
  ) => void;
  onEditLeaveRequest?: (req: LeaveRequest) => void;
  onDeleteLeaveRequest?: (id: string) => void;
  userRole?: UserRole;
  currentAccount?: UserAccount;
}

export const LeaveRequestsTab: React.FC<LeaveRequestsTabProps> = ({
  leaves = [],
  students = [],
  teachers = [],
  todayDate,
  config,
  onAddLeaveRequest,
  onUpdateLeaveStatus,
  onEditLeaveRequest,
  onDeleteLeaveRequest,
  userRole = 'admin',
  currentAccount,
}) => {
  const safeLeaves = leaves || [];
  const safeStudents = students || [];
  const safeTeachers = teachers || [];

  // Match authenticated student or teacher
  const matchingStudent = useMemo(() => {
    if (!currentAccount) return null;
    return (
      safeStudents.find((s) => currentAccount.personId && s.id === currentAccount.personId) ||
      safeStudents.find((s) => currentAccount.identifier && s.nisn === currentAccount.identifier) ||
      safeStudents.find((s) => s.name.toLowerCase() === currentAccount.name.toLowerCase()) ||
      null
    );
  }, [currentAccount, safeStudents]);

  const matchingTeacher = useMemo(() => {
    if (!currentAccount) return null;
    return (
      safeTeachers.find((t) => currentAccount.personId && t.id === currentAccount.personId) ||
      safeTeachers.find((t) => currentAccount.identifier && t.nip === currentAccount.identifier) ||
      safeTeachers.find((t) => t.name.toLowerCase() === currentAccount.name.toLowerCase()) ||
      null
    );
  }, [currentAccount, safeTeachers]);

  const [personType, setPersonType] = useState<'student' | 'teacher'>(() => {
    if (userRole === 'siswa') return 'student';
    if (userRole === 'guru') return 'teacher';
    return 'student';
  });

  const [selectedPersonId, setSelectedPersonId] = useState<string>(() => {
    if (userRole === 'siswa') return matchingStudent?.id || safeStudents[0]?.id || '';
    if (userRole === 'guru') return matchingTeacher?.id || safeTeachers[0]?.id || '';
    return safeStudents[0]?.id || '';
  });

  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine' | 'class'>(() => {
    if (userRole === 'siswa') return 'mine';
    return 'all';
  });
  const [leaveType, setLeaveType] = useState<'sakit' | 'izin' | 'dispensasi'>('sakit');
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [reason, setReason] = useState('');
  const [docName, setDocName] = useState('');
  const [docDataUrl, setDocDataUrl] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'returned' | 'rejected'>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit & Delete Modal States
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [editFileError, setEditFileError] = useState<string | null>(null);
  const [editFileSuccess, setEditFileSuccess] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [deletingLeave, setDeletingLeave] = useState<LeaveRequest | null>(null);

  // Document Viewer Gallery Modal State
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [docViewerIndex, setDocViewerIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPerson = useMemo(() => {
    if (userRole === 'siswa') {
      return matchingStudent || safeStudents.find((s) => s.id === selectedPersonId) || safeStudents[0] || null;
    }
    if (userRole === 'guru') {
      return matchingTeacher || safeTeachers.find((t) => t.id === selectedPersonId) || safeTeachers[0] || null;
    }
    return personType === 'student'
      ? safeStudents.find((s) => s.id === selectedPersonId) || safeStudents[0] || null
      : safeTeachers.find((t) => t.id === selectedPersonId) || safeTeachers[0] || null;
  }, [userRole, matchingStudent, matchingTeacher, personType, selectedPersonId, safeStudents, safeTeachers]);

  // File Validation & Conversion (Only PDF & JPG/PNG, max 5MB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setFileSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setFileError('Format file tidak didukung! Harap unggah surat dalam format PDF atau Gambar (JPG/PNG).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > maxSizeBytes) {
      setFileError(`Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB)! Batas maksimal adalah 5.0 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDocDataUrl(reader.result as string);
      setDocName(file.name);
      setFileSuccess(`File ${file.name} (${(file.size / 1024).toFixed(0)} KB) siap diunggah.`);
    };
    reader.onerror = () => {
      setFileError('Gagal membaca file lokal. Silakan coba file lain.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitNewLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || !reason.trim()) {
      alert('Harap lengkapi alasan pengajuan izin/sakit.');
      return;
    }

    const isStudent = personType === 'student';
    const finalDocName = docName.trim() ? docName.trim() : undefined;
    const finalDataUrl = docDataUrl;

    const newReq: LeaveRequest = {
      id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      personId: selectedPerson.id,
      personType,
      personName: selectedPerson.name,
      classOrSubject: isStudent ? (selectedPerson as Student).className : (selectedPerson as Teacher).subject,
      type: leaveType,
      startDate,
      endDate,
      reason: reason.trim(),
      documentName: finalDocName,
      documentUrl: finalDataUrl,
      status: 'pending',
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    playBeepSound();
    onAddLeaveRequest(newReq);
    setReason('');
    setDocName('');
    setDocDataUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileError(null);
    setFileSuccess(null);
    setShowAddForm(false);
  };

  // Edit & Delete handlers
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFileError(null);
    setEditFileSuccess(null);
    const file = e.target.files?.[0];
    if (!file || !editingLeave) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setEditFileError('Format file tidak didukung! Harap unggah surat dalam format PDF atau Gambar (JPG/PNG).');
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    if (file.size > maxSizeBytes) {
      setEditFileError(`Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB)! Batas maksimal adalah 5.0 MB.`);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditingLeave({
        ...editingLeave,
        documentUrl: reader.result as string,
        documentName: file.name,
      });
      setEditFileSuccess(`File baru ${file.name} berhasil dipilih.`);
    };
    reader.onerror = () => {
      setEditFileError('Gagal membaca file lokal.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeave) return;
    if (!editingLeave.reason.trim()) {
      alert('Alasan permohonan tidak boleh kosong.');
      return;
    }

    playBeepSound();
    if (onEditLeaveRequest) {
      onEditLeaveRequest(editingLeave);
    }
    setEditingLeave(null);
    setEditFileError(null);
    setEditFileSuccess(null);
  };

  const handleConfirmDeleteLeave = () => {
    if (!deletingLeave) return;
    playBeepSound();
    if (onDeleteLeaveRequest) {
      onDeleteLeaveRequest(deletingLeave.id);
    }
    setDeletingLeave(null);
  };

  // Convert leaves into gallery documents
  const galleryDocuments: DocumentItem[] = safeLeaves
    .filter((l) => l.documentName)
    .map((l) => ({
      id: l.id,
      title: `${l.type.toUpperCase()} - ${l.personName}`,
      type: l.documentName?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
      url:
        l.documentUrl ||
        (l.documentName?.toLowerCase().endsWith('.pdf')
          ? 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
          : 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80'),
      fileName: l.documentName || 'surat_keterangan.pdf',
      uploaderName: l.personName,
      uploaderRole: l.classOrSubject,
      date: `${l.startDate} s/d ${l.endDate}`,
      status: l.status,
    }));

  const openDocumentModal = (leaveId: string) => {
    const idx = galleryDocuments.findIndex((d) => d.id === leaveId);
    setDocViewerIndex(idx >= 0 ? idx : 0);
    setIsDocViewerOpen(true);
  };

  const isKepsekUser = useMemo(() => {
    return isPrincipalUser(currentAccount, config?.principalNip, config?.principalName);
  }, [currentAccount, config?.principalNip, config?.principalName]);

  const isAdminAcc = useMemo(() => {
    return isAdminUser(userRole, currentAccount);
  }, [userRole, currentAccount]);

  const isGuruAcc = useMemo(() => {
    if (isKepsekUser || isAdminAcc) return false;
    return userRole === 'guru' || currentAccount?.role === 'guru';
  }, [userRole, currentAccount, isKepsekUser, isAdminAcc]);

  const isPiketAcc = useMemo(() => {
    return userRole === 'piket' || currentAccount?.role === 'piket';
  }, [userRole, currentAccount]);

  // Hak Akses Persetujuan Sesuai Kebijakan:
  // 1. Izin Guru GTK: HANYA Kepala Sekolah (akun kepsek) dan Admin (akun admin) yang bisa setujui, kembalikan, dan tolak.
  // 2. Izin Siswa: HANYA Kepala Sekolah (akun kepsek), Guru GTK (akun guru), Piket (akun piket), dan Admin (akun admin) yang bisa setujui, kembalikan, dan tolak.
  const canApprove = (item: LeaveRequest) => {
    if (item.personType === 'teacher') {
      return isKepsekUser || isAdminAcc;
    }
    // Siswa leave: Kepala Sekolah, Guru GTK, Piket, and Admin
    return isKepsekUser || isGuruAcc || isPiketAcc || isAdminAcc;
  };

  const canEditOrDelete = (item: LeaveRequest) => {
    if (userRole === 'admin' || userRole === 'piket') return true;
    if (userRole === 'siswa') {
      const myId = matchingStudent?.id || currentAccount?.personId;
      const myName = (currentAccount?.name || '').toLowerCase();
      return (
        item.personType === 'student' &&
        (item.personId === myId || item.personName.toLowerCase() === myName) &&
        item.status === 'pending'
      );
    }
    if (userRole === 'guru') {
      const myId = matchingTeacher?.id || currentAccount?.personId;
      const myName = (currentAccount?.name || '').toLowerCase();
      return (
        item.personType === 'teacher' &&
        (item.personId === myId || item.personName.toLowerCase() === myName) &&
        item.status === 'pending'
      );
    }
    return false;
  };

  const filteredLeaves = safeLeaves.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (userRole === 'siswa') {
      if (scopeFilter === 'mine') {
        const myId = matchingStudent?.id || currentAccount?.personId;
        const myName = (currentAccount?.name || '').toLowerCase();
        return l.personId === myId || l.personName.toLowerCase() === myName;
      }
      if (scopeFilter === 'class' && matchingStudent) {
        return l.personType === 'student' && l.classOrSubject === matchingStudent.className;
      }
    } else if (userRole === 'guru') {
      if (scopeFilter === 'mine') {
        const myId = matchingTeacher?.id || currentAccount?.personId;
        const myName = (currentAccount?.name || '').toLowerCase();
        return l.personType === 'teacher' && (l.personId === myId || l.personName.toLowerCase() === myName);
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-lg text-slate-900">
              Pengajuan Izin, Sakit & Dispensasi Sekolah
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Layanan permohonan ketidakhadiran resmi dengan unggah surat dokter PDF/JPG dan validasi wali kelas
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {galleryDocuments.length > 0 && (
            <button
              onClick={() => {
                setDocViewerIndex(0);
                setIsDocViewerOpen(true);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center space-x-1.5 border border-slate-200"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Galeri Dokumen ({galleryDocuments.length})</span>
            </button>
          )}

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Tutup Formulir' : 'Ajukan Izin / Sakit Baru'}</span>
          </button>
        </div>
      </div>

      {/* Add New Leave Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmitNewLeave}
          className="p-6 rounded-[2.5rem] bg-white border border-indigo-200 shadow-sm space-y-4 animate-in fade-in duration-200"
        >
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Formulir Pengajuan Ketidakhadiran & Unggah Surat</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Person Type & Select / Verified Identity */}
            {userRole === 'siswa' ? (
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>Identitas Pemohon (Siswa)</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Akun Terautentikasi
                  </span>
                </label>
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-xs text-slate-900">
                      {matchingStudent?.name || currentAccount?.name || 'Siswa'}
                    </span>
                    <span className="text-[11px] text-indigo-700 font-medium">
                      ({matchingStudent?.className || currentAccount?.classOrSubject || 'Siswa'})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200 font-bold">
                    NISN: {matchingStudent?.nisn || currentAccount?.identifier || '-'}
                  </span>
                </div>
              </div>
            ) : userRole === 'guru' ? (
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>Identitas Pemohon (Guru / GTK)</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Akun Terautentikasi
                  </span>
                </label>
                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-xs text-slate-900">
                      {matchingTeacher?.name || currentAccount?.name || 'Guru'}
                    </span>
                    <span className="text-[11px] text-purple-700 font-medium">
                      [{matchingTeacher?.employmentStatus || 'GTK'}]
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200 font-bold">
                    NIP: {matchingTeacher?.nip || currentAccount?.identifier || '-'}
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Person Type */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Kategori Pemohon
                  </label>
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setPersonType('student');
                        setSelectedPersonId(safeStudents[0]?.id || '');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        personType === 'student' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Siswa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPersonType('teacher');
                        setSelectedPersonId(safeTeachers[0]?.id || '');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        personType === 'teacher' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Guru & Pegawai
                    </button>
                  </div>
                </div>

                {/* Select Person */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nama Pemohon
                  </label>
                  <select
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {personType === 'student'
                      ? safeStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.className})
                          </option>
                        ))
                      : safeTeachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.subject})
                          </option>
                        ))}
                  </select>
                </div>
              </>
            )}

            {/* Leave Type */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Jenis Permohonan
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as any)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="sakit">Sakit (Dengan Surat Dokter)</option>
                <option value="izin">Izin (Keperluan Keluarga/Mendesak)</option>
                <option value="dispensasi">Dispensasi (Lomba / Tugas Sekolah)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Alasan Lengkap
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Mengalami demam dan radang tenggorokan, surat keterangan dokter terlampir."
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Document Attachment with PDF & JPG Validation (OPSIONAL) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                <span>Unggah Surat Izin / Bukti Dukung (Opsional - PDF atau JPG/PNG)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">Maks. 5 MB • Tidak Wajib</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Lampirkan foto surat keterangan dokter, surat izin orang tua/wali, atau surat tugas jika ada. Dapat dikosongkan jika izin lisan/darurat.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,.jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer bg-white p-1 rounded-xl border border-slate-200"
              />

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setDocName('surat_dokter_resmi_klinik_sehat.pdf');
                    setDocDataUrl('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
                    setFileSuccess('Menggunakan file sampel simulasi: surat_dokter_resmi_klinik_sehat.pdf');
                    setFileError(null);
                  }}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  Gunakan Sampel
                </button>

                {(docName || docDataUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocName('');
                      setDocDataUrl(undefined);
                      setFileSuccess(null);
                      setFileError(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer shrink-0 border border-rose-200"
                    title="Hapus lampiran"
                  >
                    Hapus Lampiran
                  </button>
                )}
              </div>
            </div>

            {fileError && (
              <div className="flex items-center space-x-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{fileError}</span>
              </div>
            )}

            {fileSuccess && (
              <div className="flex items-center space-x-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{fileSuccess}</span>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFileError(null);
                setFileSuccess(null);
              }}
              className="px-5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Kirim Permohonan</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs for Leave Scope and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Scope Selector for Siswa / Guru */}
        {userRole === 'siswa' && (
          <div className="flex items-center space-x-1.5 bg-indigo-50/80 p-1 rounded-2xl border border-indigo-200 shrink-0">
            <button
              type="button"
              onClick={() => setScopeFilter('mine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                scopeFilter === 'mine'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-indigo-600 hover:text-indigo-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Pengajuan Saya</span>
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('class')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                scopeFilter === 'class'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-indigo-600 hover:text-indigo-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Teman Sekelas ({matchingStudent?.className || 'Kelas'})</span>
            </button>
          </div>
        )}

        {userRole === 'guru' && (
          <div className="flex items-center space-x-1.5 bg-purple-50/80 p-1 rounded-2xl border border-purple-200 shrink-0">
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                scopeFilter === 'all'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-purple-600 hover:text-purple-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Semua Permohonan</span>
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('mine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                scopeFilter === 'mine'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-purple-600 hover:text-purple-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Izin GTK Saya</span>
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Semua ({safeLeaves.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Menunggu ({safeLeaves.filter((l) => l.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('returned')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'returned' ? 'bg-amber-800 text-white shadow-xs' : 'bg-white text-amber-800 border border-amber-200'
            }`}
          >
            Dikembalikan ({safeLeaves.filter((l) => l.status === 'returned').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Disetujui ({safeLeaves.filter((l) => l.status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Ditolak ({safeLeaves.filter((l) => l.status === 'rejected').length})
          </button>
        </div>
      </div>

      {/* GTK Authorization Policy Notice */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-between text-xs text-indigo-950">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-extrabold text-[12px] text-slate-900">
              Otoritas Izin GTK: Kepala Sekolah & Administrator
            </p>
            <p className="text-[11px] text-slate-600">
              Sesuai aturan kedinasan, yang berhak menyetujui, mengembalikan berkas, dan menolak izin GTK hanya <strong>Kepala Sekolah</strong> (melalui akun kepala sekolah) dan <strong>Admin</strong> (melalui akun admin).
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-1.5">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              isKepsekUser || isAdminAcc
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {isKepsekUser
              ? '👑 Otoritas: Kepala Sekolah'
              : isAdminAcc
              ? '🛡️ Otoritas: Administrator'
              : '🔒 Izin GTK Dibatasi'}
          </span>
        </div>
      </div>

      {/* Leave Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLeaves.length === 0 ? (
          <div className="col-span-2 p-12 text-center rounded-[2.5rem] bg-white border border-slate-200/90 text-slate-400 text-xs">
            Tidak ada permohonan izin/sakit pada kategori ini.
          </div>
        ) : (
          filteredLeaves.map((item) => {
            const isPending = item.status === 'pending';
            const isApproved = item.status === 'approved';
            const isReturned = item.status === 'returned';
            const isPdf = item.documentName?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={item.id}
                className="p-5 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        item.type === 'sakit'
                          ? 'bg-blue-100 text-blue-800'
                          : item.type === 'dispensasi'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.type.toUpperCase()}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isReturned
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
                          : isPending
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span>
                        {isApproved
                          ? 'Disetujui'
                          : isReturned
                          ? 'Dikembalikan (Revisi)'
                          : isPending
                          ? 'Menunggu Review'
                          : 'Ditolak'}
                      </span>
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {item.personName}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {item.classOrSubject} • Diajukan pukul {item.createdAt} WIB
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        {formatDateIndo(item.startDate)}
                        {item.startDate !== item.endDate && ` s/d ${formatDateIndo(item.endDate)}`}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] pt-1 leading-relaxed">
                      "{item.reason}"
                    </p>
                  </div>

                  {item.documentName ? (
                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900">
                      <div className="flex items-center space-x-2 min-w-0">
                        {isPdf ? (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                        <span className="text-xs font-semibold truncate">{item.documentName}</span>
                      </div>
                      <button
                        onClick={() => openDocumentModal(item.id)}
                        className="px-3 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-xl text-[11px] font-bold border border-indigo-200 transition-all cursor-pointer flex items-center space-x-1 shadow-xs shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-400">
                      <Paperclip className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span>Tanpa lampiran dokumen bukti (Pengajuan izin tertulis)</span>
                    </div>
                  )}

                  {item.reviewNote && (
                    <p className="text-[11px] text-slate-500 italic">
                      Catatan Verifikasi: {item.reviewNote}
                    </p>
                  )}
                </div>

                {/* Card Actions: Edit, Delete, and Status Approval */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    {canEditOrDelete(item) && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLeave({ ...item });
                            setEditFileError(null);
                            setEditFileSuccess(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                          title="Edit pengajuan izin"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingLeave(item)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                          title="Hapus pengajuan izin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </>
                    )}
                  </div>

                  {(isPending || isReturned) && (
                    <>
                      {canApprove(item) ? (
                        <div className="flex items-center space-x-2">
                          {/* Tombol Kembalikan (Untuk GTK dan Siswa) */}
                          <button
                            type="button"
                            onClick={() => {
                              const reviewerName = isKepsekUser
                                ? config?.principalName || currentAccount?.name || 'Kepala Sekolah'
                                : isAdminAcc
                                ? config?.adminName || currentAccount?.name || 'Admin'
                                : isPiketAcc
                                ? currentAccount?.name || 'Petugas Piket'
                                : currentAccount?.name || 'Guru GTK';
                              const reviewerRole = isKepsekUser
                                ? 'Kepala Sekolah'
                                : isAdminAcc
                                ? 'Administrator'
                                : isPiketAcc
                                ? 'Petugas Piket'
                                : 'Guru GTK';
                              const defaultNote =
                                item.personType === 'teacher'
                                  ? 'Mohon lengkapi dokumen pendukung / perbaiki tanggal izin GTK.'
                                  : 'Mohon lengkapi surat keterangan / perbaiki tanggal izin siswa.';
                              const reasonInput = window.prompt(
                                `Catatan pengembalian berkas / revisi untuk ${item.personType === 'teacher' ? 'GTK' : 'Siswa'}:`,
                                defaultNote
                              );
                              if (reasonInput !== null) {
                                onUpdateLeaveStatus(
                                  item.id,
                                  'returned',
                                  reasonInput.trim() || 'Berkas dikembalikan untuk revisi',
                                  { name: reviewerName, role: reviewerRole }
                                );
                              }
                            }}
                            className="px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                            title={`Kembalikan izin ${item.personType === 'teacher' ? 'GTK' : 'Siswa'} ke pemohon untuk direvisi/dilengkapi`}
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                            <span>Kembalikan</span>
                          </button>

                          {/* Tombol Tolak */}
                          <button
                            type="button"
                            onClick={() => {
                              const reviewerName = isKepsekUser
                                ? config?.principalName || currentAccount?.name || 'Kepala Sekolah'
                                : isAdminAcc
                                ? config?.adminName || currentAccount?.name || 'Admin'
                                : isPiketAcc
                                ? currentAccount?.name || 'Petugas Piket'
                                : currentAccount?.name || 'Guru GTK';
                              const reviewerRole = isKepsekUser
                                ? 'Kepala Sekolah'
                                : isAdminAcc
                                ? 'Administrator'
                                : isPiketAcc
                                ? 'Petugas Piket'
                                : 'Guru GTK';
                              const defaultRejectReason =
                                item.personType === 'teacher'
                                  ? 'Tidak memenuhi ketentuan / jadwal bertabrakan dengan agenda dinas.'
                                  : 'Ditolak (Dokumen tidak lengkap/alasan tidak dapat diverifikasi).';
                              const rejectReason = window.prompt(
                                `Alasan penolakan izin ${item.personType === 'teacher' ? 'GTK' : 'Siswa'}:`,
                                defaultRejectReason
                              );
                              if (rejectReason !== null) {
                                onUpdateLeaveStatus(
                                  item.id,
                                  'rejected',
                                  `Ditolak oleh ${reviewerRole} (${reviewerName}): ${rejectReason}`,
                                  { name: reviewerName, role: reviewerRole }
                                );
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                            title={`Tolak pengajuan izin ${item.personType === 'teacher' ? 'GTK' : 'Siswa'}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>

                          {/* Tombol Setujui */}
                          <button
                            type="button"
                            onClick={() => {
                              const reviewerName = isKepsekUser
                                ? config?.principalName || currentAccount?.name || 'Kepala Sekolah'
                                : isAdminAcc
                                ? config?.adminName || currentAccount?.name || 'Admin'
                                : isPiketAcc
                                ? currentAccount?.name || 'Petugas Piket'
                                : currentAccount?.name || 'Guru GTK';
                              const reviewerRole = isKepsekUser
                                ? 'Kepala Sekolah'
                                : isAdminAcc
                                ? 'Administrator'
                                : isPiketAcc
                                ? 'Petugas Piket'
                                : 'Guru GTK';
                              onUpdateLeaveStatus(
                                item.id,
                                'approved',
                                `Disetujui oleh ${reviewerRole} (${reviewerName})`,
                                { name: reviewerName, role: reviewerRole }
                              );
                            }}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                            title={`Setujui pengajuan izin ${item.personType === 'teacher' ? 'GTK' : 'Siswa'}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Setujui</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {item.personType === 'teacher'
                              ? 'Hanya Kepala Sekolah (akun kepsek) & Admin (akun admin) yang berwenang memproses izin GTK'
                              : 'Hanya Kepala Sekolah, Guru GTK, Piket & Admin yang berwenang memproses izin siswa'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Leave Modal */}
      {editingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Edit Pengajuan Izin / Sakit
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingLeave.personName} ({editingLeave.classOrSubject})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingLeave(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLeave} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Jenis Permohonan
                </label>
                <select
                  value={editingLeave.type}
                  onChange={(e) =>
                    setEditingLeave({
                      ...editingLeave,
                      type: e.target.value as 'sakit' | 'izin' | 'dispensasi',
                    })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="sakit">Sakit (Dengan Surat Dokter)</option>
                  <option value="izin">Izin (Keperluan Keluarga/Mendesak)</option>
                  <option value="dispensasi">Dispensasi (Lomba / Tugas Sekolah)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={editingLeave.startDate}
                    onChange={(e) =>
                      setEditingLeave({ ...editingLeave, startDate: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={editingLeave.endDate}
                    onChange={(e) =>
                      setEditingLeave({ ...editingLeave, endDate: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Alasan Permohonan
                </label>
                <textarea
                  rows={2}
                  value={editingLeave.reason}
                  onChange={(e) =>
                    setEditingLeave({ ...editingLeave, reason: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Status Verifikasi
                </label>
                <select
                  value={editingLeave.status}
                  onChange={(e) =>
                    setEditingLeave({
                      ...editingLeave,
                      status: e.target.value as 'pending' | 'approved' | 'rejected',
                    })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="pending">Menunggu Review</option>
                  <option value="approved">Disetujui</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Catatan Review / Verifikasi (Opsional)
                </label>
                <input
                  type="text"
                  value={editingLeave.reviewNote || ''}
                  onChange={(e) =>
                    setEditingLeave({ ...editingLeave, reviewNote: e.target.value })
                  }
                  placeholder="Catatan dari guru piket atau wali kelas"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              {/* Document update */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">Lampiran Dokumen Bukti</span>
                  {editingLeave.documentName && (
                    <span className="text-[10px] text-indigo-700 font-semibold truncate max-w-[200px]">
                      Saat ini: {editingLeave.documentName}
                    </span>
                  )}
                </div>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleEditFileChange}
                  className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {editFileError && (
                  <p className="text-[10px] text-rose-600 font-semibold">{editFileError}</p>
                )}
                {editFileSuccess && (
                  <p className="text-[10px] text-emerald-600 font-semibold">{editFileSuccess}</p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLeave(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-sm text-slate-900">
                Hapus Pengajuan Izin?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus permohonan{' '}
                <strong className="text-slate-800">{deletingLeave.type.toUpperCase()}</strong> atas nama{' '}
                <strong className="text-slate-800">{deletingLeave.personName}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLeave(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLeave}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document Viewer Modal */}
      <DocumentViewer
        documents={galleryDocuments}
        initialIndex={docViewerIndex}
        isOpen={isDocViewerOpen}
        onClose={() => setIsDocViewerOpen(false)}
        onApprove={(docId) => {
          onUpdateLeaveStatus(docId, 'approved', 'Disetujui langsung melalui Pratinjau Dokumen Viewer');
          setIsDocViewerOpen(false);
        }}
        onReject={(docId) => {
          onUpdateLeaveStatus(docId, 'rejected', 'Ditolak saat pemeriksaan Pratinjau Dokumen');
          setIsDocViewerOpen(false);
        }}
      />
    </div>
  );
};

