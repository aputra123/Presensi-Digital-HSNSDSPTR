/**
 * Signature Processing Utilities
 * Supports image (JPG, PNG) and Adobe PDF (.pdf) parsing, background transparency removal,
 * ink enhancement, auto-cropping, and multi-page PDF rendering.
 */

export interface ProcessSignatureOptions {
  removeWhiteBg?: boolean;
  enhanceContrast?: boolean;
  threshold?: number;
  pageNumber?: number;
}

export interface ProcessSignatureResult {
  dataUrl: string;
  fileType: 'jpg' | 'png' | 'pdf';
  totalPages?: number;
  fileName: string;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Clean white/light paper background and boost dark ink strokes
 * Automatically crops excessive blank margins around the signature.
 */
export function extractSignatureFromCanvas(
  sourceCanvas: HTMLCanvasElement | HTMLImageElement,
  options: ProcessSignatureOptions = {}
): string {
  const {
    removeWhiteBg = true,
    enhanceContrast = true,
    threshold = 210,
  } = options;

  const w = 'width' in sourceCanvas ? sourceCanvas.width : (sourceCanvas as HTMLImageElement).naturalWidth;
  const h = 'height' in sourceCanvas ? sourceCanvas.height : (sourceCanvas as HTMLImageElement).naturalHeight;

  if (!w || !h) return '';

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  ctx.drawImage(sourceCanvas, 0, 0, w, h);

  // If user chooses raw image with no background removal or enhancement
  if (!removeWhiteBg && !enhanceContrast) {
    return canvas.toDataURL('image/png');
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let inkPixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a < 20) continue;

    // Perceived luminance (standard Rec. 601 formula)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const px = (i / 4) % w;
    const py = Math.floor((i / 4) / w);

    if (removeWhiteBg) {
      if (luminance >= threshold) {
        // Transparent white / light paper
        data[i + 3] = 0;
      } else {
        // Dark ink detected
        inkPixelCount++;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);

        if (enhanceContrast) {
          // Convert pen ink into sharp official black/deep navy
          const darkness = 1 - Math.min(1, luminance / threshold);
          data[i] = Math.round(15 * (1 - darkness)); // Slate 900
          data[i + 1] = Math.round(23 * (1 - darkness));
          data[i + 2] = Math.round(42 * (1 - darkness));
          data[i + 3] = Math.min(255, Math.round(255 * Math.pow(darkness, 0.6) * 1.3));
        }
      }
    } else if (enhanceContrast) {
      if (luminance < threshold) {
        inkPixelCount++;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);

        // Darken strokes on existing background
        const factor = 0.7;
        data[i] = Math.round(r * factor);
        data[i + 1] = Math.round(g * factor);
        data[i + 2] = Math.round(b * factor);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // If ink was found and has substantial bounding box, crop with clean breathing room
  if (inkPixelCount > 30 && maxX > minX && maxY > minY) {
    const pad = Math.max(20, Math.round(Math.min(w, h) * 0.04));
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(w - cropX, maxX - minX + pad * 2);
    const cropH = Math.min(h - cropY, maxY - minY + pad * 2);

    if (cropW > 10 && cropH > 10) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        return croppedCanvas.toDataURL('image/png');
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Render an Adobe PDF page onto an HTMLCanvasElement using pdfjs-dist
 */
export async function renderPdfPageToCanvas(
  arrayBuffer: ArrayBuffer,
  pageNumber: number = 1
): Promise<{ canvas: HTMLCanvasElement; totalPages: number }> {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${
      pdfjsLib.version || '4.0.379'
    }/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages || 1;
  const targetPage = Math.max(1, Math.min(pageNumber, totalPages));
  const page = await pdfDoc.getPage(targetPage);

  // Use 2.0x scale for crisp signature rendering
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const scale = Math.min(3.0, Math.max(1.5, 1400 / unscaledViewport.width));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal mendapatkan konteks kanvas 2D untuk PDF.');

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return { canvas, totalPages };
}

export const MAX_SIGNATURE_FILE_SIZE_BYTES = 1024 * 1024; // 1 Megabyte (1,048,576 bytes)

/**
 * Validate that signature file does not exceed maximum allowable 1 MB size limit
 */
export function validateSignatureFile(file: File): { valid: boolean; error?: string; sizeKb: number } {
  if (!file) {
    return { valid: false, error: 'Berkas tanda tangan tidak ditemukan.', sizeKb: 0 };
  }

  const sizeKb = Math.round(file.size / 1024);

  if (file.size > MAX_SIGNATURE_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `⚠️ Ukuran berkas (${sizeInMb} MB) melebihi batas maksimal 1 MB! Harap kompres berkas atau gunakan gambar bertanda tangan dengan resolusi standar.`,
      sizeKb,
    };
  }

  return { valid: true, sizeKb };
}

/**
 * Sanitize filename to prevent directory traversal or special script characters
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
}

/**
 * Process and sanitize any uploaded signature file (JPG, PNG, or PDF)
 * Performs:
 * 1. File size enforcement <= 1 MB
 * 2. Magic byte binary verification (anti-spoofing)
 * 3. Filename sanitization
 * 4. Client-side re-rendering into isolated sandboxed canvas (strips embedded EXIF / XML / XSS payloads)
 * 5. Automatic background extraction and ink contrast enhancement
 */
export async function sanitizeAndValidateSignatureFile(
  file: File,
  options: ProcessSignatureOptions = {}
): Promise<ProcessSignatureResult> {
  // 1. Validate File Size <= 1MB
  const sizeValidation = validateSignatureFile(file);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  // 2. Binary Magic Bytes Inspection to verify authentic JPG, PNG, or PDF
  const headerBuffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(headerBuffer);

  const isPngHeader =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  const isJpgHeader = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

  const isPdfHeader =
    bytes.length >= 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46; // F

  if (!isPngHeader && !isJpgHeader && !isPdfHeader) {
    throw new Error(
      'Berkas ditolak oleh sistem keamanan: Struktur binary berkas bukan berkas JPG, PNG, atau PDF yang valid.'
    );
  }

  // 3. Sanitize filename
  const cleanFileName = sanitizeFileName(file.name);

  // 4. Process file through in-memory isolated canvas
  const processed = await processUploadedSignatureFile(file, options);

  return {
    ...processed,
    fileName: cleanFileName,
  };
}

/**
 * Process any uploaded signature file (JPG, PNG, or PDF)
 */
export async function processUploadedSignatureFile(
  file: File,
  options: ProcessSignatureOptions = {}
): Promise<ProcessSignatureResult> {
  // Validate size <= 1MB
  const sizeValidation = validateSignatureFile(file);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  const fileNameLower = file.name.toLowerCase();
  const isPdf = fileNameLower.endsWith('.pdf') || file.type === 'application/pdf';
  const isPng = fileNameLower.endsWith('.png') || file.type === 'image/png';
  const isJpg =
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg';

  if (!isPdf && !isPng && !isJpg) {
    throw new Error('Format berkas tidak didukung. Harap unggah berkas bertipe JPG, PNG, atau PDF.');
  }

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const pageNum = options.pageNumber || 1;
    const { canvas, totalPages } = await renderPdfPageToCanvas(arrayBuffer, pageNum);

    const dataUrl = extractSignatureFromCanvas(canvas, options);

    return {
      dataUrl,
      fileType: 'pdf',
      totalPages,
      fileName: sanitizeFileName(file.name),
      sourceWidth: canvas.width,
      sourceHeight: canvas.height,
    };
  } else {
    // Image: JPG or PNG
    const dataUrlSource = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gagal memproses gambar tanda tangan.'));
      image.src = dataUrlSource;
    });

    const dataUrl = extractSignatureFromCanvas(img, options);

    return {
      dataUrl,
      fileType: isPng ? 'png' : 'jpg',
      totalPages: 1,
      fileName: sanitizeFileName(file.name),
      sourceWidth: img.naturalWidth,
      sourceHeight: img.naturalHeight,
    };
  }
}
