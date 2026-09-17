/**
 * Data Integrity Utilities for SchoolClass, Student[], and AttendanceRecord[]
 * SMPN 4 Satu Atap Taliabu Barat
 * 
 * Ensures robust synchronization between classes, students, and attendance records:
 * - Automatically validates and recovers from missing/dangling classId references
 * - Reconciles student className when class name changes
 * - Safely migrates students and records when a class is deleted so data is NEVER lost
 */

import { SchoolClass, Student, AttendanceRecord, ActivityLog } from '../types';

export const DEFAULT_FALLBACK_CLASS: SchoolClass = {
  id: 'c_7a_default',
  name: 'VII A',
  grade: '7',
  major: 'Kurikulum Merdeka - Fase D',
  homeroomTeacher: 'Dra. Sri Wahyuni, M.Pd.',
  roomName: 'Ruang Kelas VII.A',
  totalStudents: 32,
};

export const STANDARD_DEFAULT_CLASSES: SchoolClass[] = [
  {
    id: 'c_7a',
    name: 'VII A',
    grade: '7',
    major: 'Kurikulum Merdeka - Fase D',
    homeroomTeacher: 'Dra. Sri Wahyuni, M.Pd.',
    roomName: 'Ruang 101',
    totalStudents: 32,
  },
  {
    id: 'c_7b',
    name: 'VII B',
    grade: '7',
    major: 'Kurikulum Merdeka - Fase D',
    homeroomTeacher: 'Bambang Sudarsono, S.Pd.',
    roomName: 'Ruang 102',
    totalStudents: 32,
  },
  {
    id: 'c_8a',
    name: 'VIII A',
    grade: '8',
    major: 'Kurikulum Merdeka - Fase D',
    homeroomTeacher: 'Nurul Hidayati, S.Sos.',
    roomName: 'Ruang 201',
    totalStudents: 32,
  },
  {
    id: 'c_8b',
    name: 'VIII B',
    grade: '8',
    major: 'Kurikulum Merdeka - Fase D',
    homeroomTeacher: 'Fajar Nugraha, S.Kom.',
    roomName: 'Ruang 202',
    totalStudents: 32,
  },
  {
    id: 'c_9a',
    name: 'IX A',
    grade: '9',
    major: 'Kurikulum Merdeka - Fase D',
    homeroomTeacher: 'Dr. Hendra Gunawan, M.Si.',
    roomName: 'Ruang 301',
    totalStudents: 32,
  },
  {
    id: 'c_9b',
    name: 'IX B',
    grade: '9',
    major: 'Kurikulum Merdeka - Fase D',
    homeroomTeacher: 'Siti Rahmawati, S.Pd.',
    roomName: 'Ruang 302',
    totalStudents: 32,
  },
];

export interface IntegrityValidationResult {
  classes: SchoolClass[];
  students: Student[];
  records: AttendanceRecord[];
  hasModifications: boolean;
  repairedCount: number;
}

/**
 * Validates and reconciles data loaded from localStorage or state
 */
export function validateAndReconcileSchoolData(
  rawClasses: any[],
  rawStudents: any[],
  rawRecords: any[]
): IntegrityValidationResult {
  let hasModifications = false;
  let repairedCount = 0;

  // 1. Sanitize & ensure unique classes
  let validClasses: SchoolClass[] = [];
  const seenClassIds = new Set<string>();

  if (Array.isArray(rawClasses)) {
    for (const item of rawClasses) {
      if (item && typeof item === 'object') {
        const id = String(item.id || '').trim();
        const name = String(item.name || '').trim();
        const grade = String(item.grade || '7').trim();

        if (id && name && !seenClassIds.has(id)) {
          seenClassIds.add(id);
          validClasses.push({
            id,
            name,
            grade,
            major: String(item.major || 'Kurikulum Merdeka').trim(),
            homeroomTeacher: String(item.homeroomTeacher || '').trim(),
            homeroomTeacherId: item.homeroomTeacherId ? String(item.homeroomTeacherId) : undefined,
            roomName: String(item.roomName || 'Ruang Standar').trim(),
            totalStudents: Number(item.totalStudents) || 32,
            academicYear: item.academicYear ? String(item.academicYear) : undefined,
          });
        }
      }
    }
  }

  // If no classes exist at all, populate with standard classes
  if (validClasses.length === 0) {
    validClasses = [...STANDARD_DEFAULT_CLASSES];
    hasModifications = true;
  }

  const primaryFallbackClass = validClasses[0] || DEFAULT_FALLBACK_CLASS;
  const classByIdMap = new Map<string, SchoolClass>(validClasses.map((c) => [c.id, c]));
  const classByNameMap = new Map<string, SchoolClass>(
    validClasses.map((c) => [c.name.trim().toLowerCase(), c])
  );

  // 2. Validate and reconcile students
  const validStudents: Student[] = [];
  if (Array.isArray(rawStudents)) {
    for (const s of rawStudents) {
      if (!s || typeof s !== 'object' || !s.id) continue;

      let studentClassId = String(s.classId || '').trim();
      let studentClassName = String(s.className || '').trim();

      // Check if classId is known
      let matchedClass = classByIdMap.get(studentClassId);

      // If classId not found, try matching by className
      if (!matchedClass && studentClassName) {
        matchedClass = classByNameMap.get(studentClassName.toLowerCase());
        if (matchedClass) {
          studentClassId = matchedClass.id;
          studentClassName = matchedClass.name;
          hasModifications = true;
          repairedCount++;
        }
      }

      // If still not matched, fallback to primary class
      if (!matchedClass) {
        studentClassId = primaryFallbackClass.id;
        studentClassName = primaryFallbackClass.name;
        hasModifications = true;
        repairedCount++;
      } else {
        // Ensure student.className matches class name
        if (studentClassName !== matchedClass.name) {
          studentClassName = matchedClass.name;
          hasModifications = true;
        }
      }

      validStudents.push({
        ...s,
        classId: studentClassId,
        className: studentClassName,
      });
    }
  }

  // 3. Validate and reconcile attendance records
  const studentByIdMap = new Map<string, Student>(validStudents.map((s) => [s.id, s]));
  const validRecords: AttendanceRecord[] = [];

  if (Array.isArray(rawRecords)) {
    for (const r of rawRecords) {
      if (!r || typeof r !== 'object' || !r.id) continue;

      if (r.personType === 'student') {
        const student = studentByIdMap.get(r.personId);
        if (student && student.className && r.classOrSubject !== student.className) {
          validRecords.push({
            ...r,
            classOrSubject: student.className,
          });
          hasModifications = true;
          repairedCount++;
          continue;
        }
      }

      validRecords.push(r);
    }
  }

  return {
    classes: validClasses,
    students: validStudents,
    records: validRecords,
    hasModifications,
    repairedCount,
  };
}

/**
 * Exports classes (rombongan belajar) as CSV
 */
export function exportClassesToCsv(
  classes: SchoolClass[],
  students: Student[] = [],
  schoolName: string = 'SMPN 4 SATU ATAP TALIABU BARAT'
): void {
  const cleanSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];

  const headers = [
    'No',
    'ID Rombel',
    'Nama Kelas',
    'Jenjang',
    'Program / Kurikulum',
    'Wali Kelas',
    'Ruang Kelas',
    'Kapasitas Maksimal',
    'Jumlah Siswa Terdaftar',
    'Persentase Keterisian',
    'Tahun Akademik',
  ];

  const rows = classes.map((cls, idx) => {
    const enrolled = students.filter(
      (s) => s.classId === cls.id || s.className.toLowerCase() === cls.name.toLowerCase()
    ).length;
    const capacity = cls.totalStudents || 32;
    const percentage = capacity > 0 ? `${Math.round((enrolled / capacity) * 100)}%` : '0%';

    return [
      idx + 1,
      `"${cls.id}"`,
      `"${cls.name}"`,
      `"Jenjang ${cls.grade}"`,
      `"${cls.major || 'Kurikulum Merdeka'}"`,
      `"${cls.homeroomTeacher || 'Belum Ditugaskan'}"`,
      `"${cls.roomName || 'Ruang Standar'}"`,
      capacity,
      enrolled,
      `"${percentage}"`,
      `"${cls.academicYear || '2025/2026'}"`,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Data_Rombel_${cleanSchool}_${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports classes (rombongan belajar) as standalone JSON backup
 */
export function exportClassesToJson(
  classes: SchoolClass[],
  students: Student[] = [],
  schoolName: string = 'SMPN 4 SATU ATAP TALIABU BARAT'
): void {
  const cleanSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];

  const exportPayload = {
    app: 'Sistem Informasi Presensi & Rombel',
    backupType: 'STANDALONE_ROMBEL_BACKUP',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    schoolName,
    totalClasses: classes.length,
    totalEnrolledStudents: students.length,
    classes: classes.map((cls) => {
      const classStudents = students.filter(
        (s) => s.classId === cls.id || s.className.toLowerCase() === cls.name.toLowerCase()
      );
      return {
        ...cls,
        enrolledCount: classStudents.length,
        enrolledStudentIds: classStudents.map((s) => s.id),
      };
    }),
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Backup_Rombel_${cleanSchool}_${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

