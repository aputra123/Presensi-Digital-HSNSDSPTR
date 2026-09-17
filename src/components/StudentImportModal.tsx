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
} from 'lucide-react';
import { Student, SchoolClass, ToastNotification } from '../types';

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudents: Student[];
  classes: SchoolClass[];
  onImportStudents: (newStudents: Student[]) => void;
  onAddNotification?: (notification: ToastNotification) => void;
}

interface ParsedStudentRow {
  rowNumber: number;
  raw: Record<string, string>;
  name: string;
  nisn: string;
  nik?: string;
  className: string;
  classId: string;
  gender: 'L' | 'P';
  parentPhone?: string;
  email?: string;
  address?: string;
  isValid: boolean;
  isDuplicateInSystem: boolean;
  isDuplicateInFile: boolean;
  errors: string[];
}

export const StudentImportModal: React.FC<StudentImportModalProps> = ({
  isOpen,
  onClose,
  existingStudents,
  classes,
  onImportStudents,
  onAddNotification,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean & Normalize Header Keys
  const normalizeKey = (key: string): string => {
    return key
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, '');
  };

  // Unduh template contoh CSV
  const handleDownloadTemplate = () => {
    const headers = ['Nama Lengkap', 'NISN', 'NIK', 'Kelas', 'Jenis Kelamin (L/P)', 'No HP Orang Tua', 'Email', 'Alamat'];
    const sampleRows = [
      ['Ahmad Fauzi', '0081234567', '3174010101080001', 'X MIPA 1', 'L', '081234567890', 'fauzi@example.sch.id', 'Jl. Merdeka No. 10'],
      ['Siti Aisyah', '0089876543', '3174020202080002', 'X MIPA 1', 'P', '081298765432', 'aisyah@example.sch.id', 'Jl. Sudirman No. 25'],
      ['Budi Santoso', '0085556677', '3174030303080003', 'XI IPS 1', 'L', '081377788899', 'budi@example.sch.id', 'Jl. Gatot Subroto No. 5'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Impor_Siswa.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV text into array of objects with structure validation
  const parseCSVText = (text: string) => {
    setStructureError(null);
    setIsProcessing(true);

    try {
      // Split lines respecting both CRLF and LF
      const rawLines = text.split(/\r\n|\n|\r/);
      const lines = rawLines.filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        setStructureError('File CSV kosong atau tidak memiliki baris data setelah judul kolom (header).');
        setIsProcessing(false);
        return;
      }

      // Deteksi pembatas kolom (delimiter): koma (,) atau titik-koma (;)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

      // Tokenizer function that handles quoted fields
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

      const headers = parseLine(lines[0]);
      const normalizedHeaders = headers.map(normalizeKey);

      // Validasi Struktur Kolom Wajib
      // Harus memiliki kolom nama dan NISN
      const hasNameColumn = normalizedHeaders.some((h) =>
        ['nama', 'namalengkap', 'namasiswa', 'name', 'studentname'].includes(h)
      );
      const hasNisnColumn = normalizedHeaders.some((h) =>
        ['nisn', 'nomorinduksiswanasional', 'noinduk', 'identifier', 'nis'].includes(h)
      );

      if (!hasNameColumn || !hasNisnColumn) {
        setStructureError(
          `Struktur kolom CSV tidak sesuai standar. File wajib menyertakan kolom "Nama / Nama Lengkap" dan "NISN". Kolom terdeteksi: [${headers.join(', ')}]. Silakan unduh template standar.`
        );
        setIsProcessing(false);
        return;
      }

      // Helper mencari index kolom
      const findColIdx = (aliases: string[]) => {
        return normalizedHeaders.findIndex((h) => aliases.includes(h));
      };

      const nameIdx = findColIdx(['nama', 'namalengkap', 'namasiswa', 'name', 'studentname']);
      const nisnIdx = findColIdx(['nisn', 'nomorinduksiswanasional', 'noinduk', 'identifier', 'nis']);
      const nikIdx = findColIdx(['nik', 'nomorindukkependudukan']);
      const classIdx = findColIdx(['kelas', 'rombel', 'class', 'classname']);
      const genderIdx = findColIdx(['jeniskelamin', 'jk', 'gender', 'sex']);
      const phoneIdx = findColIdx(['nohp', 'telepon', 'nohporangtua', 'nohportu', 'parentphone', 'phone']);
      const emailIdx = findColIdx(['email', 'surel']);
      const addressIdx = findColIdx(['alamat', 'address', 'domisili']);

      // Lacak duplikasi NISN di dalam file CSV sendiri
      const nisnCountInFile: Record<string, number> = {};
      const preliminaryRows: Array<{
        rowNumber: number;
        raw: Record<string, string>;
        name: string;
        nisn: string;
        nik?: string;
        className: string;
        classId: string;
        gender: 'L' | 'P';
        parentPhone?: string;
        email?: string;
        address?: string;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const tokens = parseLine(lines[i]);
        if (tokens.length === 0 || tokens.every((t) => t === '')) continue;

        const raw: Record<string, string> = {};
        headers.forEach((h, idx) => {
          raw[h] = tokens[idx] || '';
        });

        const name = (nameIdx >= 0 ? tokens[nameIdx] : '').trim();
        // Bersihkan NISN: hapus tanda kutip tunggal atau spasi berlebih
        const cleanNisn = (nisnIdx >= 0 ? tokens[nisnIdx] : '').replace(/['"`\s]/g, '').trim();
        const nik = (nikIdx >= 0 ? tokens[nikIdx] : '').replace(/['"`\s]/g, '').trim();
        const rawClass = (classIdx >= 0 ? tokens[classIdx] : '').trim();

        // Cari pencocokan rombel kelas dari master classes
        let matchedClass = classes.find(
          (c) => c.name.toLowerCase() === rawClass.toLowerCase() || c.id.toLowerCase() === rawClass.toLowerCase()
        );
        if (!matchedClass && rawClass) {
          // Coba pencocokan parsial tanpa spasi
          matchedClass = classes.find(
            (c) => c.name.replace(/\s+/g, '').toLowerCase() === rawClass.replace(/\s+/g, '').toLowerCase()
          );
        }
        const assignedClass = matchedClass || classes[0] || { id: 'c1', name: rawClass || 'Kelas Utama' };

        // Gender parse
        const rawGender = (genderIdx >= 0 ? tokens[genderIdx] : '').toUpperCase().trim();
        const gender: 'L' | 'P' = rawGender.startsWith('P') || rawGender === 'WANITA' || rawGender === 'PEREMPUAN' ? 'P' : 'L';

        const parentPhone = phoneIdx >= 0 ? tokens[phoneIdx]?.trim() : '';
        const email = emailIdx >= 0 ? tokens[emailIdx]?.trim() : '';
        const address = addressIdx >= 0 ? tokens[addressIdx]?.trim() : '';

        if (cleanNisn) {
          nisnCountInFile[cleanNisn] = (nisnCountInFile[cleanNisn] || 0) + 1;
        }

        preliminaryRows.push({
          rowNumber: i + 1,
          raw,
          name,
          nisn: cleanNisn,
          nik: nik || undefined,
          className: assignedClass.name,
          classId: assignedClass.id,
          gender,
          parentPhone: parentPhone || undefined,
          email: email || undefined,
          address: address || undefined,
        });
      }

      // Set duplikasi yang sudah ada di database saat ini
      const existingNisnSet = new Set(existingStudents.map((s) => s.nisn.trim()));

      const finalRows: ParsedStudentRow[] = preliminaryRows.map((item) => {
        const errors: string[] = [];
        let isDuplicateInSystem = false;
        let isDuplicateInFile = false;

        // Validasi Nama
        if (!item.name || item.name.length < 2) {
          errors.push('Nama siswa kosong atau kurang dari 2 karakter.');
        }

        // Validasi NISN
        if (!item.nisn) {
          errors.push('NISN tidak boleh kosong.');
        } else {
          // Cek duplikasi di sistem
          if (existingNisnSet.has(item.nisn)) {
            isDuplicateInSystem = true;
            errors.push(`NISN ${item.nisn} sudah terdaftar di sistem (duplikat).`);
          }

          // Cek duplikasi di file sendiri
          if (nisnCountInFile[item.nisn] > 1) {
            isDuplicateInFile = true;
            errors.push(`NISN ${item.nisn} muncul lebih dari 1 kali di dalam file ini.`);
          }
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
      console.error('Error parsing CSV:', err);
      setStructureError('Terjadi kesalahan saat memproses file CSV: ' + (err?.message || 'Format tidak valid.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSVText(text);
    };
    reader.onerror = () => {
      setStructureError('Gagal membaca file dari disk.');
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.txt')) {
        setFile(droppedFile);
        setFileName(droppedFile.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          parseCSVText(text);
        };
        reader.readAsText(droppedFile, 'UTF-8');
      } else {
        setStructureError('Format file tidak didukung. Harap unggah file berformat .CSV');
      }
    }
  };

  // Hitung metrik validasi
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

  // Eksekusi penyimpanan ke state aplikasi
  const handleCommitImport = () => {
    if (validRows.length === 0) return;

    const defaultAvatars = [
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    ];

    const newStudentsToSave: Student[] = validRows.map((r, idx) => ({
      id: `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      name: r.name,
      nisn: r.nisn,
      nik: r.nik,
      classId: r.classId,
      className: r.className,
      gender: r.gender,
      parentPhone: r.parentPhone || '',
      email: r.email || '',
      address: r.address || '',
      avatar: defaultAvatars[idx % defaultAvatars.length],
    }));

    onImportStudents(newStudentsToSave);

    if (onAddNotification) {
      onAddNotification({
        id: `import_toast_${Date.now()}`,
        title: 'Impor Data Siswa Berhasil',
        message: `Sebanyak ${newStudentsToSave.length} data siswa baru berhasil ditambahkan tanpa duplikasi.`,
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
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Impor Data Siswa Massal (CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Unggah file CSV dengan validasi struktur kolom otomatis dan pencegahan duplikasi NISN.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Unduh file format CSV contoh"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh Template CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Area Drag & Drop File */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-6 text-center bg-indigo-50/30 hover:bg-indigo-50/60 transition-all cursor-pointer group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {fileName ? fileName : 'Klik atau Tarik File CSV ke Sini'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Mendukung format .CSV dengan pemisah koma (,) atau titik-koma (;). Ukuran file maks 5MB.
            </p>
            {file && (
              <div className="mt-2 inline-flex items-center space-x-1.5 text-xs text-indigo-700 bg-indigo-100/80 font-semibold px-2.5 py-1 rounded-full">
                <Check className="w-3.5 h-3.5 text-indigo-700" />
                <span>File siap diproses ({totalRows} baris data)</span>
              </div>
            )}
          </div>

          {/* Alert Error Struktur Kolom */}
          {structureError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Validasi Struktur Kolom Gagal:</strong>
                <span className="text-slate-700 mt-0.5 block">{structureError}</span>
              </div>
            </div>
          )}

          {/* Ringkasan & Hasil Validasi */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Baris</span>
                  <span className="text-lg font-extrabold text-slate-800">{totalRows}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-emerald-600 block">Valid (Siap Simpan)</span>
                  <span className="text-lg font-extrabold text-emerald-700">{validRows.length}</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-amber-600 block">Duplikat NISN</span>
                  <span className="text-lg font-extrabold text-amber-700">{duplicateRows.length}</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-rose-600 block">Tidak Valid / Error</span>
                  <span className="text-lg font-extrabold text-rose-700">{invalidRows.length}</span>
                </div>
              </div>

              {/* Filter Tabs Preview */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500">Tampilkan:</span>
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      filterView === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
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
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Bermasalah ({invalidRows.length})
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  Hanya baris bertanda <span className="text-emerald-600 font-bold">Valid</span> yang akan disimpan ke database.
                </span>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold w-12 text-center">No</th>
                      <th className="py-2.5 px-3 font-bold">Nama Lengkap</th>
                      <th className="py-2.5 px-3 font-bold">NISN</th>
                      <th className="py-2.5 px-3 font-bold">Kelas</th>
                      <th className="py-2.5 px-3 font-bold">L/P</th>
                      <th className="py-2.5 px-3 font-bold">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400">
                          Tidak ada baris data yang cocok dengan filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={
                            row.isValid
                              ? 'hover:bg-slate-50/70'
                              : row.isDuplicateInSystem || row.isDuplicateInFile
                              ? 'bg-amber-50/40 hover:bg-amber-50'
                              : 'bg-rose-50/40 hover:bg-rose-50'
                          }
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">
                            {row.rowNumber}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {row.name || <span className="text-rose-500 italic">Nama Kosong</span>}
                          </td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-700">
                            {row.nisn || <span className="text-rose-500 italic">NISN Kosong</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{row.className}</td>
                          <td className="py-2 px-3 text-slate-600 font-bold">{row.gender}</td>
                          <td className="py-2 px-3">
                            {row.isValid ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Valid (Siap Impor)</span>
                              </span>
                            ) : row.isDuplicateInSystem ? (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]"
                                title={row.errors.join('; ')}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Duplikat di Sistem</span>
                              </span>
                            ) : row.isDuplicateInFile ? (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]"
                                title={row.errors.join('; ')}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Duplikat di File</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]"
                                title={row.errors.join('; ')}
                              >
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>{row.errors[0]}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={validRows.length === 0 || isProcessing}
              onClick={handleCommitImport}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>
                {validRows.length > 0
                  ? `Simpan ${validRows.length} Siswa Valid ke Database`
                  : 'Pilih File CSV Valid'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
