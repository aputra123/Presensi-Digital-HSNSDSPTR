import QRCode from 'qrcode';

export interface QRCardData {
  id: string;
  name: string;
  identifier: string; // NISN or NIP
  type: 'student' | 'teacher';
  classOrSubject: string;
  schoolNpsn: string;
}

/**
 * Generates high-res DataURL QR code for a student or teacher
 */
export const generateQRCodeDataUrl = async (data: QRCardData): Promise<string> => {
  const payload = JSON.stringify({
    uid: data.id,
    name: data.name,
    idNum: data.identifier,
    type: data.type,
    sub: data.classOrSubject,
    npsn: data.schoolNpsn,
    issuedAt: new Date().toISOString().split('T')[0],
  });

  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
};
