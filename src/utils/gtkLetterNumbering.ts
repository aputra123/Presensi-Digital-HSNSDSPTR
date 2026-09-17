import { GtkServiceCategory, SchoolConfig } from '../types';

export const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

export const CATEGORY_LETTER_CODES: Record<GtkServiceCategory, string> = {
  surat_tugas: 'ST',
  izin_cuti: 'CUTI',
  rekomendasi_akademik: 'SR',
  tukar_jadwal: 'DP',
  keterangan_aktif: 'SK',
};

export const DEFAULT_GTK_LETTER_FORMAT = '421.3/{NO}/SMPN4-TB/DISDIK/{BULAN_ROMAWI}/{TAHUN}';

/**
 * Returns Roman numeral for month (1-12)
 */
export function getRomanMonth(monthIndex1to12: number): string {
  return ROMAN_MONTHS[Math.max(0, Math.min(11, monthIndex1to12 - 1))] || 'I';
}

/**
 * Generates official formatted letter number from config template
 */
export function generateGtkLetterNumber(
  config?: SchoolConfig,
  category: GtkServiceCategory = 'surat_tugas',
  customCounter?: number,
  date?: Date
): string {
  const currentDate = date || new Date();
  const year = currentDate.getFullYear().toString();
  const monthNum = currentDate.getMonth() + 1;
  const monthPad = String(monthNum).padStart(2, '0');
  const monthRoman = getRomanMonth(monthNum);

  const counter = customCounter !== undefined ? customCounter : (config?.gtkLetterNumberCounter || 1);
  const noPad3 = String(counter).padStart(3, '0');
  const noPad4 = String(counter).padStart(4, '0');
  const noRaw = String(counter);

  const template = config?.gtkLetterNumberFormat || DEFAULT_GTK_LETTER_FORMAT;
  const classification = config?.gtkClassificationCode || '421.3';
  const categoryCode = CATEGORY_LETTER_CODES[category] || 'GTK';

  let result = template
    .replace(/\{KODE\}/g, classification)
    .replace(/\{NO\}/g, noPad3)
    .replace(/\{NO4\}/g, noPad4)
    .replace(/\{NO_RAW\}/g, noRaw)
    .replace(/\{KATEGORI\}/g, categoryCode)
    .replace(/\{SINGKATAN_SEKOLAH\}/g, 'SMPN4-TB')
    .replace(/\{BULAN_ROMAWI\}/g, monthRoman)
    .replace(/\{BULAN_ANGKA\}/g, monthPad)
    .replace(/\{TAHUN\}/g, year);

  return result;
}
