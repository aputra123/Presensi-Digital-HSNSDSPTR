/**
 * Dedicated Data Processor Web Worker
 * Offloads CPU-intensive operations (integrity scans, storage cleanup, large dataset filtering & sorting)
 * from the main thread to prevent UI freezing and ensure a responsive 60fps experience.
 */

// Worker message request type
export interface WorkerRequest {
  id: string;
  type: 'CHECK_INTEGRITY' | 'CLEANUP_STORAGE' | 'FILTER_RECORDS' | 'FILTER_LOGS';
  payload: any;
}

// Worker message response type
export interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

// Self-contained integrity check logic inside Worker
function handleIntegrityCheck(payload: { classes: any[]; students: any[]; records: any[] }) {
  const { classes = [], students = [], records = [] } = payload;
  const classIdSet = new Set(classes.map((c: any) => c.id));

  const orphanedStudents = students.filter((s: any) => !s.classId || !classIdSet.has(s.classId));
  const orphanedRecords = records.filter((r: any) => r.classId && !classIdSet.has(r.classId));

  const defaultClassId = classes.length > 0 ? classes[0].id : 'class-default';

  let repairedCount = 0;
  let newStudents = students;
  let newRecords = records;

  if (orphanedStudents.length > 0) {
    newStudents = students.map((s: any) => {
      if (!s.classId || !classIdSet.has(s.classId)) {
        repairedCount++;
        return { ...s, classId: defaultClassId };
      }
      return s;
    });
  }

  if (orphanedRecords.length > 0) {
    newRecords = records.map((r: any) => {
      if (r.classId && !classIdSet.has(r.classId)) {
        repairedCount++;
        return { ...r, classId: defaultClassId };
      }
      return r;
    });
  }

  return {
    hasModifications: orphanedStudents.length > 0 || orphanedRecords.length > 0,
    repairedCount,
    orphanedStudentsCount: orphanedStudents.length,
    orphanedRecordsCount: orphanedRecords.length,
    classes,
    students: newStudents,
    records: newRecords,
  };
}

// Self-contained filter records logic inside Worker
function handleFilterRecords(payload: {
  records: any[];
  searchQuery?: string;
  filterRole?: string;
  filterStatus?: string;
  filterMethod?: string;
  filterClass?: string;
  startDate?: string;
  endDate?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const {
    records = [],
    searchQuery = '',
    filterRole = 'all',
    filterStatus = 'all',
    filterMethod = 'all',
    filterClass = 'all',
    startDate = '',
    endDate = '',
    sortField = 'time',
    sortOrder = 'desc',
  } = payload;

  const query = searchQuery.trim().toLowerCase();

  const filtered = records.filter((rec: any) => {
    // Search query
    if (query) {
      const matchName = rec.personName?.toLowerCase().includes(query);
      const matchId = rec.identifier?.toLowerCase().includes(query);
      const matchClass = rec.classOrSubject?.toLowerCase().includes(query);
      const matchNote = rec.note?.toLowerCase().includes(query);
      if (!matchName && !matchId && !matchClass && !matchNote) return false;
    }

    // Role
    if (filterRole === 'teachers' && rec.personType !== 'teacher') return false;
    if (filterRole === 'students' && rec.personType !== 'student') return false;

    // Status
    if (filterStatus !== 'all' && rec.status !== filterStatus) return false;

    // Method
    if (filterMethod !== 'all' && rec.method !== filterMethod) return false;

    // Class
    if (filterClass !== 'all' && rec.classId !== filterClass) return false;

    // Date range
    if (startDate && rec.date < startDate) return false;
    if (endDate && rec.date > endDate) return false;

    return true;
  });

  // Sort
  filtered.sort((a: any, b: any) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    if (sortField === 'time') {
      const dateA = `${a.date || ''} ${a.time || ''}`;
      const dateB = `${b.date || ''} ${b.time || ''}`;
      return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }

    if (typeof valA === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });

  // Calculate summary stats
  const stats = {
    total: filtered.length,
    hadir: 0,
    terlambat: 0,
    izin: 0,
    sakit: 0,
    alpha: 0,
  };

  for (let i = 0; i < filtered.length; i++) {
    const s = filtered[i].status;
    if (s === 'hadir') stats.hadir++;
    else if (s === 'terlambat') stats.terlambat++;
    else if (s === 'izin') stats.izin++;
    else if (s === 'sakit') stats.sakit++;
    else if (s === 'alpa' || s === 'alpha') stats.alpha++;
  }

  return {
    filtered,
    stats,
  };
}

// Self-contained filter logs logic inside Worker
function handleFilterLogs(payload: {
  logs: any[];
  searchQuery?: string;
  selectedCategory?: string;
  selectedStatus?: string;
  dateFilter?: string;
  customStartDate?: string;
  customEndDate?: string;
}) {
  const {
    logs = [],
    searchQuery = '',
    selectedCategory = 'all',
    selectedStatus = 'all',
    dateFilter = 'all',
    customStartDate = '',
    customEndDate = '',
  } = payload;

  const q = searchQuery.trim().toLowerCase();
  const now = new Date();

  let weekAgoStr = '';
  let monthAgoStr = '';

  if (dateFilter === 'week') {
    const w = new Date(now);
    w.setDate(w.getDate() - 7);
    weekAgoStr = w.toISOString().split('T')[0];
  } else if (dateFilter === 'month') {
    const m = new Date(now);
    m.setDate(m.getDate() - 30);
    monthAgoStr = m.toISOString().split('T')[0];
  }

  const todayStr = now.toISOString().split('T')[0];

  const filtered = logs.filter((log: any) => {
    if (q) {
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchDesc = log.description?.toLowerCase().includes(q);
      const matchActor = log.actor?.name?.toLowerCase().includes(q) || log.actor?.role?.toLowerCase().includes(q);
      const matchTarget = log.targetName?.toLowerCase().includes(q);
      const matchDevice = log.deviceInfo?.toLowerCase().includes(q);
      if (!matchAction && !matchDesc && !matchActor && !matchTarget && !matchDevice) return false;
    }

    if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && log.status !== selectedStatus) return false;

    if (dateFilter === 'today' && log.date !== todayStr) return false;
    if (dateFilter === 'week' && log.date < weekAgoStr) return false;
    if (dateFilter === 'month' && log.date < monthAgoStr) return false;
    if (dateFilter === 'custom') {
      if (customStartDate && log.date < customStartDate) return false;
      if (customEndDate && log.date > customEndDate) return false;
    }

    return true;
  });

  return { filtered, total: filtered.length };
}

// Storage cleanup logic inside Worker
function handleCleanupStorage(payload: { syncQueue?: any[]; bkdLogs?: any[] }) {
  const { syncQueue = [], bkdLogs = [] } = payload;
  const filteredQueue = syncQueue.filter((item: any) => item.status === 'pending');
  const cleanedQueueCount = syncQueue.length - filteredQueue.length;

  const filteredBkdLogs = bkdLogs.slice(0, 50);
  const cleanedBkdLogsCount = Math.max(0, bkdLogs.length - 50);

  return {
    cleanedQueueCount,
    cleanedBkdLogsCount,
    filteredQueue,
    filteredBkdLogs,
    details: `Dibersihkan ${cleanedQueueCount} item antrian sinkronisasi dan ${cleanedBkdLogsCount} log historis lama.`,
  };
}

// Worker message listener
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;

  try {
    let result: any;
    switch (type) {
      case 'CHECK_INTEGRITY':
        result = handleIntegrityCheck(payload);
        break;
      case 'CLEANUP_STORAGE':
        result = handleCleanupStorage(payload);
        break;
      case 'FILTER_RECORDS':
        result = handleFilterRecords(payload);
        break;
      case 'FILTER_LOGS':
        result = handleFilterLogs(payload);
        break;
      default:
        throw new Error(`Unknown worker operation: ${type}`);
    }

    const response: WorkerResponse = { id, success: true, data: result };
    self.postMessage(response);
  } catch (err: any) {
    const response: WorkerResponse = {
      id,
      success: false,
      error: err?.message || 'Worker processing error',
    };
    self.postMessage(response);
  }
};
