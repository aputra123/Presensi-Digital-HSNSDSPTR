import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Edit2,
  Trash2,
  CreditCard,
  X,
  AlertCircle,
  Users,
  Download,
  Upload,
  Link as LinkIcon,
  ScanFace,
  QrCode,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  List,
  Fingerprint,
  School,
  FileSpreadsheet,
  Filter,
  Layers,
  RefreshCw,
  Database,
  CheckCircle2,
  FileJson,
} from 'lucide-react';
import { Student, SchoolClass, ActiveTab, Teacher, ToastNotification, SchoolConfig } from '../types';
import { formatDriveUrl, downloadCsv } from '../utils/soundAndDate';
import { generateQRCodeDataUrl } from '../utils/qrGenerator';
import { BiometricRegistrationGuideModal } from './BiometricRegistrationGuideModal';
import { ClassManagementModal } from './ClassManagementModal';
import { StudentImportModal } from './StudentImportModal';
import { StudentAcademicDistributionChart } from './StudentAcademicDistributionChart';
import { RombelOverviewExportModal } from './RombelOverviewExportModal';
import { syncEventEmitter, SyncRowStatus, SyncTarget, SyncRowEvent } from '../utils/syncEventEmitter';
import { SanitizedInput } from './SanitizedInput';
import { ClassIdValidityTooltip } from './ClassIdValidityTooltip';
import { exportClassesToCsv, exportClassesToJson } from '../utils/classIntegrityUtils';

interface StudentManagementTabProps {
  students?: Student[];
  classes?: SchoolClass[];
  teachers?: Teacher[];
  config?: SchoolConfig;
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddClass?: (newClass: SchoolClass) => void;
  onUpdateClass?: (updatedClass: SchoolClass) => void;
  onDeleteClass?: (id: string) => void;
  onBatchUpdateClasses?: (classes: SchoolClass[]) => void;
  onAddNotification?: (notification: ToastNotification) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

const PRESET_STUDENT_AVATARS = [
  { label: 'Siswa Putra 1', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
  { label: 'Siswa Putri 1 (Hijab)', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80' },
  { label: 'Siswa Putra 2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
  { label: 'Siswa Putri 2', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80' },
];

type StudentSortBy = 'name' | 'nisn' | 'class' | 'gender' | 'nik';

export const StudentManagementTab: React.FC<StudentManagementTabProps> = ({
  students = [],
  classes = [],
  teachers = [],
  config,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onBatchUpdateClasses,
  onAddNotification,
  setActiveTab,
}) => {
  const safeStudents = students || [];
  const safeClasses = classes || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<StudentSortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [openClassAddDirectly, setOpenClassAddDirectly] = useState(false);
  const [showRombelExportModal, setShowRombelExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showBiometricGuide, setShowBiometricGuide] = useState(false);
  const [selectedStudentForGuide, setSelectedStudentForGuide] = useState<Student | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time visual feedback per-row sync states
  const [syncRowStatus, setSyncRowStatus] = useState<
    Record<string, { status: SyncRowStatus; target: SyncTarget; timestamp: number; message?: string }>
  >({});
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [showRombelBackupDropdown, setShowRombelBackupDropdown] = useState(false);

  // Subscribe to sync event emitter for real-time visual feedback on student rows
  useEffect(() => {
    const unsubscribe = syncEventEmitter.subscribe((event: SyncRowEvent) => {
      if (event.entity === 'student' || event.entity === 'all') {
        if (event.rowId) {
          setSyncRowStatus((prev) => ({
            ...prev,
            [event.rowId!]: {
              status: event.status,
              target: event.target,
              timestamp: event.timestamp,
              message: event.message,
            },
          }));
        } else if (event.status === 'syncing' || event.status === 'synced') {
          // Broadcast batch updates across all student rows
          setSyncRowStatus((prev) => {
            const next = { ...prev };
            safeStudents.forEach((s) => {
              next[s.id] = {
                status: event.status,
                target: event.target,
                timestamp: event.timestamp,
                message: event.message,
              };
            });
            return next;
          });
        }
      }
    });

    return () => unsubscribe();
  }, [safeStudents]);

  // Handlers for Rombel Backup and Real-time Sync
  const handleTriggerStudentSync = (target: SyncTarget = 'localStorage') => {
    if (safeStudents.length === 0) return;
    setIsBatchSyncing(true);

    syncEventEmitter.emit({
      entity: 'student',
      status: 'syncing',
      target,
      timestamp: Date.now(),
      message: `Menyinkronkan ${safeStudents.length} siswa ke ${target}...`,
    });

    // Stagger per-row visual feedback
    safeStudents.forEach((student, index) => {
      setTimeout(() => {
        syncEventEmitter.triggerRowSyncCycle('student', student.id, target, 500);
      }, index * 45);
    });

    const totalDuration = safeStudents.length * 45 + 600;
    setTimeout(() => {
      setIsBatchSyncing(false);
      if (onAddNotification) {
        onAddNotification({
          id: `sync_notif_${Date.now()}`,
          title: '✓ Sinkronisasi Baris Data Selesai',
          message: `Seluruh ${safeStudents.length} siswa berhasil disinkronkan ke ${
            target === 'firebase' ? 'Cloud Firebase' : 'database lokal'
          } dengan verifikasi real-time.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }
    }, totalDuration);
  };

  const handleExportRombelCsv = () => {
    exportClassesToCsv(safeClasses, safeStudents, config?.schoolName);
    setShowRombelBackupDropdown(false);
    if (onAddNotification) {
      onAddNotification({
        id: `rombel_csv_${Date.now()}`,
        title: '📄 Ekspor CSV Rombel Berhasil',
        message: `Cadangan data ${safeClasses.length} rombongan belajar berhasil diunduh dalam format CSV.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
  };

  const handleExportRombelJson = () => {
    exportClassesToJson(safeClasses, safeStudents, config?.schoolName);
    setShowRombelBackupDropdown(false);
    if (onAddNotification) {
      onAddNotification({
        id: `rombel_json_${Date.now()}`,
        title: '💾 Pencadangan JSON Rombel Mandiri Berhasil',
        message: `Cadangan data rombongan belajar (${safeClasses.length} rombel) berhasil diekspor secara terpisah dari snapshot sistem.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
  };

  // Helper to accurately match students to academic levels
  const isStudentInGrade = (s: Student, gradeFilter: string): boolean => {
    if (gradeFilter === 'ALL') return true;
    const studentClassObj = safeClasses.find((c) => c.id === s.classId || c.name.toLowerCase() === s.className.toLowerCase());
    const studentGrade = studentClassObj?.grade || (
      /^VII(\s|$|\.)|^7(\s|\.|\-|$)/i.test(s.className) ? '7' :
      /^VIII(\s|$|\.)|^8(\s|\.|\-|$)/i.test(s.className) ? '8' :
      /^IX(\s|$|\.)|^9(\s|\.|\-|$)/i.test(s.className) ? '9' :
      /^X(\s|$|\.|\-)|^10(\s|\.|\-|$)/i.test(s.className) ? '10' :
      /^XI(\s|$|\.|\-)|^11(\s|\.|\-|$)/i.test(s.className) ? '11' :
      /^XII(\s|$|\.|\-)|^12(\s|\.|\-|$)/i.test(s.className) ? '12' :
      /^1(\s|\.|\-|$)|^Kelas 1/i.test(s.className) ? '1' :
      /^2(\s|\.|\-|$)|^Kelas 2/i.test(s.className) ? '2' :
      /^3(\s|\.|\-|$)|^Kelas 3/i.test(s.className) ? '3' :
      /^4(\s|\.|\-|$)|^Kelas 4/i.test(s.className) ? '4' :
      /^5(\s|\.|\-|$)|^Kelas 5/i.test(s.className) ? '5' :
      /^6(\s|\.|\-|$)|^Kelas 6/i.test(s.className) ? '6' : 'OTHER'
    );

    if (gradeFilter === 'OTHER') {
      return !['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].includes(studentGrade);
    }
    return studentGrade === gradeFilter;
  };

  const handleHeaderSort = (field: StudentSortBy) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const renderSortIndicator = (field: StudentSortBy) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
    );
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    nisn: '',
    nik: '',
    classId: safeClasses[0]?.id || 'c1',
    className: safeClasses[0]?.name || 'VII A',
    gender: 'L',
    parentPhone: '',
    email: '',
    address: '',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80',
  });

  // Validation: Check if assigned class exists in active registered classes
  const isAssignedClassValid = useMemo(() => {
    if (!formData.classId) return false;
    return safeClasses.some((c) => c.id === formData.classId || c.name === formData.className);
  }, [formData.classId, formData.className, safeClasses]);

  // Validation: Check duplicate NISN
  const isDuplicateNisn = useMemo(() => {
    if (!formData.nisn || !formData.nisn.trim()) return false;
    return safeStudents.some(
      (s) => s.nisn.trim() === formData.nisn?.trim() && s.id !== editingStudent?.id
    );
  }, [formData.nisn, safeStudents, editingStudent]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [qrModalStudent, setQrModalStudent] = useState<{ student: Student; qrUrl: string } | null>(null);

  const handleShowQrCode = async (student: Student) => {
    const qrUrl = await generateQRCodeDataUrl({
      id: student.id,
      name: student.name,
      identifier: student.nisn,
      type: 'student',
      classOrSubject: student.className,
      schoolNpsn: '69904123',
    });
    setQrModalStudent({ student, qrUrl });
  };

  // Classes filtered by selected grade
  const classesForSelectedGrade = useMemo(() => {
    if (selectedGradeFilter === 'ALL') return safeClasses;
    return safeClasses.filter((c) => {
      if (selectedGradeFilter === '7') return c.grade === '7' || c.name.startsWith('VII') || c.name.startsWith('7.');
      if (selectedGradeFilter === '8') return c.grade === '8' || c.name.startsWith('VIII') || c.name.startsWith('8.');
      if (selectedGradeFilter === '9') return c.grade === '9' || c.name.startsWith('IX') || c.name.startsWith('9.');
      if (selectedGradeFilter === '10') return c.grade === '10' || c.name.startsWith('X-') || c.name.startsWith('X ');
      if (selectedGradeFilter === '11') return c.grade === '11' || c.name.startsWith('XI');
      if (selectedGradeFilter === '12') return c.grade === '12' || c.name.startsWith('XII');
      if (selectedGradeFilter === 'OTHER') return !['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].includes(c.grade);
      return c.grade === selectedGradeFilter;
    });
  }, [safeClasses, selectedGradeFilter]);

  const filteredStudents = useMemo(() => {
    return safeStudents
      .filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.nisn.includes(searchQuery) ||
          (s.nik && s.nik.includes(searchQuery)) ||
          s.className.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesGrade = isStudentInGrade(s, selectedGradeFilter);

        const matchesClass =
          selectedClassId === 'ALL' || s.classId === selectedClassId || s.className === selectedClassId;

        return matchesSearch && matchesGrade && matchesClass;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'name') comp = a.name.localeCompare(b.name, 'id');
        else if (sortBy === 'nisn') comp = a.nisn.localeCompare(b.nisn);
        else if (sortBy === 'class') comp = a.className.localeCompare(b.className, 'id');
        else if (sortBy === 'gender') comp = (a.gender || '').localeCompare(b.gender || '');
        else if (sortBy === 'nik') comp = (a.nik || '').localeCompare(b.nik || '');
        return sortDir === 'asc' ? comp : -comp;
      });
  }, [safeStudents, searchQuery, selectedGradeFilter, selectedClassId, sortBy, sortDir, safeClasses]);

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData({
      name: '',
      nisn: `00${Math.floor(10000000 + Math.random() * 90000000)}`,
      nik: `3174${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      classId: safeClasses[0]?.id || 'c1',
      className: safeClasses[0]?.name || 'X MIPA 1',
      gender: 'L',
      parentPhone: '0812' + Math.floor(10000000 + Math.random() * 90000000),
      email: '',
      address: 'Jl. Merdeka No. ' + Math.floor(1 + Math.random() * 100) + ', Jakarta',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({ ...student });
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(png|jpeg|jpg|webp)/i)) {
      alert('Mohon pilih file gambar format PNG, JPG, atau WEBP.');
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

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nisn) {
      alert('Nama dan NISN wajib diisi!');
      return;
    }

    const formattedAvatar = formatDriveUrl(formData.avatar) || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80';

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        ...formData,
        avatar: formattedAvatar,
      } as Student);
    } else {
      const newStudent: Student = {
        id: `std_${Date.now()}`,
        name: formData.name || '',
        nisn: formData.nisn || '',
        nik: formData.nik || '',
        classId: formData.classId || 'c1',
        className: formData.className || 'X MIPA 1',
        gender: (formData.gender as 'L' | 'P') || 'L',
        parentPhone: formData.parentPhone || '',
        email: formData.email || `${formData.name?.toLowerCase().replace(/\s+/g, '.')}@siswa.sch.id`,
        address: formData.address || '',
        avatar: formattedAvatar,
      };
      onAddStudent(newStudent);
    }

    setIsModalOpen(false);
  };

  const handleExportCsv = () => {
    const headers = ['No', 'Nama Lengkap', 'NISN', 'NIK', 'Kelas / Rombel', 'JK', 'No HP Orang Tua', 'Email Siswa', 'Alamat', 'URL Foto Biometrik'];
    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.name.replace(/"/g, '""')}"`,
      `'${s.nisn}`,
      `'${s.nik || '-'}`,
      `"${s.className}"`,
      s.gender,
      `'${s.parentPhone || '-'}`,
      s.email || '-',
      `"${(s.address || '-').replace(/"/g, '""')}"`,
      `"${s.avatar}"`,
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    downloadCsv(`Master_Siswa_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 lg:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Master Data Peserta Didik (Siswa)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola data profil siswa, NISN, rombel kelas, serta integrasi foto biometrik (PNG, JPG, Drive URL)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="export-rombel-overview-btn"
            onClick={() => setShowRombelExportModal(true)}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-xs"
            title="Ekspor laporan terstruktur data rombel & analisis kapasitas"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Rombel Overview</span>
          </button>

          {/* Real-time Row Synchronization Trigger with Event Emitter */}
          <button
            id="sync-students-realtime-btn"
            onClick={() => handleTriggerStudentSync('localStorage')}
            disabled={isBatchSyncing}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              isBatchSyncing
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-400 animate-pulse'
                : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-xs'
            }`}
            title="Kirim event sinkronisasi real-time ke setiap baris data siswa"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 ${isBatchSyncing ? 'animate-spin' : ''}`} />
            <span>{isBatchSyncing ? 'Menyinkronkan...' : 'Sinkron Real-Time'}</span>
          </button>

          {/* Pencadangan Data Rombel Terpisah (CSV / JSON) */}
          <div className="relative">
            <button
              id="export-rombel-backup-dropdown-btn"
              onClick={() => setShowRombelBackupDropdown((prev) => !prev)}
              className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-amber-200 dark:border-amber-800 shadow-xs"
              title="Pencadangan data rombongan belajar mandiri secara terpisah dari snapshot sistem utama"
            >
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Cadangkan Rombel</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {showRombelBackupDropdown && (
              <div
                className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 z-30 space-y-1 text-xs animate-in fade-in zoom-in-95"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  Pencadangan Rombel Mandiri
                </div>
                <button
                  onClick={handleExportRombelCsv}
                  className="w-full text-left px-2.5 py-2 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-xl flex items-center space-x-2 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="font-bold">Ekspor Rombel (.CSV)</div>
                    <div className="text-[10px] text-slate-400">Format tabular Excel / Google Sheets</div>
                  </div>
                </button>
                <button
                  onClick={handleExportRombelJson}
                  className="w-full text-left px-2.5 py-2 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-xl flex items-center space-x-2 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <FileJson className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <div className="font-bold">Ekspor Rombel (.JSON)</div>
                    <div className="text-[10px] text-slate-400">Backup mandiri struktur rombel & siswa</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            id="manage-classes-header-btn"
            onClick={() => {
              setOpenClassAddDirectly(false);
              setShowClassModal(true);
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <School className="w-4 h-4 text-indigo-600" />
            <span>Kelola Rombel ({classes.length})</span>
          </button>

          <button
            id="add-class-header-btn"
            onClick={() => {
              setOpenClassAddDirectly(true);
              setShowClassModal(true);
            }}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
            title="Input formulir rombel baru per jenjang"
          >
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Input Rombel Baru</span>
          </button>

          <button
            onClick={() => {
              setSelectedStudentForGuide(null);
              setShowBiometricGuide(true);
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Fingerprint className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Panduan Biometrik</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV Siswa</span>
          </button>

          {/* Fitur Impor Data Siswa Massal dari CSV */}
          <button
            id="import-students-csv-btn"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-xs"
            title="Impor data siswa secara massal dari file CSV dengan validasi duplikasi NISN"
          >
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Impor Data Siswa</span>
          </button>

          <button
            onClick={() => setActiveTab('cards')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Cetak Kartu</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa Baru</span>
          </button>
        </div>
      </div>

      {/* Bar Chart Visualization: Distribution of Students Across Academic Levels */}
      <StudentAcademicDistributionChart
        students={safeStudents}
        classes={safeClasses}
        selectedGradeFilter={selectedGradeFilter}
        onSelectGradeFilter={(grade) => {
          setSelectedGradeFilter(grade);
          setSelectedClassId('ALL');
        }}
      />

      {/* Master Jenjang & Rombel Strip */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          {/* Jenjang Selector */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 shrink-0">
              Jenjang:
            </span>
            {[
              { id: 'ALL', label: 'Semua Jenjang', count: safeStudents.length },
              { id: '7', label: 'Jenjang 7 (SMP)', count: safeStudents.filter((s) => isStudentInGrade(s, '7')).length },
              { id: '8', label: 'Jenjang 8 (SMP)', count: safeStudents.filter((s) => isStudentInGrade(s, '8')).length },
              { id: '9', label: 'Jenjang 9 (SMP)', count: safeStudents.filter((s) => isStudentInGrade(s, '9')).length },
              { id: '10', label: 'Jenjang 10 (SMA)', count: safeStudents.filter((s) => isStudentInGrade(s, '10')).length },
              { id: '11', label: 'Jenjang 11 (SMA)', count: safeStudents.filter((s) => isStudentInGrade(s, '11')).length },
              { id: '12', label: 'Jenjang 12 (SMA)', count: safeStudents.filter((s) => isStudentInGrade(s, '12')).length },
              { id: 'OTHER', label: 'SD / Kustom', count: safeStudents.filter((s) => isStudentInGrade(s, 'OTHER')).length },
            ].map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setSelectedGradeFilter(j.id);
                  setSelectedClassId('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  selectedGradeFilter === j.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{j.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedGradeFilter === j.id ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {j.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Class Management Trigger */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowClassModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1.5"
              title="Buka panel kelola dan input rombel/kelas"
            >
              <School className="w-3.5 h-3.5" />
              <span>Kelola & Input Rombel</span>
            </button>
          </div>
        </div>

        {/* Rombel Filter Chips for Selected Jenjang */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full pb-1">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Rombel:</span>
          <button
            onClick={() => setSelectedClassId('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedClassId === 'ALL'
                ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Semua Rombel ({filteredStudents.length})
          </button>
          {classesForSelectedGrade.map((cls) => {
            const count = safeStudents.filter((s) => s.classId === cls.id || s.className === cls.name).length;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedClassId === cls.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cls.name} <span className="opacity-75">({count})</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowClassModal(true)}
            className="px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-dashed border-emerald-300 flex items-center space-x-1"
          >
            <Plus className="w-3 h-3" />
            <span>+ Input Rombel</span>
          </button>
        </div>
      </div>

      {/* Filters, Search & Table Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto flex-1">
          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama siswa, NISN, NIK, kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* Filter by Academic Level Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <label htmlFor="filter-academic-level-dropdown" className="text-[11px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Filter Jenjang:
              </label>
              <select
                id="filter-academic-level-dropdown"
                value={selectedGradeFilter}
                onChange={(e) => {
                  setSelectedGradeFilter(e.target.value);
                  setSelectedClassId('ALL');
                }}
                className="bg-transparent border-0 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="dark:bg-slate-800">Semua Jenjang ({safeStudents.length} Siswa)</option>
                <optgroup label="Tingkat SMP / MTs" className="dark:bg-slate-800">
                  <option value="7">Jenjang 7 / Kelas VII ({safeStudents.filter((s) => isStudentInGrade(s, '7')).length} Siswa)</option>
                  <option value="8">Jenjang 8 / Kelas VIII ({safeStudents.filter((s) => isStudentInGrade(s, '8')).length} Siswa)</option>
                  <option value="9">Jenjang 9 / Kelas IX ({safeStudents.filter((s) => isStudentInGrade(s, '9')).length} Siswa)</option>
                </optgroup>
                <optgroup label="Tingkat SMA / SMK / MA" className="dark:bg-slate-800">
                  <option value="10">Jenjang 10 / Kelas X ({safeStudents.filter((s) => isStudentInGrade(s, '10')).length} Siswa)</option>
                  <option value="11">Jenjang 11 / Kelas XI ({safeStudents.filter((s) => isStudentInGrade(s, '11')).length} Siswa)</option>
                  <option value="12">Jenjang 12 / Kelas XII ({safeStudents.filter((s) => isStudentInGrade(s, '12')).length} Siswa)</option>
                </optgroup>
                <optgroup label="Tingkat SD / MI" className="dark:bg-slate-800">
                  <option value="1">Jenjang 1 (SD) ({safeStudents.filter((s) => isStudentInGrade(s, '1')).length} Siswa)</option>
                  <option value="2">Jenjang 2 (SD) ({safeStudents.filter((s) => isStudentInGrade(s, '2')).length} Siswa)</option>
                  <option value="3">Jenjang 3 (SD) ({safeStudents.filter((s) => isStudentInGrade(s, '3')).length} Siswa)</option>
                  <option value="4">Jenjang 4 (SD) ({safeStudents.filter((s) => isStudentInGrade(s, '4')).length} Siswa)</option>
                  <option value="5">Jenjang 5 (SD) ({safeStudents.filter((s) => isStudentInGrade(s, '5')).length} Siswa)</option>
                  <option value="6">Jenjang 6 (SD) ({safeStudents.filter((s) => isStudentInGrade(s, '6')).length} Siswa)</option>
                </optgroup>
                <optgroup label="Lainnya" className="dark:bg-slate-800">
                  <option value="OTHER">Jenjang Kustom ({safeStudents.filter((s) => isStudentInGrade(s, 'OTHER')).length} Siswa)</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* View Mode & Sort Controls */}
        <div className="flex items-center space-x-2 shrink-0 text-xs">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Tampilan Grid Kartu"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Tampilan Tabel Interaktif"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-400">Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="name">Nama Siswa</option>
            <option value="nisn">NISN</option>
            <option value="class">Kelas / Rombel</option>
            <option value="nik">NIK Siswa</option>
            <option value="gender">Jenis Kelamin</option>
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

      {/* Conditional: Table View or Grid View */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider select-none">
                  <th
                    onClick={() => handleHeaderSort('name')}
                    className="py-3.5 pl-5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Nama Siswa</span>
                      {renderSortIndicator('name')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort('nisn')}
                    className="py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center space-x-1">
                      <span>NISN</span>
                      {renderSortIndicator('nisn')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort('class')}
                    className="py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Kelas / Rombel</span>
                      {renderSortIndicator('class')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort('gender')}
                    className="py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center space-x-1">
                      <span>L/P</span>
                      {renderSortIndicator('gender')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort('nik')}
                    className="py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center space-x-1">
                      <span>NIK</span>
                      {renderSortIndicator('nik')}
                    </div>
                  </th>
                  <th className="py-3.5">Kontak Ortu</th>
                  <th className="py-3.5">Status Sinkron</th>
                  <th className="py-3.5 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((student) => {
                  const syncInfo = syncRowStatus[student.id];
                  const isSyncing = syncInfo?.status === 'syncing';
                  return (
                    <tr
                      key={student.id}
                      className={`transition-all duration-300 ${
                        isSyncing
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-400'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 pl-5">
                        <div className="flex items-center space-x-3">
                          <img
                            src={formatDriveUrl(student.avatar) || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80'}
                            alt={student.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white">{student.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{student.email || 'Email belum diatur'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {student.nisn}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                            {student.className}
                          </span>
                          <ClassIdValidityTooltip student={student} classes={safeClasses} />
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          student.gender === 'L' ? 'bg-indigo-50 text-indigo-700' : 'bg-pink-50 text-pink-700'
                        }`}>
                          {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-600 dark:text-slate-400">
                        {student.nik || '-'}
                      </td>
                      <td className="py-3 font-mono text-slate-700 dark:text-slate-300">
                        {student.parentPhone || '-'}
                      </td>
                      <td className="py-3">
                        {isSyncing ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 animate-pulse border border-indigo-300">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                            <span>Syncing...</span>
                          </span>
                        ) : syncInfo?.status === 'synced' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Tersinkron ({syncInfo.target === 'firebase' ? 'Cloud' : 'Lokal'})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                            <Database className="w-2.5 h-2.5 text-slate-400" />
                            <span>Lokal Siap</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleShowQrCode(student)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(student)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(student.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Students Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const syncInfo = syncRowStatus[student.id];
            const isSyncing = syncInfo?.status === 'syncing';
            return (
              <div
                key={student.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all flex flex-col justify-between space-y-4 relative group p-5 ${
                  isSyncing
                    ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/25 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Top Info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={formatDriveUrl(student.avatar) || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80'}
                          alt={student.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80';
                          }}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                        <span
                          title="Biometrik Wajah Tersinkronisasi"
                          className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-500 text-white rounded-full text-[8px]"
                        >
                          <ScanFace className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {student.className}
                          </span>
                          <ClassIdValidityTooltip student={student} classes={safeClasses} />
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1 leading-tight">
                          {student.name}
                        </h3>
                      </div>
                    </div>

                    {/* Edit, QR & Delete Action Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setSelectedStudentForGuide(student);
                          setShowBiometricGuide(true);
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Panduan Biometrik & Standar Foto Siswa"
                      >
                        <Fingerprint className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShowQrCode(student)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Generate & Unduh QR Code Siswa"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(student)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Edit Data Siswa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(student.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Hapus Siswa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Data Fields */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">NISN:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{student.nisn}</span>
                    </div>
                    {student.nik && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">NIK:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{student.nik}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Jenis Kelamin:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {student.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}
                      </span>
                    </div>
                    {student.parentPhone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">WhatsApp Ortu:</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{student.parentPhone}</span>
                      </div>
                    )}
                    {/* Real-Time Sync Status Line in Grid Card */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Status Sinkron:</span>
                      {isSyncing ? (
                        <span className="inline-flex items-center space-x-1 font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Menyinkronkan...</span>
                        </span>
                      ) : syncInfo?.status === 'synced' ? (
                        <span className="inline-flex items-center space-x-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Tersinkron ({syncInfo.target === 'firebase' ? 'Cloud' : 'Lokal'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-slate-400">
                          <Database className="w-2.5 h-2.5" />
                          <span>Penyimpanan Lokal</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete Alert Modal */}
                {deleteConfirmId === student.id && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl space-y-2">
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                      Hapus data siswa {student.name}?
                    </p>
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          onDeleteStudent(student.id);
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
            );
          })}
        </div>
      )}

      {filteredStudents.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Tidak ada data siswa yang cocok</p>
          <p className="text-xs text-slate-400 mt-1">
            Coba gunakan kata kunci pencarian lain atau pilih kelas yang berbeda.
          </p>
        </div>
      )}

      {/* Modal Add / Edit Student */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              {/* Photo Upload & Preview */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Foto Profil Siswa (PNG / JPG / Link Google Drive)
                </label>

                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src={formatDriveUrl(formData.avatar) || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80'}
                      alt="Preview Foto Siswa"
                      referrerPolicy="no-referrer"
                      className="w-18 h-18 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80';
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-600 text-white">
                      Face Scan
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
                        <span>Atau tempel Link Google Drive:</span>
                      </div>
                      <SanitizedInput
                        id="student-avatar-drive-input"
                        type="text"
                        placeholder="https://drive.google.com/file/d/.../view"
                        value={formData.avatar || ''}
                        onChange={(_e, val) => handleDriveUrlChange(val)}
                        sanitizeOn="both"
                        showSanitizeBadge
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Preset Avatars */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mb-1.5">
                    Preset Foto Profil Siswa:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_STUDENT_AVATARS.map((preset, idx) => (
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
                {/* Inline Validation Warnings */}
                {isDuplicateNisn && (
                  <div className="sm:col-span-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center space-x-2.5 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Peringatan Duplikasi NISN:</strong> NISN <code>{formData.nisn}</code> sudah terdaftar pada siswa lain dalam database.
                    </span>
                  </div>
                )}

                {!isAssignedClassValid && (
                  <div className="sm:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-center space-x-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Peringatan Jenjang Rombel:</strong> Rombongan belajar yang dipilih belum terdaftar atau tidak valid. Silakan pilih kelas terdaftar atau buat rombel baru.
                    </span>
                  </div>
                )}

                {/* Nama Lengkap */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nama Lengkap Siswa *</label>
                  <SanitizedInput
                    id="student-name-input"
                    type="text"
                    required
                    placeholder="Contoh: Muhammad Rizky Pratama"
                    value={formData.name || ''}
                    onChange={(_e, val) => setFormData({ ...formData, name: val })}
                    sanitizeOn="both"
                    showSanitizeBadge
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                  />
                </div>

                {/* NISN */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">NISN (10 Digit) *</label>
                  <SanitizedInput
                    id="student-nisn-input"
                    type="text"
                    required
                    placeholder="0078129001"
                    value={formData.nisn || ''}
                    onChange={(_e, val) => setFormData({ ...formData, nisn: val })}
                    sanitizeOn="both"
                    showSanitizeBadge
                    className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 font-mono text-slate-900 dark:text-white ${
                      isDuplicateNisn
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/20'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                {/* NIK */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">NIK (16 Digit)</label>
                  <SanitizedInput
                    id="student-nik-input"
                    type="text"
                    placeholder="317401..."
                    value={formData.nik || ''}
                    onChange={(_e, val) => setFormData({ ...formData, nik: val })}
                    sanitizeOn="both"
                    showSanitizeBadge
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                {/* Kelas / Rombel */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Rombongan Belajar (Kelas) *</label>
                    <button
                      type="button"
                      onClick={() => setShowClassModal(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer flex items-center space-x-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Input Rombel Baru</span>
                    </button>
                  </div>
                  <select
                    value={formData.classId || (classes[0]?.id || 'c1')}
                    onChange={(e) => {
                      const selected = classes.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        classId: e.target.value,
                        className: selected ? selected.name : 'VII A',
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 dark:text-white"
                  >
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'CUSTOM'].map((gr) => {
                      const grClasses = classes.filter((c) => {
                        if (gr === '7') return c.grade === '7' || c.name.startsWith('VII');
                        if (gr === '8') return c.grade === '8' || c.name.startsWith('VIII');
                        if (gr === '9') return c.grade === '9' || c.name.startsWith('IX');
                        if (gr === '10') return c.grade === '10' || c.name.startsWith('X-') || c.name.startsWith('X ');
                        if (gr === '11') return c.grade === '11' || c.name.startsWith('XI');
                        if (gr === '12') return c.grade === '12' || c.name.startsWith('XII');
                        if (['1', '2', '3', '4', '5', '6'].includes(gr)) return c.grade === gr;
                        return c.grade === gr || !['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].includes(c.grade);
                      });
                      if (grClasses.length === 0) return null;
                      const label = 
                        gr === '7' ? 'Jenjang VII (7 SMP)' :
                        gr === '8' ? 'Jenjang VIII (8 SMP)' :
                        gr === '9' ? 'Jenjang IX (9 SMP)' :
                        gr === '10' ? 'Jenjang 10 (X SMA)' :
                        gr === '11' ? 'Jenjang 11 (XI SMA)' :
                        gr === '12' ? 'Jenjang 12 (XII SMA)' :
                        ['1', '2', '3', '4', '5', '6'].includes(gr) ? `Jenjang ${gr} (SD)` :
                        'Jenjang Lainnya';
                      return (
                        <optgroup key={gr} label={label}>
                          {grClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} - {c.major || `Kelas ${c.grade}`} ({c.roomName || 'Ruang Standar'})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
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

                {/* No HP Orang Tua */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">No. WhatsApp / HP Orang Tua</label>
                  <SanitizedInput
                    id="student-parent-phone-input"
                    type="text"
                    placeholder="081288991001"
                    value={formData.parentPhone || ''}
                    onChange={(_e, val) => setFormData({ ...formData, parentPhone: val })}
                    sanitizeOn="both"
                    showSanitizeBadge
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                {/* Email Siswa */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Email Akun Belajar Siswa</label>
                  <SanitizedInput
                    id="student-email-input"
                    type="email"
                    placeholder="nama@siswa.belajar.id"
                    value={formData.email || ''}
                    onChange={(_e, val) => setFormData({ ...formData, email: val })}
                    sanitizeOn="both"
                    showSanitizeBadge
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                {/* Alamat */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Alamat Tempat Tinggal</label>
                  <SanitizedInput
                    id="student-address-input"
                    type="text"
                    placeholder="Jl. Melawai Raya No. 45, Kebayoran Baru, Jakarta Selatan"
                    value={formData.address || ''}
                    onChange={(_e, val) => setFormData({ ...formData, address: val })}
                    sanitizeOn="both"
                    showSanitizeBadge
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
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
                  {editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code Siswa */}
      {qrModalStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-left">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  QR Presensi Siswa
                </h3>
              </div>
              <button
                onClick={() => setQrModalStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              {qrModalStudent.qrUrl ? (
                <img
                  src={qrModalStudent.qrUrl}
                  alt={`QR Code ${qrModalStudent.student.name}`}
                  className="w-48 h-48 rounded-xl object-contain bg-white p-2 shadow-inner"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                  Membuat QR Code...
                </div>
              )}
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-3">
                {qrModalStudent.student.name}
              </h4>
              <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                NISN: {qrModalStudent.student.nisn}
              </p>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {qrModalStudent.student.className}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <a
                href={qrModalStudent.qrUrl}
                download={`QR_Siswa_${qrModalStudent.student.nisn}_${qrModalStudent.student.name}.png`}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh PNG</span>
              </a>
              <button
                onClick={() => {
                  setQrModalStudent(null);
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
          setSelectedStudentForGuide(null);
        }}
        userRole="student"
        userName={selectedStudentForGuide?.name || 'Peserta Didik / Siswa'}
        userId={selectedStudentForGuide?.id || 'std_sample'}
      />

      {/* Class / Rombel Management Modal (Manual Input Per Jenjang) */}
      <ClassManagementModal
        isOpen={showClassModal}
        initialOpenAddForm={openClassAddDirectly}
        onClose={() => {
          setShowClassModal(false);
          setOpenClassAddDirectly(false);
        }}
        classes={classes}
        students={students}
        teachers={teachers}
        config={config}
        onAddClass={onAddClass || (() => {})}
        onUpdateClass={onUpdateClass || (() => {})}
        onDeleteClass={onDeleteClass || (() => {})}
        onBatchUpdateClasses={onBatchUpdateClasses}
        onAddNotification={onAddNotification}
      />

      {/* Rombel Overview Export Report Modal */}
      <RombelOverviewExportModal
        isOpen={showRombelExportModal}
        onClose={() => setShowRombelExportModal(false)}
        classes={classes}
        students={students}
        teachers={teachers}
        schoolName={config.schoolName}
        academicYear={config.academicYear}
      />

      {/* Modal Impor Data Siswa Massal dari CSV dengan Pencegahan Duplikasi NISN */}
      {showImportModal && (
        <StudentImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingStudents={safeStudents}
          classes={safeClasses}
          onImportStudents={(newStudents) => {
            newStudents.forEach((student) => {
              onAddStudent(student);
            });
          }}
          onAddNotification={onAddNotification}
        />
      )}
    </div>
  );
};
