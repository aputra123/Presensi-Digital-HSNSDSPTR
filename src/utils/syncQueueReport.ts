import { SyncQueueItem, AttendanceRecord } from '../types';
import { getSyncQueue, saveSyncQueue } from './syncQueue';

export interface SyncQueueUsageReport {
  totalQueued: number;
  studentsCount: number;
  teachersCount: number;
  statusBreakdown: {
    hadir: number;
    terlambat: number;
    sakit: number;
    izin: number;
    alpa: number;
  };
  methodBreakdown: {
    qrcode: number;
    selfie_gps: number;
    manual: number;
    rfid: number;
  };
  timeDistribution: Array<{
    hourRange: string;
    count: number;
    percentage: number;
  }>;
  dateDistribution: Array<{
    date: string;
    count: number;
    students: number;
    teachers: number;
  }>;
  classBreakdown: Array<{
    className: string;
    count: number;
  }>;
  employmentBreakdown: Array<{
    status: string;
    count: number;
  }>;
  ageAnalysis: {
    oldestTimestamp?: string;
    newestTimestamp?: string;
    averageWaitMinutes: number;
    olderThan24HoursCount: number;
    olderThan7DaysCount: number;
    olderThan30DaysCount: number;
  };
  gpsStats: {
    withGpsCount: number;
    inRadiusCount: number;
    outRadiusCount: number;
    averageDistanceMeter: number;
  };
  insights: string[];
}

/**
 * Processes the raw local SyncQueue array into a comprehensive Usage Report
 * with statistics, trends, and analytical insights.
 */
export const generateSyncQueueUsageReport = (
  queue: SyncQueueItem[] = []
): SyncQueueUsageReport => {
  const currentQueue = queue.length > 0 ? queue : getSyncQueue();
  const total = currentQueue.length;

  if (total === 0) {
    return {
      totalQueued: 0,
      studentsCount: 0,
      teachersCount: 0,
      statusBreakdown: { hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0 },
      methodBreakdown: { qrcode: 0, selfie_gps: 0, manual: 0, rfid: 0 },
      timeDistribution: [],
      dateDistribution: [],
      classBreakdown: [],
      employmentBreakdown: [],
      ageAnalysis: {
        averageWaitMinutes: 0,
        olderThan24HoursCount: 0,
        olderThan7DaysCount: 0,
        olderThan30DaysCount: 0,
      },
      gpsStats: {
        withGpsCount: 0,
        inRadiusCount: 0,
        outRadiusCount: 0,
        averageDistanceMeter: 0,
      },
      insights: ['Semua data presensi lokal telah tersinkronisasi 100% dengan Cloud Firebase.'],
    };
  }

  let studentsCount = 0;
  let teachersCount = 0;
  const statusCounts = { hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0 };
  const methodCounts = { qrcode: 0, selfie_gps: 0, manual: 0, rfid: 0 };

  const hourBuckets: Record<string, number> = {
    '06:00 - 07:00': 0,
    '07:00 - 08:00': 0,
    '08:00 - 12:00': 0,
    '12:00 - 14:00': 0,
    '14:00 - 16:00': 0,
    '16:00+': 0,
  };

  const dateMap = new Map<string, { count: number; students: number; teachers: number }>();
  const classMap = new Map<string, number>();
  const employmentMap = new Map<string, number>();

  let totalWaitMinutes = 0;
  let olderThan24h = 0;
  let olderThan7d = 0;
  let olderThan30d = 0;
  const now = Date.now();

  let withGpsCount = 0;
  let inRadiusCount = 0;
  let outRadiusCount = 0;
  let totalDistanceMeter = 0;

  const timestamps: number[] = [];

  currentQueue.forEach((item) => {
    const rec = item.record;
    const itemTime = new Date(item.queuedAt || rec.date).getTime();
    if (!isNaN(itemTime)) {
      timestamps.push(itemTime);
      const diffMinutes = Math.max(0, Math.floor((now - itemTime) / (1000 * 60)));
      totalWaitMinutes += diffMinutes;

      if (diffMinutes >= 60 * 24) olderThan24h++;
      if (diffMinutes >= 60 * 24 * 7) olderThan7d++;
      if (diffMinutes >= 60 * 24 * 30) olderThan30d++;
    }

    if (rec.personType === 'student') {
      studentsCount++;
      const cName = rec.classOrSubject || 'Kelas Umum';
      classMap.set(cName, (classMap.get(cName) || 0) + 1);
    } else {
      teachersCount++;
      const emp = rec.employmentStatus || 'PNS';
      employmentMap.set(emp, (employmentMap.get(emp) || 0) + 1);
    }

    const st = rec.status as keyof typeof statusCounts;
    if (statusCounts[st] !== undefined) {
      statusCounts[st]++;
    }

    const meth = rec.method as keyof typeof methodCounts;
    if (methodCounts[meth] !== undefined) {
      methodCounts[meth]++;
    }

    // Time buckets
    const timeParts = (rec.time || '07:00').split(':');
    const hour = parseInt(timeParts[0], 10) || 7;
    if (hour < 7) hourBuckets['06:00 - 07:00']++;
    else if (hour < 8) hourBuckets['07:00 - 08:00']++;
    else if (hour < 12) hourBuckets['08:00 - 12:00']++;
    else if (hour < 14) hourBuckets['12:00 - 14:00']++;
    else if (hour < 16) hourBuckets['14:00 - 16:00']++;
    else hourBuckets['16:00+']++;

    // Date distribution
    const dKey = rec.date || 'Hari Ini';
    const curDate = dateMap.get(dKey) || { count: 0, students: 0, teachers: 0 };
    curDate.count++;
    if (rec.personType === 'student') curDate.students++;
    else curDate.teachers++;
    dateMap.set(dKey, curDate);

    // GPS metrics
    if (rec.location) {
      withGpsCount++;
      if (rec.location.inRadius) inRadiusCount++;
      else outRadiusCount++;
      totalDistanceMeter += rec.location.distanceMeter || 0;
    }
  });

  const timeDistribution = Object.entries(hourBuckets).map(([hourRange, count]) => ({
    hourRange,
    count,
    percentage: Math.round((count / total) * 100),
  }));

  const dateDistribution = Array.from(dateMap.entries()).map(([date, val]) => ({
    date,
    count: val.count,
    students: val.students,
    teachers: val.teachers,
  }));

  const classBreakdown = Array.from(classMap.entries())
    .map(([className, count]) => ({ className, count }))
    .sort((a, b) => b.count - a.count);

  const employmentBreakdown = Array.from(employmentMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  timestamps.sort((a, b) => a - b);
  const oldestTimestamp = timestamps.length > 0 ? new Date(timestamps[0]).toLocaleString('id-ID') : undefined;
  const newestTimestamp = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toLocaleString('id-ID') : undefined;
  const avgWait = Math.round(totalWaitMinutes / total);

  // Generate intelligent insights
  const insights: string[] = [];
  const peakHour = [...timeDistribution].sort((a, b) => b.count - a.count)[0];
  if (peakHour && peakHour.count > 0) {
    insights.push(`Puncak pencatatan presensi offline terjadi pada rentang jam **${peakHour.hourRange}** (${peakHour.count} presensi, ${peakHour.percentage}% dari total antrian).`);
  }

  if (teachersCount > 0) {
    insights.push(`Terdapat **${teachersCount} presensi Guru & GTK** menunggu pengiriman, siap dikompilasi ke format SIMPEG BKD Pulau Taliabu.`);
  }

  if (methodCounts.selfie_gps > 0) {
    const validGpsPct = Math.round((inRadiusCount / (withGpsCount || 1)) * 100);
    insights.push(`**${methodCounts.selfie_gps} rekaman biometrik wajah & GPS** tersimpan; ${validGpsPct}% berada di dalam radius geofencing resmi sekolah.`);
  }

  if (olderThan7d > 0) {
    insights.push(`⚠️ Perhatian: Terdapat **${olderThan7d} data antrian offline** yang berumur lebih dari 7 hari. Disarankan untuk segera melakukan sinkronisasi atau pembersihan arsip lama.`);
  } else {
    insights.push(`Semua data antrian berumur wajar (<7 hari) dan aman tersimpan di cache lokal perangkat.`);
  }

  return {
    totalQueued: total,
    studentsCount,
    teachersCount,
    statusBreakdown: statusCounts,
    methodBreakdown: methodCounts,
    timeDistribution,
    dateDistribution,
    classBreakdown,
    employmentBreakdown,
    ageAnalysis: {
      oldestTimestamp,
      newestTimestamp,
      averageWaitMinutes: avgWait,
      olderThan24HoursCount: olderThan24h,
      olderThan7DaysCount: olderThan7d,
      olderThan30DaysCount: olderThan30d,
    },
    gpsStats: {
      withGpsCount,
      inRadiusCount,
      outRadiusCount,
      averageDistanceMeter: withGpsCount > 0 ? Math.round(totalDistanceMeter / withGpsCount) : 0,
    },
    insights,
  };
};

/**
 * Cleans up successfully synced records or queue items older than a given number of days (default 30 days)
 * from localStorage to maintain high runtime performance and prune storage overhead.
 */
export const cleanupOldSyncQueue = (
  daysThreshold: number = 30
): {
  cleanedCount: number;
  remainingCount: number;
  freedBytesEstimated: number;
  cleanedItems: SyncQueueItem[];
} => {
  const currentQueue = getSyncQueue();
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const remaining: SyncQueueItem[] = [];
  const cleaned: SyncQueueItem[] = [];

  currentQueue.forEach((item) => {
    const itemTime = new Date(item.queuedAt || item.record.date).getTime();
    const isOld = !isNaN(itemTime) && now - itemTime > thresholdMs;
    const isSynced = item.status === 'synced';

    // Prune if synced or older than threshold days
    if (isOld || (isSynced && now - itemTime > 24 * 60 * 60 * 1000)) {
      cleaned.push(item);
    } else {
      remaining.push(item);
    }
  });

  saveSyncQueue(remaining);

  const initialJson = JSON.stringify(currentQueue);
  const remainingJson = JSON.stringify(remaining);
  const freedBytes = Math.max(0, initialJson.length - remainingJson.length);

  return {
    cleanedCount: cleaned.length,
    remainingCount: remaining.length,
    freedBytesEstimated: freedBytes,
    cleanedItems: cleaned,
  };
};
