import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { SchoolConfig, Student, Teacher } from '../types';

export type CardOrientation = 'landscape' | 'portrait';

/**
 * Generates a crisp, high-resolution QR code data URL from any string
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    return '';
  }
}

/**
 * Downloads a single QR code image directly
 */
export function downloadQrOnly(qrDataUrl: string, fileName: string): void {
  if (!qrDataUrl) return;
  const link = document.createElement('a');
  link.href = qrDataUrl;
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to safely load an image URL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Return a 1x1 transparent image or reject gracefully
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    };
    img.src = src;
  });
}

/**
 * Draws a professional, high-resolution ID Card onto an HTML5 Canvas
 * Supports both Landscape (1000px x 630px) and Portrait (630px x 1000px)
 */
export async function renderCardToCanvas(
  person: Student | Teacher,
  type: 'student' | 'teacher',
  config: SchoolConfig,
  qrDataUrl: string,
  orientation?: CardOrientation
): Promise<HTMLCanvasElement> {
  const activeOrientation: CardOrientation = orientation || (type === 'teacher' ? 'portrait' : 'landscape');
  const canvas = document.createElement('canvas');
  const isPortrait = activeOrientation === 'portrait';
  const width = isPortrait ? 630 : 1000;
  const height = isPortrait ? 1000 : 630;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  const isStudent = type === 'student';
  const student = isStudent ? (person as Student) : null;
  const teacher = !isStudent ? (person as Teacher) : null;

  // 1. Base Card Background (Warm Crisp White with Rounded Rect)
  ctx.save();
  const radius = 32;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();

  // White Card Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Header Banner Gradient
  const headerHeight = isPortrait ? 160 : 135;
  const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
  if (isStudent) {
    headerGrad.addColorStop(0, '#1e3a8a'); // Blue-900
    headerGrad.addColorStop(0.5, '#312e81'); // Indigo-900
    headerGrad.addColorStop(1, '#0f172a'); // Slate-900
  } else {
    headerGrad.addColorStop(0, '#581c87'); // Purple-900
    headerGrad.addColorStop(0.5, '#3b0764'); // Purple-950
    headerGrad.addColorStop(1, '#1e1b4b'); // Indigo-950
  }
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, headerHeight);

  // Decorative header circle/glow
  ctx.save();
  ctx.fillStyle = isStudent ? 'rgba(99, 102, 241, 0.25)' : 'rgba(168, 85, 247, 0.25)';
  ctx.beginPath();
  ctx.arc(width - 40, headerHeight - 10, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. School Logo in Header
  let logoDrawn = false;
  if (config.logoUrl) {
    try {
      const logoImg = await loadImage(config.logoUrl);
      if (logoImg.width > 1) {
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        if (isPortrait) {
          ctx.roundRect(30, 35, 90, 90, 18);
        } else {
          ctx.roundRect(30, 22, 90, 90, 18);
        }
        ctx.fill();
        ctx.clip();
        if (isPortrait) {
          ctx.drawImage(logoImg, 35, 40, 80, 80);
        } else {
          ctx.drawImage(logoImg, 35, 27, 80, 80);
        }
        ctx.restore();
        logoDrawn = true;
      }
    } catch {
      logoDrawn = false;
    }
  }

  const textStartX = logoDrawn ? 135 : 40;

  // Header Titles
  if (isPortrait) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText((config.schoolName || 'SMPN 4 TALIABU BARAT').toUpperCase(), textStartX, 65);

    ctx.fillStyle = isStudent ? '#93c5fd' : '#d8b4fe';
    ctx.font = 'bold 15px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      isStudent ? 'KARTU TANDA PELAJAR DIGITAL' : 'KARTU IDENTITAS GTK / PEGAWAI',
      textStartX,
      95
    );

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '500 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`NPSN: ${config.npsn || '-'} • T.A ${config.academicYear || '2025/2026'}`, textStartX, 120);

    // Status Badge in Top Right
    const badgeText = isStudent ? 'SISWA' : teacher?.employmentStatus || 'GURU GTK';
    ctx.save();
    ctx.fillStyle = isStudent ? '#fbbf24' : '#34d399';
    ctx.beginPath();
    ctx.roundRect(width - 120, 35, 90, 32, 10);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, width - 120 + 45, 56);
    ctx.restore();
  } else {
    // Landscape Header
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText((config.schoolName || 'SEKOLAH NEGERI').toUpperCase(), textStartX, 58);

    ctx.fillStyle = isStudent ? '#93c5fd' : '#d8b4fe';
    ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      isStudent ? 'KARTU TANDA PELAJAR DIGITAL & QR PRESENSI' : 'KARTU IDENTITAS PEGAWAI / GTK & QR PRESENSI',
      textStartX,
      88
    );

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '500 15px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`NPSN: ${config.npsn || '-'}  •  TAHUN AJARAN ${config.academicYear || '2025/2026'}`, textStartX, 114);

    const badgeText = isStudent ? 'SISWA' : teacher?.employmentStatus || 'GURU GTK';
    ctx.save();
    ctx.fillStyle = isStudent ? '#fbbf24' : '#34d399';
    ctx.beginPath();
    ctx.roundRect(width - 150, 42, 115, 42, 12);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, width - 150 + 115 / 2, 69);
    ctx.restore();
  }

  // 4. Person Photo & Information
  if (isPortrait) {
    // PORTRAIT LAYOUT: Photo + Info in top half, Big Centered QR in bottom half
    const photoX = 40;
    const photoY = 190;
    const photoW = 150;
    const photoH = 190;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isStudent ? '#c7d2fe' : '#e9d5ff';
    ctx.stroke();
    ctx.clip();

    if (person.avatar) {
      try {
        const avatarImg = await loadImage(person.avatar);
        ctx.drawImage(avatarImg, photoX, photoY, photoW, photoH);
      } catch {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(photoX, photoY, photoW, photoH);
      }
    }
    ctx.restore();

    // Person Information beside photo
    const infoX = 210;
    let currentY = 220;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(person.name, infoX, currentY);
    currentY += 32;

    const subBadgeText = isStudent ? `Kelas: ${student?.className || '-'}` : `Jabatan: ${teacher?.role || teacher?.subject || '-'}`;
    ctx.save();
    ctx.fillStyle = isStudent ? '#e0e7ff' : '#f3e8ff';
    ctx.beginPath();
    ctx.roundRect(infoX, currentY - 20, 380, 28, 8);
    ctx.fill();
    ctx.fillStyle = isStudent ? '#3730a3' : '#6b21a8';
    ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(subBadgeText, infoX + 12, currentY - 1);
    ctx.restore();
    currentY += 38;

    const fields: { label: string; value: string; isMono?: boolean }[] = isStudent
      ? [
          { label: 'NISN', value: student?.nisn || '-', isMono: true },
          { label: 'NIK Siswa', value: student?.nik || '-', isMono: true },
          { label: 'Kelas', value: student?.className || '-' },
          { label: 'Tahun Ajaran', value: config.academicYear ? `T.A ${config.academicYear}` : '-' },
        ]
      : [
          { label: 'NIP', value: teacher?.nip || '-', isMono: true },
          { label: 'Mata Pelajaran', value: teacher?.subject || teacher?.role || '-' },
          { label: 'Status Kepegawaian', value: teacher?.employmentStatus || 'GTK' },
          { label: 'Tahun Ajaran', value: config.academicYear ? `T.A ${config.academicYear}` : '-' },
        ];

    // Mathematical colon alignment: fixed X coordinate for colons ensures perfect vertical alignment
    const portraitColonX = infoX + 142;
    const portraitValueX = portraitColonX + 10;

    fields.forEach((field) => {
      // 1. Label (left-aligned)
      ctx.fillStyle = '#64748b';
      ctx.font = '600 13.5px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(field.label, infoX, currentY);

      // 2. Colon separator (centered at fixed X coordinate)
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(':', portraitColonX, currentY);

      // 3. Value (left-aligned at fixed valueX)
      ctx.fillStyle = '#0f172a';
      ctx.font = field.isMono
        ? 'bold 14.5px "Courier New", monospace'
        : 'bold 13.5px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';

      // Truncate value if exceeding available width
      let displayValue = field.value;
      const maxValueW = width - portraitValueX - 25;
      if (ctx.measureText(displayValue).width > maxValueW) {
        while (ctx.measureText(displayValue + '...').width > maxValueW && displayValue.length > 0) {
          displayValue = displayValue.slice(0, -1);
        }
        displayValue += '...';
      }
      ctx.fillText(displayValue, portraitValueX, currentY);

      currentY += 26;
    });

    // PORTRAIT: Large, Perfectly Centered & Aligned QR Code Container in lower section
    const qrBoxW = 550;
    const qrBoxH = 480;
    const qrBoxX = (width - qrBoxW) / 2;
    const qrBoxY = 410;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    // QR Title (Centered)
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 17px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR CODE PRESENSI MANDIRI', width / 2, qrBoxY + 36);

    // QR Code Image (Large, Centered)
    const qrSize = 310;
    const qrX = (width - qrSize) / 2;
    const qrY = qrBoxY + 54;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 18);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    if (qrDataUrl) {
      try {
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, qrX + 8, qrY + 8, qrSize - 16, qrSize - 16);
      } catch (e) {
        console.warn('QR image draw error:', e);
      }
    }

    // Centered Monospace Identifier
    const qrIdLabel = isStudent ? `STD-${student?.nisn}` : `ASN-${teacher?.nip}`;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(qrIdLabel, width / 2, qrBoxY + 405);

    // Verification Seal text (Centered)
    ctx.fillStyle = isStudent ? '#059669' : '#7c3aed';
    ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(isStudent ? '✓ Terverifikasi Dapodik Kemendikbud' : '✓ SIMPEG & BKD Taliabu Verified', width / 2, qrBoxY + 442);
    ctx.restore();

    // Portrait Footer
    const footerH = 50;
    ctx.fillStyle = isStudent ? '#f1f5f9' : '#faf5ff';
    ctx.fillRect(0, height - footerH, width, footerH);
    ctx.fillStyle = isStudent ? '#475569' : '#6b21a8';
    ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Alamat: ${config.address || 'Kabupaten Pulau Taliabu, Maluku Utara'}`, 30, height - 18);
    ctx.textAlign = 'right';
    ctx.fillText('Presensi Digital Resmi', width - 30, height - 18);

  } else {
    // LANDSCAPE LAYOUT: Left Photo, Middle Info, Right Clean Aligned QR Box
    const photoX = 40;
    const photoY = 165;
    const photoW = 180;
    const photoH = 225;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = isStudent ? '#c7d2fe' : '#e9d5ff';
    ctx.stroke();
    ctx.clip();

    if (person.avatar) {
      try {
        const avatarImg = await loadImage(person.avatar);
        ctx.drawImage(avatarImg, photoX, photoY, photoW, photoH);
      } catch {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(photoX, photoY, photoW, photoH);
      }
    }
    ctx.restore();

    // Middle Info
    const infoX = 250;
    let currentY = 195;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(person.name, infoX, currentY);
    currentY += 38;

    const subBadgeText = isStudent ? `Kelas: ${student?.className || '-'}` : `Jabatan: ${teacher?.role || teacher?.subject || '-'}`;
    ctx.save();
    ctx.fillStyle = isStudent ? '#e0e7ff' : '#f3e8ff';
    ctx.beginPath();
    ctx.roundRect(infoX, currentY - 24, 300, 34, 10);
    ctx.fill();

    ctx.fillStyle = isStudent ? '#3730a3' : '#6b21a8';
    ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(subBadgeText, infoX + 16, currentY - 1);
    ctx.restore();
    currentY += 45;

    const fields: { label: string; value: string; isMono?: boolean }[] = isStudent
      ? [
          { label: 'NISN', value: student?.nisn || '-', isMono: true },
          { label: 'NIK Siswa', value: student?.nik || '-', isMono: true },
          { label: 'Kelas', value: student?.className || '-' },
          { label: 'Tahun Ajaran', value: config.academicYear ? `T.A ${config.academicYear}` : '-' },
        ]
      : [
          { label: 'NIP', value: teacher?.nip || '-', isMono: true },
          { label: 'Mata Pelajaran', value: teacher?.subject || teacher?.role || '-' },
          { label: 'Status Kepegawaian', value: teacher?.employmentStatus || 'GTK' },
          { label: 'Tahun Ajaran', value: config.academicYear ? `T.A ${config.academicYear}` : '-' },
        ];

    // Mathematical colon alignment: fixed X coordinate for colons ensures perfect vertical alignment
    const landscapeColonX = infoX + 175;
    const landscapeValueX = landscapeColonX + 12;

    fields.forEach((field) => {
      // 1. Label (left-aligned)
      ctx.fillStyle = '#64748b';
      ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(field.label, infoX, currentY);

      // 2. Colon separator (centered at fixed X coordinate)
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 17px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(':', landscapeColonX, currentY);

      // 3. Value (left-aligned at fixed valueX)
      ctx.fillStyle = '#0f172a';
      ctx.font = field.isMono
        ? 'bold 18px "Courier New", monospace'
        : 'bold 17px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';

      // Truncate value if exceeding available width
      let displayValue = field.value;
      const maxValW = qrBoxX - landscapeValueX - 15;
      if (ctx.measureText(displayValue).width > maxValW) {
        while (ctx.measureText(displayValue + '...').width > maxValW && displayValue.length > 0) {
          displayValue = displayValue.slice(0, -1);
        }
        displayValue += '...';
      }
      ctx.fillText(displayValue, landscapeValueX, currentY);

      currentY += 32;
    });

    // Right QR Box (Aligned with perfect centering)
    const qrBoxW = 250;
    const qrBoxH = 345;
    const qrBoxX = width - qrBoxW - 40;
    const qrBoxY = 160;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 20);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR CODE PRESENSI RESMI', qrBoxX + qrBoxW / 2, qrBoxY + 28);

    // Real QR Code Image
    if (qrDataUrl) {
      try {
        const qrImg = await loadImage(qrDataUrl);
        const qrSize = 200;
        const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
        const qrY = qrBoxY + 40;

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(qrX, qrY, qrSize, qrSize, 14);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        ctx.drawImage(qrImg, qrX + 5, qrY + 5, qrSize - 10, qrSize - 10);
      } catch (e) {
        console.warn('QR image draw error:', e);
      }
    }

    const qrIdLabel = isStudent ? `STD-${student?.nisn}` : `ASN-${teacher?.nip}`;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(qrIdLabel, qrBoxX + qrBoxW / 2, qrBoxY + 276);

    ctx.fillStyle = isStudent ? '#059669' : '#7c3aed';
    ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(isStudent ? '✓ Terverifikasi Dapodik' : '✓ SIMPEG & BKD Verified', qrBoxX + qrBoxW / 2, qrBoxY + 312);
    ctx.restore();

    // Security Notice (Bottom Left Area)
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      'Kartu ini adalah identitas digital resmi presensi mandiri dan akses layanan sekolah.',
      40,
      height - 110
    );

    // Landscape Footer Bar
    const footerH = 50;
    ctx.fillStyle = isStudent ? '#f1f5f9' : '#faf5ff';
    ctx.fillRect(0, height - footerH, width, footerH);
    ctx.fillStyle = isStudent ? '#475569' : '#6b21a8';
    ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Alamat: ${config.address || 'Kabupaten Pulau Taliabu, Maluku Utara'}`, 40, height - 19);

    ctx.textAlign = 'right';
    ctx.fillText('Website: https://presensi.sekolah.go.id', width - 40, height - 19);
  }

  // Card Outer Border
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();
  ctx.restore();

  return canvas;
}

/**
 * Downloads high-resolution PNG image of the ID Card in chosen orientation
 */
export async function downloadCardAsPng(
  person: Student | Teacher,
  type: 'student' | 'teacher',
  config: SchoolConfig,
  qrDataUrl: string,
  orientation?: CardOrientation
): Promise<void> {
  const activeOrientation: CardOrientation = orientation || (type === 'teacher' ? 'portrait' : 'landscape');
  const canvas = await renderCardToCanvas(person, type, config, qrDataUrl, activeOrientation);
  const identifier = type === 'student' ? (person as Student).nisn : (person as Teacher).nip;
  const cleanName = person.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Kartu_${type === 'student' ? 'Pelajar' : 'GTK'}_${activeOrientation}_${identifier}_${cleanName}.png`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Generates an A4 PDF document containing cards formatted for printing & laminating
 * Supports both Landscape and Portrait layouts
 */
export async function exportCardsToPdf(
  items: (Student | Teacher)[],
  type: 'student' | 'teacher',
  config: SchoolConfig,
  onProgress?: (current: number, total: number) => void,
  orientation?: CardOrientation
): Promise<void> {
  const activeOrientation: CardOrientation = orientation || (type === 'teacher' ? 'portrait' : 'landscape');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const isLandscapeCard = activeOrientation === 'landscape';
  const cardWidth = isLandscapeCard ? 86 : 54;
  const cardHeight = isLandscapeCard ? 54 : 86;

  const cardsPerPage = 4;
  const marginX = (pageWidth - cardWidth * 2) / 3;
  const marginY = 16;
  const gapY = isLandscapeCard ? 14 : 10;

  let cardIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) {
      onProgress(i + 1, items.length);
    }

    if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
      pdf.addPage();
    }

    const posOnPage = cardIndex % cardsPerPage;
    const col = posOnPage % 2;
    const row = Math.floor(posOnPage / 2);

    const x = marginX + col * (cardWidth + marginX);
    const y = marginY + row * (cardHeight + gapY);

    const qrPayload = type === 'student' ? `STD-${(item as Student).nisn}` : `ASN-${(item as Teacher).nip}`;
    const qrDataUrl = await generateQrDataUrl(qrPayload);
    const canvas = await renderCardToCanvas(item, type, config, qrDataUrl, activeOrientation);
    const imgData = canvas.toDataURL('image/png', 0.95);

    pdf.addImage(imgData, 'PNG', x, y, cardWidth, cardHeight);

    pdf.setDrawColor(180, 190, 205);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.rect(x - 1, y - 1, cardWidth + 2, cardHeight + 2);

    cardIndex++;
  }

  const fileName = `Kumpulan_Kartu_${type === 'student' ? 'Pelajar' : 'GTK'}_${activeOrientation}_${items.length}_Orang.pdf`;
  pdf.save(fileName);
}
