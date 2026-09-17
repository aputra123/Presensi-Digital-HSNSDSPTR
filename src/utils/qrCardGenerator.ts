import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { SchoolConfig, Student, Teacher } from '../types';

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
 * Standard CR-80 card ratio (85.6mm x 53.98mm) rendered at 1000px x 630px
 */
export async function renderCardToCanvas(
  person: Student | Teacher,
  type: 'student' | 'teacher',
  config: SchoolConfig,
  qrDataUrl: string
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const width = 1000;
  const height = 630;
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
  const headerHeight = 135;
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
        // White rounded badge for logo
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(30, 22, 90, 90, 18);
        ctx.fill();
        ctx.clip();
        ctx.drawImage(logoImg, 35, 27, 80, 80);
        ctx.restore();
        logoDrawn = true;
      }
    } catch {
      logoDrawn = false;
    }
  }

  const textStartX = logoDrawn ? 135 : 40;

  // School Name & Card Type Title
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

  // Status Badge in Top Right
  const badgeText = isStudent
    ? 'SISWA'
    : teacher?.employmentStatus || 'GURU GTK';
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

  // 4. Person Photo (Left Body)
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
      // Fallback gray silhouette
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }
  }
  ctx.restore();

  // 5. Person Information (Middle Body)
  const infoX = 250;
  let currentY = 195;

  // Name
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(person.name, infoX, currentY);
  currentY += 38;

  // Class or Subject Badge
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

  // Fields Table
  const fields: { label: string; value: string; isMono?: boolean }[] = isStudent
    ? [
        { label: 'NISN', value: student?.nisn || '-', isMono: true },
        { label: 'NIK Siswa', value: student?.nik || '-', isMono: true },
        { label: 'Tahun Ajaran', value: config.academicYear || '-' },
      ]
    : [
        { label: 'NIP / NUPTK', value: teacher?.nip || '-', isMono: true },
        { label: 'Mata Pelajaran', value: teacher?.subject || '-' },
        { label: 'Status Kepegawaian', value: teacher?.employmentStatus || '-' },
      ];

  fields.forEach((field) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(field.label, infoX, currentY);

    ctx.fillStyle = '#0f172a';
    ctx.font = field.isMono
      ? 'bold 20px "Courier New", monospace'
      : 'bold 19px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`:  ${field.value}`, infoX + 160, currentY);
    currentY += 34;
  });

  // 6. QR Code Area (Right Box)
  const qrBoxW = 240;
  const qrBoxH = 340;
  const qrBoxX = width - qrBoxW - 40;
  const qrBoxY = 165;

  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 20);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // QR Title
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR CODE PRESENSI RESMI', qrBoxX + qrBoxW / 2, qrBoxY + 30);

  // Draw Real QR Code Image
  if (qrDataUrl) {
    try {
      const qrImg = await loadImage(qrDataUrl);
      const qrSize = 190;
      const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
      const qrY = qrBoxY + 44;

      // Crisp White backing for QR
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

  // QR ID Label (NISN or NIP)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = 'center';
  const qrIdLabel = isStudent ? `STD-${student?.nisn}` : `ASN-${teacher?.nip}`;
  ctx.fillText(qrIdLabel, qrBoxX + qrBoxW / 2, qrBoxY + 270);

  // Verification Seal text
  ctx.fillStyle = isStudent ? '#059669' : '#7c3aed';
  ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(isStudent ? '✓ Terverifikasi Dapodik' : '✓ SIMPEG & BKD Verified', qrBoxX + qrBoxW / 2, qrBoxY + 305);
  ctx.restore();

  // 7. Security Notice & Instruction (Bottom Left Area)
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    'Kartu ini adalah identitas digital resmi presensi mandiri dan akses layanan sekolah.',
    40,
    height - 110
  );

  // 8. Card Footer Bar
  const footerH = 50;
  ctx.fillStyle = isStudent ? '#f1f5f9' : '#faf5ff';
  ctx.fillRect(0, height - footerH, width, footerH);
  ctx.fillStyle = isStudent ? '#475569' : '#6b21a8';
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Alamat: ${config.address || 'Kabupaten Pulau Taliabu, Maluku Utara'}`, 40, height - 19);

  ctx.textAlign = 'right';
  ctx.fillText('Website: https://presensi.sekolah.go.id', width - 40, height - 19);

  // 9. Card Outer Border (Subtle border for cutting guide when printed)
  ctx.restore(); // Restore unclipped state
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
 * Downloads high-resolution PNG image of the ID Card
 */
export async function downloadCardAsPng(
  person: Student | Teacher,
  type: 'student' | 'teacher',
  config: SchoolConfig,
  qrDataUrl: string
): Promise<void> {
  const canvas = await renderCardToCanvas(person, type, config, qrDataUrl);
  const identifier = type === 'student' ? (person as Student).nisn : (person as Teacher).nip;
  const cleanName = person.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Kartu_${type === 'student' ? 'Pelajar' : 'GTK'}_${identifier}_${cleanName}.png`;

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
 * 4 cards per page (2 columns x 2 rows) or 8 cards (2 columns x 4 rows)
 */
export async function exportCardsToPdf(
  items: (Student | Teacher)[],
  type: 'student' | 'teacher',
  config: SchoolConfig,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const cardWidth = 86; // Standard CR80 width in mm
  const cardHeight = 54; // Standard CR80 height in mm
  const marginX = (pageWidth - cardWidth * 2) / 3; // ~12.6mm
  const marginY = 16;
  const gapY = 12;

  // 4 cards per page in 2x2 layout with ample spacing and cutting guide
  const cardsPerPage = 4;
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
    const canvas = await renderCardToCanvas(item, type, config, qrDataUrl);
    const imgData = canvas.toDataURL('image/png', 0.95);

    // Draw card image
    pdf.addImage(imgData, 'PNG', x, y, cardWidth, cardHeight);

    // Draw subtle dashed cutting guide line around card
    pdf.setDrawColor(180, 190, 205);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.rect(x - 1, y - 1, cardWidth + 2, cardHeight + 2);

    cardIndex++;
  }

  const fileName = `Kumpulan_Kartu_${type === 'student' ? 'Pelajar' : 'GTK'}_${items.length}_Orang.pdf`;
  pdf.save(fileName);
}
