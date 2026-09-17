import React from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchoolClass, Student, Teacher } from '../types';
import { downloadCsv } from '../utils/soundAndDate';

interface RombelOverviewExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes?: SchoolClass[];
  students?: Student[];
  teachers?: Teacher[];
  schoolName?: string;
  academicYear?: string;
}

export const RombelOverviewExportModal: React.FC<RombelOverviewExportModalProps> = ({
  isOpen,
  onClose,
  classes = [],
  students = [],
  teachers = [],
  schoolName = 'SMP / SMA Unggulan',
  academicYear = '2025/2026',
}) => {
  if (!isOpen) return null;

  // Process data per class
  const classOverviewData = classes.map((cls, index) => {
    const enrolledStudents = students.filter(
      (s) => s.classId === cls.id || s.className.toLowerCase() === cls.name.toLowerCase()
    );
    const count = enrolledStudents.length;
    const capacity = cls.totalStudents || 32;
    const utilizationRate = capacity > 0 ? Math.round((count / capacity) * 100) : 100;

    let balanceStatus = 'Ideal (Seimbang)';
    let balanceType: 'ideal' | 'overcrowded' | 'underfilled' = 'ideal';

    if (count > 34 || utilizationRate > 108) {
      balanceStatus = 'Kelebihan Kapasitas (Padat)';
      balanceType = 'overcrowded';
    } else if (count < 20 && count > 0) {
      balanceStatus = 'Di Bawah Kapasitas (Kurang)';
      balanceType = 'underfilled';
    } else if (count === 0) {
      balanceStatus = 'Belum Ada Siswa';
      balanceType = 'underfilled';
    }

    const teacherObj = teachers.find(
      (t) => t.id === cls.homeroomTeacherId || t.name.toLowerCase() === (cls.homeroomTeacher || '').toLowerCase()
    );

    return {
      no: index + 1,
      id: cls.id,
      name: cls.name,
      grade: cls.grade || '7',
      major: cls.major || 'Kurikulum Merdeka',
      homeroomTeacher: cls.homeroomTeacher || teacherObj?.name || 'Belum Ditugaskan',
      homeroomTeacherNip: teacherObj?.nip || '-',
      roomName: cls.roomName || 'Ruang Belajar',
      studentCount: count,
      capacity,
      utilizationRate,
      balanceStatus,
      balanceType,
    };
  });

  // Summary statistics
  const totalStudents = students.length;
  const totalClasses = classes.length;
  const totalCapacity = classes.reduce((sum, c) => sum + (c.totalStudents || 32), 0);
  const avgStudentsPerClass = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : '0';
  const overallUtilization = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;
  const overcrowdedCount = classOverviewData.filter((c) => c.balanceType === 'overcrowded').length;
  const underfilledCount = classOverviewData.filter((c) => c.balanceType === 'underfilled').length;

  // Export to Excel (.xlsx)
  const handleExportXLSX = () => {
    const worksheetData: (string | number)[][] = [
      ['LAPORAN REKAPITULASI DAN DISTRIBUSI ROMBONGAN BELAJAR (ROMBEL)'],
      [`Satuan Pendidikan: ${schoolName}`, `Tahun Ajaran: ${academicYear}`, `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      ['RINGKASAN EKSEKUTIF:'],
      ['Total Peserta Didik', totalStudents, 'Total Rombel', totalClasses],
      ['Total Kapasitas Rombel', totalCapacity, 'Rata-rata Siswa/Rombel', avgStudentsPerClass],
      ['Keterisian Total', `${overallUtilization}%`, 'Rombel Padat', overcrowdedCount, 'Rombel Kurang', underfilledCount],
      [],
      [
        'No',
        'Jenjang / Tingkat',
        'Nama Rombel / Kelas',
        'Program / Kurikulum',
        'Wali Kelas',
        'NIP Wali Kelas',
        'Ruang Belajar / Gedung',
        'Jumlah Siswa Aktif',
        'Target Kapasitas',
        'Keterisian (%)',
        'Status Keseimbangan Rombel',
      ],
    ];

    classOverviewData.forEach((row) => {
      worksheetData.push([
        row.no,
        `Jenjang ${row.grade}`,
        row.name,
        row.major,
        row.homeroomTeacher,
        row.homeroomTeacherNip,
        row.roomName,
        row.studentCount,
        row.capacity,
        `${row.utilizationRate}%`,
        row.balanceStatus,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 16 }, // Jenjang
      { wch: 18 }, // Nama Rombel
      { wch: 32 }, // Kurikulum
      { wch: 28 }, // Wali Kelas
      { wch: 20 }, // NIP
      { wch: 22 }, // Ruang
      { wch: 18 }, // Jml Siswa
      { wch: 16 }, // Target
      { wch: 15 }, // Keterisian
      { wch: 28 }, // Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Rombel');

    const fileName = `Rekap_Rombel_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'No',
      'Jenjang',
      'Nama Rombel',
      'Kurikulum / Program',
      'Wali Kelas',
      'NIP Wali Kelas',
      'Ruang Belajar',
      'Jumlah Siswa',
      'Target Kapasitas',
      'Keterisian (%)',
      'Status Keseimbangan',
    ];

    const rows = classOverviewData.map((r) => [
      r.no,
      `"Jenjang ${r.grade}"`,
      `"${r.name}"`,
      `"${r.major}"`,
      `"${r.homeroomTeacher}"`,
      `'${r.homeroomTeacherNip}`,
      `"${r.roomName}"`,
      r.studentCount,
      r.capacity,
      `"${r.utilizationRate}%"`,
      `"${r.balanceStatus}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    downloadCsv(
      `Rekap_Rombel_${new Date().toISOString().split('T')[0]}.csv`,
      csvContent
    );
  };

  // Export to PDF with official letterhead & structured table
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Official Header Letterhead
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolName.toUpperCase(), pageWidth / 2, 35, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `LAPORAN REKAPITULASI & ANALISIS DISTRIBUSI ROMBONGAN BELAJAR (ROMBEL)`,
      pageWidth / 2,
      48,
      { align: 'center' }
    );
    doc.text(
      `Tahun Ajaran: ${academicYear} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      pageWidth / 2,
      61,
      { align: 'center' }
    );

    // Double Divider Lines
    doc.setLineWidth(1.5);
    doc.line(35, 70, pageWidth - 35, 70);
    doc.setLineWidth(0.5);
    doc.line(35, 72, pageWidth - 35, 72);

    // Summary Statistics Header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `RINGKASAN: Total ${totalStudents} Siswa | ${totalClasses} Rombel | Rata-rata ${avgStudentsPerClass} Siswa/Rombel | Kapasitas Terisi: ${overallUtilization}% (${overcrowdedCount} Padat, ${underfilledCount} Kurang)`,
      35,
      88
    );

    // Table Data
    const tableData = classOverviewData.map((r) => [
      r.no,
      `Jenjang ${r.grade}`,
      r.name,
      r.major,
      r.homeroomTeacher,
      r.homeroomTeacherNip,
      r.roomName,
      r.studentCount,
      r.capacity,
      `${r.utilizationRate}%`,
      r.balanceStatus,
    ]);

    autoTable(doc, {
      startY: 98,
      head: [
        [
          'No',
          'Jenjang',
          'Nama Rombel',
          'Kurikulum / Program',
          'Wali Kelas',
          'NIP',
          'Ruang',
          'Siswa',
          'Kapasitas',
          'Rasio',
          'Status Keseimbangan',
        ],
      ],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3.5,
        halign: 'left',
      },
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 25 },
        1: { halign: 'center', cellWidth: 55 },
        2: { fontStyle: 'bold', cellWidth: 65 },
        3: { cellWidth: 120 },
        4: { cellWidth: 110 },
        5: { halign: 'center', cellWidth: 75 },
        6: { cellWidth: 80 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 40 },
        8: { halign: 'center', cellWidth: 45 },
        9: { halign: 'center', cellWidth: 40 },
        10: { cellWidth: 110 },
      },
      margin: { left: 35, right: 35 },
    });

    const fileName = `Laporan_Rombel_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-5xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Export & Rekapitulasi Rombel (Rombongan Belajar)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Struktur data kelas, jenjang pendidikan, rasio siswa, serta analisis keseimbangan ukuran rombel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
            <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
              Total Rombel Aktif
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-black text-indigo-950 dark:text-indigo-100">{totalClasses}</span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Kelas</span>
            </div>
            <span className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 block">
              {totalStudents} Siswa Terdaftar
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
              Rata-rata Siswa / Kelas
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100">{avgStudentsPerClass}</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Siswa/Rombel</span>
            </div>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5 block">
              Standar Permendikbud: 28-32
            </span>
          </div>

          <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/50">
            <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
              Keterisian Kapasitas
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-black text-purple-950 dark:text-purple-100">{overallUtilization}%</span>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Terisi</span>
            </div>
            <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 mt-0.5 block">
              Kapasitas: {totalCapacity} Kursi
            </span>
          </div>

          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-900/50">
            <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
              Status Keseimbangan
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-amber-950 dark:text-amber-100">
                {overcrowdedCount === 0 && underfilledCount === 0 ? 'Optimal' : `${overcrowdedCount + underfilledCount} Perlu Dicek`}
              </span>
            </div>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 block">
              {overcrowdedCount > 0 ? `${overcrowdedCount} Rombel Padat` : 'Distribusi Rata'}
            </span>
          </div>
        </div>

        {/* Structured Table Container */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-extrabold sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-center w-10">No</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Jenjang</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Nama Rombel</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Kurikulum / Program</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Wali Kelas</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Ruang</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-center">Siswa Aktif</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-center">Target</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-center">Keterisian</th>
                <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {classOverviewData.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors font-medium"
                >
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{row.no}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px]">
                      Jenjang {row.grade}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white text-xs">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-400">
                    {row.major}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-white text-[11px]">{row.homeroomTeacher}</div>
                    <div className="text-[10px] font-mono text-slate-400">NIP: {row.homeroomTeacherNip}</div>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-400">{row.roomName}</td>
                  <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white">
                    {row.studentCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                    {row.capacity}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        row.utilizationRate > 105
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : row.utilizationRate < 70
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {row.utilizationRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        row.balanceType === 'overcrowded'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                          : row.balanceType === 'underfilled'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                      }`}
                    >
                      {row.balanceType === 'ideal' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                      )}
                      <span>{row.balanceStatus}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total <strong>{classes.length}</strong> rombel telah terstruktur siap diekspor.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              id="export-rombel-csv-btn"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>

            <button
              id="export-rombel-pdf-btn"
              onClick={handleExportPDF}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Unduh PDF Resmi</span>
            </button>

            <button
              id="export-rombel-xlsx-btn"
              onClick={handleExportXLSX}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-all shadow-md shadow-emerald-600/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel (.XLSX)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
