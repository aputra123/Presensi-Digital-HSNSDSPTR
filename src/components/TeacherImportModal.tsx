import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  X,
  Check,
  Briefcase,
  Users,
} from 'lucide-react';
import { Teacher, EmploymentStatus, ToastNotification } from '../types';

interface TeacherImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTeachers: Teacher[];
  onImportTeachers: (newTeachers: Teacher[]) => void;
  onAddNotification?: (notification: ToastNotification) => void;
}

interface ParsedTeacherRow {
  rowNumber: number;
  raw: Record<string, string>;
  name: string;
  nip: string;
  nuptk?: string;
  employmentStatus: EmploymentStatus;
  subject: string;
  role: string;
  gender: 'L' | 'P';
  phone?: string;
  email?: string;
  department?: string;
  avatar?: string;
  isValid: boolean;
  isDuplicateInSystem: boolean;
  isDuplicateInFile: boolean;
  errors: string[];
}

const PRESET_AVATARS_L = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
];

const PRESET_AVATARS_P = [
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
];

export const TeacherImportModal: React.FC<TeacherImportModalProps> = ({
  isOpen,
  onClose,
  existingTeachers = [],
  onImportTeachers,
  onAddNotification,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalisasi header key
  const normalizeKey = (key: string): string => {
    return key
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, '');
  };

  // Unduh template CSV untuk data Guru & Pegawai
  const handleDownloadTemplate = () => {
    const headers = [
      'Nama Lengkap',
      'NIP',
      'NUPTK',
      'Status Kepegawaian (PNS/PPPK/PPPK PW/HONORER)',
      'Mata Pelajaran',
      'Tugas / Jabatan',
      'Jenis Kelamin (L/P)',
      'No HP / WhatsApp',
      'Email',
      'Departemen / Unit Kerja',
      'URL Foto Drive/Avatar',
    ];

    const sampleRows = [
      [
        'Drs. H. Mulyadi, M.Pd.',
        '197204151998021003',
        '8446750652200012',
        'PNS',
        'Matematika Peminatan',
        'Wakil Kepala Sekolah',
        'L',
        '081234567891',
        'mulyadi@sekolah.sch.id',
        'MIPA',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      ],
      [
        'Siti Nurhaliza, S.Pd., M.Hum.',
        '198506202010012015',
        '3738763665300021',
        'PNS',
        'Bahasa Indonesia',
        'Wali Kelas X MIPA 1',
        'P',
        '081298765431',
        'siti.nurhaliza@sekolah.sch.id',
        'Bahasa & Sastra',
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
      ],
      [
        'Rahmat Hidayat, S.Kom.',
        '199208172023211005',
        '5839770671130032',
        'PPPK',
        'Informatika',
        'Kepala Lab Komputer',
        'L',
        '081344556677',
        'rahmat.kom@sekolah.sch.id',
        'TIK & Multimedia',
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80',
      ],
      [
        'Dewi Sartika, S.Pd.',
        '199403122024212008',
        '9142772674230043',
        'PPPK_PW',
        'Bimbingan Konseling (BK)',
        'Guru BK',
        'P',
        '081388990011',
        'dewi.bk@sekolah.sch.id',
        'Bimbingan Konseling',
        'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=300&q=80',
      ],
      [
        'Agus Setiawan, S.E.',
        '-',
        '-',
        'HONORER',
        'Administrasi Sekolah',
        'Staf Tata Usaha (TU)',
        'L',
        '082155667788',
        'agus.tu@sekolah.sch.id',
        'Tata Usaha',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
      ],
    ];

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...sampleRows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Impor_Guru_GTK_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parsing CSV Text
  const parseCSVText = (text: string) => {
    setStructureError(null);
    setIsProcessing(true);

    try {
      const rawLines = text.split(/\r\n|\n|\r/);
      const lines = rawLines.filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        setStructureError('File CSV kosong atau tidak memiliki baris data setelah judul kolom (header).');
        setIsProcessing(false);
        return;
      }

      // Deteksi delimiter
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

      // Tokenizer
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const rawHeaders = parseLine(lines[0]);
      const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim());

      // Pencocokan kolom
      const nameIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('nama') || norm === 'name';
      });

      const nipIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm === 'nip' || norm.includes('nomorindukpegawai');
      });

      const nuptkIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('nuptk');
      });

      const statusIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('status') || norm.includes('kepegawaian');
      });

      const subjectIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('mapel') || norm.includes('matapelajaran') || norm.includes('subject') || norm.includes('tugasutama');
      });

      const roleIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('jabatan') || norm.includes('role') || norm.includes('tugas');
      });

      const genderIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm === 'jk' || norm.includes('jeniskelamin') || norm === 'gender';
      });

      const phoneIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('hp') || norm.includes('telepon') || norm.includes('phone') || norm.includes('wa');
      });

      const emailIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('email') || norm.includes('surel');
      });

      const deptIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('departemen') || norm.includes('unit') || norm.includes('bidang') || norm.includes('jurusan');
      });

      const avatarIdx = headers.findIndex((h) => {
        const norm = normalizeKey(h);
        return norm.includes('foto') || norm.includes('avatar') || norm.includes('gambar') || norm.includes('drive');
      });

      if (nameIdx === -1) {
        setStructureError('Kolom "Nama Lengkap" atau "Nama" tidak ditemukan pada baris header CSV.');
        setIsProcessing(false);
        return;
      }

      const nipCountInFile: Record<string, number> = {};
      const preliminaryRows: Array<{
        rowNumber: number;
        raw: Record<string, string>;
        name: string;
        nip: string;
        nuptk?: string;
        employmentStatus: EmploymentStatus;
        subject: string;
        role: string;
        gender: 'L' | 'P';
        phone?: string;
        email?: string;
        department?: string;
        avatar?: string;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const tokens = parseLine(lines[i]);
        if (tokens.length === 0 || tokens.every((t) => t === '')) continue;

        const raw: Record<string, string> = {};
        headers.forEach((h, idx) => {
          raw[h] = tokens[idx] || '';
        });

        const name = (nameIdx >= 0 ? tokens[nameIdx] : '').trim();
        const rawNip = (nipIdx >= 0 ? tokens[nipIdx] : '').replace(/['"`\s]/g, '').trim();
        const cleanNip = rawNip === '-' || rawNip === '' ? '' : rawNip;
        const cleanNuptk = nuptkIdx >= 0 ? tokens[nuptkIdx]?.replace(/['"`\s]/g, '').trim() : '';

        // Status parsing
        let employmentStatus: EmploymentStatus = 'PNS';
        const rawStatus = (statusIdx >= 0 ? tokens[statusIdx] : '').toUpperCase().replace(/[\s_-]+/g, '');
        if (rawStatus.includes('HONOR') || rawStatus.includes('GTT') || rawStatus.includes('PTT')) {
          employmentStatus = 'HONORER';
        } else if (rawStatus.includes('PW') || rawStatus.includes('PARUH')) {
          employmentStatus = 'PPPK_PW';
        } else if (rawStatus.includes('PPPK') || rawStatus.includes('P3K')) {
          employmentStatus = 'PPPK';
        } else if (rawStatus.includes('PNS') || rawStatus.includes('ASN')) {
          employmentStatus = 'PNS';
        } else if (cleanNip.length >= 18) {
          employmentStatus = 'PNS';
        } else {
          employmentStatus = 'HONORER';
        }

        const subject = (subjectIdx >= 0 ? tokens[subjectIdx] : '').trim() || 'Guru Mata Pelajaran';
        const role = (roleIdx >= 0 ? tokens[roleIdx] : '').trim() || (employmentStatus === 'HONORER' && !subject ? 'Staf Administrasi' : 'Guru');

        const rawGender = (genderIdx >= 0 ? tokens[genderIdx] : '').toUpperCase().trim();
        const gender: 'L' | 'P' = rawGender.startsWith('P') || rawGender === 'WANITA' || rawGender === 'PEREMPUAN' ? 'P' : 'L';

        const phone = phoneIdx >= 0 ? tokens[phoneIdx]?.replace(/['"`\s]/g, '').trim() : '';
        const email = emailIdx >= 0 ? tokens[emailIdx]?.trim() : '';
        const department = deptIdx >= 0 ? tokens[deptIdx]?.trim() : 'Tenaga Pendidik';
        const avatar = avatarIdx >= 0 ? tokens[avatarIdx]?.trim() : '';

        if (cleanNip) {
          nipCountInFile[cleanNip] = (nipCountInFile[cleanNip] || 0) + 1;
        }

        preliminaryRows.push({
          rowNumber: i + 1,
          raw,
          name,
          nip: cleanNip || (employmentStatus === 'HONORER' ? '-' : `PEG-${Date.now().toString().slice(-6)}-${i}`),
          nuptk: cleanNuptk && cleanNuptk !== '-' ? cleanNuptk : undefined,
          employmentStatus,
          subject,
          role,
          gender,
          phone: phone || undefined,
          email: email || undefined,
          department: department || 'Tenaga Pendidik',
          avatar: avatar || undefined,
        });
      }

      // Existing NIP set in current state
      const existingNipSet = new Set(
        existingTeachers
          .map((t) => t.nip?.replace(/['"`\s]/g, '').trim())
          .filter((nip) => nip && nip !== '-')
      );

      const existingNuptkSet = new Set(
        existingTeachers
          .map((t) => t.nuptk?.replace(/['"`\s]/g, '').trim())
          .filter((nuptk) => !!nuptk && nuptk !== '-')
      );

      const finalRows: ParsedTeacherRow[] = preliminaryRows.map((item) => {
        const errors: string[] = [];

        if (!item.name || item.name.length < 2) {
          errors.push('Nama GTK tidak boleh kosong');
        }

        const isDuplicateInFile = Boolean(item.nip && item.nip !== '-' && nipCountInFile[item.nip] > 1);
        if (isDuplicateInFile) {
          errors.push(`NIP ${item.nip} terduplikasi di dalam file CSV yang sama`);
        }

        const isDuplicateNipInSystem = Boolean(item.nip && item.nip !== '-' && existingNipSet.has(item.nip));
        const isDuplicateNuptkInSystem = Boolean(item.nuptk && item.nuptk !== '-' && existingNuptkSet.has(item.nuptk));
        const isDuplicateInSystem = isDuplicateNipInSystem || isDuplicateNuptkInSystem;

        if (isDuplicateNipInSystem) {
          errors.push(`NIP ${item.nip} sudah terdaftar di sistem`);
        }
        if (isDuplicateNuptkInSystem) {
          errors.push(`NUPTK ${item.nuptk} sudah terdaftar di sistem`);
        }

        const isValid = errors.length === 0;

        return {
          ...item,
          isValid,
          isDuplicateInSystem,
          isDuplicateInFile,
          errors,
        };
      });

      setParsedRows(finalRows);
    } catch (err: any) {
      setStructureError(`Gagal membaca file CSV: ${err?.message || 'Format tidak valid'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setFileName(uploadedFile.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCSVText(text);
      }
    };
    reader.readAsText(uploadedFile, 'UTF-8');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.name.endsWith('.csv') || droppedFile.type.includes('csv') || droppedFile.type.includes('text')) {
        setFile(droppedFile);
        setFileName(droppedFile.name);

        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            parseCSVText(text);
          }
        };
        reader.readAsText(droppedFile, 'UTF-8');
      } else {
        setStructureError('Format file tidak didukung. Harap unggah file berformat .CSV');
      }
    }
  };

  // Metrics
  const totalRows = parsedRows.length;
  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const duplicateRows = useMemo(
    () => parsedRows.filter((r) => r.isDuplicateInSystem || r.isDuplicateInFile),
    [parsedRows]
  );
  const invalidRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);

  const displayedRows = useMemo(() => {
    if (filterView === 'valid') return validRows;
    if (filterView === 'invalid') return invalidRows;
    return parsedRows;
  }, [parsedRows, validRows, invalidRows, filterView]);

  const handleCommitImport = () => {
    if (validRows.length === 0) return;

    const newTeachersToSave: Teacher[] = validRows.map((r, idx) => {
      const defaultAvatar =
        r.gender === 'P'
          ? PRESET_AVATARS_P[idx % PRESET_AVATARS_P.length]
          : PRESET_AVATARS_L[idx % PRESET_AVATARS_L.length];

      return {
        id: `tea_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: r.name,
        nip: r.nip,
        nuptk: r.nuptk,
        employmentStatus: r.employmentStatus,
        subject: r.subject,
        role: r.role,
        gender: r.gender,
        phone: r.phone || '',
        email: r.email || `${r.name.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')}@sekolah.sch.id`,
        department: r.department || 'Tenaga Pendidik',
        avatar: r.avatar || defaultAvatar,
      };
    });

    onImportTeachers(newTeachersToSave);

    if (onAddNotification) {
      onAddNotification({
        id: `import_teacher_toast_${Date.now()}`,
        title: 'Impor Data Guru & GTK Berhasil',
        message: `Sebanyak ${newTeachersToSave.length} data guru dan pegawai baru berhasil ditambahkan tanpa duplikasi.`,
        type: 'success',
        severity: 'success',
        duration: 5000,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Impor Data Guru & GTK Massal (CSV)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unggah berkas CSV dengan verifikasi NIP/NUPTK otomatis, status kepegawaian, dan pencegahan duplikasi.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Unduh file format CSV contoh"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh Template CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-all cursor-pointer group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {fileName ? fileName : 'Klik atau Tarik Berkas CSV Data Guru ke Sini'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Mendukung format .CSV (koma atau titik-koma). Format status: PNS, PPPK, PPPK PW, HONORER.
            </p>
            {file && (
              <div className="mt-2 inline-flex items-center space-x-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/60 font-semibold px-2.5 py-1 rounded-full">
                <Check className="w-3.5 h-3.5" />
                <span>Berkas berhasil diurai ({totalRows} baris GTK)</span>
              </div>
            )}
          </div>

          {/* Alert Error Struktur Kolom */}
          {structureError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800 dark:text-rose-200 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Validasi Struktur Kolom Gagal:</strong>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">{structureError}</span>
              </div>
            </div>
          )}

          {/* Ringkasan & Hasil Validasi */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Baris</span>
                  <span className="text-lg font-extrabold text-slate-800 dark:text-white">{totalRows}</span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">Valid (Siap Simpan)</span>
                  <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{validRows.length}</span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl">
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">Duplikat NIP / NUPTK</span>
                  <span className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{duplicateRows.length}</span>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl">
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">Format Tidak Lengkap</span>
                  <span className="text-lg font-extrabold text-rose-700 dark:text-rose-300">{invalidRows.length}</span>
                </div>
              </div>

              {/* Filter Tabs Preview */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tampilkan:</span>
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      filterView === 'all'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Semua ({totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('valid')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      filterView === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('invalid')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      filterView === 'invalid'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                    }`}
                  >
                    Bermasalah ({invalidRows.length})
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  Menampilkan {displayedRows.length} dari {totalRows} data
                </span>
              </div>

              {/* Tabel Pratinjau */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2.5 px-3 font-bold w-12 text-center">Baris</th>
                        <th className="py-2.5 px-3 font-bold">Status Verifikasi</th>
                        <th className="py-2.5 px-3 font-bold">Nama Guru & GTK</th>
                        <th className="py-2.5 px-3 font-bold">NIP / NUPTK</th>
                        <th className="py-2.5 px-3 font-bold">Status Kepegawaian</th>
                        <th className="py-2.5 px-3 font-bold">Mata Pelajaran / Tugas</th>
                        <th className="py-2.5 px-3 font-bold">Kontak / Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Tidak ada data untuk filter yang dipilih.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((r) => (
                          <tr
                            key={`row_${r.rowNumber}`}
                            className={
                              !r.isValid
                                ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {r.rowNumber}
                            </td>
                            <td className="py-2 px-3">
                              {r.isValid ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Siap Impor</span>
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>Gagal</span>
                                  </span>
                                  <ul className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 list-disc pl-3">
                                    {r.errors.map((err, errIdx) => (
                                      <li key={errIdx}>{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center space-x-1.5">
                                <span>{r.name || <span className="text-rose-500 italic">Kosong</span>}</span>
                                <span className="text-[10px] text-slate-400 px-1 bg-slate-100 dark:bg-slate-800 rounded">
                                  {r.gender}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                              <div>{r.nip || '-'}</div>
                              {r.nuptk && <div className="text-[10px] text-slate-400">NUPTK: {r.nuptk}</div>}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  r.employmentStatus === 'PNS'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                    : r.employmentStatus === 'PPPK'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : r.employmentStatus === 'PPPK_PW'
                                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {r.employmentStatus === 'PPPK_PW' ? 'PPPK PW' : r.employmentStatus}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              <div className="font-medium">{r.subject}</div>
                              <div className="text-[10px] text-slate-400">{r.role}</div>
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                              <div>{r.phone || '-'}</div>
                              <div className="text-[10px] text-indigo-500">{r.department}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {validRows.length > 0 ? (
              <span>
                <strong className="text-emerald-600 dark:text-emerald-400">{validRows.length}</strong> guru & GTK siap
                disimpan ke sistem.
                {invalidRows.length > 0 && (
                  <span className="text-rose-500 ml-1">
                    ({invalidRows.length} baris dilewati karena duplikasi/tidak valid).
                  </span>
                )}
              </span>
            ) : (
              <span>Silakan pilih atau tarik berkas CSV untuk memulai verifikasi.</span>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer w-full sm:w-auto text-center"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={validRows.length === 0 || isProcessing}
              onClick={handleCommitImport}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md w-full sm:w-auto ${
                validRows.length > 0 && !isProcessing
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan {validRows.length > 0 ? `${validRows.length} ` : ''}Data GTK</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
