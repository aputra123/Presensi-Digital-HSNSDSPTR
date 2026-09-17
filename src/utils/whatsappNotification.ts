import { AttendanceRecord, SchoolConfig, Student, Teacher } from '../types';
import { formatDateTimeWita, formatDateIndo } from './soundAndDate';

export interface WhatsAppNotificationPayload {
  recipientPhone: string;
  recipientName: string;
  recipientType: 'parent' | 'teacher' | 'bkd' | 'admin';
  personName: string;
  identifier: string; // NISN or NIP
  personRole: string; // Kelas or Mata Pelajaran / Jabatan
  date: string;
  time: string;
  status: 'alpa' | 'terlambat' | 'izin' | 'sakit' | 'hadir';
  type: 'masuk' | 'pulang';
  reason?: string;
  schoolName: string;
}

export interface WhatsAppNotificationResult {
  success: boolean;
  messageId: string;
  timestamp: string;
  recipientPhone: string;
  messageText: string;
  waUrl: string;
}

/**
 * Generates official Indonesian WhatsApp alert text
 */
export const generateWhatsAppNotificationMessage = (payload: WhatsAppNotificationPayload): string => {
  const isStudent = payload.recipientType === 'parent';
  const statusEmoji = payload.status === 'alpa' ? '❌ ALPA (Tanpa Keterangan)' : '⚠️ TERLAMBAT';
  const dateFormatted = formatDateIndo(payload.date);

  if (isStudent) {
    return `*📢 NOTIFIKASI KEHADIRAN SISWA - ${payload.schoolName.toUpperCase()}*

Yth. Orang Tua / Wali dari *${payload.personName}*,

Kami menginformasikan data kehadiran putra/putri Bapak/Ibu:
• *Nama Siswa:* ${payload.personName}
• *NISN:* ${payload.identifier || '-'}
• *Kelas:* ${payload.personRole}
• *Tanggal:* ${dateFormatted}
• *Sesi Presensi:* ${payload.type === 'masuk' ? 'Presensi Masuk' : 'Presensi Pulang'}
• *Waktu Tercatat:* ${payload.time ? `${payload.time} WITA` : '-'}
• *Status Kehadiran:* ${statusEmoji}
${payload.reason ? `• *Keterangan:* ${payload.reason}\n` : ''}
Mohon perhatian Bapak/Ibu untuk memantau kedisiplinan dan kehadiran putra/putri. Apabila terdapat kekeliruan atau kendala, silakan hubungi Wali Kelas atau pihak sekolah.

_Pesan otomatis dikirim melalui Sistem Presensi Digital SMPN 4 Satu Atap Taliabu Barat._`;
  }

  // For GTK / Teacher / BKD
  return `*📢 NOTIFIKASI PRESENSI GTK / ASN - ${payload.schoolName.toUpperCase()}*

Yth. *${payload.recipientName || payload.personName}*,

Laporan absensi SIMPEG/BKD otomatis mencatat data berikut:
• *Nama GTK/Pendidik:* ${payload.personName}
• *NIP/NUPTK:* ${payload.identifier || '-'}
• *Jabatan / Bidang:* ${payload.personRole}
• *Tanggal:* ${dateFormatted}
• *Sesi:* ${payload.type === 'masuk' ? 'Presensi Masuk' : 'Presensi Pulang'}
• *Waktu:* ${payload.time ? `${payload.time} WITA` : '-'}
• *Status:* ${statusEmoji}
${payload.reason ? `• *Catatan:* ${payload.reason}\n` : ''}
Data ini otomatis tercatat dalam rekapitulasi TPP BKD Kabupaten Pulau Taliabu.

_SIMPEG Digital Terpadu Kab. Pulau Taliabu._`;
};

/**
 * Sends or generates WhatsApp notification dispatch link
 */
export const sendWhatsAppNotification = (
  payload: WhatsAppNotificationPayload
): WhatsAppNotificationResult => {
  const messageText = generateWhatsAppNotificationMessage(payload);
  const cleanPhone = (payload.recipientPhone || '').replace(/\D/g, '');
  // Format to international 62 format
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('+62')) {
    formattedPhone = formattedPhone.substring(1);
  }

  const encodedText = encodeURIComponent(messageText);
  const waUrl = formattedPhone
    ? `https://wa.me/${formattedPhone}?text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  const messageId = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = formatDateTimeWita(new Date());

  // Store in notification history if needed
  try {
    const existingLogs = JSON.parse(localStorage.getItem('school_wa_notification_logs') || '[]');
    const newLog = {
      id: messageId,
      timestamp,
      recipientName: payload.recipientName,
      recipientPhone: formattedPhone,
      personName: payload.personName,
      status: payload.status,
      messageText,
      waUrl,
    };
    localStorage.setItem(
      'school_wa_notification_logs',
      JSON.stringify([newLog, ...existingLogs.slice(0, 49)])
    );
  } catch (err) {
    console.warn('Failed to save WA log:', err);
  }

  return {
    success: true,
    messageId,
    timestamp,
    recipientPhone: formattedPhone,
    messageText,
    waUrl,
  };
};

/**
 * Checks attendance record and triggers WhatsApp notification if status is 'alpa' or 'terlambat'
 */
export const checkAndTriggerWhatsAppForRecord = (
  record: AttendanceRecord,
  config: SchoolConfig,
  students: Student[],
  teachers: Teacher[]
): WhatsAppNotificationResult | null => {
  if (record.status !== 'alpa' && record.status !== 'terlambat') {
    return null;
  }

  let recipientPhone = '';
  let recipientName = '';
  let recipientType: 'parent' | 'teacher' = 'parent';
  let personRole = record.classOrSubject;

  if (record.personType === 'student') {
    recipientType = 'parent';
    const student = students.find((s) => s.id === record.personId || s.nisn === record.identifier);
    if (student) {
      recipientPhone = student.parentPhone || '';
      recipientName = `Orang Tua / Wali ${student.name}`;
      personRole = student.className;
    }
  } else {
    recipientType = 'teacher';
    const teacher = teachers.find((t) => t.id === record.personId || t.nip === record.identifier);
    if (teacher) {
      recipientPhone = teacher.phone || config.bkdWhatsAppNumber || config.bkdWhatsApp || '';
      recipientName = teacher.name;
      personRole = `${teacher.employmentStatus || 'GTK'} - ${teacher.subject}`;
    } else {
      recipientPhone = config.bkdWhatsAppNumber || config.bkdWhatsApp || '';
      recipientName = record.personName;
    }
  }

  const payload: WhatsAppNotificationPayload = {
    recipientPhone,
    recipientName: recipientName || record.personName,
    recipientType,
    personName: record.personName,
    identifier: record.identifier || '-',
    personRole,
    date: record.date,
    time: record.time,
    status: record.status as 'alpa' | 'terlambat',
    type: record.type,
    reason: record.note,
    schoolName: config.schoolName || 'SMPN 4 Satu Atap Taliabu Barat',
  };

  return sendWhatsAppNotification(payload);
};
