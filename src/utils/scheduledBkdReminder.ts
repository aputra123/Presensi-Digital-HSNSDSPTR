/**
 * Scheduled BKD Reminder Utility
 * Handles Friday 14:00 WITA check for unexported weekly GTK attendance records.
 */

export interface BkdReminderStatus {
  isFridayAfternoonWita: boolean;
  currentWitaTimeFormatted: string;
  currentDayName: string;
  hasExportedThisWeek: boolean;
  unexportedRecordsCount: number;
  shouldAlert: boolean;
}

/**
 * Gets ISO week number (1-53) for weekly export tracking
 */
export const getIsoWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

export const getWeeklyExportStorageKey = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const week = getIsoWeekNumber(d);
  return `school_bkd_exported_${year}_w${week}`;
};

/**
 * Marks current week's BKD attendance records as exported
 */
export const markWeeklyBkdExported = (): void => {
  if (typeof localStorage === 'undefined') return;
  const key = getWeeklyExportStorageKey();
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        exportedBy: 'Admin / Operator BKD',
      })
    );
  } catch (err) {
    console.warn('Failed to mark BKD export:', err);
  }
};

/**
 * Checks if current week's BKD attendance has been exported
 */
export const hasWeeklyBkdBeenExported = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  const key = getWeeklyExportStorageKey();
  return !!localStorage.getItem(key);
};

/**
 * Evaluates Friday 14:00 WITA (UTC+8) condition
 */
export const checkFridayBkdReminder = (teacherRecordsCount: number = 0): BkdReminderStatus => {
  // Convert current UTC time to WITA (UTC+8)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const witaDate = new Date(utc + 3600000 * 8); // UTC+8

  const dayOfWeek = witaDate.getDay(); // 0 = Sunday, 5 = Friday
  const hours = witaDate.getHours();
  const minutes = witaDate.getMinutes();

  const isFridayAfternoonWita = dayOfWeek === 5 && hours >= 14;
  const hasExported = hasWeeklyBkdBeenExported();

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const currentDayName = dayNames[dayOfWeek];
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} WITA`;

  // Should alert if it is Friday >= 14:00 WITA, has not yet exported this week, and has teacher attendance records
  const shouldAlert = isFridayAfternoonWita && !hasExported;

  return {
    isFridayAfternoonWita,
    currentWitaTimeFormatted: timeFormatted,
    currentDayName,
    hasExportedThisWeek: hasExported,
    unexportedRecordsCount: teacherRecordsCount,
    shouldAlert,
  };
};
