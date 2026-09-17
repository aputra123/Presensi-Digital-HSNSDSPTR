import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  User,
  Clock,
} from 'lucide-react';
import { Teacher } from '../types';
import {
  sanitizeAndValidateSignatureFile,
  validateSignatureFile,
  ProcessSignatureResult,
} from '../utils/signatureUtils';

export interface SavedUploadedSignaturePayload {
  teacherId: string;
  teacherName: string;
  nip: string;
  sessionType: 'masuk' | 'pulang';
  signatureDataUrl: string;
  timeStr: string;
  targetDate: string;
  fileInfo: {
    fileName: string;
    fileType: 'jpg' | 'png' | 'pdf';
    fileSizeKb: number;
    totalPages?: number;
  };
}

interface AsnSignatureFileUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  initialTeacherId?: string;
  initialSessionType?: 'masuk' | 'pulang';
  targetDate: string;
  onSaveSignature: (payload: SavedUploadedSignaturePayload) => void;
}

export const AsnSignatureFileUploaderModal: React.FC<AsnSignatureFileUploaderModalProps> = ({
  isOpen,
  onClose,
  teachers,
  initialTeacherId,
  initialSessionType = 'masuk',
  targetDate,
  onSaveSignature,
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    initialTeacherId || (teachers[0]?.id ?? '')
  );
  const [sessionType, setSessionType] = useState<'masuk' | 'pulang'>(initialSessionType);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sanitizedResult, setSanitizedResult] = useState<ProcessSignatureResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [removeWhiteBg, setRemoveWhiteBg] = useState<boolean>(true);
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentTeacher = teachers.find((t) => t.id === selectedTeacherId) || teachers[0];

  const handleFileSelection = async (file: File) => {
    setErrorMessage(null);
    setSelectedFile(file);

    // 1. Pre-validation: Size Check (Max 1MB)
    const sizeCheck = validateSignatureFile(file);
    setFileSizeKb(sizeCheck.sizeKb);

    if (!sizeCheck.valid) {
      setErrorMessage(sizeCheck.error || 'Ukuran berkas melebihi 1 MB.');
      setSanitizedResult(null);
      return;
    }

    // 2. Client-Side Sanitization & Magic Bytes Inspection
    setIsProcessing(true);
    try {
      const result = await sanitizeAndValidateSignatureFile(file, {
        pageNumber: 1,
        removeWhiteBg,
        enhanceContrast,
      });

      setSanitizedResult(result);
      setCurrentPage(1);
    } catch (err: any) {
      console.warn('[Signature Sanitizer Error]', err);
      setErrorMessage(err?.message || 'Gagal memproses dan mensanitasi berkas tanda tangan.');
      setSanitizedResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!selectedFile || !sanitizedResult?.totalPages) return;
    if (newPage < 1 || newPage > sanitizedResult.totalPages) return;

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await sanitizeAndValidateSignatureFile(selectedFile, {
        pageNumber: newPage,
        removeWhiteBg,
        enhanceContrast,
      });
      setSanitizedResult(result);
      setCurrentPage(newPage);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal merender halaman PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleOptions = async (newRemoveBg: boolean, newEnhance: boolean) => {
    setRemoveWhiteBg(newRemoveBg);
    setEnhanceContrast(newEnhance);

    if (selectedFile) {
      setIsProcessing(true);
      try {
        const result = await sanitizeAndValidateSignatureFile(selectedFile, {
          pageNumber: currentPage,
          removeWhiteBg: newRemoveBg,
          enhanceContrast: newEnhance,
        });
        setSanitizedResult(result);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Gagal memperbarui filter tanda tangan.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSave = () => {
    if (!sanitizedResult || !currentTeacher) {
      setErrorMessage('Harap pilih berkas tanda tangan yang valid terlebih dahulu.');
      return;
    }

    const now = new Date();
    const timeStr = `${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`;

    onSaveSignature({
      teacherId: currentTeacher.id,
      teacherName: currentTeacher.name,
      nip: currentTeacher.nip || '-',
      sessionType,
      signatureDataUrl: sanitizedResult.dataUrl,
      timeStr,
      targetDate,
      fileInfo: {
        fileName: sanitizedResult.fileName,
        fileType: sanitizedResult.fileType,
        fileSizeKb,
        totalPages: sanitizedResult.totalPages,
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                  Unggah Berkas Tanda Tangan GTK
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                  Maks 1 MB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Solusi alternatif resmi presensi jika kanvas tanda tangan sentuh mengalami kendala
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Validation Notice */}
        <div className="px-4 py-2 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Sanitasi Klien Aktif: Magic bytes binary diverifikasi & metadata EXIF dibersihkan
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-mono text-[10px] font-bold text-emerald-700">
            JPG • PNG • PDF
          </span>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Target GTK & Session Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Teacher Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pilih Guru / Tenaga Kependidikan:</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (NIP: {t.nip || 'Non-NIP'})
                  </option>
                ))}
              </select>
            </div>

            {/* Session Type Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sesi Presensi:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSessionType('masuk')}
                  className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer border ${
                    sessionType === 'masuk'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Absen Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType('pulang')}
                  className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer border ${
                    sessionType === 'pulang'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Absen Pulang
                </button>
              </div>
            </div>
          </div>

          {/* Hidden native input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelection(file);
            }}
            className="hidden"
          />

          {/* Dropzone Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileSelection(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-2.5 ${
              isDragOver
                ? 'border-indigo-600 bg-indigo-50/80 scale-[1.01]'
                : errorMessage
                ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400'
                : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <Upload className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs">
                Klik untuk memilih berkas atau seret berkas Anda ke kotak ini
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Foto tanda tangan kertas (<span className="font-semibold text-indigo-700">JPG, PNG</span>) atau scan dokumen (<span className="font-semibold text-indigo-700">PDF</span>)
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-slate-700">
                Batas Maksimal: 1.0 MB
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-700 font-bold flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Sanitasi Klien Otomatis</span>
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900">Validasi Gagal</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Processing Loading State */}
          {isProcessing && (
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center space-x-2 text-xs text-slate-700">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Memproses dan membersihkan berkas tanda tangan secara aman...</span>
            </div>
          )}

          {/* Preview & Controls when file is loaded */}
          {sanitizedResult && !isProcessing && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                      sanitizedResult.fileType === 'pdf' ? 'bg-rose-600' : 'bg-indigo-600'
                    }`}
                  >
                    {sanitizedResult.fileType === 'pdf' ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">
                        {sanitizedResult.fileName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                        {fileSizeKb} KB
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-medium flex items-center space-x-1 mt-0.5">
                      <Check className="w-3 h-3" />
                      <span>Berkas valid & siap dipasang ke presensi</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Ganti</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSanitizedResult(null);
                      setSelectedFile(null);
                      setErrorMessage(null);
                    }}
                    className="p-1 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* PDF Multi-page navigation */}
              {sanitizedResult.fileType === 'pdf' && (sanitizedResult.totalPages || 1) > 1 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs">
                  <span className="text-slate-600 font-semibold">Pilih Halaman Dokumen PDF:</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || isProcessing}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="p-1 rounded-lg bg-slate-100 border border-slate-200 disabled:opacity-30 hover:bg-slate-200 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-200 rounded-md font-mono font-bold text-slate-800 text-[11px]">
                      {currentPage} / {sanitizedResult.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= (sanitizedResult.totalPages || 1) || isProcessing}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="p-1 rounded-lg bg-slate-100 border border-slate-200 disabled:opacity-30 hover:bg-slate-200 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Live Preview Box with checkered background */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">Pratinjau Tanda Tangan:</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Latar Transparan Terisolasi
                  </span>
                </div>
                <div
                  className="w-full h-32 rounded-xl border border-slate-200 flex items-center justify-center p-3 relative overflow-hidden"
                  style={{
                    backgroundColor: '#ffffff',
                    backgroundImage:
                      'radial-gradient(#cbd5e1 0.75px, transparent 0.75px), radial-gradient(#cbd5e1 0.75px, #ffffff 0.75px)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 8px 8px',
                  }}
                >
                  <img
                    src={sanitizedResult.dataUrl}
                    alt="Pratinjau Tanda Tangan"
                    className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                  />
                </div>
              </div>

              {/* Filter Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-[11px]">
                <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-700">
                  <input
                    type="checkbox"
                    checked={removeWhiteBg}
                    onChange={(e) => handleToggleOptions(e.target.checked, enhanceContrast)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-semibold">Hapus Latar Putih Kertas</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-700">
                  <input
                    type="checkbox"
                    checked={enhanceContrast}
                    onChange={(e) => handleToggleOptions(removeWhiteBg, e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-semibold">Pertajam Tinta Dokumen Resmi</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={!sanitizedResult || isProcessing}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none active:scale-95 text-white text-xs font-extrabold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Simpan Tanda Tangan ke Presensi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
