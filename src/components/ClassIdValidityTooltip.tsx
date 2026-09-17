import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Student, SchoolClass } from '../types';

interface ClassIdValidityTooltipProps {
  student: Student;
  classes: SchoolClass[];
  compact?: boolean;
}

export const ClassIdValidityTooltip: React.FC<ClassIdValidityTooltipProps> = ({
  student,
  classes = [],
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const studentClassId = String(student.classId || '').trim();
  const studentClassName = String(student.className || '').trim();

  const matchedClass = classes.find((c) => c.id === studentClassId);

  let validityStatus: 'valid' | 'warning' | 'invalid' = 'valid';

  if (!matchedClass) {
    validityStatus = 'invalid';
  } else if (matchedClass.name.trim().toLowerCase() !== studentClassName.toLowerCase()) {
    validityStatus = 'warning';
  } else {
    validityStatus = 'valid';
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {/* Trigger Pill / Icon */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold cursor-help transition-all border ${
          validityStatus === 'valid'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : validityStatus === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        }`}
        aria-label={`Status validitas rombel: ${validityStatus}`}
      >
        {validityStatus === 'valid' && <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
        {validityStatus === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
        {validityStatus === 'invalid' && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 animate-pulse" />}

        {!compact && (
          <span>
            {validityStatus === 'valid'
              ? 'Rombel Sah'
              : validityStatus === 'warning'
              ? 'Penyelarasan'
              : 'Rombel Anomali'}
          </span>
        )}
      </button>

      {/* Floating Tooltip Box */}
      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-2xl text-[11px] space-y-2 border border-slate-700 pointer-events-none transition-all animate-in fade-in zoom-in-95"
          role="tooltip"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80">
            <div className="flex items-center space-x-1.5 font-extrabold">
              {validityStatus === 'valid' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Status classId: Terverifikasi Valid</span>
                </>
              )}
              {validityStatus === 'warning' && (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">Status classId: Perlu Penyelarasan</span>
                </>
              )}
              {validityStatus === 'invalid' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-300">Peringatan: classId Tidak Terdaftar!</span>
                </>
              )}
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-1 text-slate-300 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">ID Rombel Siswa:</span>
              <span className="font-mono font-bold text-white">{studentClassId || '(Kosong)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Nama Kelas Tertera:</span>
              <span className="font-bold text-white">{studentClassName || '(Kosong)'}</span>
            </div>

            {matchedClass && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rombel Resmi:</span>
                  <span className="font-bold text-emerald-300">{matchedClass.name} (Tingkat {matchedClass.grade})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Wali Kelas:</span>
                  <span className="text-slate-200">{matchedClass.homeroomTeacher || 'Belum ditugaskan'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ruang Kelas:</span>
                  <span className="text-slate-200">{matchedClass.roomName || 'Ruang Standar'}</span>
                </div>
              </>
            )}
          </div>

          {/* Explanation / Recommendation */}
          <div
            className={`p-2 rounded-xl text-[10px] leading-relaxed ${
              validityStatus === 'valid'
                ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-800/60'
                : validityStatus === 'warning'
                ? 'bg-amber-950/60 text-amber-200 border border-amber-800/60'
                : 'bg-rose-950/60 text-rose-200 border border-rose-800/60'
            }`}
          >
            {validityStatus === 'valid' && (
              <p>
                ✓ Relasi data konsisten. Siswa tercatat resmi pada rombongan belajar aktif sekolah dan siap untuk presensi serta rekapitulasi BKD.
              </p>
            )}
            {validityStatus === 'warning' && (
              <p>
                ⚠️ ID Rombel terdaftar, namun nama kelas ({studentClassName}) berbeda dengan nama resmi ({matchedClass?.name}). Pemindai startup akan menyelaraskan otomatis.
              </p>
            )}
            {validityStatus === 'invalid' && (
              <p>
                ⛔ ID Rombel "{studentClassId || 'Kosong'}" tidak ditemukan pada daftar kelas aktif. Siswa dapat diperbaiki otomatis lewat verifikasi integritas sistem atau edit data siswa.
              </p>
            )}
          </div>

          {/* Triangle Pointer */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
        </div>
      )}
    </div>
  );
};
