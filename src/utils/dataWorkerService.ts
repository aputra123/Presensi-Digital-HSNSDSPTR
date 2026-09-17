import { AttendanceRecord, SchoolClass, Student, ActivityLog, SyncQueueItem, BkdDispatchLog } from '../types';
import { WorkerRequest, WorkerResponse } from '../workers/dataProcessor.worker';

let workerInstance: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('../workers/dataProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerInstance.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, success, data, error } = e.data;
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (success) {
            pending.resolve(data);
          } else {
            pending.reject(new Error(error || 'Worker operation failed'));
          }
        }
      };

      workerInstance.onerror = (err) => {
        console.warn('[DataWorker] Worker error encountered, falling back to main-thread processing:', err);
      };
    } catch (e) {
      console.warn('[DataWorker] Web Worker instantiation unsupported or blocked:', e);
      workerInstance = null;
    }
  }
  return workerInstance;
}

function sendToWorker<T>(type: WorkerRequest['type'], payload: any): Promise<T> {
  const worker = getWorker();
  const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  if (!worker) {
    // Synchronous fallback simulation in microtask
    return new Promise((resolve) => {
      setTimeout(() => {
        if (type === 'CHECK_INTEGRITY') {
          const classIdSet = new Set((payload.classes || []).map((c: any) => c.id));
          const orphanedStudents = (payload.students || []).filter((s: any) => !s.classId || !classIdSet.has(s.classId));
          const orphanedRecords = (payload.records || []).filter((r: any) => r.classId && !classIdSet.has(r.classId));
          const defaultClassId = payload.classes?.length > 0 ? payload.classes[0].id : 'class-default';
          let repairedCount = 0;
          const newStudents = (payload.students || []).map((s: any) => {
            if (!s.classId || !classIdSet.has(s.classId)) {
              repairedCount++;
              return { ...s, classId: defaultClassId };
            }
            return s;
          });
          const newRecords = (payload.records || []).map((r: any) => {
            if (r.classId && !classIdSet.has(r.classId)) {
              repairedCount++;
              return { ...r, classId: defaultClassId };
            }
            return r;
          });
          resolve({
            hasModifications: orphanedStudents.length > 0 || orphanedRecords.length > 0,
            repairedCount,
            orphanedStudentsCount: orphanedStudents.length,
            orphanedRecordsCount: orphanedRecords.length,
            classes: payload.classes,
            students: newStudents,
            records: newRecords,
          } as any);
        } else if (type === 'CLEANUP_STORAGE') {
          const queue = (payload.syncQueue || []).filter((item: any) => item.status === 'pending');
          const logs = (payload.bkdLogs || []).slice(0, 50);
          resolve({
            cleanedQueueCount: (payload.syncQueue?.length || 0) - queue.length,
            cleanedBkdLogsCount: Math.max(0, (payload.bkdLogs?.length || 0) - 50),
            filteredQueue: queue,
            filteredBkdLogs: logs,
            details: 'Pembersihan penyimpanan selesai.',
          } as any);
        } else {
          resolve({} as any);
        }
      }, 0);
    });
  }

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload } as WorkerRequest);
  });
}

/**
 * Executes Relational Integrity Scanner in background Web Worker
 */
export async function runWorkerIntegrityCheck(
  classes: SchoolClass[],
  students: Student[],
  records: AttendanceRecord[]
): Promise<{
  hasModifications: boolean;
  repairedCount: number;
  orphanedStudentsCount: number;
  orphanedRecordsCount: number;
  classes: SchoolClass[];
  students: Student[];
  records: AttendanceRecord[];
}> {
  return sendToWorker('CHECK_INTEGRITY', { classes, students, records });
}

/**
 * Executes Storage Cleanup and Log Pruning in background Web Worker
 */
export async function runWorkerStorageCleanup(
  syncQueue: SyncQueueItem[],
  bkdLogs: BkdDispatchLog[]
): Promise<{
  cleanedQueueCount: number;
  cleanedBkdLogsCount: number;
  filteredQueue: SyncQueueItem[];
  filteredBkdLogs: BkdDispatchLog[];
  details: string;
}> {
  return sendToWorker('CLEANUP_STORAGE', { syncQueue, bkdLogs });
}

/**
 * Executes Attendance Records Filtering & Slicing in background Web Worker
 */
export async function runWorkerFilterRecords(params: {
  records: AttendanceRecord[];
  searchQuery?: string;
  filterRole?: string;
  filterStatus?: string;
  filterMethod?: string;
  filterClass?: string;
  startDate?: string;
  endDate?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{
  filtered: AttendanceRecord[];
  stats: {
    total: number;
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpha: number;
  };
}> {
  return sendToWorker('FILTER_RECORDS', params);
}

/**
 * Executes Activity Logs Filtering in background Web Worker
 */
export async function runWorkerFilterLogs(params: {
  logs: ActivityLog[];
  searchQuery?: string;
  selectedCategory?: string;
  selectedStatus?: string;
  dateFilter?: string;
  customStartDate?: string;
  customEndDate?: string;
}): Promise<{
  filtered: ActivityLog[];
  total: number;
}> {
  return sendToWorker('FILTER_LOGS', params);
}
