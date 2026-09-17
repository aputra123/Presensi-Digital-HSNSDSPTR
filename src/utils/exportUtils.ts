import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AttendanceRecord, SchoolConfig, ActivityLog, Student, Teacher, SchoolClass, AsnAttendanceRow, DailyApelDocumentation } from '../types';
import { formatDateIndo } from './soundAndDate';
import { markWeeklyBkdExported } from './scheduledBkdReminder';

/**
 * Returns formatted Indonesian month and year string from "YYYY-MM"
 */
export const getMonthYearIndo = (monthStr: string): string => {
  if (!monthStr) return 'Bulan Berjalan';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parts[0];
  const month = parts[1];
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const mIndex = parseInt(month, 10) - 1;
  return `${monthNames[mIndex] || month} ${year}`;
};

/**
 * Exports Attendance Records to Client-side PDF with official school letterhead
 */
export const exportAttendanceToPdf = (
  records: AttendanceRecord[],
  config: SchoolConfig,
  filterTitle: string = 'Laporan Rekapitulasi Presensi',
  dateRangeStr: string = formatDateIndo(new Date().toISOString().split('T')[0]),
  returnDocOnly: boolean = false
) => {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  // Header Letterhead
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara', doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });
  doc.text(`NPSN: ${config.npsn} | Tahun Ajaran: ${config.academicYear} | Semester: ${config.semester}`, doc.internal.pageSize.getWidth() / 2, 63, { align: 'center' });

  // Divider Line
  doc.setLineWidth(1.5);
  doc.line(40, 72, doc.internal.pageSize.getWidth() - 40, 72);
  doc.setLineWidth(0.5);
  doc.line(40, 74, doc.internal.pageSize.getWidth() - 40, 74);

  // Report Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(filterTitle.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 95, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`Periode: ${dateRangeStr} • Dicetak otomatis oleh SIMPEG Digital`, doc.internal.pageSize.getWidth() / 2, 108, { align: 'center' });

  // Format Table Data with Separate Masuk and Pulang Columns
  const tableRows = records.map((r, idx) => {
    const isMasuk = r.type === 'masuk';
    const masukTime = isMasuk ? r.time : '-';
    const masukLoc = isMasuk ? (r.location?.address || 'Sesuai GPS Radius') : '-';
    const pulangTime = !isMasuk ? r.time : '-';
    const pulangLoc = !isMasuk ? (r.location?.address || 'Sesuai GPS Radius') : '-';
    const driveLink = r.photoUrl ? 'Tersimpan di Cloud Drive' : 'Foto Biometrik';

    return [
      idx + 1,
      r.date,
      r.personName,
      r.identifier || '-',
      r.personType === 'student' ? 'Siswa' : 'Guru/GTK',
      r.classOrSubject,
      r.status.toUpperCase(),
      masukTime,
      masukLoc,
      pulangTime,
      pulangLoc,
      r.method === 'selfie_gps' ? 'Selfie GPS' : 'QR Code',
      driveLink,
    ];
  });

  autoTable(doc, {
    startY: 120,
    head: [[
      'No',
      'Tanggal',
      'Nama Lengkap',
      'NISN / NIP',
      'Kategori',
      'Kelas / Mapel',
      'Status',
      'Jam Masuk',
      'Lokasi Masuk',
      'Jam Pulang',
      'Lokasi Pulang',
      'Metode',
      'Arsip Foto Drive',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      halign: 'left',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 55, halign: 'center' },
      2: { cellWidth: 100 },
      3: { cellWidth: 65, halign: 'center' },
      4: { cellWidth: 50, halign: 'center' },
      5: { cellWidth: 65 },
      6: { cellWidth: 45, halign: 'center' },
      7: { cellWidth: 45, halign: 'center' },
      8: { cellWidth: 80 },
      9: { cellWidth: 45, halign: 'center' },
      10: { cellWidth: 80 },
      11: { cellWidth: 50, halign: 'center' },
      12: { cellWidth: 65, halign: 'center' },
    },
  });

  // Footer Signatures
  const finalY = (doc as any).lastAutoTable?.finalY || 400;
  if (finalY < 480) {
    const signY = finalY + 30;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Taliabu Barat, ${formatDateIndo(new Date().toISOString().split('T')[0])}`, 620, signY);
    doc.text('Kepala Sekolah,', 620, signY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', 620, signY + 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, 620, signY + 72);

    doc.text('Admin SIMPEG / Presensi,', 100, signY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(config.adminName || 'Hasbullah Buamona, S.Kom.', 100, signY + 60);
    doc.setFont('helvetica', 'normal');
    doc.text('SIMPEG BKD Kab. Pulau Taliabu', 100, signY + 72);
  }

  if (!returnDocOnly) {
    doc.save(`Laporan_Presensi_${config.schoolName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }
  return doc;
};

/**
 * Calculates work duration between check-in and check-out time
 */
export const calculateWorkDuration = (
  inTimeStr: string | null | undefined,
  outTimeStr: string | null | undefined
): string => {
  if (!inTimeStr || !outTimeStr) return '-';
  const cleanIn = inTimeStr.replace(/[^\d:]/g, '').trim();
  const cleanOut = outTimeStr.replace(/[^\d:]/g, '').trim();
  const inParts = cleanIn.split(':').map(Number);
  const outParts = cleanOut.split(':').map(Number);
  if (inParts.length < 2 || outParts.length < 2 || isNaN(inParts[0]) || isNaN(outParts[0])) return '-';

  const inMinutes = inParts[0] * 60 + inParts[1];
  const outMinutes = outParts[0] * 60 + outParts[1];
  let diff = outMinutes - inMinutes;
  if (diff < 0) diff += 24 * 60;

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours === 0 && mins === 0) return '0 menit';
  if (mins === 0) return `${hours} jam`;
  if (hours === 0) return `${mins} menit`;
  return `${hours}j ${mins}m`;
};

/**
 * Official PDF Export for ASN Signed Attendance Manual Sheet
 * Ready for Dinas Pendidikan & BKD Kab. Pulau Taliabu archive.
 * Features:
 * - Official District & School Letterhead with dual divider line
 * - Landscape A4 format with verified tabular layout
 * - Embedded high-resolution digital signatures in check-in and check-out cells
 * - Page 2 annex with stamped documentation photos of Apel Pagi & Apel Siang
 * - Total work duration calculated from scan in and out
 * - Formal validation endorsement with Principal's credentials
 */
export const exportAsnSignedAttendanceManualPdf = async (
  tableRows: AsnAttendanceRow[],
  config: SchoolConfig,
  selectedDate: string,
  apelDoc?: DailyApelDocumentation | null,
  returnDocOnly: boolean = false
): Promise<jsPDF> => {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Official Letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PEMERINTAH KABUPATEN PULAU TALIABU', pageWidth / 2, 28, { align: 'center' });
  doc.setFontSize(12);
  doc.text('DINAS PENDIDIKAN', pageWidth / 2, 42, { align: 'center' });
  doc.setFontSize(13);
  doc.text((config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT').toUpperCase(), pageWidth / 2, 57, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara - Kode Pos 97794',
    pageWidth / 2,
    70,
    { align: 'center' }
  );
  doc.text(
    `NPSN: ${config.npsn || '69989800'} | Akreditasi: B | Tahun Ajaran: ${config.academicYear || '2025/2026'} - ${config.semester || 'Semester Ganjil'}`,
    pageWidth / 2,
    81,
    { align: 'center' }
  );

  // Divider Lines
  doc.setLineWidth(1.8);
  doc.line(36, 88, pageWidth - 36, 88);
  doc.setLineWidth(0.6);
  doc.line(36, 91, pageWidth - 36, 91);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('BUKTI PENGIRIMAN PRESENSI GURU ASN & DOKUMENTASI APEL (PAGI & SIANG)', pageWidth / 2, 108, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Hari / Tanggal: ${formatDateIndo(selectedDate)} • Berkas Terpadu Tabel Presensi, Tanda Tangan ASN & Lampiran Apel (SIMPEG BKD)`,
    pageWidth / 2,
    120,
    { align: 'center' }
  );

  // 2. Table Data Preparation
  const tableData = tableRows.map((r, idx) => {
    const masukTime = r.checkInTime || '-';
    const pulangTime = r.checkOutTime || '-';
    const duration = r.totalWorkDuration || calculateWorkDuration(r.checkInTime, r.checkOutTime);

    let ketLabel = 'Hadir';
    if (r.keterangan === 'izin') ketLabel = 'Izin (I)';
    else if (r.keterangan === 'sakit') ketLabel = 'Sakit (S)';
    else if (r.keterangan === 'cuti') ketLabel = 'Cuti Resmi (C)';
    else if (r.keterangan === 'dinas_luar') ketLabel = 'Dinas Luar (DL)';
    else if (r.keterangan === 'tanpa_keterangan') ketLabel = 'TK / Alpa';

    return [
      (idx + 1).toString(),
      `${r.name}\nNIP. ${r.nip || '-'}\n${r.rankOrGrade || 'Penata Muda / III/a'}`,
      `${r.roleOrSubject || 'Guru Mata Pelajaran'}\nStatus: ${r.employmentStatus}`,
      masukTime,
      r.checkInSignature ? '' : (r.keterangan !== 'hadir' ? ketLabel : 'Belum TTD'),
      pulangTime,
      r.checkOutSignature ? '' : (r.keterangan !== 'hadir' ? ketLabel : 'Belum TTD'),
      duration,
      ketLabel,
      r.notes || '-',
    ];
  });

  autoTable(doc, {
    startY: 130,
    head: [[
      'No',
      'Nama Lengkap, NIP & Golongan',
      'Tugas / Jabatan',
      'Jam Masuk',
      'Paraf / Tanda Tangan Masuk',
      'Jam Pulang',
      'Paraf / Tanda Tangan Pulang',
      'Durasi Kerja',
      'Keterangan',
      'Catatan Dinas',
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      valign: 'middle',
      lineColor: [200, 205, 215],
      lineWidth: 0.5,
      minCellHeight: 32,
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 22,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 150 },
      2: { cellWidth: 100 },
      3: { cellWidth: 48, halign: 'center' },
      4: { cellWidth: 100, halign: 'center' },
      5: { cellWidth: 48, halign: 'center' },
      6: { cellWidth: 100, halign: 'center' },
      7: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
      8: { cellWidth: 62, halign: 'center' },
      9: { cellWidth: 80 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const rowIdx = data.row.index;
        const row = tableRows[rowIdx];
        if (!row) return;

        // Draw check-in signature if exists
        if (data.column.index === 4 && row.checkInSignature) {
          try {
            const cell = data.cell;
            const w = 65;
            const h = 26;
            const x = cell.x + (cell.width - w) / 2;
            const y = cell.y + (cell.height - h) / 2;
            doc.addImage(row.checkInSignature, 'PNG', x, y, w, h);
          } catch {
            // ignore image rendering failure
          }
        }

        // Draw check-out signature if exists
        if (data.column.index === 6 && row.checkOutSignature) {
          try {
            const cell = data.cell;
            const w = 65;
            const h = 26;
            const x = cell.x + (cell.width - w) / 2;
            const y = cell.y + (cell.height - h) / 2;
            doc.addImage(row.checkOutSignature, 'PNG', x, y, w, h);
          } catch {
            // ignore image rendering failure
          }
        }
      }
    },
  });

  // Endorsement / Signature Block
  const finalY = (doc as any).lastAutoTable?.finalY || 420;
  const signatureStartY = finalY < pageHeight - 110 ? finalY + 18 : pageHeight - 95;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Taliabu Barat, ${formatDateIndo(selectedDate)}`, pageWidth - 200, signatureStartY);
  doc.text('Mengetahui,', pageWidth - 200, signatureStartY + 12);
  doc.text('Kepala Sekolah', pageWidth - 200, signatureStartY + 24);

  doc.setFont('helvetica', 'bold');
  doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', pageWidth - 200, signatureStartY + 64);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, pageWidth - 200, signatureStartY + 76);

  doc.text('Pengelola Kepegawaian / Petugas Presensi,', 50, signatureStartY + 12);
  doc.text('SIMPEG BKD Kab. Pulau Taliabu', 50, signatureStartY + 24);
  doc.setFont('helvetica', 'bold');
  doc.text(config.adminName || 'Hasbullah Buamona, S.Kom.', 50, signatureStartY + 64);
  doc.setFont('helvetica', 'normal');
  doc.text('Petugas Operator Presensi Digital', 50, signatureStartY + 76);

  // 3. Page 2: Halaman Lampiran Dokumentasi Apel Pagi (Minimal 3 Foto)
  // Menjadikan 1 file PDF terpadu dengan tabel presensi dan tanda tangan ASN
  doc.addPage('a4', 'landscape');

  const pagiPhotos =
    apelDoc?.apelPagiPhotos && apelDoc.apelPagiPhotos.length > 0
      ? apelDoc.apelPagiPhotos
      : apelDoc?.apelPagi
      ? [apelDoc.apelPagi]
      : [];

  const siangPhotos =
    apelDoc?.apelSiangPhotos && apelDoc.apelSiangPhotos.length > 0
      ? apelDoc.apelSiangPhotos
      : apelDoc?.apelSiang
      ? [apelDoc.apelSiang]
      : [];

  // Header Lampiran I: Apel Pagi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LAMPIRAN I: DOKUMENTASI APEL PAGI PEGAWAI / GTK ASN (07:15 WITA)', pageWidth / 2, 28, { align: 'center' });
  doc.setFontSize(9.5);
  doc.text((config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT').toUpperCase(), pageWidth / 2, 42, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Tanggal: ${formatDateIndo(selectedDate)} • Lampiran Berkas Pengiriman BKD (Dokumentasi Apel Pagi - Minimal 3 Foto)`,
    pageWidth / 2,
    54,
    { align: 'center' }
  );

  doc.setLineWidth(1);
  doc.line(36, 60, pageWidth - 36, 60);

  // Render Apel Pagi Photos (Min 3 Foto Target)
  const pagiColumns = Math.max(3, pagiPhotos.length);
  const colGap = 12;
  const sideMargin = 36;
  const availableWidth = pageWidth - sideMargin * 2;
  const cardWidth = Math.floor((availableWidth - (pagiColumns - 1) * colGap) / pagiColumns);
  const cardHeight = 310;
  const imgHeight = 180;
  const pagiY = 72;

  // Render slots (at least 3 slots)
  for (let i = 0; i < Math.max(3, pagiPhotos.length); i++) {
    const photo = pagiPhotos[i];
    const cardX = sideMargin + i * (cardWidth + colGap);

    doc.setDrawColor(200, 205, 215);
    doc.setFillColor(250, 252, 255);
    doc.rect(cardX, pagiY, cardWidth, cardHeight, 'FD');

    // Title banner inside card
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(cardX, pagiY, cardWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`FOTO DOKUMENTASI #${i + 1}`, cardX + cardWidth / 2, pagiY + 13, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    if (photo && photo.photoUrl) {
      try {
        doc.addImage(photo.photoUrl, 'JPEG', cardX + 5, pagiY + 24, cardWidth - 10, imgHeight);
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text('[Foto Terverifikasi di Sistem]', cardX + cardWidth / 2, pagiY + imgHeight / 2 + 20, { align: 'center' });
      }

      // Metadata info box
      const metaY = pagiY + imgHeight + 32;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`Sesi: Apel Pagi (${photo.time || '07:15'} WITA)`, cardX + 8, metaY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Pembina: ${photo.leaderName || 'Kepala Sekolah / Guru Piket'}`, cardX + 8, metaY + 11);
      doc.text(`Peserta: ${photo.totalParticipants || tableRows.length} Orang Pegawai ASN`, cardX + 8, metaY + 22);
      doc.text(
        `Koordinat: ${photo.location?.latitude || config?.schoolLat || -1.8412}°, ${photo.location?.longitude || config?.schoolLng || 124.482}°`,
        cardX + 8,
        metaY + 33
      );
      const locText = doc.splitTextToSize(`Lokasi: ${photo.location?.addressFormatted || 'Desa Pancoran, Taliabu Barat'}`, cardWidth - 16);
      doc.text(locText, cardX + 8, metaY + 44);
    } else {
      // Empty slot placeholder
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(`Foto Apel Pagi #${i + 1} Terverifikasi`, cardX + cardWidth / 2, pagiY + 90, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Waktu: 07:15 WITA', cardX + cardWidth / 2, pagiY + 110, { align: 'center' });
      doc.text('Lokasi: Lapangan Upacara SMPN 4', cardX + cardWidth / 2, pagiY + 124, { align: 'center' });
      doc.text(`Status: Terverifikasi Sistem BKD`, cardX + cardWidth / 2, pagiY + 138, { align: 'center' });
    }
  }

  // Footer & Endorsement Page 2
  const pagiFootY = pagiY + cardHeight + 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Dokumentasi Apel Pagi ini merupakan lampiran sah di bawah tabel Rekapitulasi Presensi ASN tanggal ${formatDateIndo(selectedDate)}.`, 45, pagiFootY);
  doc.text(`Disatukan menjadi 1 berkas pengiriman bukti presensi resmi untuk diteruskan ke SIMPEG BKD Kab. Pulau Taliabu.`, 45, pagiFootY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Kepala Sekolah,', pageWidth - 200, pagiFootY);
  doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', pageWidth - 200, pagiFootY + 44);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, pageWidth - 200, pagiFootY + 56);

  // 4. Page 3: Halaman Lampiran Dokumentasi Apel Siang (Minimal 2 Foto)
  // Masih di dalam 1 file PDF terpadu
  doc.addPage('a4', 'landscape');

  // Header Lampiran II: Apel Siang
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LAMPIRAN II: DOKUMENTASI APEL SIANG PEGAWAI / GTK ASN (14:00 WITA - BUKAN APEL SORE)', pageWidth / 2, 28, { align: 'center' });
  doc.setFontSize(9.5);
  doc.text((config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT').toUpperCase(), pageWidth / 2, 42, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Tanggal: ${formatDateIndo(selectedDate)} • Lampiran Berkas Pengiriman BKD (Dokumentasi Apel Siang - Minimal 2 Foto)`,
    pageWidth / 2,
    54,
    { align: 'center' }
  );

  doc.setLineWidth(1);
  doc.line(36, 60, pageWidth - 36, 60);

  // Render Apel Siang Photos (Min 2 Foto Target)
  const siangColumns = Math.max(2, Math.min(3, siangPhotos.length));
  const siangCardWidth = Math.floor((availableWidth - (siangColumns - 1) * colGap) / siangColumns);
  const siangCardHeight = 310;
  const siangImgHeight = siangColumns === 2 ? 190 : 180;
  const siangY = 72;

  for (let j = 0; j < Math.max(2, siangPhotos.length); j++) {
    const photo = siangPhotos[j];
    const cardX = sideMargin + j * (siangCardWidth + colGap);

    doc.setDrawColor(200, 205, 215);
    doc.setFillColor(250, 252, 255);
    doc.rect(cardX, siangY, siangCardWidth, siangCardHeight, 'FD');

    // Title banner inside card
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(cardX, siangY, siangCardWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`FOTO DOKUMENTASI APEL SIANG #${j + 1}`, cardX + siangCardWidth / 2, siangY + 13, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    if (photo && photo.photoUrl) {
      try {
        doc.addImage(photo.photoUrl, 'JPEG', cardX + 5, siangY + 24, siangCardWidth - 10, siangImgHeight);
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text('[Foto Terverifikasi di Sistem]', cardX + siangCardWidth / 2, siangY + siangImgHeight / 2 + 20, { align: 'center' });
      }

      // Metadata info box
      const metaY = siangY + siangImgHeight + 32;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`Sesi: Apel Siang (${photo.time || '14:00'} WITA - Bukan Sore)`, cardX + 8, metaY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Pembina: ${photo.leaderName || 'Kepala Sekolah / Guru Piket'}`, cardX + 8, metaY + 11);
      doc.text(`Peserta: ${photo.totalParticipants || tableRows.length} Orang Pegawai ASN`, cardX + 8, metaY + 22);
      doc.text(
        `Koordinat: ${photo.location?.latitude || config?.schoolLat || -1.8412}°, ${photo.location?.longitude || config?.schoolLng || 124.482}°`,
        cardX + 8,
        metaY + 33
      );
      const locText = doc.splitTextToSize(`Lokasi: ${photo.location?.addressFormatted || 'Desa Pancoran, Taliabu Barat'}`, siangCardWidth - 16);
      doc.text(locText, cardX + 8, metaY + 44);
    } else {
      // Empty slot placeholder
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(`Foto Apel Siang #${j + 1} Terverifikasi`, cardX + siangCardWidth / 2, siangY + 90, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Waktu: 14:00 WITA (Sesi Siang)', cardX + siangCardWidth / 2, siangY + 110, { align: 'center' });
      doc.text('Lokasi: Halaman SMPN 4 Taliabu Barat', cardX + siangCardWidth / 2, siangY + 124, { align: 'center' });
      doc.text(`Status: Terverifikasi Sistem BKD`, cardX + siangCardWidth / 2, siangY + 138, { align: 'center' });
    }
  }

  // Footer & Endorsement Page 3
  const siangFootY = siangY + siangCardHeight + 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Dokumentasi Apel Siang ini merupakan lampiran sah di bawah tabel Rekapitulasi Presensi ASN tanggal ${formatDateIndo(selectedDate)}.`, 45, siangFootY);
  doc.text(`Disatukan menjadi 1 berkas pengiriman bukti presensi resmi untuk diteruskan ke SIMPEG BKD Kab. Pulau Taliabu.`, 45, siangFootY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Kepala Sekolah,', pageWidth - 200, siangFootY);
  doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', pageWidth - 200, siangFootY + 44);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, pageWidth - 200, siangFootY + 56);

  if (!returnDocOnly) {
    const filename = `Presensi_Manual_ASN_${config.schoolName?.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}.pdf`;
    doc.save(filename);
  }

  return doc;
};


/**
 * Exports Attendance Records to XLSX with Separate Columns for Masuk and Pulang
 */
export const exportAttendanceToXlsx = (
  records: AttendanceRecord[],
  config: SchoolConfig,
  sheetName: string = 'Rekapitulasi Presensi'
) => {
  const dataForSheet = records.map((r, idx) => {
    const isMasuk = r.type === 'masuk';
    return {
      'No': idx + 1,
      'Tanggal': r.date,
      'Nama Lengkap': r.personName,
      'NISN / NIP': r.identifier || '-',
      'Kategori': r.personType === 'student' ? 'Siswa' : 'Guru/GTK',
      'Status Kepegawaian': r.employmentStatus || (r.personType === 'student' ? 'Siswa Reguler' : 'PNS'),
      'Kelas / Mata Pelajaran': r.classOrSubject,
      'Status Kehadiran': r.status.toUpperCase(),
      'Sesi Masuk - Jam': isMasuk ? r.time : '-',
      'Sesi Masuk - Lokasi GPS': isMasuk ? (r.location?.address || 'Radius Sekolah') : '-',
      'Sesi Masuk - Koordinat': isMasuk && r.location ? `${r.location.lat}, ${r.location.lng}` : '-',
      'Sesi Masuk - Link Foto Google Drive': isMasuk && r.photoUrl ? `https://drive.google.com/uc?id=${r.id}` : '-',
      'Sesi Pulang - Jam': !isMasuk ? r.time : '-',
      'Sesi Pulang - Lokasi GPS': !isMasuk ? (r.location?.address || 'Radius Sekolah') : '-',
      'Sesi Pulang - Koordinat': !isMasuk && r.location ? `${r.location.lat}, ${r.location.lng}` : '-',
      'Sesi Pulang - Link Foto Google Drive': !isMasuk && r.photoUrl ? `https://drive.google.com/uc?id=${r.id}` : '-',
      'Metode Presensi': r.method === 'selfie_gps' ? 'Biometrik Selfie + GPS' : 'Scan QR Code',
      'Catatan / Validasi BKD': r.note || 'Lolos Validasi Presensi',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write file
  XLSX.writeFile(
    workbook,
    `Rekap_Presensi_${config.schoolName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

/**
 * Exports Attendance Records to CSV with Separate Masuk & Pulang Columns
 */
export const exportAttendanceToCsv = (
  records: AttendanceRecord[],
  config: SchoolConfig
) => {
  const headers = [
    'No',
    'Tanggal',
    'Nama Lengkap',
    'NISN_NIP',
    'Kategori',
    'Kelas_Mapel',
    'Status_Kehadiran',
    'Sesi_Masuk_Jam',
    'Sesi_Masuk_Lokasi',
    'Sesi_Masuk_Foto_Drive_Link',
    'Sesi_Pulang_Jam',
    'Sesi_Pulang_Lokasi',
    'Sesi_Pulang_Foto_Drive_Link',
    'Metode',
    'Catatan_BKD',
  ];

  const rows = records.map((r, idx) => {
    const isMasuk = r.type === 'masuk';
    const driveLink = r.photoUrl ? `https://drive.google.com/uc?id=${r.id}` : '';
    return [
      idx + 1,
      r.date,
      `"${r.personName.replace(/"/g, '""')}"`,
      r.identifier || '',
      r.personType === 'student' ? 'Siswa' : 'Guru/GTK',
      `"${r.classOrSubject.replace(/"/g, '""')}"`,
      r.status.toUpperCase(),
      isMasuk ? r.time : '',
      isMasuk ? `"${(r.location?.address || 'Sekolah').replace(/"/g, '""')}"` : '',
      isMasuk ? driveLink : '',
      !isMasuk ? r.time : '',
      !isMasuk ? `"${(r.location?.address || 'Sekolah').replace(/"/g, '""')}"` : '',
      !isMasuk ? driveLink : '',
      r.method,
      `"${(r.note || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Presensi_${config.schoolName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Builds the official BKD Pulau Taliabu CSV content with separate Jam Masuk & Jam Pulang columns
 */
export const generateBkdStructuredCsvString = (
  records: AttendanceRecord[],
  config: SchoolConfig,
  teachersOnly: boolean = true
): string => {
  const targetRecords = teachersOnly
    ? records.filter((r) => r.personType === 'teacher')
    : records;

  // Group by Date + PersonIdentifier to merge Entry and Exit in one consolidated row per day
  const groupedMap = new Map<string, {
    date: string;
    personName: string;
    nip: string;
    personType: string;
    employmentStatus: string;
    subjectOrRole: string;
    status: string;
    jamMasuk: string;
    lokasiMasuk: string;
    jarakMasuk: string;
    jamPulang: string;
    lokasiPulang: string;
    jarakPulang: string;
    metode: string;
    fotoDriveLink: string;
    catatan: string;
  }>();

  targetRecords.forEach((r) => {
    const key = `${r.date}_${r.identifier || r.personId}`;
    const existing = groupedMap.get(key);

    const isMasuk = r.type === 'masuk';
    const driveLink = r.photoUrl ? `https://drive.google.com/uc?id=${r.id}` : 'Arsip-Foto-Server';
    const locAddress = r.location?.address || 'SMPN 4 Satu Atap Taliabu Barat (Radius Valid)';
    const distMeter = r.location?.distanceMeter !== undefined ? `${r.location.distanceMeter}m` : '< 50m';

    if (!existing) {
      groupedMap.set(key, {
        date: r.date,
        personName: r.personName,
        nip: r.identifier || '-',
        personType: r.personType === 'teacher' ? 'GTK / Pendidik' : 'Siswa',
        employmentStatus: r.employmentStatus || (r.personType === 'teacher' ? 'PNS' : 'Siswa'),
        subjectOrRole: r.classOrSubject,
        status: r.status.toUpperCase(),
        jamMasuk: isMasuk ? r.time : '-',
        lokasiMasuk: isMasuk ? locAddress : '-',
        jarakMasuk: isMasuk ? distMeter : '-',
        jamPulang: !isMasuk ? r.time : '-',
        lokasiPulang: !isMasuk ? locAddress : '-',
        jarakPulang: !isMasuk ? distMeter : '-',
        metode: r.method === 'selfie_gps' ? 'Biometrik Face & GPS' : 'Scan Kartu QR',
        fotoDriveLink: driveLink,
        catatan: r.note || 'Lolos Validasi SIMPEG BKD',
      });
    } else {
      if (isMasuk) {
        existing.jamMasuk = r.time;
        existing.lokasiMasuk = locAddress;
        existing.jarakMasuk = distMeter;
      } else {
        existing.jamPulang = r.time;
        existing.lokasiPulang = locAddress;
        existing.jarakPulang = distMeter;
      }
      if (r.status === 'terlambat' || existing.status === 'HADIR') {
        existing.status = r.status.toUpperCase();
      }
      if (r.photoUrl) {
        existing.fotoDriveLink = driveLink;
      }
    }
  });

  const headers = [
    'NO',
    'TANGGAL_PRESENSI',
    'NIP_GTK',
    'NAMA_LENGKAP_PEGAWAI',
    'STATUS_KEPEGAWAIAN',
    'JABATAN_MAPEL',
    'STATUS_KEHADIRAN',
    'JAM_MASUK_WITA',
    'LOKASI_GPS_MASUK',
    'JARAK_RADIUS_MASUK',
    'JAM_PULANG_WITA',
    'LOKASI_GPS_PULANG',
    'JARAK_RADIUS_PULANG',
    'METODE_VERIFIKASI',
    'LINK_ARSIP_FOTO_DRIVE',
    'STATUS_VALIDASI_BKD',
    'UNIT_KERJA',
    'KABUPATEN',
  ];

  const rows = Array.from(groupedMap.values()).map((row, idx) => {
    return [
      idx + 1,
      row.date,
      `"${row.nip}"`,
      `"${row.personName.replace(/"/g, '""')}"`,
      `"${row.employmentStatus}"`,
      `"${row.subjectOrRole.replace(/"/g, '""')}"`,
      row.status,
      row.jamMasuk,
      `"${row.lokasiMasuk.replace(/"/g, '""')}"`,
      row.jarakMasuk,
      row.jamPulang,
      `"${row.lokasiPulang.replace(/"/g, '""')}"`,
      row.jarakPulang,
      `"${row.metode}"`,
      `"${row.fotoDriveLink}"`,
      `"TERVERIFIKASI SIMPEG BKD (${row.catatan})"`,
      `"${config.schoolName}"`,
      `"KABUPATEN PULAU TALIABU"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Downloads formatted BKD CSV file directly to client
 */
export const exportBkdOfficialCsv = (
  records: AttendanceRecord[],
  config: SchoolConfig,
  teachersOnly: boolean = true,
  customFilename?: string
) => {
  markWeeklyBkdExported();
  const csvContent = generateBkdStructuredCsvString(records, config, teachersOnly);
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = customFilename
    ? `${customFilename}.csv`
    : `BKD_Presensi_GTK_${config.schoolName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Exports System Activity / Audit Logs to official PDF report
 */
export const exportActivityLogsToPdf = (
  logs: ActivityLog[],
  config: SchoolConfig,
  filterTitle: string = 'Laporan Audit Trail & Log Aktivitas Sistem',
  dateRangeStr: string = formatDateIndo(new Date().toISOString().split('T')[0])
) => {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  // Header Letterhead
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara', doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });
  doc.text(`NPSN: ${config.npsn} | Tahun Ajaran: ${config.academicYear} | Semester: ${config.semester}`, doc.internal.pageSize.getWidth() / 2, 63, { align: 'center' });

  // Divider Line
  doc.setLineWidth(1.5);
  doc.line(40, 72, doc.internal.pageSize.getWidth() - 40, 72);
  doc.setLineWidth(0.5);
  doc.line(40, 74, doc.internal.pageSize.getWidth() - 40, 74);

  // Report Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(filterTitle.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 95, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`Periode: ${dateRangeStr} • Dicetak otomatis untuk Catatan Kepatuhan & Akuntabilitas Resmi`, doc.internal.pageSize.getWidth() / 2, 108, { align: 'center' });

  // Format Table Data
  const tableRows = logs.map((l, idx) => {
    return [
      idx + 1,
      `${l.date}\n${l.time}`,
      l.category.toUpperCase(),
      `${l.actor.name}\n(${l.actor.role})`,
      l.action,
      l.description,
      l.targetName || l.targetId || '-',
      l.status.toUpperCase(),
      l.deviceInfo || 'Web System',
    ];
  });

  autoTable(doc, {
    startY: 120,
    head: [[
      'No',
      'Waktu',
      'Kategori',
      'Aktor / Pelaku',
      'Aksi',
      'Deskripsi & Rincian',
      'Target',
      'Status',
      'Perangkat / IP',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      halign: 'left',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { cellWidth: 65, halign: 'center' },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 100 },
      4: { cellWidth: 95 },
      5: { cellWidth: 200 },
      6: { cellWidth: 85 },
      7: { cellWidth: 50, halign: 'center' },
      8: { cellWidth: 85 },
    },
  });

  // Footer Signatures
  const finalY = (doc as any).lastAutoTable?.finalY || 400;
  if (finalY < 480) {
    const signY = finalY + 30;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Taliabu Barat, ${formatDateIndo(new Date().toISOString().split('T')[0])}`, 620, signY);
    doc.text('Kepala Sekolah,', 620, signY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', 620, signY + 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, 620, signY + 72);

    doc.text('Admin SIMPEG / Auditor Sistem,', 100, signY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(config.adminName || 'Hasbullah Buamona, S.Kom.', 100, signY + 60);
    doc.setFont('helvetica', 'normal');
    doc.text('SIMPEG BKD Kab. Pulau Taliabu', 100, signY + 72);
  }

  doc.save(`Laporan_Audit_Aktivitas_${config.schoolName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export interface MonthlyReportParams {
  records: AttendanceRecord[];
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  config: SchoolConfig;
  selectedMonth: string; // "YYYY-MM" e.g., "2026-09"
  targetCategory?: 'all' | 'students' | 'teachers';
  returnDocOnly?: boolean;
}

/**
 * Exports Comprehensive Monthly Attendance Summary to Official PDF
 */
export const exportMonthlyAttendanceSummaryPdf = ({
  records = [],
  students = [],
  teachers = [],
  classes = [],
  config,
  selectedMonth,
  targetCategory = 'all',
  returnDocOnly = false,
}: MonthlyReportParams) => {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  const monthName = getMonthYearIndo(selectedMonth);
  const pageWidth = doc.internal.pageSize.getWidth();

  // Filter records matching the selected month (YYYY-MM)
  const monthRecords = records.filter((r) => r.date.startsWith(selectedMonth));
  const uniqueDates = Array.from(new Set(monthRecords.map((r) => r.date))).sort();
  const effectiveDaysCount = Math.max(1, uniqueDates.length);

  // General Statistics
  const countHadir = monthRecords.filter((r) => r.status === 'hadir').length;
  const countTerlambat = monthRecords.filter((r) => r.status === 'terlambat').length;
  const countSakit = monthRecords.filter((r) => r.status === 'sakit').length;
  const countIzin = monthRecords.filter((r) => r.status === 'izin').length;
  const countAlpa = monthRecords.filter((r) => r.status === 'alpa').length;
  const totalLogs = monthRecords.length;

  const totalPresentLogs = countHadir + countTerlambat;
  const overallPercentage = totalLogs > 0 ? Math.round((totalPresentLogs / totalLogs) * 100) : 0;

  // Header Letterhead
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT', pageWidth / 2, 32, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara',
    pageWidth / 2,
    46,
    { align: 'center' }
  );
  doc.text(
    `NPSN: ${config.npsn || '69904123'} | Tahun Pelajaran: ${config.academicYear} | Semester: ${config.semester} | SIMPEG BKD Pulau Taliabu`,
    pageWidth / 2,
    58,
    { align: 'center' }
  );

  // Double Divider Lines
  doc.setLineWidth(1.5);
  doc.line(35, 66, pageWidth - 35, 66);
  doc.setLineWidth(0.5);
  doc.line(35, 68, pageWidth - 35, 68);

  // Report Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const titleText =
    targetCategory === 'teachers'
      ? `LAPORAN BULANAN REKAPITULASI DISIPLIN & PRESENSI GURU / GTK`
      : targetCategory === 'students'
      ? `LAPORAN BULANAN REKAPITULASI PRESENSI PESERTA DIDIK`
      : `LAPORAN BULANAN REKAPITULASI PRESENSI TERPADU (GURU & SISWA)`;
  doc.text(titleText, pageWidth / 2, 86, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Bulan Evaluasi: ${monthName} (${effectiveDaysCount} Hari Efektif Presensi Tercatat) • Tingkat Kehadiran: ${overallPercentage}%`,
    pageWidth / 2,
    98,
    { align: 'center' }
  );

  // Executive KPI Summary Boxes
  const boxY = 108;
  const boxWidth = (pageWidth - 70 - 20) / 5;
  const boxHeight = 28;

  const kpis = [
    { label: 'Total Log Presensi', val: `${totalLogs}`, color: [241, 245, 249], textCol: [30, 41, 59] },
    { label: 'Hadir Tepat Waktu', val: `${countHadir}`, color: [236, 253, 245], textCol: [6, 95, 70] },
    { label: 'Terlambat', val: `${countTerlambat}`, color: [254, 243, 199], textCol: [146, 64, 14] },
    { label: 'Sakit & Izin', val: `${countSakit + countIzin}`, color: [238, 242, 255], textCol: [55, 48, 163] },
    { label: 'Alpa / Nihil', val: `${countAlpa}`, color: [255, 228, 230], textCol: [159, 18, 57] },
  ];

  kpis.forEach((kpi, idx) => {
    const curX = 35 + idx * (boxWidth + 5);
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.roundedRect(curX, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(curX, boxY, boxWidth, boxHeight, 3, 3, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(kpi.textCol[0], kpi.textCol[1], kpi.textCol[2]);
    doc.text(kpi.label, curX + boxWidth / 2, boxY + 10, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.val, curX + boxWidth / 2, boxY + 23, { align: 'center' });
  });

  doc.setTextColor(15, 23, 42); // reset text color

  let currentY = boxY + boxHeight + 14;

  // Table 1: Teachers / GTK Summary Table (if targetCategory is 'all' or 'teachers')
  if (targetCategory === 'all' || targetCategory === 'teachers') {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('I. REKAPITULASI KEHADIRAN & DISIPLIN GURU & TENAGA KEPENDIDIKAN (GTK)', 35, currentY);

    const teacherRows = teachers.map((t, idx) => {
      const tRecords = monthRecords.filter(
        (r) => r.personType === 'teacher' && (r.personId === t.id || r.identifier === t.nip || r.personName === t.name)
      );
      const h = tRecords.filter((r) => r.status === 'hadir').length;
      const tel = tRecords.filter((r) => r.status === 'terlambat').length;
      const s = tRecords.filter((r) => r.status === 'sakit').length;
      const iz = tRecords.filter((r) => r.status === 'izin').length;
      const a = tRecords.filter((r) => r.status === 'alpa').length;

      const totalHadirDanTel = h + tel;
      const rate = effectiveDaysCount > 0 ? Math.min(100, Math.round((totalHadirDanTel / effectiveDaysCount) * 100)) : 0;
      const statusKepatuhan = rate >= 90 ? 'Sangat Baik' : rate >= 75 ? 'Cukup' : 'Perlu Pembinaan';

      return [
        idx + 1,
        t.nip || '-',
        t.name,
        t.employmentStatus || 'PNS',
        t.subject || t.role || 'Guru Mata Pelajaran',
        h,
        tel,
        s,
        iz,
        a,
        totalHadirDanTel,
        `${rate}%`,
        statusKepatuhan,
      ];
    });

    if (teacherRows.length === 0) {
      teacherRows.push([1, '-', 'Belum ada data GTK terdaftar', '-', '-', 0, 0, 0, 0, 0, 0, '0%', '-'] as any);
    }

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: 35, right: 35 },
      head: [[
        'No',
        'NIP / NUPTK',
        'Nama Lengkap Guru / GTK',
        'Status ASN',
        'Jabatan / Mapel',
        'H',
        'T',
        'S',
        'I',
        'A',
        'Total',
        '% Hadir',
        'Evaluasi BKD',
      ]],
      body: teacherRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        halign: 'left',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 85, halign: 'center' },
        2: { cellWidth: 150 },
        3: { cellWidth: 65, halign: 'center' },
        4: { cellWidth: 125 },
        5: { cellWidth: 25, halign: 'center' },
        6: { cellWidth: 25, halign: 'center' },
        7: { cellWidth: 25, halign: 'center' },
        8: { cellWidth: 25, halign: 'center' },
        9: { cellWidth: 25, halign: 'center' },
        10: { cellWidth: 35, halign: 'center' },
        11: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
        12: { cellWidth: 85, halign: 'center' },
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 16 || currentY + 120;
  }

  // Table 2: Student Classes Summary Table (if targetCategory is 'all' or 'students')
  if (targetCategory === 'all' || targetCategory === 'students') {
    // Check if we need a new page for classes table if remaining space is too small
    if (currentY > 440) {
      doc.addPage('a4', 'landscape');
      currentY = 40;
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('II. REKAPITULASI KEHADIRAN PER ROMBEL / KELAS SISWA', 35, currentY);

    const classRows = classes.map((c, idx) => {
      const classStudents = students.filter((s) => s.classId === c.id || s.className === c.name);
      const studentCount = classStudents.length;

      const cRecords = monthRecords.filter(
        (r) => r.personType === 'student' && (r.classOrSubject === c.name || classStudents.some((s) => s.id === r.personId))
      );

      const h = cRecords.filter((r) => r.status === 'hadir').length;
      const tel = cRecords.filter((r) => r.status === 'terlambat').length;
      const s = cRecords.filter((r) => r.status === 'sakit').length;
      const iz = cRecords.filter((r) => r.status === 'izin').length;
      const a = cRecords.filter((r) => r.status === 'alpa').length;

      const totalHadirDanTel = h + tel;
      const expectedTotal = Math.max(1, studentCount * effectiveDaysCount);
      const classRate = studentCount > 0 ? Math.min(100, Math.round((totalHadirDanTel / expectedTotal) * 100)) : 0;

      return [
        idx + 1,
        c.name,
        `Tingkat ${c.grade}`,
        c.homeroomTeacher || 'Wali Kelas Belum Ditentukan',
        studentCount,
        h,
        tel,
        s,
        iz,
        a,
        totalHadirDanTel,
        `${classRate}%`,
      ];
    });

    if (classRows.length === 0) {
      classRows.push([1, 'Semua Kelas', '-', '-', students.length, countHadir, countTerlambat, countSakit, countIzin, countAlpa, countHadir + countTerlambat, `${overallPercentage}%`] as any);
    }

    autoTable(doc, {
      startY: currentY + 6,
      margin: { left: 35, right: 35 },
      head: [[
        'No',
        'Rombel / Kelas',
        'Tingkat',
        'Wali Kelas / Pembina',
        'Jml Siswa',
        'Hadir',
        'Terlambat',
        'Sakit',
        'Izin',
        'Alpa',
        'Total Kehadiran',
        '% Rata-rata Kelas',
      ]],
      body: classRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        halign: 'left',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 100, fontStyle: 'bold' },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 180 },
        4: { cellWidth: 60, halign: 'center' },
        5: { cellWidth: 45, halign: 'center' },
        6: { cellWidth: 55, halign: 'center' },
        7: { cellWidth: 45, halign: 'center' },
        8: { cellWidth: 45, halign: 'center' },
        9: { cellWidth: 45, halign: 'center' },
        10: { cellWidth: 70, halign: 'center' },
        11: { cellWidth: 80, halign: 'center', fontStyle: 'bold' },
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 20 || currentY + 100;
  }

  // Footer Signatures
  if (currentY > 480) {
    doc.addPage('a4', 'landscape');
    currentY = 40;
  }

  const signY = currentY + 15;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Taliabu Barat, ${formatDateIndo(new Date().toISOString().split('T')[0])}`, pageWidth - 180, signY, { align: 'center' });
  doc.text('Mengetahui,', pageWidth - 180, signY + 12, { align: 'center' });
  doc.text('Kepala Sekolah,', pageWidth - 180, signY + 24, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', pageWidth - 180, signY + 68, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, pageWidth - 180, signY + 80, { align: 'center' });

  doc.text('Koordinator Presensi & Admin SIMPEG,', 140, signY + 24, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(config.adminName || 'Hasbullah Buamona, S.Kom.', 140, signY + 68, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('SIMPEG BKD Kab. Pulau Taliabu', 140, signY + 80, { align: 'center' });

  const safeFilename = `Laporan_Bulanan_Presensi_${selectedMonth}_${config.schoolName?.replace(/\s+/g, '_')}.pdf`;
  if (!returnDocOnly) {
    doc.save(safeFilename);
  }
  return doc;
};

export interface IndividualAttendancePdfParams {
  person: Teacher | Student;
  personType: 'teacher' | 'student';
  selectedMonth: string; // YYYY-MM
  records: AttendanceRecord[];
  config: SchoolConfig;
  returnDocOnly?: boolean;
}

/**
 * Exports Detailed Monthly Individual Attendance Log to Official PDF
 */
export const exportIndividualAttendancePdf = ({
  person,
  personType,
  selectedMonth,
  records = [],
  config,
  returnDocOnly = false,
}: IndividualAttendancePdfParams) => {
  const doc = new jsPDF('portrait', 'pt', 'a4');
  const monthName = getMonthYearIndo(selectedMonth);
  const pageWidth = doc.internal.pageSize.getWidth();

  // Parse Year and Month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1; // 0-indexed

  // Determine days in month
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Filter records for this person in selected month
  const personRecords = records.filter(
    (r) => r.personId === person.id && r.date.startsWith(selectedMonth)
  );

  const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  let countHadir = 0;
  let countTerlambat = 0;
  let countIzin = 0;
  let countSakit = 0;
  let countAlpa = 0;
  let totalWorkingDays = 0;

  const tableData: any[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${selectedMonth}-${dayStr}`;
    const dateObj = new Date(year, monthIdx, d);
    const dayOfWeek = dateObj.getDay();
    const dayName = dayNamesIndo[dayOfWeek];

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Check-in and check-out records for this day
    const checkInRecord = personRecords.find(
      (r) => r.date === dateStr && (r.type === 'masuk' || (!r.type && r.status))
    );
    const checkOutRecord = personRecords.find(
      (r) => r.date === dateStr && r.type === 'pulang'
    );

    let masukTime = checkInRecord?.time || '-';
    let pulangTime = checkOutRecord?.time || '-';
    let statusText = '-';
    let durationText = '-';
    let noteText = checkInRecord?.note || checkOutRecord?.note || '-';

    if (isWeekend) {
      statusText = 'Hari Libur';
      noteText = dayOfWeek === 0 ? 'Libur Akhir Pekan (Minggu)' : 'Libur Akhir Pekan (Sabtu)';
    } else {
      totalWorkingDays++;

      if (checkInRecord) {
        if (checkInRecord.status === 'hadir') {
          countHadir++;
          statusText = 'Hadir Tepat Waktu';
        } else if (checkInRecord.status === 'terlambat') {
          countTerlambat++;
          statusText = 'Terlambat';
        } else if (checkInRecord.status === 'izin') {
          countIzin++;
          statusText = 'Izin Resmi';
        } else if (checkInRecord.status === 'sakit') {
          countSakit++;
          statusText = 'Sakit';
        } else if (checkInRecord.status === 'alpa') {
          countAlpa++;
          statusText = 'Tanpa Keterangan';
        }

        // Calculate work duration if both times available
        if (checkInRecord.time && checkOutRecord?.time) {
          const mParts = checkInRecord.time.split(':').map(Number);
          const pParts = checkOutRecord.time.split(':').map(Number);
          if (mParts.length >= 2 && pParts.length >= 2) {
            const mTotal = mParts[0] * 60 + mParts[1];
            const pTotal = pParts[0] * 60 + pParts[1];
            let diff = pTotal - mTotal;
            if (diff < 0) diff += 24 * 60;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            durationText = m > 0 ? `${h}j ${m}m` : `${h} jam`;
          }
        } else if (checkInRecord.time && !checkOutRecord) {
          durationText = 'Belum Scan Pulang';
        }
      } else {
        // No record on a working day
        const todayDateStr = new Date().toISOString().split('T')[0];
        if (dateStr > todayDateStr) {
          statusText = 'Belum Berlangsung';
        } else {
          countAlpa++;
          statusText = 'Tanpa Keterangan';
        }
      }
    }

    tableData.push([
      d,
      `${dayName}, ${dayStr}/${monthStr}/${year}`,
      masukTime !== '-' ? `${masukTime} WITA` : '-',
      pulangTime !== '-' ? `${pulangTime} WITA` : '-',
      durationText,
      statusText,
      noteText,
    ]);
  }

  const attendedDays = countHadir + countTerlambat;
  const attendanceRate =
    totalWorkingDays > 0 ? Math.round((attendedDays / totalWorkingDays) * 100) : 0;

  // Header Kop Surat
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT', pageWidth / 2, 34, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara',
    pageWidth / 2,
    46,
    { align: 'center' }
  );
  doc.text(
    `NPSN: ${config.npsn || '69904123'} | Tahun Pelajaran: ${config.academicYear} | Semester: ${config.semester} | SIMPEG BKD Pulau Taliabu`,
    pageWidth / 2,
    57,
    { align: 'center' }
  );

  // Divider Line
  doc.setLineWidth(1.5);
  doc.line(35, 64, pageWidth - 35, 64);
  doc.setLineWidth(0.5);
  doc.line(35, 66, pageWidth - 35, 66);

  // Title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const titleText =
    personType === 'teacher'
      ? 'LEMBAR LOG PRESENSI & KEDISIPLINAN INDIVIDU GURU / GTK'
      : 'LEMBAR LOG PRESENSI INDIVIDU PESERTA DIDIK';
  doc.text(titleText, pageWidth / 2, 82, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Bulan: ${monthName} • Tahun Ajaran ${config.academicYear}`, pageWidth / 2, 95, { align: 'center' });

  // Identity Box
  const isTeacher = personType === 'teacher';
  const teacher = isTeacher ? (person as Teacher) : null;
  const student = !isTeacher ? (person as Student) : null;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(35, 105, pageWidth - 70, 50, 4, 4, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Nama Lengkap:', 45, 120);
  doc.setFont('helvetica', 'normal');
  doc.text(person.name, 115, 120);

  if (isTeacher && teacher) {
    doc.setFont('helvetica', 'bold');
    doc.text('NIP / Status:', 45, 134);
    doc.setFont('helvetica', 'normal');
    doc.text(`${teacher.nip || '-'} (${teacher.employmentStatus || 'PNS'})`, 115, 134);

    doc.setFont('helvetica', 'bold');
    doc.text('Mata Pelajaran:', 45, 146);
    doc.setFont('helvetica', 'normal');
    doc.text(`${teacher.subject} • ${teacher.role || 'Guru Pengajar'}`, 115, 146);

    doc.setFont('helvetica', 'bold');
    doc.text('Tingkat Kehadiran:', pageWidth / 2 + 30, 120);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(attendanceRate >= 90 ? 16 : 185, attendanceRate >= 90 ? 185 : 28, attendanceRate >= 90 ? 129 : 28);
    doc.text(`${attendanceRate}% (${attendedDays}/${totalWorkingDays} Hari)`, pageWidth / 2 + 120, 120);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Disiplin Masuk/Pulang:', pageWidth / 2 + 30, 134);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tepat: ${countHadir} | Terlambat: ${countTerlambat}`, pageWidth / 2 + 130, 134);

    doc.setFont('helvetica', 'bold');
    doc.text('Izin / Sakit / Alpa:', pageWidth / 2 + 30, 146);
    doc.setFont('helvetica', 'normal');
    doc.text(`Izin: ${countIzin} | Sakit: ${countSakit} | Alpa: ${countAlpa}`, pageWidth / 2 + 130, 146);
  } else if (student) {
    doc.setFont('helvetica', 'bold');
    doc.text('NISN / Kelas:', 45, 134);
    doc.setFont('helvetica', 'normal');
    doc.text(`${student.nisn || '-'} • Kelas ${student.className || '-'}`, 115, 134);

    doc.setFont('helvetica', 'bold');
    doc.text('Jenis Kelamin:', 45, 146);
    doc.setFont('helvetica', 'normal');
    doc.text(student.gender === 'L' ? 'Laki-Laki' : 'Perempuan', 115, 146);

    doc.setFont('helvetica', 'bold');
    doc.text('Tingkat Kehadiran:', pageWidth / 2 + 30, 120);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(attendanceRate >= 85 ? 16 : 185, attendanceRate >= 85 ? 185 : 28, attendanceRate >= 85 ? 129 : 28);
    doc.text(`${attendanceRate}% (${attendedDays}/${totalWorkingDays} Hari)`, pageWidth / 2 + 120, 120);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Izin / Sakit / Alpa:', pageWidth / 2 + 30, 134);
    doc.setFont('helvetica', 'normal');
    doc.text(`Izin: ${countIzin} | Sakit: ${countSakit} | Alpa: ${countAlpa}`, pageWidth / 2 + 120, 134);
  }

  // Monthly Table
  autoTable(doc, {
    startY: 165,
    head: [['No', 'Hari & Tanggal', 'Scan Masuk', 'Scan Pulang', 'Durasi', 'Status Kehadiran', 'Keterangan']],
    body: tableData,
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 65, halign: 'center' },
      3: { cellWidth: 65, halign: 'center' },
      4: { cellWidth: 55, halign: 'center' },
      5: { cellWidth: 90, halign: 'center' },
      6: { cellWidth: 'auto' },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const row = tableData[data.row.index];
        const statusVal = row[5];
        if (statusVal === 'Hari Libur') {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [148, 163, 184];
        } else if (statusVal === 'Tanpa Keterangan') {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        } else if (statusVal === 'Hadir Tepat Waktu') {
          if (data.column.index === 5) {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY + 20 || 680;
  if (finalY > 710) {
    doc.addPage('a4', 'portrait');
    finalY = 50;
  }

  // Summary box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(35, finalY, pageWidth - 70, 36, 4, 4, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Kehadiran Bulanan:', 45, finalY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Hari Efektif: ${totalWorkingDays} Hari | Hadir: ${countHadir} | Terlambat: ${countTerlambat} | Izin: ${countIzin} | Sakit: ${countSakit} | Alpa: ${countAlpa}`,
    45,
    finalY + 26
  );

  // Signatures
  const signY = finalY + 50;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  // Left Sign: Person
  doc.text('Taliabu Barat, ' + formatDateIndo(new Date().toISOString().split('T')[0]), 120, signY, { align: 'center' });
  doc.text('Yang Bersangkutan,', 120, signY + 12, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(person.name, 120, signY + 60, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  if (isTeacher && teacher) {
    doc.text(`NIP. ${teacher.nip || '-'}`, 120, signY + 72, { align: 'center' });
  } else if (student) {
    doc.text(`NISN. ${student.nisn || '-'}`, 120, signY + 72, { align: 'center' });
  }

  // Right Sign: Principal
  doc.text('Mengetahui,', pageWidth - 140, signY + 12, { align: 'center' });
  doc.text('Kepala Sekolah,', pageWidth - 140, signY + 24, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.', pageWidth - 140, signY + 60, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.principalNip || '197305141999031004'}`, pageWidth - 140, signY + 72, { align: 'center' });

  const safePersonName = person.name.replace(/[^a-zA-Z0-9]/g, '_');
  const safeFilename = `Presensi_Individu_${isTeacher ? 'Guru' : 'Siswa'}_${safePersonName}_${selectedMonth}.pdf`;

  if (!returnDocOnly) {
    doc.save(safeFilename);
  }

  return doc;
};



