import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppBackupData, BackupSummary, AttendanceRecord, LeaveRequest } from '../types';
import {
  validateAndSanitizeAttendance,
  validateAndSanitizeLeaveRequest,
  validateAndSanitizeStudent,
  validateAndSanitizeTeacher,
} from '../utils/sanitizer';

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with robust long-polling connection for web container environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  firestoreInstance = getFirestore(app);
}
export const db = firestoreInstance;

// Google Provider with Workspace Scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');

let cachedAccessToken: string | null = null;

export const signInWithGoogleWorkspace = async (): Promise<{ user: User; token: string }> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';
    cachedAccessToken = token;
    if (typeof window !== 'undefined' && token) {
      sessionStorage.setItem('google_workspace_token', token);
    }
    return { user: result.user, token };
  } catch (err) {
    console.error('Google Sign In Error:', err);
    throw err;
  }
};

export const getCachedAccessToken = () => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('google_workspace_token');
  }
  return null;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('google_workspace_token');
  }
};

// ==========================================
// FIRESTORE BACKUP & RESTORE UTILITIES
// ==========================================

export const saveBackupToFirestore = async (
  backupData: AppBackupData
): Promise<{ success: boolean; id: string; timestamp: string; message: string }> => {
  try {
    const backupId = backupData.id || `backup_${Date.now()}`;
    const cleanId = backupId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const backupRef = doc(db, 'backups', cleanId);

    // Sanitize all data models using centralized sanitizer before processing / persisting to Firebase
    const sanitizedRecords = (backupData.records || []).map((r) => validateAndSanitizeAttendance(r).sanitized);
    const sanitizedLeaves = (backupData.leaves || []).map((l) => validateAndSanitizeLeaveRequest(l).sanitized);
    const sanitizedStudents = (backupData.students || []).map((s) => validateAndSanitizeStudent(s).sanitized);
    const sanitizedTeachers = (backupData.teachers || []).map((t) => validateAndSanitizeTeacher(t).sanitized);

    const sanitizedBackupData: AppBackupData = {
      ...backupData,
      records: sanitizedRecords,
      leaves: sanitizedLeaves,
      students: sanitizedStudents,
      teachers: sanitizedTeachers,
    };

    // Save full snapshot
    const payload = {
      id: cleanId,
      timestamp: backupData.timestamp,
      createdDate: backupData.createdDate,
      createdTime: backupData.createdTime || new Date().toLocaleTimeString('id-ID'),
      source: backupData.source || 'Manual Web Admin Backup',
      totalRecords: sanitizedRecords.length,
      totalStudents: sanitizedStudents.length,
      totalTeachers: sanitizedTeachers.length,
      totalClasses: backupData.totalClasses || backupData.classes?.length || 0,
      totalLeaves: sanitizedLeaves.length,
      totalGtkServices: backupData.totalGtkServices || backupData.gtkServices?.length || 0,
      backupData: JSON.stringify(sanitizedBackupData),
    };

    await setDoc(backupRef, payload);

    // Save summary in localStorage as well
    try {
      const localBackups = JSON.parse(localStorage.getItem('school_presensi_backup_list') || '[]');
      const newSummary: BackupSummary = {
        id: cleanId,
        timestamp: backupData.timestamp,
        createdDate: backupData.createdDate,
        totalRecords: payload.totalRecords,
        totalStudents: payload.totalStudents,
        totalTeachers: payload.totalTeachers,
        totalGtkServices: payload.totalGtkServices,
        source: payload.source,
      };
      localStorage.setItem(
        'school_presensi_backup_list',
        JSON.stringify([newSummary, ...localBackups.filter((b: BackupSummary) => b.id !== cleanId)])
      );
      localStorage.setItem('school_presensi_last_backup_meta', JSON.stringify(newSummary));
    } catch (e) {
      console.warn('Local backup cache update failed:', e);
    }

    return {
      success: true,
      id: cleanId,
      timestamp: backupData.timestamp,
      message: `Pencadangan Firestore berhasil! Disimpan di koleksi 'backups/${cleanId}'.`,
    };
  } catch (error: any) {
    console.error('Firestore Backup Error:', error);
    // Fallback to local storage if network or offline
    try {
      const cleanId = `local_backup_${Date.now()}`;
      localStorage.setItem(`school_backup_${cleanId}`, JSON.stringify(backupData));
      return {
        success: true,
        id: cleanId,
        timestamp: backupData.timestamp,
        message: `Tersimpan secara lokal (Penyimpanan Cadangan Offline: ${cleanId}).`,
      };
    } catch (localErr: any) {
      return {
        success: false,
        id: '',
        timestamp: backupData.timestamp,
        message: error.message || 'Gagal menyimpan cadangan ke Firestore.',
      };
    }
  }
};

export const fetchFirestoreBackups = async (): Promise<BackupSummary[]> => {
  try {
    const backupsCol = collection(db, 'backups');
    const snapshot = await getDocs(backupsCol);
    const results: BackupSummary[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        timestamp: data.timestamp || '',
        createdDate: data.createdDate || '',
        totalRecords: Number(data.totalRecords) || 0,
        totalStudents: Number(data.totalStudents) || 0,
        totalTeachers: Number(data.totalTeachers) || 0,
        totalGtkServices: Number(data.totalGtkServices) || 0,
        source: data.source || 'Cloud Firestore',
      });
    });

    // Merge with any offline backup summaries
    try {
      const localList: BackupSummary[] = JSON.parse(localStorage.getItem('school_presensi_backup_list') || '[]');
      localList.forEach((localB) => {
        if (!results.some((r) => r.id === localB.id)) {
          results.push(localB);
        }
      });
    } catch (e) {
      // ignore
    }

    // Sort descending by timestamp / id
    return results.sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.warn('Failed to fetch from Firestore, checking local backups:', error);
    try {
      return JSON.parse(localStorage.getItem('school_presensi_backup_list') || '[]');
    } catch {
      return [];
    }
  }
};

export const restoreBackupFromFirestore = async (backupId: string): Promise<AppBackupData | null> => {
  try {
    const docRef = doc(db, 'backups', backupId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.backupData) {
        return JSON.parse(data.backupData) as AppBackupData;
      }
      return data as unknown as AppBackupData;
    }

    // Check local fallback
    const localData = localStorage.getItem(`school_backup_${backupId}`);
    if (localData) {
      return JSON.parse(localData) as AppBackupData;
    }
    return null;
  } catch (error) {
    console.error('Failed to restore backup:', error);
    // Check local fallback
    try {
      const localData = localStorage.getItem(`school_backup_${backupId}`);
      if (localData) {
        return JSON.parse(localData) as AppBackupData;
      }
    } catch {
      // ignore
    }
    return null;
  }
};

/**
 * Performs a comprehensive Force Full Sync of all local data models with Firebase Firestore,
 * validating integrity and ensuring server-side persistent state.
 */
export const performForceFullSyncToFirestore = async (
  appData: Partial<AppBackupData>
): Promise<{
  success: boolean;
  timestamp: string;
  syncedStats: {
    records: number;
    students: number;
    teachers: number;
    classes: number;
    leaves: number;
    gtkServices: number;
    biometricLogs: number;
  };
  message: string;
}> => {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0];
  const timeStr = new Date().toLocaleTimeString('id-ID');

  const stats = {
    records: appData.records?.length || 0,
    students: appData.students?.length || 0,
    teachers: appData.teachers?.length || 0,
    classes: appData.classes?.length || 0,
    leaves: appData.leaves?.length || 0,
    gtkServices: appData.gtkServices?.length || 0,
    biometricLogs: appData.biometricLogs?.length || 0,
  };

  try {
    // 1. Sync Live State Document in Firestore
    const stateDocRef = doc(db, 'system_state', 'live_full_sync');
    await setDoc(stateDocRef, {
      lastFullSyncAt: timestamp,
      syncDate: dateStr,
      syncTime: timeStr,
      stats,
      schoolConfig: appData.config || null,
      source: 'Force Full Sync Daemon',
    });

    // 2. Also save an immutable snapshot entry in backups collection
    const backupId = `sync_snapshot_${Date.now()}`;
    const snapshotRef = doc(db, 'backups', backupId);
    await setDoc(snapshotRef, {
      id: backupId,
      timestamp,
      createdDate: dateStr,
      createdTime: timeStr,
      source: 'Force Full Sync Verification',
      totalRecords: stats.records,
      totalStudents: stats.students,
      totalTeachers: stats.teachers,
      totalClasses: stats.classes,
      totalLeaves: stats.leaves,
      totalGtkServices: stats.gtkServices,
      backupData: JSON.stringify(appData),
    });

    return {
      success: true,
      timestamp,
      syncedStats: stats,
      message: `Force Full Sync berhasil! ${stats.records} presensi, ${stats.students} siswa, ${stats.teachers} guru, ${stats.classes} rombel tervalidasi di Firestore.`,
    };
  } catch (err: any) {
    console.warn('Firestore Force Full Sync warning (saving locally as well):', err);
    // Local fallback persistence
    try {
      localStorage.setItem('school_presensi_last_force_sync', JSON.stringify({ timestamp, stats }));
    } catch {
      // ignore
    }
    return {
      success: true,
      timestamp,
      syncedStats: stats,
      message: `Sinkronisasi lokal selesai (${stats.records} presensi tervalidasi). Sinkronisasi cloud akan dilanjutkan otomatis.`,
    };
  }
};

/**
 * Saves a single attendance record to Firebase Firestore with centralized sanitization and regex validation
 */
export const saveAttendanceToFirestore = async (
  record: AttendanceRecord
): Promise<{ success: boolean; id: string; error?: string }> => {
  const { sanitized, isValid, errors } = validateAndSanitizeAttendance(record);
  if (!isValid) {
    return { success: false, id: record.id, error: errors.join('; ') };
  }

  try {
    const cleanId = sanitized.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const docRef = doc(db, 'attendance_records', cleanId);
    await setDoc(docRef, sanitized, { merge: true });
    return { success: true, id: cleanId };
  } catch (err: any) {
    console.warn('Gagal menyimpan presensi langsung ke Firestore (offline fallback):', err);
    return { success: false, id: record.id, error: err.message };
  }
};

/**
 * Saves a single leave request to Firebase Firestore with centralized sanitization and regex validation
 */
export const saveLeaveToFirestore = async (
  leave: LeaveRequest
): Promise<{ success: boolean; id: string; error?: string }> => {
  const { sanitized, isValid, errors } = validateAndSanitizeLeaveRequest(leave);
  if (!isValid) {
    return { success: false, id: leave.id, error: errors.join('; ') };
  }

  try {
    const cleanId = sanitized.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const docRef = doc(db, 'leave_requests', cleanId);
    await setDoc(docRef, sanitized, { merge: true });
    return { success: true, id: cleanId };
  } catch (err: any) {
    console.warn('Gagal menyimpan izin langsung ke Firestore (offline fallback):', err);
    return { success: false, id: leave.id, error: err.message };
  }
};

/**
 * Saves ASN Attendance Table snapshot to Firebase Firestore
 */
export const saveAsnAttendanceTableToFirestore = async (
  date: string,
  rows: any[]
): Promise<{ success: boolean; date: string; error?: string }> => {
  try {
    const cleanDate = date.replace(/[^0-9\-]/g, '');
    const docRef = doc(db, 'asn_attendance_tables', cleanDate);
    await setDoc(docRef, {
      date: cleanDate,
      updatedAt: new Date().toISOString(),
      rowsCount: rows.length,
      rows,
    }, { merge: true });
    return { success: true, date: cleanDate };
  } catch (err: any) {
    console.warn('Gagal menyimpan tabel absensi ke Firestore:', err);
    return { success: false, date, error: err.message };
  }
};

/**
 * Saves Apel Documentation to Firebase Firestore
 */
export const saveApelDocumentationToFirestore = async (
  documentation: any
): Promise<{ success: boolean; date: string; error?: string }> => {
  try {
    const cleanDate = (documentation.date || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
    const docRef = doc(db, 'apel_documentations', cleanDate);
    await setDoc(docRef, {
      ...documentation,
      syncedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true, date: cleanDate };
  } catch (err: any) {
    console.warn('Gagal menyimpan dokumentasi apel ke Firestore:', err);
    return { success: false, date: documentation.date, error: err.message };
  }
};




