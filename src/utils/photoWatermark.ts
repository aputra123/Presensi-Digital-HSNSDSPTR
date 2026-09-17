/**
 * Watermarking & GPS Metadata Stamping for Apel Pagi & Apel Siang Documentation Photos
 * Compliant with Government of Pulau Taliabu & SMPN 4 Satu Atap Taliabu Barat standards.
 */

export interface GpsStampMetadata {
  latitude: number;
  longitude: number;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  addressFormatted?: string;
  dateStr: string; // e.g. "Jumat, 04 September 2026"
  timeStr: string; // e.g. "07:15:24"
  timezoneStr: string; // e.g. "WITA (GMT+8)"
  sessionTitle: string; // e.g. "DOKUMENTASI APEL PAGI" or "DOKUMENTASI APEL SIANG"
  schoolName: string; // e.g. "SMP NEGERI 4 SATU ATAP TALIABU BARAT"
}

// Fallback regional defaults for SMPN 4 Satu Atap Taliabu Barat
export const DEFAULT_TALIABU_LOCATION = {
  latitude: -1.8412,
  longitude: 124.482,
  desa: 'Desa Pancoran',
  kecamatan: 'Kec. Taliabu Barat',
  kabupaten: 'Kab. Pulau Taliabu',
  provinsi: 'Maluku Utara',
  addressFormatted: 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara',
};

/**
 * Resolves address information from coordinates with fallback to Pulau Taliabu
 */
export async function resolveLocationFromCoords(
  lat: number,
  lng: number
): Promise<{
  desa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  addressFormatted: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'id' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const desa =
        addr.village ||
        addr.hamlet ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.town ||
        DEFAULT_TALIABU_LOCATION.desa;
      const kecamatan =
        addr.municipality ||
        addr.county ||
        addr.district ||
        DEFAULT_TALIABU_LOCATION.kecamatan;
      const kabupaten =
        addr.state_district ||
        addr.city ||
        DEFAULT_TALIABU_LOCATION.kabupaten;
      const provinsi = addr.state || DEFAULT_TALIABU_LOCATION.provinsi;

      return {
        desa,
        kecamatan,
        kabupaten,
        provinsi,
        addressFormatted: `${desa}, ${kecamatan}, ${kabupaten}, ${provinsi}`,
      };
    }
  } catch {
    // network timeout or cors - fallback gracefully
  }

  return DEFAULT_TALIABU_LOCATION;
}

/**
 * Stamps an image with an official, non-obtrusive GPS & timestamp badge
 * placed precisely on the BOTTOM-RIGHT corner of the photo.
 */
export async function stampPhotoWithGpsMetadata(
  imageSource: string | HTMLImageElement | File | Blob,
  metadata: GpsStampMetadata
): Promise<string> {
  return new Promise((resolve, reject) => {
    let img: HTMLImageElement;

    const onImageLoaded = () => {
      try {
        const canvas = document.createElement('canvas');
        const origWidth = img.naturalWidth || img.width || 1280;
        const origHeight = img.naturalHeight || img.height || 720;

        // Maintain high resolution (cap at 1920 to keep memory optimal)
        const scale = Math.min(1920 / origWidth, 1);
        const canvasWidth = Math.round(origWidth * scale);
        const canvasHeight = Math.round(origHeight * scale);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context tidak tersedia');
        }

        // Draw original photo
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        // Calculate dynamic font sizes and dimensions proportional to canvas width
        const baseFontSize = Math.max(11, Math.min(18, Math.round(canvasWidth * 0.0135)));
        const titleFontSize = Math.round(baseFontSize * 1.15);
        const smallFontSize = Math.round(baseFontSize * 0.9);
        const lineSpacing = Math.round(baseFontSize * 1.4);

        const latStr = `${metadata.latitude >= 0 ? '+' : ''}${metadata.latitude.toFixed(6)}°`;
        const lngStr = `${metadata.longitude >= 0 ? '+' : ''}${metadata.longitude.toFixed(6)}°`;

        const desaText = metadata.desa || DEFAULT_TALIABU_LOCATION.desa;
        const kecText = metadata.kecamatan || DEFAULT_TALIABU_LOCATION.kecamatan;
        const kabProvText = `${metadata.kabupaten || DEFAULT_TALIABU_LOCATION.kabupaten}, ${metadata.provinsi || DEFAULT_TALIABU_LOCATION.provinsi}`;

        const locationLine = `${desaText}, ${kecText}`;
        const timeLine = `${metadata.dateStr} • ${metadata.timeStr} ${metadata.timezoneStr}`;
        const gpsLine = `GPS: ${latStr}, ${lngStr}`;
        const schoolLine = metadata.schoolName || 'SMPN 4 SATU ATAP TALIABU BARAT';

        // Measure max width for badge
        ctx.font = `bold ${titleFontSize}px sans-serif`;
        const titleWidth = ctx.measureText(metadata.sessionTitle).width;
        ctx.font = `${baseFontSize}px sans-serif`;
        const locWidth = ctx.measureText(locationLine).width;
        const kabWidth = ctx.measureText(kabProvText).width;
        const timeWidth = ctx.measureText(timeLine).width;
        const gpsWidth = ctx.measureText(gpsLine).width;
        const schoolWidth = ctx.measureText(schoolLine).width;

        const maxTextWidth = Math.max(titleWidth, locWidth, kabWidth, timeWidth, gpsWidth, schoolWidth);
        const paddingX = Math.round(baseFontSize * 1.2);
        const paddingY = Math.round(baseFontSize * 1.0);
        const badgeWidth = maxTextWidth + paddingX * 2 + 10;
        const badgeHeight = lineSpacing * 5 + paddingY * 2 + 8;

        const margin = Math.round(canvasWidth * 0.02); // 2% margin from edges
        const badgeX = canvasWidth - badgeWidth - margin;
        const badgeY = canvasHeight - badgeHeight - margin;

        // Draw translucent dark background card with rounded corners
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'; // Slate-900 with 82% opacity
        const cornerRadius = 10;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, cornerRadius);
        ctx.fill();

        // Subtle accent border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Draw text lines inside bottom-right badge
        let curY = badgeY + paddingY + titleFontSize;

        // Line 1: Session Tag & Green Active Dot
        ctx.fillStyle = '#10b981'; // Emerald dot
        ctx.beginPath();
        ctx.arc(badgeX + paddingX + 4, curY - titleFontSize * 0.35, Math.max(3, titleFontSize * 0.25), 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `bold ${titleFontSize}px sans-serif`;
        ctx.fillStyle = '#38bdf8'; // Sky-400
        ctx.fillText(metadata.sessionTitle.toUpperCase(), badgeX + paddingX + 16, curY);

        // Line 2: School Name
        curY += lineSpacing;
        ctx.font = `bold ${smallFontSize}px sans-serif`;
        ctx.fillStyle = '#f1f5f9'; // Slate-100
        ctx.fillText(schoolLine, badgeX + paddingX, curY);

        // Line 3: Location (Desa & Kecamatan)
        curY += lineSpacing;
        ctx.font = `${baseFontSize}px sans-serif`;
        ctx.fillStyle = '#cbd5e1'; // Slate-300
        ctx.fillText(`📍 ${locationLine}`, badgeX + paddingX, curY);

        // Line 4: Kabupaten & Provinsi
        curY += lineSpacing * 0.92;
        ctx.font = `${smallFontSize}px sans-serif`;
        ctx.fillStyle = '#94a3b8'; // Slate-400
        ctx.fillText(`   ${kabProvText}`, badgeX + paddingX, curY);

        // Line 5: GPS Coordinates
        curY += lineSpacing;
        ctx.font = `bold ${smallFontSize}px monospace`;
        ctx.fillStyle = '#fde047'; // Amber-300
        ctx.fillText(`📡 ${gpsLine}`, badgeX + paddingX, curY);

        // Line 6: Date, Time & WITA GMT+8
        curY += lineSpacing;
        ctx.font = `${smallFontSize}px sans-serif`;
        ctx.fillStyle = '#e2e8f0'; // Slate-200
        ctx.fillText(`🕒 ${timeLine}`, badgeX + paddingX, curY);

        // Export as High Quality JPEG
        const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(stampedDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    if (imageSource instanceof HTMLImageElement) {
      img = imageSource;
      if (img.complete && img.naturalWidth > 0) {
        onImageLoaded();
      } else {
        img.onload = onImageLoaded;
        img.onerror = (e) => reject(e);
      }
    } else if (typeof imageSource === 'string') {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = onImageLoaded;
      img.onerror = (e) => reject(e);
      img.src = imageSource;
    } else if (imageSource && typeof imageSource === 'object') {
      const reader = new FileReader();
      reader.onload = () => {
        img = new Image();
        img.onload = onImageLoaded;
        img.onerror = (e) => reject(e);
        img.src = reader.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(imageSource as Blob);
    }
  });
}
