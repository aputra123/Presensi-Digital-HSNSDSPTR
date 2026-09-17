import React, { useState, useMemo } from 'react';
import {
  School,
  Plus,
  Edit2,
  Trash2,
  Users,
  Search,
  AlertCircle,
  X,
  Sparkles,
  Download,
  GraduationCap,
  Layers,
  MapPin,
  Check,
} from 'lucide-react';
import { SchoolClass, Student, Teacher, SchoolConfig, ToastNotification } from '../types';
import { downloadCsv } from '../utils/soundAndDate';

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  students: Student[];
  teachers: Teacher[];
  config?: SchoolConfig;
  initialOpenAddForm?: boolean;
  onAddClass: (newClass: SchoolClass) => void;
  onUpdateClass: (updatedClass: SchoolClass) => void;
  onDeleteClass: (classId: string) => void;
  onBatchUpdateClasses?: (newClasses: SchoolClass[]) => void;
  onAddNotification?: (notification: ToastNotification) => void;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen,
  onClose,
  classes = [],
  students = [],
  teachers = [],
  config,
  initialOpenAddForm = false,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onBatchUpdateClasses,
  onAddNotification,
}) => {
  const [selectedGradeTab, setSelectedGradeTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for manual input
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'single' | 'batch'>('single');
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  const [formGrade, setFormGrade] = useState<string>('7');
  const [customGradeInput, setCustomGradeInput] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formAcademicYear, setFormAcademicYear] = useState<string>(config?.academicYear || '2025/2026');
  const [formMajor, setFormMajor] = useState<string>('Kurikulum Merdeka - Fase D');
  const [formHomeroomTeacher, setFormHomeroomTeacher] = useState<string>(teachers[0]?.name || '');
  const [formHomeroomTeacherId, setFormHomeroomTeacherId] = useState<string>(teachers[0]?.id || '');
  const [formRoomName, setFormRoomName] = useState<string>('Ruang Kelas A.101');
  const [formTotalCapacity, setFormTotalCapacity] = useState<number>(32);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto open add form if requested via initialOpenAddForm
  React.useEffect(() => {
    if (isOpen && initialOpenAddForm) {
      handleOpenAddForm('7');
    }
  }, [isOpen, initialOpenAddForm]);

  // Standard recognized educational grades (1 through 12)
  const STANDARD_ACADEMIC_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  // Check if current formName is a duplicate in real-time
  const isDuplicateName = useMemo(() => {
    if (!formName.trim()) return false;
    const targetName = formName.trim().toLowerCase();
    return classes.some(
      (c) => c.name.trim().toLowerCase() === targetName && c.id !== editingClass?.id
    );
  }, [formName, classes, editingClass]);

  // Check if current selected academic level is recognized
  const finalGradeValue = formGrade === 'CUSTOM' ? customGradeInput.trim() : formGrade;
  const isUnrecognizedGrade = useMemo(() => {
    if (!finalGradeValue) return true;
    return !STANDARD_ACADEMIC_LEVELS.includes(finalGradeValue);
  }, [finalGradeValue]);

  // Batch Generator states
  const [batchGrade, setBatchGrade] = useState<string>('7');
  const [batchSuffixes, setBatchSuffixes] = useState<string[]>(['A', 'B', 'C']);
  const [batchCustomSuffix, setBatchCustomSuffix] = useState<string>('');
  const [batchMajor, setBatchMajor] = useState<string>('Kurikulum Merdeka / SMP Reguler');

  // Delete confirmation
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      const matchesGrade =
        selectedGradeTab === 'ALL' ||
        c.grade === selectedGradeTab ||
        (selectedGradeTab === '7' && (c.grade === '7' || c.grade === '10' || c.name.startsWith('VII') || c.name.startsWith('7.'))) ||
        (selectedGradeTab === '8' && (c.grade === '8' || c.grade === '11' || c.name.startsWith('VIII') || c.name.startsWith('8.'))) ||
        (selectedGradeTab === '9' && (c.grade === '9' || c.grade === '12' || c.name.startsWith('IX') || c.name.startsWith('9.')));

      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.major && c.major.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.homeroomTeacher && c.homeroomTeacher.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.roomName && c.roomName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesGrade && matchesSearch;
    });
  }, [classes, selectedGradeTab, searchQuery]);

  // Auto suggestions based on selected grade
  const getNameSuggestions = (grade: string) => {
    switch (grade) {
      case '7':
        return ['VII A', 'VII B', 'VII C', 'VII D', 'VII Unggulan', 'VII Tahfidz', '7.1', '7.2'];
      case '8':
        return ['VIII A', 'VIII B', 'VIII C', 'VIII D', 'VIII Unggulan', 'VIII Tahfidz', '8.1', '8.2'];
      case '9':
        return ['IX A', 'IX B', 'IX C', 'IX D', 'IX Unggulan', 'IX Tahfidz', '9.1', '9.2'];
      case '10':
        return ['X-1', 'X-2', 'X-3', 'X MIPA 1', 'X IPS 1', 'X RPL 1', 'X TKJ 1'];
      case '11':
        return ['XI MIPA 1', 'XI MIPA 2', 'XI IPS 1', 'XI RPL 1', 'XI TKJ 1'];
      case '12':
        return ['XII MIPA 1', 'XII MIPA 2', 'XII IPS 1', 'XII RPL 1', 'XII TKJ 1'];
      case '1':
        return ['Kelas 1A', 'Kelas 1B', 'Kelas 1C'];
      case '2':
        return ['Kelas 2A', 'Kelas 2B', 'Kelas 2C'];
      case '3':
        return ['Kelas 3A', 'Kelas 3B', 'Kelas 3C'];
      case '4':
        return ['Kelas 4A', 'Kelas 4B', 'Kelas 4C'];
      case '5':
        return ['Kelas 5A', 'Kelas 5B', 'Kelas 5C'];
      case '6':
        return ['Kelas 6A', 'Kelas 6B', 'Kelas 6C'];
      default:
        return [`Kelas ${grade} A`, `Kelas ${grade} B`, `Kelas ${grade} C`];
    }
  };

  const getMajorDefault = (grade: string) => {
    if (['7', '8', '9'].includes(grade)) return 'Kurikulum Merdeka - Fase D (SMP)';
    if (['10'].includes(grade)) return 'Kurikulum Merdeka - Fase E (SMA/SMK)';
    if (['11', '12'].includes(grade)) return 'Kurikulum Merdeka - Fase F (SMA/SMK)';
    if (['1', '2', '3', '4', '5', '6'].includes(grade)) return 'Kurikulum Merdeka - Fase A/B/C (SD)';
    return 'Kurikulum Merdeka / Reguler';
  };

  // Open Form for Adding New Class
  const handleOpenAddForm = (gradePreset?: string) => {
    setEditingClass(null);
    setFormMode('single');
    const targetGrade = gradePreset && gradePreset !== 'ALL' ? gradePreset : (selectedGradeTab !== 'ALL' ? selectedGradeTab : '7');
    setFormGrade(targetGrade);
    setCustomGradeInput('');
    const suggestions = getNameSuggestions(targetGrade);
    // Find next available name not yet in classes
    const existingNames = new Set(classes.map((c) => c.name.toLowerCase()));
    const nextName = suggestions.find((s) => !existingNames.has(s.toLowerCase())) || (targetGrade === '7' ? 'VII A' : targetGrade === '8' ? 'VIII A' : targetGrade === '9' ? 'IX A' : `Kelas ${targetGrade}`);
    
    setFormName(nextName);
    setFormMajor(getMajorDefault(targetGrade));
    setFormHomeroomTeacher(teachers[0]?.name || '');
    setFormHomeroomTeacherId(teachers[0]?.id || '');
    setFormRoomName(`Ruang Kelas Gedung ${targetGrade === '7' ? 'A' : targetGrade === '8' ? 'B' : 'C'}`);
    setFormTotalCapacity(32);
    setIsFormOpen(true);
  };

  // Open Batch Generator Form
  const handleOpenBatchForm = (gradePreset?: string) => {
    setEditingClass(null);
    setFormMode('batch');
    const targetGrade = gradePreset && gradePreset !== 'ALL' ? gradePreset : (selectedGradeTab !== 'ALL' ? selectedGradeTab : '7');
    setBatchGrade(targetGrade);
    setBatchSuffixes(['A', 'B', 'C']);
    setBatchCustomSuffix('');
    setBatchMajor(getMajorDefault(targetGrade));
    setIsFormOpen(true);
  };

  // Open Form for Editing Existing Class
  const handleOpenEditForm = (cls: SchoolClass) => {
    setEditingClass(cls);
    setFormMode('single');
    const isStandard = ['7', '8', '9', '10', '11', '12', '1', '2', '3', '4', '5', '6'].includes(cls.grade);
    setFormGrade(isStandard ? cls.grade : 'CUSTOM');
    setCustomGradeInput(isStandard ? '' : cls.grade);
    setFormName(cls.name);
    setFormMajor(cls.major || getMajorDefault(cls.grade));
    setFormHomeroomTeacher(cls.homeroomTeacher || teachers[0]?.name || '');
    setFormHomeroomTeacherId(cls.homeroomTeacherId || (teachers.find((t) => t.name === cls.homeroomTeacher)?.id || ''));
    setFormRoomName(cls.roomName || 'Ruang Kelas');
    setFormTotalCapacity(cls.totalStudents || 32);
    setIsFormOpen(true);
  };

  // Handle Form Submit (Manual Single Input)
  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setValidationError('Nama Rombel / Kelas wajib diisi!');
      return;
    }

    // Duplicate check within same academic year
    const isDup = classes.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase() && c.id !== editingClass?.id
    );
    if (isDup) {
      const errMsg = `Nama rombel "${trimmedName}" sudah terdaftar pada tahun ajaran ${formAcademicYear}! Sistem menolak nama kelas ganda dalam tahun ajaran yang sama.`;
      setValidationError(errMsg);
      if (onAddNotification) {
        onAddNotification({
          id: `class_dup_reject_${Date.now()}`,
          title: '⚠️ Penolakan Duplikasi Rombel',
          message: errMsg,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }
      return;
    }

    const finalGrade = formGrade === 'CUSTOM' ? (customGradeInput.trim() || '7') : formGrade;
    if (!finalGrade) {
      setValidationError('Jenjang pendidikan tidak boleh kosong.');
      return;
    }

    // Warning for non-existent / unrecognized academic level
    if (!STANDARD_ACADEMIC_LEVELS.includes(finalGrade)) {
      const confirmCustom = window.confirm(
        `Perhatian: Jenjang "${finalGrade}" bukan jenjang tingkatan standar formal (1 s/d 12). Apakah Anda yakin ingin melanjutkan penyimpanan dengan jenjang ini?`
      );
      if (!confirmCustom) return;
    }

    const selectedTeacherObj = teachers.find((t) => t.id === formHomeroomTeacherId || t.name === formHomeroomTeacher);
    const homeroomName = selectedTeacherObj ? selectedTeacherObj.name : formHomeroomTeacher;

    if (editingClass) {
      const updated: SchoolClass = {
        ...editingClass,
        name: trimmedName,
        grade: finalGrade,
        major: formMajor.trim(),
        homeroomTeacher: homeroomName,
        homeroomTeacherId: selectedTeacherObj?.id || '',
        roomName: formRoomName.trim(),
        totalStudents: Number(formTotalCapacity) || 32,
      };

      onUpdateClass(updated);

      if (onAddNotification) {
        onAddNotification({
          id: `class_update_${Date.now()}`,
          title: '✓ Rombel Kelas Berhasil Diperbarui',
          message: `Data Rombel "${updated.name}" (Jenjang ${updated.grade}) telah berhasil diperbarui.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }
    } else {
      const newClassId = `c_${Date.now().toString().slice(-6)}`;
      const newClass: SchoolClass = {
        id: newClassId,
        name: trimmedName,
        grade: finalGrade,
        major: formMajor.trim(),
        homeroomTeacher: homeroomName,
        homeroomTeacherId: selectedTeacherObj?.id || '',
        roomName: formRoomName.trim(),
        totalStudents: Number(formTotalCapacity) || 32,
      };

      onAddClass(newClass);

      if (onAddNotification) {
        onAddNotification({
          id: `class_add_${Date.now()}`,
          title: '✓ Rombel Baru Berhasil Dibuat',
          message: `Rombel "${newClass.name}" pada Jenjang ${newClass.grade} telah ditambahkan ke sistem.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }
    }

    setIsFormOpen(false);
    setEditingClass(null);
  };

  // Handle Batch Rombel Generation per Jenjang
  const handleSaveBatchRombel = (e: React.FormEvent) => {
    e.preventDefault();
    const finalGrade = batchGrade;
    let suffixes = [...batchSuffixes];

    if (batchCustomSuffix.trim()) {
      const customList = batchCustomSuffix
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      suffixes = [...new Set([...suffixes, ...customList])];
    }

    if (suffixes.length === 0) {
      alert('Pilih minimal 1 huruf/nama rombel rombongan belajar!');
      return;
    }

    const romanPrefix =
      finalGrade === '7'
        ? 'VII'
        : finalGrade === '8'
        ? 'VIII'
        : finalGrade === '9'
        ? 'IX'
        : finalGrade === '10'
        ? 'X'
        : finalGrade === '11'
        ? 'XI'
        : finalGrade === '12'
        ? 'XII'
        : `Kelas ${finalGrade}`;

    const existingNames = new Set(classes.map((c) => c.name.toLowerCase()));
    const newClassesToCreate: SchoolClass[] = [];

    suffixes.forEach((sfx, idx) => {
      const name = ['10', '11', '12'].includes(finalGrade) && !sfx.startsWith('MIPA') && !sfx.startsWith('IPS') && !sfx.startsWith('RPL') && !sfx.startsWith('TKJ')
        ? `${romanPrefix}-${sfx}`
        : ['1', '2', '3', '4', '5', '6'].includes(finalGrade)
        ? `Kelas ${finalGrade}${sfx}`
        : `${romanPrefix} ${sfx}`;

      if (!existingNames.has(name.toLowerCase())) {
        const assignedTeacher = teachers[idx % Math.max(1, teachers.length)];
        newClassesToCreate.push({
          id: `c_${finalGrade}_${sfx.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-4)}`,
          name,
          grade: finalGrade,
          major: batchMajor || getMajorDefault(finalGrade),
          homeroomTeacher: assignedTeacher ? assignedTeacher.name : `Wali Kelas ${name}`,
          homeroomTeacherId: assignedTeacher ? assignedTeacher.id : '',
          roomName: `Ruang Kelas ${romanPrefix}.${idx + 1}`,
          totalStudents: 32,
        });
      }
    });

    if (newClassesToCreate.length === 0) {
      alert('Semua rombel yang dipilih sudah ada dalam daftar sistem!');
      return;
    }

    if (onBatchUpdateClasses) {
      onBatchUpdateClasses([...classes, ...newClassesToCreate]);
    } else {
      newClassesToCreate.forEach((c) => onAddClass(c));
    }

    if (onAddNotification) {
      onAddNotification({
        id: `batch_class_${Date.now()}`,
        title: `✨ ${newClassesToCreate.length} Rombel Jenjang ${finalGrade} Berhasil Dibuat`,
        message: `Rombel: ${newClassesToCreate.map((c) => c.name).join(', ')} telah siap digunakan.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }

    setIsFormOpen(false);
  };

  // Handle Delete
  const handleConfirmDelete = () => {
    if (!deletingClass) return;

    onDeleteClass(deletingClass.id);

    if (onAddNotification) {
      onAddNotification({
        id: `class_delete_${Date.now()}`,
        title: '🗑️ Rombel Kelas Dihapus',
        message: `Rombel "${deletingClass.name}" (Jenjang ${deletingClass.grade}) telah berhasil dihapus.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }

    setDeletingClass(null);
  };

  // Batch Preset Generator for SMP
  const handleGenerateSmpPresets = () => {
    if (!confirm('Apakah Anda ingin menambahkan paket rombel standar SMP (VII A-C, VIII A-C, IX A-C)?')) return;

    const smpPresets: SchoolClass[] = [
      { id: 'c_7a', name: 'VII A', grade: '7', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[0]?.name || 'Dra. Sri Wahyuni, M.Pd.', totalStudents: 32, roomName: 'Ruang 101 Gedung A' },
      { id: 'c_7b', name: 'VII B', grade: '7', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[1]?.name || 'Bambang Sudarsono, S.Pd.', totalStudents: 32, roomName: 'Ruang 102 Gedung A' },
      { id: 'c_7c', name: 'VII C', grade: '7', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[2]?.name || 'Guru Pendidik 1', totalStudents: 30, roomName: 'Ruang 103 Gedung A' },
      { id: 'c_8a', name: 'VIII A', grade: '8', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[3]?.name || 'Nurul Hidayati, S.Sos.', totalStudents: 32, roomName: 'Ruang 201 Gedung B' },
      { id: 'c_8b', name: 'VIII B', grade: '8', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[4]?.name || 'Fajar Nugraha, S.Kom., M.T.', totalStudents: 32, roomName: 'Ruang 202 Gedung B' },
      { id: 'c_8c', name: 'VIII C', grade: '8', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[5]?.name || 'Guru Pendidik 2', totalStudents: 30, roomName: 'Ruang 203 Gedung B' },
      { id: 'c_9a', name: 'IX A', grade: '9', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[0]?.name || 'Dr. Hendra Gunawan, M.Si.', totalStudents: 32, roomName: 'Ruang 301 Gedung C' },
      { id: 'c_9b', name: 'IX B', grade: '9', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[1]?.name || 'Siti Rahmawati, S.Pd., M.Ed.', totalStudents: 32, roomName: 'Ruang 302 Gedung C' },
      { id: 'c_9c', name: 'IX C', grade: '9', major: 'SMP Reguler Terpadu', homeroomTeacher: teachers[2]?.name || 'Guru Pendidik 3', totalStudents: 30, roomName: 'Ruang 303 Gedung C' },
    ];

    if (onBatchUpdateClasses) {
      // Merge avoiding duplicates by name
      const existingNames = new Set(classes.map((c) => c.name.toLowerCase()));
      const toAdd = smpPresets.filter((p) => !existingNames.has(p.name.toLowerCase()));
      onBatchUpdateClasses([...classes, ...toAdd]);
    } else {
      smpPresets.forEach((p) => onAddClass(p));
    }

    if (onAddNotification) {
      onAddNotification({
        id: `preset_smp_${Date.now()}`,
        title: '✨ Preset Rombel SMP Diaktifkan',
        message: 'Paket rombel standar jenjang 7, 8, dan 9 telah ditambahkan.',
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['No', 'ID Rombel', 'Nama Kelas (Rombel)', 'Jenjang / Tingkat', 'Program / Jurusan', 'Wali Kelas', 'Ruang Kelas', 'Kapasitas Target', 'Jumlah Siswa Aktif'];
    const rows = filteredClasses.map((c, idx) => {
      const activeStudentsCount = students.filter((s) => s.classId === c.id || s.className === c.name).length;
      return [
        idx + 1,
        c.id,
        `"${c.name}"`,
        `"Jenjang ${c.grade}"`,
        `"${c.major || '-'}"`,
        `"${(c.homeroomTeacher || '-').replace(/"/g, '""')}"`,
        `"${c.roomName || '-'}"`,
        c.totalStudents || 32,
        activeStudentsCount,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCsv(`Master_Data_Rombel_Perjenjang_${config?.schoolName?.replace(/\s+/g, '_') || 'Sekolah'}_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] max-w-5xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-6 my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                <span>Manajemen & Input Manual Rombel (Kelas) Per Jenjang</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola rombongan belajar per tingkat jenjang (SMP: 7, 8, 9 / SMA-SMK: 10, 11, 12) & penugasan wali kelas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenBatchForm()}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 border border-indigo-200"
              title="Buat beberapa rombel per jenjang sekaligus (misal: VII A, B, C, D)"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Generator Rombel Per Jenjang</span>
            </button>

            <button
              onClick={handleGenerateSmpPresets}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 border border-purple-200"
              title="Generate rombel SMP standar (VII A-C, VIII A-C, IX A-C)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Preset Rombel SMP (VII-IX)</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5"
              title="Ekspor daftar rombel ke CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Ekspor CSV</span>
            </button>

            <button
              id="close-class-modal-btn"
              onClick={onClose}
              className="p-2 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action & Tab Navigation Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          {/* Grade Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              onClick={() => setSelectedGradeTab('ALL')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedGradeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Rombel ({classes.length})
            </button>

            {/* Jenjang 7, 8, 9 SMP */}
            {['7', '8', '9'].map((g) => {
              const count = classes.filter(
                (c) => c.grade === g || (g === '7' && c.grade === '10') || (g === '8' && c.grade === '11') || (g === '9' && c.grade === '12') || c.name.startsWith(g === '7' ? 'VII' : g === '8' ? 'VIII' : 'IX')
              ).length;
              const label = g === '7' ? 'Jenjang VII (7)' : g === '8' ? 'Jenjang VIII (8)' : 'Jenjang IX (9)';

              return (
                <button
                  key={g}
                  onClick={() => setSelectedGradeTab(g)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                    selectedGradeTab === g
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedGradeTab === g ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Jenjang 10, 11, 12 (SMA/SMK) if present */}
            {['10', '11', '12'].some((g) => classes.some((c) => c.grade === g && !c.name.startsWith('VII') && !c.name.startsWith('VIII') && !c.name.startsWith('IX'))) && (
              ['10', '11', '12'].map((g) => {
                const count = classes.filter((c) => c.grade === g).length;
                if (count === 0) return null;
                return (
                  <button
                    key={g}
                    onClick={() => setSelectedGradeTab(g)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                      selectedGradeTab === g
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Jenjang {g}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">{count}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari rombel, wali..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              id="btn-manual-input-rombel"
              onClick={() => handleOpenAddForm()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Input Manual Rombel</span>
            </button>
          </div>
        </div>

        {/* Content Body: Class Grid and Statistics */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Active Classes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <School className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-600">Belum ada rombel pada kategori ini</p>
                  <p className="text-xs text-slate-400">Klik tombol "Input Manual Rombel" untuk menambahkan kelas baru.</p>
                </div>
                <button
                  onClick={() => handleOpenAddForm()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xs inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Rombel Sekarang</span>
                </button>
              </div>
            ) : (
              filteredClasses.map((item) => {
                const enrolledStudents = students.filter((s) => s.classId === item.id || s.className === item.name);
                const gradeLabel =
                  item.grade === '7' || item.grade === '10' && item.name.startsWith('VII')
                    ? 'Jenjang VII (7 SMP)'
                    : item.grade === '8' || item.grade === '11' && item.name.startsWith('VIII')
                    ? 'Jenjang VIII (8 SMP)'
                    : item.grade === '9' || item.grade === '12' && item.name.startsWith('IX')
                    ? 'Jenjang IX (9 SMP)'
                    : `Jenjang ${item.grade}`;

                const badgeBg =
                  item.grade === '7' || item.name.startsWith('VII')
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : item.grade === '8' || item.name.startsWith('VIII')
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : item.grade === '9' || item.name.startsWith('IX')
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover:border-indigo-300 transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${badgeBg}`}>
                          {gradeLabel}
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center space-x-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{enrolledStudents.length} Siswa Aktif</span>
                        </span>
                      </div>

                      {/* Class Name */}
                      <div>
                        <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">{item.major || 'SMP Reguler Terpadu'}</p>
                      </div>

                      {/* Detail Info: Homeroom & Room */}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center space-x-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            Wali: {item.homeroomTeacher || 'Belum Ditentukan'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{item.roomName || 'Gedung Sekolah'} (Kapasitas: {item.totalStudents || 32} siswa)</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Edit & Delete */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        id={`edit-class-${item.id}`}
                        onClick={() => handleOpenEditForm(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Rombel</span>
                      </button>

                      <button
                        id={`delete-class-${item.id}`}
                        onClick={() => setDeletingClass(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <div>
            Total <strong className="text-slate-800">{classes.length} Rombel</strong> terdaftar •{' '}
            <strong className="text-slate-800">{students.length} Siswa</strong> terdistribusi
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Selesai & Tutup
          </button>
        </div>
      </div>

      {/* Form Modal: Manual Input Rombel */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  {formMode === 'batch' ? <Layers className="w-5 h-5" /> : <School className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    {editingClass
                      ? `Edit Data Rombel ${editingClass.name}`
                      : formMode === 'batch'
                      ? 'Generator Multi-Rombel Per Jenjang'
                      : 'Input Manual Rombel Baru Per Jenjang'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {formMode === 'batch'
                      ? 'Buat beberapa rombel sekaligus untuk satu tingkat jenjang dengan penugasan otomatis'
                      : 'Isi spesifikasi data kelas, jenjang, kurikulum, dan penugasan wali kelas'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher (Single vs Batch) when adding */}
            {!editingClass && (
              <div className="flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setFormMode('single')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    formMode === 'single'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Input Rombel Satuan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormMode('batch')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    formMode === 'batch'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Generator Batch Per Jenjang</span>
                </button>
              </div>
            )}

            {formMode === 'single' ? (
              <form onSubmit={handleSaveClass} className="space-y-4 text-xs">
                {/* Jenjang Tingkat */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Pilih Jenjang / Tingkat Kelas
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {['7', '8', '9'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setFormGrade(g);
                          const suggestions = getNameSuggestions(g);
                          const existingNames = new Set(classes.map((c) => c.name.toLowerCase()));
                          const nextName = suggestions.find((s) => !existingNames.has(s.toLowerCase())) || `Kelas ${g}`;
                          setFormName(nextName);
                          setFormMajor(getMajorDefault(g));
                          setFormRoomName(`Ruang Kelas Gedung ${g === '7' ? 'A' : g === '8' ? 'B' : 'C'}`);
                        }}
                        className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          formGrade === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Jenjang {g === '7' ? 'VII (7 SMP)' : g === '8' ? 'VIII (8 SMP)' : 'IX (9 SMP)'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {['10', '11', '12'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setFormGrade(g);
                          const suggestions = getNameSuggestions(g);
                          setFormName(suggestions[0] || `Kelas ${g}`);
                          setFormMajor(getMajorDefault(g));
                        }}
                        className={`py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center text-[11px] ${
                          formGrade === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Jenjang {g} (SMA)
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormGrade('CUSTOM')}
                      className={`py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center text-[11px] ${
                        formGrade === 'CUSTOM' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Jenjang Kustom
                    </button>
                  </div>

                  {formGrade === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="Masukkan jenjang kustom (misal: 1, 2, Akselerasi, Matrikulasi)"
                      value={customGradeInput}
                      onChange={(e) => setCustomGradeInput(e.target.value)}
                      className="w-full mt-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  )}
                </div>

                {/* Nama Rombel & Rekomendasi Pintas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      Nama Rombel / Kelas <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Pilih rekomendasi di bawah untuk mengisi cepat</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Contoh: VII A, VIII B, 9.1, X-1"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        setValidationError(null);
                      }}
                      className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:outline-none font-bold text-sm transition-all ${
                        isDuplicateName
                          ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-rose-400'
                          : 'border-slate-200 focus:ring-indigo-500'
                      }`}
                      required
                    />
                  </div>

                  {/* Real-time duplicate error banner */}
                  {isDuplicateName && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 text-[11px] font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Nama rombel <strong>"{formName}"</strong> sudah terdaftar dalam tahun ajaran ini. Mohon gunakan nama yang unik.</span>
                    </div>
                  )}

                  {/* Non-standard academic level warning */}
                  {isUnrecognizedGrade && finalGradeValue && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center space-x-2 text-[11px] font-medium">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Peringatan: Jenjang <strong>"{finalGradeValue}"</strong> bukan jenjang formal standar (1-12). Pastikan penamaan jenjang sudah sesuai kebijakan sekolah.</span>
                    </div>
                  )}

                  {/* General Validation Error */}
                  {validationError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 text-[11px] font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* Suggestions Pills */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500">Rekomendasi Penamaan Jenjang Ini:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {getNameSuggestions(formGrade).map((sugg) => {
                        const isTaken = classes.some((c) => c.name.toLowerCase() === sugg.toLowerCase() && c.id !== editingClass?.id);
                        return (
                          <button
                            key={sugg}
                            type="button"
                            disabled={isTaken}
                            onClick={() => setFormName(sugg)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                              formName === sugg
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : isTaken
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'
                            }`}
                          >
                            {sugg} {isTaken && '(Ada)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Program & Kurikulum dan Tahun Akademik */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Program / Kurikulum
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kurikulum Merdeka - Fase D (SMP)"
                      value={formMajor}
                      onChange={(e) => setFormMajor(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Tahun Akademik
                    </label>
                    <select
                      value={formAcademicYear}
                      onChange={(e) => setFormAcademicYear(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    >
                      <option value="2025/2026">2025/2026 (Tahun Berjalan)</option>
                      <option value="2026/2027">2026/2027</option>
                      <option value="2024/2025">2024/2025</option>
                    </select>
                  </div>
                </div>

                {/* Wali Kelas */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Wali Kelas (Pendidik Penanggung Jawab)
                  </label>
                  <select
                    value={formHomeroomTeacherId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setFormHomeroomTeacherId(selId);
                      const selT = teachers.find((t) => t.id === selId);
                      if (selT) setFormHomeroomTeacher(selT.name);
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (NIP: {t.nip || '-'}) - {t.subject}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ruang Kelas & Kapasitas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Ruang Kelas / Gedung
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Gedung A Ruang 101"
                      value={formRoomName}
                      onChange={(e) => setFormRoomName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Target Kapasitas Siswa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={formTotalCapacity}
                      onChange={(e) => setFormTotalCapacity(parseInt(e.target.value) || 32)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingClass ? 'Simpan Perubahan' : 'Tambahkan Rombel'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Batch Generator Form */
              <form onSubmit={handleSaveBatchRombel} className="space-y-4 text-xs">
                {/* Pilih Jenjang Target */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Pilih Jenjang yang Akan Dibuat Rombelnya
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['7', '8', '9'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setBatchGrade(g);
                          setBatchMajor(getMajorDefault(g));
                        }}
                        className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          batchGrade === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Jenjang {g === '7' ? 'VII (7 SMP)' : g === '8' ? 'VIII (8 SMP)' : 'IX (9 SMP)'}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['10', '11', '12'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setBatchGrade(g);
                          setBatchMajor(getMajorDefault(g));
                        }}
                        className={`py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          batchGrade === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Jenjang {g} (SMA)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suffix Checkboxes */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">
                    Pilih Huruf / Kategori Rombel yang Diinginkan
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['A', 'B', 'C', 'D', 'E', 'F', 'Unggulan', 'Tahfidz', 'Billingual'].map((sfx) => {
                      const isChecked = batchSuffixes.includes(sfx);
                      return (
                        <button
                          key={sfx}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setBatchSuffixes(batchSuffixes.filter((s) => s !== sfx));
                            } else {
                              setBatchSuffixes([...batchSuffixes, sfx]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Check className={`w-3.5 h-3.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                          <span>{sfx}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Suffix */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tambah Rombel Kustom Lainnya (Pisahkan dengan koma):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sains 1, Olahraga, 1, 2"
                    value={batchCustomSuffix}
                    onChange={(e) => setBatchCustomSuffix(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Live Preview Box */}
                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-indigo-900 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Hasil Preview Rombel yang Akan Dibuat:</span>
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600">
                      Jenjang {batchGrade}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(() => {
                      const roman = batchGrade === '7' ? 'VII' : batchGrade === '8' ? 'VIII' : batchGrade === '9' ? 'IX' : batchGrade === '10' ? 'X' : batchGrade === '11' ? 'XI' : batchGrade === '12' ? 'XII' : `Kelas ${batchGrade}`;
                      let list = [...batchSuffixes];
                      if (batchCustomSuffix.trim()) {
                        list = [...new Set([...list, ...batchCustomSuffix.split(',').map((s) => s.trim()).filter(Boolean)])];
                      }
                      if (list.length === 0) return <span className="text-slate-400 italic text-[11px]">Belum ada rombel yang dipilih</span>;
                      return list.map((sfx) => {
                        const name = ['10', '11', '12'].includes(batchGrade) && !sfx.startsWith('MIPA') && !sfx.startsWith('IPS')
                          ? `${roman}-${sfx}`
                          : `${roman} ${sfx}`;
                        const isExist = classes.some((c) => c.name.toLowerCase() === name.toLowerCase());
                        return (
                          <span
                            key={sfx}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                              isExist ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {name} {isExist ? '(Sudah Ada)' : '✓ Baru'}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Generate & Tambahkan Semua</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {deletingClass && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">
                Hapus Rombel {deletingClass.name}?
              </h4>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus rombel <strong>{deletingClass.name}</strong> (Jenjang {deletingClass.grade})?
                {students.filter((s) => s.classId === deletingClass.id || s.className === deletingClass.name).length > 0 && (
                  <span className="block mt-1 text-rose-600 font-bold">
                    ⚠️ Peringatan: Terdapat {students.filter((s) => s.classId === deletingClass.id || s.className === deletingClass.name).length} siswa terdaftar di rombel ini.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Ya, Hapus Rombel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
