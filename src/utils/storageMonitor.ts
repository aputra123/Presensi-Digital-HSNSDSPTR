/**
 * Storage Monitor Utility
 * Monitors browser localStorage usage, calculates remaining quota percentage,
 * and handles smart cleanup suggestions.
 */

export interface StorageUsageStats {
  usedBytes: number;
  usedFormatted: string;
  estimatedTotalBytes: number;
  totalFormatted: string;
  usedPercentage: number;
  availablePercentage: number;
  isLowSpace: boolean; // True if available space < 10% (usage > 90%)
  itemCount: number;
  breakdown: { key: string; bytes: number; formatted: string }[];
}

// Typical browser localStorage quota is ~5MB (5,242,880 bytes)
const ESTIMATED_LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Calculates current localStorage usage statistics
 */
export const getLocalStorageStats = (): StorageUsageStats => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      usedBytes: 0,
      usedFormatted: '0 B',
      estimatedTotalBytes: ESTIMATED_LOCAL_STORAGE_QUOTA_BYTES,
      totalFormatted: '5.00 MB',
      usedPercentage: 0,
      availablePercentage: 100,
      isLowSpace: false,
      itemCount: 0,
      breakdown: [],
    };
  }

  let totalBytes = 0;
  const breakdown: { key: string; bytes: number; formatted: string }[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        // 2 bytes per char in UTF-16
        const itemBytes = (key.length + val.length) * 2;
        totalBytes += itemBytes;
        breakdown.push({
          key,
          bytes: itemBytes,
          formatted: formatBytes(itemBytes),
        });
      }
    }
  } catch (err) {
    console.error('Error calculating localStorage usage:', err);
  }

  // Sort breakdown descending
  breakdown.sort((a, b) => b.bytes - a.bytes);

  const usedPercentage = Math.min(100, Math.round((totalBytes / ESTIMATED_LOCAL_STORAGE_QUOTA_BYTES) * 100));
  const availablePercentage = Math.max(0, 100 - usedPercentage);
  const isLowSpace = availablePercentage < 10; // Available space is below 10%

  return {
    usedBytes: totalBytes,
    usedFormatted: formatBytes(totalBytes),
    estimatedTotalBytes: ESTIMATED_LOCAL_STORAGE_QUOTA_BYTES,
    totalFormatted: formatBytes(ESTIMATED_LOCAL_STORAGE_QUOTA_BYTES),
    usedPercentage,
    availablePercentage,
    isLowSpace,
    itemCount: localStorage.length,
    breakdown,
  };
};

/**
 * Performs cleanup of non-essential cached data (e.g. old sync queue items older than 14 days, activity logs)
 * to free up space while maintaining critical school data.
 */
export const performStorageCleanup = (): { freedBytes: number; freedFormatted: string; details: string } => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { freedBytes: 0, freedFormatted: '0 B', details: 'Penyimpanan tidak tersedia.' };
  }

  const initialStats = getLocalStorageStats();
  let itemsCleaned = 0;

  try {
    // 1. Clean synced items from sync_queue
    const syncQueueRaw = localStorage.getItem('school_presensi_sync_queue');
    if (syncQueueRaw) {
      try {
        const queue = JSON.parse(syncQueueRaw);
        if (Array.isArray(queue)) {
          const filtered = queue.filter((item: any) => item.status === 'pending');
          localStorage.setItem('school_presensi_sync_queue', JSON.stringify(filtered));
          itemsCleaned += queue.length - filtered.length;
        }
      } catch (e) {
        console.warn('Failed parsing sync queue during cleanup:', e);
      }
    }

    // 2. Prune old temporary demo logs if size is large
    const bkdLogsRaw = localStorage.getItem('school_presensi_bkd_logs');
    if (bkdLogsRaw) {
      try {
        const logs = JSON.parse(bkdLogsRaw);
        if (Array.isArray(logs) && logs.length > 50) {
          localStorage.setItem('school_presensi_bkd_logs', JSON.stringify(logs.slice(0, 50)));
          itemsCleaned += logs.length - 50;
        }
      } catch (e) {
        console.warn('Failed pruning bkd logs:', e);
      }
    }
  } catch (err) {
    console.error('Error during storage cleanup:', err);
  }

  const finalStats = getLocalStorageStats();
  const freedBytes = Math.max(0, initialStats.usedBytes - finalStats.usedBytes);

  return {
    freedBytes,
    freedFormatted: formatBytes(freedBytes),
    details: `Berhasil membersihkan ${itemsCleaned} item riwayat/antrian yang sudah tersinkronisasi.`,
  };
};
