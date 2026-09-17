import { ActivityLog, ActivityLogCategory } from '../types';

export interface DiffResult {
  changedFields: string[];
  prevValue: Record<string, any>;
  newValue: Record<string, any>;
  summaryText: string;
  hasChanges: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nama Lengkap',
  nisn: 'NISN',
  nip: 'NIP',
  nuptk: 'NUPTK',
  className: 'Kelas / Rombel',
  classId: 'ID Rombel',
  grade: 'Tingkat',
  gender: 'Jenis Kelamin',
  subject: 'Mata Pelajaran',
  phone: 'Nomor WhatsApp / HP',
  employmentStatus: 'Status Kepegawaian',
  role: 'Jabatan / Peran',
  address: 'Alamat',
  birthDate: 'Tanggal Lahir',
  schoolName: 'Nama Sekolah',
  npsn: 'NPSN',
  checkInStart: 'Mulai Presensi Masuk',
  checkInDeadline: 'Batas Presensi Masuk',
  checkOutStart: 'Mulai Presensi Pulang',
  schoolLat: 'Latitude Sekolah',
  schoolLng: 'Longitude Sekolah',
  maxRadiusMeters: 'Radius Maksimal GPS',
  principalName: 'Nama Kepala Sekolah',
  principalNip: 'NIP Kepala Sekolah',
  adminName: 'Nama Administrator',
  logoUrl: 'Logo Sekolah',
  appIconUrl: 'Ikon Aplikasi PWA',
  brandColor: 'Warna Tema',
  weeklyAttendanceGoal: 'Target Kehadiran Mingguan',
  enableFaceRecognitionMode: 'Mode Pengenalan Wajah',
  biometricLivenessThreshold: 'Ambang Batas Keaslian Biometrik',
  academicYear: 'Tahun Ajaran',
  semester: 'Semester',
};

/**
 * Calculates a precise field-by-field diff between two states of an entity
 */
export const calculateEntityDiff = (
  prevObj: Record<string, any> | undefined | null,
  newObj: Record<string, any> | undefined | null,
  ignoredKeys: string[] = ['updatedAt', 'lastModified', 'createdAt']
): DiffResult => {
  if (!prevObj || !newObj) {
    return {
      changedFields: [],
      prevValue: prevObj || {},
      newValue: newObj || {},
      summaryText: 'Perubahan data',
      hasChanges: false,
    };
  }

  const allKeys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(newObj)]));
  const changedFields: string[] = [];
  const prevValue: Record<string, any> = {};
  const newValue: Record<string, any> = {};
  const changeSummaries: string[] = [];

  for (const key of allKeys) {
    if (ignoredKeys.includes(key)) continue;

    const oldVal = prevObj[key];
    const nextVal = newObj[key];

    // Normalize comparison for undefined/null/empty strings
    const normalizedOld = oldVal === undefined || oldVal === null ? '' : oldVal;
    const normalizedNext = nextVal === undefined || nextVal === null ? '' : nextVal;

    // Stringify objects or primitives to compare
    const isDifferent =
      typeof normalizedOld === 'object' && typeof normalizedNext === 'object'
        ? JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNext)
        : String(normalizedOld) !== String(normalizedNext);

    if (isDifferent) {
      changedFields.push(key);
      prevValue[key] = oldVal ?? null;
      newValue[key] = nextVal ?? null;

      const label = FIELD_LABELS[key] || key;
      const displayOld =
        typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? '-');
      const displayNew =
        typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal ?? '-');

      changeSummaries.push(
        `${label}: "${displayOld.slice(0, 30)}" → "${displayNew.slice(0, 30)}"`
      );
    }
  }

  const summaryText =
    changeSummaries.length > 0
      ? `Modifikasi ${changeSummaries.length} field (${changeSummaries.slice(0, 3).join(', ')}${
          changeSummaries.length > 3 ? `, +${changeSummaries.length - 3} lainnya` : ''
        })`
      : 'Tidak ada perubahan nilai terdeteksi';

  return {
    changedFields,
    prevValue,
    newValue,
    summaryText,
    hasChanges: changedFields.length > 0,
  };
};

/**
 * Creates an audit ActivityLog containing prevValue and newValue
 */
export const createEntityEditAuditLog = (
  entityType: 'Teacher' | 'Student' | 'SchoolConfig',
  targetId: string,
  targetName: string,
  prevObj: Record<string, any>,
  newObj: Record<string, any>,
  actor: { name: string; role: string; email?: string },
  todayDate: string
): ActivityLog | null => {
  const diff = calculateEntityDiff(prevObj, newObj);
  if (!diff.hasChanges) return null;

  const categoryMap: Record<string, ActivityLogCategory> = {
    Teacher: 'master_data',
    Student: 'master_data',
    SchoolConfig: 'config',
  };

  const entityTypeLabels: Record<string, string> = {
    Teacher: 'Guru / GTK',
    Student: 'Siswa',
    SchoolConfig: 'Konfigurasi Sekolah',
  };

  const action = `Edit Data ${entityTypeLabels[entityType] || entityType}: ${targetName}`;
  const description = `${diff.summaryText} pada ${entityTypeLabels[entityType] || entityType} "${targetName}". Dilakukan oleh ${actor.name} (${actor.role}).`;

  return {
    id: `act_diff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    date: todayDate,
    time: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    category: categoryMap[entityType] || 'master_data',
    actor,
    action,
    description,
    targetId,
    targetName,
    status: 'info',
    prevValue: diff.prevValue,
    newValue: diff.newValue,
    changedFields: diff.changedFields,
  };
};
