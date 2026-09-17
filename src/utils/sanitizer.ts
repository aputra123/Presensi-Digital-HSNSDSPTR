/**
 * Centralized Sanitation & Validation Utility (Anti-XSS, Anti-Injection & Regex Validation)
 * Strips potentially malicious characters from user inputs (names, NIP/NISN, reasons, notes)
 * and enforces strict regex validation before values are processed or persisted to Firebase.
 */

import { AttendanceRecord, LeaveRequest, Student, Teacher } from '../types';

// Regex Definitions for Input Validation
export const REGEX_PATTERNS = {
  // Name: only letters, spaces, dots, commas, hyphens, and apostrophes
  NAME: /^[a-zA-ZÀ-ÿ\s.,'’`\-]{2,100}$/,
  // NIP: 8 to 18 digits (PNS / PPPK / Honorer)
  NIP: /^[0-9]{8,18}$/,
  // NISN: exact 10 digits
  NISN: /^[0-9]{10}$/,
  // Reason / Narrative: alphanumeric, safe punctuation, newlines (max 500 chars)
  REASON: /^[a-zA-Z0-9À-ÿ\s.,/()\-+!?:;"'’`\n\r%&*@#_]{1,500}$/,
  // Safe general label/code: alphanumeric, dash, underscore
  SAFE_ID: /^[a-zA-Z0-9_\-]{1,64}$/,
  // Email RFC 5322 simplified
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // Phone: Indonesian standard (+62, 62, 08)
  PHONE: /^(?:\+62|62|08)[0-9]{8,13}$/,
};

/**
 * Strips potentially dangerous HTML tags, inline script handlers, and URI schemes
 */
export function stripDangerousCharacters(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<[^>]+>/g, '') // Strip all other HTML tags
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:\s*text\/html/gi, '')
    .replace(/on\w+\s*=/gi, '') // Strip event handlers like onclick=, onerror=
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip ASCII control characters
    .trim();
}

/**
 * Escapes HTML entities for safe UI rendering
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  const cleaned = stripDangerousCharacters(input);
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Centralized sanitization for person names with regex validation
 */
export function sanitizeName(name: string | null | undefined): { isValid: boolean; value: string; error?: string } {
  const cleaned = stripDangerousCharacters(name)
    .replace(/[^a-zA-ZÀ-ÿ\s.,'’`\-]/g, '') // Strip non-letter characters except valid punctuation
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { isValid: false, value: '', error: 'Nama tidak boleh kosong.' };
  }

  if (cleaned.length < 2) {
    return { isValid: false, value: cleaned, error: 'Nama minimal terdiri dari 2 karakter.' };
  }

  if (cleaned.length > 100) {
    return { isValid: false, value: cleaned.slice(0, 100), error: 'Nama maksimal 100 karakter.' };
  }

  if (!REGEX_PATTERNS.NAME.test(cleaned)) {
    return { isValid: false, value: cleaned, error: 'Nama mengandung karakter yang tidak diizinkan.' };
  }

  return { isValid: true, value: cleaned };
}

/**
 * Centralized sanitization for NIP (Teacher / Staff ID) with regex validation
 */
export function sanitizeNIP(nip: string | null | undefined): { isValid: boolean; value: string; error?: string } {
  const cleaned = String(nip || '')
    .replace(/[^0-9]/g, '') // Strip all non-digit characters
    .trim();

  if (!cleaned) {
    return { isValid: false, value: '', error: 'NIP tidak boleh kosong.' };
  }

  if (!REGEX_PATTERNS.NIP.test(cleaned)) {
    return {
      isValid: false,
      value: cleaned,
      error: `Format NIP tidak valid (${cleaned.length} digit). NIP harus berupa 8 hingga 18 digit angka.`,
    };
  }

  return { isValid: true, value: cleaned };
}

/**
 * Centralized sanitization for NISN (Student ID) with regex validation
 */
export function sanitizeNISN(nisn: string | null | undefined): { isValid: boolean; value: string; error?: string } {
  const cleaned = String(nisn || '')
    .replace(/[^0-9]/g, '') // Strip non-digits
    .trim();

  if (!cleaned) {
    return { isValid: false, value: '', error: 'NISN tidak boleh kosong.' };
  }

  if (!REGEX_PATTERNS.NISN.test(cleaned)) {
    return {
      isValid: false,
      value: cleaned,
      error: `Format NISN tidak valid (${cleaned.length} digit). NISN harus tepat 10 digit angka.`,
    };
  }

  return { isValid: true, value: cleaned };
}

/**
 * Centralized sanitization for reasons, notes, and textual descriptions
 */
export function sanitizeReason(reason: string | null | undefined): { isValid: boolean; value: string; error?: string } {
  const cleaned = stripDangerousCharacters(reason)
    .replace(/\s+/g, ' ')
    .slice(0, 500)
    .trim();

  if (!cleaned) {
    return { isValid: true, value: '' };
  }

  if (!REGEX_PATTERNS.REASON.test(cleaned)) {
    // Filter out invalid characters directly to make safe
    const sanitized = cleaned.replace(/[^a-zA-Z0-9À-ÿ\s.,/()\-+!?:;"'’`\n\r%&*@#_]/g, '');
    return { isValid: true, value: sanitized };
  }

  return { isValid: true, value: cleaned };
}

/**
 * Sanitizes file names to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return 'dokumen';
  const clean = fileName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\.+/g, '.') // Prevent directory traversal ../
    .replace(/\0/g, '')     // Prevent null byte injection
    .trim();
  return clean.slice(0, 100);
}

/**
 * Validates Indonesian phone numbers
 */
export function validatePhoneNumber(phone: string): { isValid: boolean; message?: string } {
  const cleaned = phone.replace(/[\s\-_]/g, '');
  if (!cleaned) {
    return { isValid: false, message: 'Nomor telepon tidak boleh kosong.' };
  }
  if (!REGEX_PATTERNS.PHONE.test(cleaned)) {
    return { isValid: false, message: 'Format nomor telepon tidak valid (contoh: 08123456789 atau +628123456789).' };
  }
  return { isValid: true };
}

/**
 * Validates email addresses
 */
export function validateEmail(email: string): { isValid: boolean; message?: string } {
  const cleaned = email.trim();
  if (!cleaned) {
    return { isValid: false, message: 'Email tidak boleh kosong.' };
  }
  if (!REGEX_PATTERNS.EMAIL.test(cleaned)) {
    return { isValid: false, message: 'Format email tidak valid.' };
  }
  return { isValid: true };
}

/**
 * Validates GPS coordinates
 */
export function validateCoordinates(lat: number, lng: number): { isValid: boolean; message?: string } {
  if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
    return { isValid: false, message: 'Latitude tidak valid (harus di antara -90 dan 90).' };
  }
  if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
    return { isValid: false, message: 'Longitude tidak valid (harus di antara -180 dan 180).' };
  }
  return { isValid: true };
}

/**
 * Validates uploaded files
 */
export function validateFileUpload(
  file: File,
  maxMb = 5,
  allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ]
): { isValid: boolean; message?: string } {
  if (!file) {
    return { isValid: false, message: 'Tidak ada berkas yang dipilih.' };
  }

  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { isValid: false, message: `Ukuran berkas melebihi batas maksimum ${maxMb}MB.` };
  }

  const fileName = file.name.toLowerCase();
  const validExtension = allowedTypes.some((type) => {
    if (type.includes('pdf') && fileName.endsWith('.pdf')) return true;
    if (type.includes('image') && (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png'))) return true;
    if (type.includes('spreadsheet') && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) return true;
    if (type.includes('csv') && fileName.endsWith('.csv')) return true;
    return false;
  });

  if (!validExtension) {
    return { isValid: false, message: 'Format berkas tidak diizinkan. Hanya menerima PDF, Foto (JPG/PNG), atau Excel/CSV.' };
  }

  return { isValid: true };
}

// =========================================================================
// CENTRALIZED OBJECT SANITIZERS & VALIDATORS BEFORE FIREBASE / LOCAL STORAGE
// =========================================================================

/**
 * Sanitizes and validates an AttendanceRecord payload before Firebase persistence
 */
export function validateAndSanitizeAttendance(record: AttendanceRecord): {
  sanitized: AttendanceRecord;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nameResult = sanitizeName(record.personName);
  if (!nameResult.isValid) {
    errors.push(nameResult.error || 'Nama personil tidak valid.');
  }

  const noteResult = sanitizeReason(record.note || '');

  const sanitized: AttendanceRecord = {
    ...record,
    id: stripDangerousCharacters(record.id).replace(/[^a-zA-Z0-9_\-]/g, '_'),
    personId: stripDangerousCharacters(record.personId),
    personName: nameResult.value || stripDangerousCharacters(record.personName),
    classOrSubject: stripDangerousCharacters(record.classOrSubject),
    note: noteResult.value,
  };

  return {
    sanitized,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes and validates a LeaveRequest payload before Firebase persistence
 */
export function validateAndSanitizeLeaveRequest(leave: LeaveRequest): {
  sanitized: LeaveRequest;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nameResult = sanitizeName(leave.personName);
  if (!nameResult.isValid) {
    errors.push(nameResult.error || 'Nama pemohon tidak valid.');
  }

  const reasonResult = sanitizeReason(leave.reason);
  if (!leave.reason || !reasonResult.value) {
    errors.push('Alasan perizinan tidak boleh kosong.');
  }

  const reviewNoteResult = sanitizeReason(leave.reviewNote || '');

  const sanitized: LeaveRequest = {
    ...leave,
    id: stripDangerousCharacters(leave.id).replace(/[^a-zA-Z0-9_\-]/g, '_'),
    personId: stripDangerousCharacters(leave.personId),
    personName: nameResult.value || stripDangerousCharacters(leave.personName),
    classOrSubject: stripDangerousCharacters(leave.classOrSubject),
    reason: reasonResult.value,
    reviewNote: reviewNoteResult.value,
  };

  return {
    sanitized,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes and validates a Student record before Firebase persistence
 */
export function validateAndSanitizeStudent(student: Student): {
  sanitized: Student;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nameResult = sanitizeName(student.name);
  if (!nameResult.isValid) errors.push(nameResult.error || 'Nama siswa tidak valid.');

  const nisnResult = sanitizeNISN(student.nisn);
  if (!nisnResult.isValid) errors.push(nisnResult.error || 'NISN siswa tidak valid.');

  const sanitized: Student = {
    ...student,
    id: stripDangerousCharacters(student.id).replace(/[^a-zA-Z0-9_\-]/g, '_'),
    name: nameResult.value || stripDangerousCharacters(student.name),
    nisn: nisnResult.value || student.nisn,
    className: stripDangerousCharacters(student.className),
    parentPhone: stripDangerousCharacters(student.parentPhone).replace(/[^0-9+]/g, ''),
    address: stripDangerousCharacters(student.address || ''),
  };

  return {
    sanitized,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes and validates a Teacher record before Firebase persistence
 */
export function validateAndSanitizeTeacher(teacher: Teacher): {
  sanitized: Teacher;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nameResult = sanitizeName(teacher.name);
  if (!nameResult.isValid) errors.push(nameResult.error || 'Nama GTK tidak valid.');

  const nipResult = sanitizeNIP(teacher.nip);
  if (!nipResult.isValid) errors.push(nipResult.error || 'NIP GTK tidak valid.');

  const sanitized: Teacher = {
    ...teacher,
    id: stripDangerousCharacters(teacher.id).replace(/[^a-zA-Z0-9_\-]/g, '_'),
    name: nameResult.value || stripDangerousCharacters(teacher.name),
    nip: nipResult.value || teacher.nip,
    subject: stripDangerousCharacters(teacher.subject),
    role: stripDangerousCharacters(teacher.role),
    phone: stripDangerousCharacters(teacher.phone).replace(/[^0-9+]/g, ''),
    email: stripDangerousCharacters(teacher.email),
  };

  return {
    sanitized,
    isValid: errors.length === 0,
    errors,
  };
}
