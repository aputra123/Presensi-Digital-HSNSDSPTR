import { AppBackupData, SchoolConfig } from '../types';
import { getIsoWeekNumber } from './scheduledBkdReminder';

export const FRIDAY_AUTO_BACKUP_KEY_PREFIX = 'school_friday_auto_backup_';

/**
 * Generates the storage key for current week's Friday auto backup
 */
export const getFridayAutoBackupStorageKey = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const week = getIsoWeekNumber(d);
  return `${FRIDAY_AUTO_BACKUP_KEY_PREFIX}${year}_w${week}`;
};

/**
 * Checks if Friday auto backup has already been performed this week
 */
export const hasFridayAutoBackupRunThisWeek = (d: Date = new Date()): boolean => {
  if (typeof localStorage === 'undefined') return false;
  const key = getFridayAutoBackupStorageKey(d);
  return !!localStorage.getItem(key);
};

/**
 * Marks Friday auto backup as completed for the current week
 */
export const markFridayAutoBackupRun = (metadata: {
  timestamp: string;
  fileName: string;
  totalRecords: number;
}): void => {
  if (typeof localStorage === 'undefined') return;
  const key = getFridayAutoBackupStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(metadata));
  } catch (err) {
    console.warn('Failed to mark Friday auto-backup:', err);
  }
};

/**
 * Downloads a snapshot object as a formatted JSON file to user's downloads folder
 */
export const triggerJsonDownload = (payload: AppBackupData, filename: string): void => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

/**
 * Evaluates Friday Auto-Backup condition:
 * - If today is Friday (Day 5)
 * - Has not run auto-backup for this week yet
 */
export const evaluateFridayAutoBackup = (
  appData: Partial<AppBackupData>,
  config: SchoolConfig
): {
  shouldBackup: boolean;
  isFriday: boolean;
  fileName: string;
  payload: AppBackupData;
} => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const witaDate = new Date(utc + 3600000 * 8); // WITA UTC+8
  const isFriday = witaDate.getDay() === 5;
  const hasRun = hasFridayAutoBackupRunThisWeek(witaDate);

  const dateStr = now.toISOString().split('T')[0];
  const cleanSchool = (config.schoolName || 'SMPN4_Taliabu_Barat').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `AutoBackup_Snapshot_Jumat_${cleanSchool}_${dateStr}.json`;

  const payload: AppBackupData = {
    id: `auto_backup_friday_${now.getTime()}`,
    timestamp: now.toISOString(),
    createdDate: dateStr,
    createdTime: now.toLocaleTimeString('id-ID'),
    source: 'Friday Auto-Backup Scheduler (WITA Snapshot)',
    totalRecords: appData.records?.length || 0,
    totalStudents: appData.students?.length || 0,
    totalTeachers: appData.teachers?.length || 0,
    totalClasses: appData.classes?.length || 0,
    totalLeaves: appData.leaves?.length || 0,
    totalGtkServices: appData.gtkServices?.length || 0,
    records: appData.records || [],
    students: appData.students || [],
    teachers: appData.teachers || [],
    classes: appData.classes || [],
    leaves: appData.leaves || [],
    gtkServices: appData.gtkServices || [],
    events: appData.events || [],
    config: config,
    piketDuties: appData.piketDuties || [],
    biometricLogs: appData.biometricLogs || [],
    activityLogs: appData.activityLogs || [],
  };

  return {
    shouldBackup: isFriday && !hasRun,
    isFriday,
    fileName,
    payload,
  };
};
