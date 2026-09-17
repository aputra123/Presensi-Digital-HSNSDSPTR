import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BiometricLog, SchoolConfig } from '../types';
import { formatDateIndo } from './soundAndDate';

export interface VerificationHealthInfo {
  level: 'optimal' | 'warning' | 'critical';
  label: string;
  sublabel: string;
  badgeClass: string;
  dotColor: string;
  description: string;
}

/**
 * Calculates verification health of a single biometric log attempt
 */
export const getLogVerificationHealth = (log: BiometricLog): VerificationHealthInfo => {
  const isSuccess = log.status === 'success';
  const score = log.matchScore ?? 0;
  const isOutOfRadius = log.location?.inRadius === false;
  const isError = log.severity === 'error';

  if (!isSuccess || isError || score < 70) {
    return {
      level: 'critical',
      label: 'Kritis / Gagal',
      sublabel: 'Otentikasi Ditolak',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 ring-rose-500/20',
      dotColor: 'bg-rose-500',
      description: 'Verifikasi biometrik gagal lolos atau terdeteksi potensi anomali spoofing.',
    };
  }

  if (score < 85 || isOutOfRadius) {
    return {
      level: 'warning',
      label: 'Peringatan',
      sublabel: isOutOfRadius ? 'Di Luar Radius GPS' : 'Skor Marginal',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 ring-amber-500/20',
      dotColor: 'bg-amber-500',
      description: isOutOfRadius
        ? 'Otentikasi sukses namun posisi fisik berada di luar batas geofence sekolah.'
        : 'Skor kecocokan di bawah batas optimal 85%, perlu verifikasi lanjutan.',
    };
  }

  return {
    level: 'optimal',
    label: 'Optimal (Sehat)',
    sublabel: 'Terverifikasi Sah',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-emerald-500/20',
    dotColor: 'bg-emerald-500',
    description: 'Verifikasi biometrik sempurna: skor kecocokan tinggi dan lokasi dalam radius sah.',
  };
};

/**
 * Aggregates overall health statistics across a list of biometric logs
 */
export const getBiometricHealthDistribution = (logs: BiometricLog[]) => {
  const total = logs.length;
  let optimalCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  logs.forEach((log) => {
    const health = getLogVerificationHealth(log);
    if (health.level === 'optimal') optimalCount++;
    else if (health.level === 'warning') warningCount++;
    else criticalCount++;
  });

  const optimalPct = total > 0 ? Math.round((optimalCount / total) * 100) : 0;
  const warningPct = total > 0 ? Math.round((warningCount / total) * 100) : 0;
  const criticalPct = total > 0 ? Math.max(0, 100 - optimalPct - warningPct) : 0;

  return {
    total,
    optimalCount,
    optimalPct,
    warningCount,
    warningPct,
    criticalCount,
    criticalPct,
  };
};

/**
 * Exports biometric activity logs directly as an official PDF audit report
 */
export const exportBiometricLogsPdf = (
  logs: BiometricLog[],
  config?: SchoolConfig,
  filterSummary: string = 'Semua Periode'
): void => {
  if (!logs || logs.length === 0) {
    alert('Tidak ada data log biometrik untuk diekspor ke PDF!');
    return;
  }

  // Create Landscape A4 PDF document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const schoolName = config?.schoolName || 'SMP NEGERI 4 TALIABU BARAT';
  const schoolAddress = config?.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara';
  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const printTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';

  // Kop Surat & Header
  doc.setFillColor(30, 41, 59); // Slate-800 accent top line
  doc.rect(0, 0, pageWidth, 6, 'F');

  // School Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolName.toUpperCase(), 40, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(schoolAddress, 40, 46);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138); // Indigo-900
  doc.text('LAPORAN AUDIT REKAM JEJAK & KESEHATAN OTENTIKASI BIOMETRIK', 40, 68);

  // Metadata Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Filter/Periode: ${filterSummary} | Waktu Ekspor: ${currentDateStr} (${printTimeStr}) | Total Log: ${logs.length} Rekaman`,
    40,
    81
  );

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(40, 90, pageWidth - 40, 90);

  // Summary Stat Pill Box
  const healthStats = getBiometricHealthDistribution(logs);
  const successCount = logs.filter((l) => l.status === 'success').length;
  const failCount = logs.filter((l) => l.status === 'failed').length;
  const avgScore = (logs.reduce((acc, c) => acc + (c.matchScore || 0), 0) / logs.length).toFixed(1);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, 98, pageWidth - 80, 24, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Ringkasan Audit:  Lolos (Sukses): ${successCount}  |  Ditolak (Gagal): ${failCount}  |  Rata-rata Skor: ${avgScore}%  |  Status Kesehatan: ${healthStats.optimalCount} Optimal (${healthStats.optimalPct}%), ${healthStats.warningCount} Waspada (${healthStats.warningPct}%), ${healthStats.criticalCount} Kritis/Gagal (${healthStats.criticalPct}%)`,
    50,
    113
  );

  // Build Table Data
  const tableHeaders = [
    'No',
    'Tanggal & Waktu',
    'Nama Personil',
    'NIP / NISN',
    'Kategori',
    'Metode Sensor',
    'Skor',
    'Status',
    'Kesehatan',
    'Lokasi & GPS',
    'Catatan / Anomali',
  ];

  const tableRows = logs.map((log, index) => {
    const health = getLogVerificationHealth(log);
    const datePart = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : '-');
    const timePart = log.time || (log.timestamp ? log.timestamp.split(' ')[1] : '-');
    const methodLabel =
      log.method === 'face_scan'
        ? 'Face Scan AI'
        : 'WebAuthn Passkey';
    const statusLabel = log.status === 'success' ? 'LOLOS' : 'DITOLAK';
    const gpsLabel = log.location
      ? `${log.location.distanceMeter !== undefined ? log.location.distanceMeter + 'm' : ''} ${log.location.inRadius === false ? '(Luar Radius)' : '(Dalam Radius)'}`
      : 'GPS Standar';
    const notesClean = log.notes || '-';

    return [
      index + 1,
      `${datePart}\n${timePart}`,
      log.personName,
      log.personId || '-',
      log.personType === 'student' ? 'Siswa' : 'Guru / GTK',
      methodLabel,
      `${log.matchScore}%`,
      statusLabel,
      health.label,
      gpsLabel,
      notesClean.length > 40 ? notesClean.substring(0, 37) + '...' : notesClean,
    ];
  });

  // Render Table using autoTable
  autoTable(doc, {
    startY: 130,
    margin: { left: 40, right: 40, bottom: 50 },
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'middle',
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
      0: { cellWidth: 26, halign: 'center' }, // No
      1: { cellWidth: 68, halign: 'center' }, // Tanggal & Waktu
      2: { cellWidth: 100, fontStyle: 'bold' }, // Nama Personil
      3: { cellWidth: 70, halign: 'center' }, // NIP/NISN
      4: { cellWidth: 55, halign: 'center' }, // Kategori
      5: { cellWidth: 72, halign: 'center' }, // Metode
      6: { cellWidth: 38, halign: 'center' }, // Skor
      7: { cellWidth: 50, halign: 'center' }, // Status
      8: { cellWidth: 75, halign: 'center' }, // Kesehatan
      9: { cellWidth: 85 }, // Lokasi & GPS
      10: { cellWidth: 'auto' }, // Catatan
    },
    didParseCell: (data) => {
      // Highlight status and health cells with colors
      if (data.section === 'body') {
        if (data.column.index === 7) {
          const val = String(data.cell.raw);
          if (val === 'LOLOS') {
            data.cell.styles.textColor = [16, 149, 106]; // Emerald-600
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [225, 29, 72]; // Rose-600
            data.cell.styles.fontStyle = 'bold';
          }
        } else if (data.column.index === 8) {
          const val = String(data.cell.raw);
          if (val.includes('Optimal')) {
            data.cell.styles.textColor = [16, 149, 106];
          } else if (val.includes('Peringatan')) {
            data.cell.styles.textColor = [217, 119, 6];
          } else {
            data.cell.styles.textColor = [225, 29, 72];
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Footer page count & watermark
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = (data as any).pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Laporan Audit Resmi Sistem Biometrik — ${schoolName} | Diunduh secara terenkripsi`,
        40,
        pageHeight - 20
      );
      doc.text(
        `Halaman ${currentPage} dari ${pageCount}`,
        pageWidth - 100,
        pageHeight - 20
      );
    },
  });

  // Save the PDF
  const sanitizedSchool = (config?.schoolName || 'SMPN4_TaliabuBarat').replace(/[^a-zA-Z0-9]/g, '_');
  const dateFileStamp = new Date().toISOString().split('T')[0];
  doc.save(`Laporan_Audit_Biometrik_${sanitizedSchool}_${dateFileStamp}.pdf`);
};

/**
 * Downloads raw data from biometricLogs as a structured CSV file
 * suitable for external school reporting tools (Dapodik, BKD, spreadsheets)
 */
export const downloadStructuredBiometricCsv = (
  logs: BiometricLog[],
  filename?: string
): void => {
  if (!logs || logs.length === 0) {
    alert('Tidak ada data log biometrik untuk diunduh sebagai CSV!');
    return;
  }

  // Structured machine-readable headers
  const csvHeaders = [
    'log_id',
    'timestamp_iso',
    'date',
    'time_wita',
    'person_id',
    'person_name',
    'person_category',
    'session_type',
    'verification_status',
    'verification_health',
    'severity_level',
    'biometric_method',
    'match_score_pct',
    'device_sensor',
    'ip_address',
    'latitude',
    'longitude',
    'geofence_radius_m',
    'is_within_radius',
    'location_address',
    'audit_notes',
  ];

  const escapeCsv = (str: any): string => {
    if (str === null || str === undefined) return '';
    const text = String(str);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const rows = logs.map((log) => {
    const health = getLogVerificationHealth(log);
    const dateStr = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : '');
    const timeStr = log.time || (log.timestamp ? log.timestamp.split(' ')[1] : '');
    const isoTimestamp = log.date && log.time ? `${log.date}T${log.time}` : log.timestamp || '';

    return [
      escapeCsv(log.id),
      escapeCsv(isoTimestamp),
      escapeCsv(dateStr),
      escapeCsv(timeStr),
      escapeCsv(log.personId || ''),
      escapeCsv(log.personName),
      escapeCsv(log.personType === 'student' ? 'student' : 'teacher'),
      escapeCsv(log.type || 'masuk'),
      escapeCsv(log.status),
      escapeCsv(health.level),
      escapeCsv(log.severity || 'info'),
      escapeCsv(log.method),
      log.matchScore ?? 0,
      escapeCsv(log.deviceInfo || log.cameraFacing || 'standard_web'),
      escapeCsv(log.ipAddress || '-'),
      log.location?.lat ?? '',
      log.location?.lng ?? '',
      log.location?.distanceMeter ?? '',
      log.location?.inRadius !== undefined ? (log.location.inRadius ? 'TRUE' : 'FALSE') : '',
      escapeCsv(log.location?.address || ''),
      escapeCsv(log.notes || ''),
    ].join(',');
  });

  // UTF-8 BOM for Excel compatibility
  const csvContent = '\uFEFF' + [csvHeaders.join(','), ...rows].join('\r\n');
  const dateStamp = new Date().toISOString().split('T')[0];
  const activeFileName = filename || `raw_biometric_logs_export_${dateStamp}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', activeFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
