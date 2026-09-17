import { get, set } from 'idb-keyval';
import {
  AttendanceRecord,
  ActivityLog,
  BiometricLog,
  Student,
} from '../types';

/**
 * IndexedDB Storage Helper using idb-keyval
 * Safely offloads large datasets from synchronous localStorage to asynchronous IndexedDB.
 * Automatically migrates existing records from localStorage without data loss.
 */

const IDB_RECORDS_KEY = 'school_presensi_records_idb';
const IDB_LOGS_KEY = 'school_presensi_activity_logs_idb';
const IDB_BIOMETRIC_KEY = 'school_presensi_biometric_logs_idb';
const IDB_STUDENTS_KEY = 'school_presensi_students_idb';

// Legacy localStorage keys for seamless migration
const LS_RECORDS_KEY = 'school_presensi_records';
const LS_LOGS_KEY = 'school_presensi_activity_logs';
const LS_BIOMETRIC_KEY = 'school_presensi_biometric_logs';
const LS_STUDENTS_KEY = 'school_presensi_students';

/**
 * Loads Attendance Records from IndexedDB with transparent fallback and migration from localStorage.
 */
export async function loadRecordsFromDb(fallback: AttendanceRecord[]): Promise<AttendanceRecord[]> {
  try {
    const idbData = await get<AttendanceRecord[]>(IDB_RECORDS_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) {
      return idbData;
    }

    // Try migration from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const lsRaw = localStorage.getItem(LS_RECORDS_KEY);
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Save to IndexedDB asynchronously
            await set(IDB_RECORDS_KEY, parsed);
            return parsed;
          }
        } catch (e) {
          console.warn('[dbStorage] Error parsing legacy records from localStorage:', e);
        }
      }
    }
  } catch (err) {
    console.warn('[dbStorage] Failed reading records from IndexedDB:', err);
  }
  return fallback;
}

/**
 * Saves Attendance Records to IndexedDB asynchronously.
 */
export async function saveRecordsToDb(records: AttendanceRecord[]): Promise<void> {
  try {
    await set(IDB_RECORDS_KEY, records);
    // Keep a lightweight count/status in localStorage for backward compatibility without blocking
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // If dataset is reasonable (< 500kb), save copy, else save light summary
        const str = JSON.stringify(records);
        if (str.length < 1024 * 1024) {
          localStorage.setItem(LS_RECORDS_KEY, str);
        }
      } catch {
        // Quota exceeded in localStorage is safely ignored because data is secure in IndexedDB
      }
    }
  } catch (err) {
    console.error('[dbStorage] Failed saving records to IndexedDB:', err);
  }
}

/**
 * Loads Activity Logs from IndexedDB with migration.
 */
export async function loadActivityLogsFromDb(fallback: ActivityLog[]): Promise<ActivityLog[]> {
  try {
    const idbData = await get<ActivityLog[]>(IDB_LOGS_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) {
      return idbData;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const lsRaw = localStorage.getItem(LS_LOGS_KEY);
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            await set(IDB_LOGS_KEY, parsed);
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[dbStorage] Failed reading activity logs from IndexedDB:', err);
  }
  return fallback;
}

/**
 * Saves Activity Logs to IndexedDB asynchronously.
 */
export async function saveActivityLogsToDb(logs: ActivityLog[]): Promise<void> {
  try {
    await set(IDB_LOGS_KEY, logs);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Save at most 30 recent entries in localStorage for instant sync previews
        localStorage.setItem(LS_LOGS_KEY, JSON.stringify(logs.slice(0, 30)));
      } catch {
        // Ignore localStorage quota
      }
    }
  } catch (err) {
    console.error('[dbStorage] Failed saving activity logs to IndexedDB:', err);
  }
}

/**
 * Loads Biometric Logs from IndexedDB with migration.
 */
export async function loadBiometricLogsFromDb(fallback: BiometricLog[]): Promise<BiometricLog[]> {
  try {
    const idbData = await get<BiometricLog[]>(IDB_BIOMETRIC_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) {
      return idbData;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const lsRaw = localStorage.getItem(LS_BIOMETRIC_KEY);
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            await set(IDB_BIOMETRIC_KEY, parsed);
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[dbStorage] Failed reading biometric logs from IndexedDB:', err);
  }
  return fallback;
}

/**
 * Saves Biometric Logs to IndexedDB asynchronously.
 */
export async function saveBiometricLogsToDb(logs: BiometricLog[]): Promise<void> {
  try {
    await set(IDB_BIOMETRIC_KEY, logs);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(LS_BIOMETRIC_KEY, JSON.stringify(logs.slice(0, 30)));
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('[dbStorage] Failed saving biometric logs to IndexedDB:', err);
  }
}

/**
 * Loads Students from IndexedDB with migration.
 */
export async function loadStudentsFromDb(fallback: Student[]): Promise<Student[]> {
  try {
    const idbData = await get<Student[]>(IDB_STUDENTS_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) {
      return idbData;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const lsRaw = localStorage.getItem(LS_STUDENTS_KEY);
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            await set(IDB_STUDENTS_KEY, parsed);
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[dbStorage] Failed reading students from IndexedDB:', err);
  }
  return fallback;
}

/**
 * Saves Students to IndexedDB asynchronously.
 */
export async function saveStudentsToDb(students: Student[]): Promise<void> {
  try {
    await set(IDB_STUDENTS_KEY, students);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(LS_STUDENTS_KEY, JSON.stringify(students));
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('[dbStorage] Failed saving students to IndexedDB:', err);
  }
}
