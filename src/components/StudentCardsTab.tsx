import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  QrCode,
  Printer,
  Search,
  GraduationCap,
  Briefcase,
  School,
  ShieldCheck,
  Lock,
  UserCheck,
  Users,
  FileDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Student, Teacher, SchoolClass, SchoolConfig, UserRole, UserAccount } from '../types';
import { DigitalIdCard } from './DigitalIdCard';
import { CardPrintModal } from './CardPrintModal';
import { getActiveTokenSessionSync, getUserAccountBySessionSync } from '../utils/auth';
import { exportCardsToPdf } from '../utils/qrCardGenerator';

interface StudentCardsTabProps {
  students?: Student[];
  teachers?: Teacher[];
  classes?: SchoolClass[];
  config: SchoolConfig;
  userRole?: UserRole;
  forcedType?: 'student' | 'teacher';
  currentAccount?: UserAccount;
}

export const StudentCardsTab: React.FC<StudentCardsTabProps> = ({
  students = [],
  teachers = [],
  classes = [],
  config,
  userRole,
  forcedType,
  currentAccount,
}) => {
  const isTeacherOnly = userRole === 'guru' || forcedType === 'teacher';
  const isStudentOnly = userRole === 'siswa' || forcedType === 'student';

  const initialType: 'student' | 'teacher' = isTeacherOnly
    ? 'teacher'
    : isStudentOnly
    ? 'student'
    : 'student';

  const [cardType, setCardType] = useState<'student' | 'teacher'>(initialType);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedTeacherStatus, setSelectedTeacherStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printItems, setPrintItems] = useState<(Student | Teacher)[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const safeStudents = students || [];
  const safeTeachers = teachers || [];

  // Auto-resolve account if not directly provided
  const activeAccount = useMemo(() => {
    if (currentAccount) return currentAccount;
    const session = getActiveTokenSessionSync();
    return getUserAccountBySessionSync(session);
  }, [currentAccount]);

  // Match authenticated student or teacher
  const matchingStudent = useMemo(() => {
    if (!activeAccount) return null;
    return (
      safeStudents.find((s) => activeAccount.personId && s.id === activeAccount.personId) ||
      safeStudents.find((s) => activeAccount.identifier && s.nisn === activeAccount.identifier) ||
      safeStudents.find((s) => s.name.toLowerCase() === activeAccount.name.toLowerCase()) ||
      null
    );
  }, [activeAccount, safeStudents]);

  const matchingTeacher = useMemo(() => {
    if (!activeAccount) return null;
    return (
      safeTeachers.find((t) => activeAccount.personId && t.id === activeAccount.personId) ||
      safeTeachers.find((t) => activeAccount.identifier && t.nip === activeAccount.identifier) ||
      safeTeachers.find((t) => t.name.toLowerCase() === activeAccount.name.toLowerCase()) ||
      null
    );
  }, [activeAccount, safeTeachers]);

  // View Scope: personal by default for siswa and guru
  const [viewScope, setViewScope] = useState<'personal' | 'all'>(() => {
    if (userRole === 'siswa' || userRole === 'guru') return 'personal';
    return 'all';
  });

  useEffect(() => {
    if (isTeacherOnly) {
      setCardType('teacher');
    } else if (isStudentOnly) {
      setCardType('student');
    }
  }, [isTeacherOnly, isStudentOnly]);

  const filteredStudents = safeStudents.filter((s) => {
    if (isStudentOnly && viewScope === 'personal' && matchingStudent) {
      return s.id === matchingStudent.id;
    }
    if (isStudentOnly && viewScope === 'all' && matchingStudent) {
      return s.classId === matchingStudent.classId;
    }
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.includes(searchQuery) ||
      s.className.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClassId === 'ALL' || s.classId === selectedClassId;
    return matchesSearch && matchesClass;
  });

  const filteredTeachers = safeTeachers.filter((t) => {
    if (isTeacherOnly && viewScope === 'personal' && matchingTeacher) {
      return t.id === matchingTeacher.id;
    }
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nip.includes(searchQuery) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      selectedTeacherStatus === 'ALL' || t.employmentStatus === selectedTeacherStatus;
    return matchesSearch && matchesStatus;
  });

  // Print all filtered cards
  const handlePrintAll = () => {
    const items = cardType === 'student' ? filteredStudents : filteredTeachers;
    if (items.length === 0) return;
    setPrintItems(items);
    setIsPrintModalOpen(true);
  };

  // Print single card
  const handlePrintSingle = (person: Student | Teacher) => {
    setPrintItems([person]);
    setIsPrintModalOpen(true);
  };

  // Export all filtered cards as PDF
  const handleExportAllPdf = async () => {
    const items = cardType === 'student' ? filteredStudents : filteredTeachers;
    if (items.length === 0) return;
    try {
      setIsExportingPdf(true);
      await exportCardsToPdf(items, cardType, config);
    } catch (e) {
      console.error('Failed to export PDF:', e);
      alert('Gagal mengekspor PDF kartu. Silakan coba kembali.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 lg:p-6 rounded-3xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                isTeacherOnly
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {isTeacherOnly
                  ? 'Kartu Guru GTK & QR Presensi'
                  : isStudentOnly
                  ? 'Kartu Pelajar & QR Presensi'
                  : 'Kartu Identitas Digital (ID Card & QR Presensi)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isTeacherOnly
                  ? 'Kartu Identitas Pegawai / Guru GTK dan QR Presensi Mandiri resmi siap cetak & unduh'
                  : isStudentOnly
                  ? 'Kartu Tanda Pelajar Digital Siswa resmi siap cetak & unduh QR presensi'
                  : 'Kartu pelajar siswa dan ID Card ASN / PPPK guru siap cetak & unduh presensi QR'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Card Type Toggle or Role Scope Pill */}
          {isTeacherOnly ? (
            <div className="flex items-center space-x-1 bg-purple-50/80 p-1 rounded-2xl border border-purple-200">
              <button
                type="button"
                onClick={() => setViewScope('personal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewScope === 'personal'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-purple-600 hover:text-purple-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Kartu GTK Saya</span>
              </button>
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewScope === 'all'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-purple-600 hover:text-purple-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Semua Guru GTK</span>
              </button>
            </div>
          ) : isStudentOnly ? (
            <div className="flex items-center space-x-1 bg-indigo-50/80 p-1 rounded-2xl border border-indigo-200">
              <button
                type="button"
                onClick={() => setViewScope('personal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewScope === 'personal'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-indigo-600 hover:text-indigo-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Kartu Saya</span>
              </button>
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewScope === 'all'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-indigo-600 hover:text-indigo-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Teman Sekelas</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setCardType('student')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  cardType === 'student'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Kartu Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => setCardType('teacher')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  cardType === 'teacher'
                    ? 'bg-white text-purple-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Kartu Guru GTK</span>
              </button>
            </div>
          )}

          {/* Download All PDF Button */}
          <button
            type="button"
            onClick={handleExportAllPdf}
            disabled={isExportingPdf || (cardType === 'student' ? filteredStudents : filteredTeachers).length === 0}
            className="px-3.5 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Download Semua Kartu Terpilih dalam Dokumen PDF Siap Cetak A4"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">{isExportingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
          </button>

          {/* Print All Button */}
          <button
            type="button"
            onClick={handlePrintAll}
            disabled={(cardType === 'student' ? filteredStudents : filteredTeachers).length === 0}
            className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Buka Pratinjau & Cetak Lembar Kartu Format A4"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kartu (A4)</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              cardType === 'student'
                ? 'Cari nama siswa, NISN, atau kelas...'
                : 'Cari nama guru, NIP, atau mata pelajaran...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {cardType === 'student' ? (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedTeacherStatus}
              onChange={(e) => setSelectedTeacherStatus(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-purple-500 focus:outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">Semua Status Kepegawaian</option>
              <option value="PNS">PNS / ASN</option>
              <option value="PPPK">PPPK</option>
              <option value="GTT">GTT / Honorer</option>
              <option value="Honor Sekolah">Honor Sekolah</option>
            </select>
          )}

          <div className="text-xs text-slate-500 font-bold whitespace-nowrap px-1">
            Total:{' '}
            <span className="text-slate-900 font-extrabold">
              {cardType === 'student' ? filteredStudents.length : filteredTeachers.length}
            </span>{' '}
            Kartu
          </div>
        </div>
      </div>

      {/* Cards Grid Render */}
      {(cardType === 'student' ? filteredStudents.length : filteredTeachers.length) === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">Tidak ada kartu yang cocok</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Tidak ditemukan data siswa atau guru sesuai kriteria pencarian dan filter kelas yang dipilih.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cardType === 'student'
            ? filteredStudents.map((student) => (
                <DigitalIdCard
                  key={student.id}
                  person={student}
                  type="student"
                  config={config}
                  onPrintSingle={handlePrintSingle}
                />
              ))
            : filteredTeachers.map((teacher) => (
                <DigitalIdCard
                  key={teacher.id}
                  person={teacher}
                  type="teacher"
                  config={config}
                  onPrintSingle={handlePrintSingle}
                />
              ))}
        </div>
      )}

      {/* Dedicated Card Print Modal for Sheet A4 Printing */}
      <CardPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        type={cardType}
        config={config}
      />
    </div>
  );
};
