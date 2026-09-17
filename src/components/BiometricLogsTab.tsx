import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Fingerprint,
  Camera,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Calendar,
  User,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Trash2,
  X,
  Info,
  Check,
  Building2,
  Smartphone,
  Download,
  AlertTriangle,
  AlertOctagon,
  MapPin,
  ExternalLink,
  TrendingUp,
  BarChart3,
  Activity,
  Copy,
  ShieldAlert,
  Zap,
  HeartPulse,
  Shield,
  Archive,
  CheckSquare,
  Square,
  CheckSquare2,
  FileText,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BiometricLog, BiometricSeverity, Teacher, Student, SchoolConfig, ToastNotification } from '../types';
import { formatDateIndo, downloadCsv } from '../utils/soundAndDate';
import {
  exportBiometricLogsPdf,
  downloadStructuredBiometricCsv,
  getLogVerificationHealth,
  getBiometricHealthDistribution,
} from '../utils/biometricExportUtils';
import { BiometricLocationMap } from './BiometricLocationMap';
import { BiometricUserProfileCard } from './BiometricUserProfileCard';
import { BiometricCleanupModal } from './BiometricCleanupModal';

export interface ConsecutiveFailureIncident {
  personId: string;
  personName: string;
  personType: 'student' | 'teacher';
  failCount: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  attempts: BiometricLog[];
  firstLogId: string;
  lastLogId: string;
  incidentKey: string;
}

interface BiometricLogsTabProps {
  logs: BiometricLog[];
  teachers?: Teacher[];
  students?: Student[];
  config?: SchoolConfig;
  onRefresh?: () => void;
  onClearLogs?: () => void;
  onUpdateLogs?: (newLogs: BiometricLog[]) => void;
  onAddNotification?: (notification: ToastNotification) => void;
  onAddBiometricLog?: (log: BiometricLog) => void;
  onAddMultipleBiometricLogs?: (logs: BiometricLog[]) => void;
}

type SortField = 'timestamp' | 'name' | 'matchScore' | 'status' | 'severity' | 'method' | 'personType';
type SortOrder = 'asc' | 'desc';
type DateFilterMode = 'all' | 'today' | '7days' | 'month' | 'custom';
type ChartViewType = 'area' | 'bar';

export const getLogSeverity = (log: BiometricLog): BiometricSeverity => {
  if (log.severity) return log.severity;
  if (log.status === 'failed') return 'error';
  if ((log.matchScore ?? 100) < 85 || (log.location && log.location.inRadius === false)) {
    return 'warning';
  }
  return 'info';
};

/**
 * Detects 3 or more consecutive failed biometric attempts for a single user within a given window (default: 5 minutes).
 */
export const detectConsecutiveFailures = (
  logs: BiometricLog[],
  windowMinutes: number = 5
): ConsecutiveFailureIncident[] => {
  const grouped = new Map<string, BiometricLog[]>();

  logs.forEach((log) => {
    const key = log.personId || log.personName;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(log);
  });

  const incidents: ConsecutiveFailureIncident[] = [];

  grouped.forEach((userLogs, userKey) => {
    // Sort chronologically ascending
    const sorted = [...userLogs].sort((a, b) => {
      const parseTime = (item: BiometricLog) => {
        const d = item.date || item.timestamp?.split(' ')[0] || '1970-01-01';
        const t = item.time || item.timestamp?.split(' ')[1] || '00:00:00';
        return new Date(`${d}T${t}`).getTime();
      };
      return parseTime(a) - parseTime(b);
    });

    let consecutiveFails: BiometricLog[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const log = sorted[i];
      const isFail = log.status === 'failed' || getLogSeverity(log) === 'error';

      if (isFail) {
        consecutiveFails.push(log);

        if (consecutiveFails.length >= 3) {
          const firstInWindow = consecutiveFails[consecutiveFails.length - 3];
          const lastInWindow = log;

          const parseTime = (item: BiometricLog) => {
            const d = item.date || item.timestamp?.split(' ')[0] || '1970-01-01';
            const t = item.time || item.timestamp?.split(' ')[1] || '00:00:00';
            return new Date(`${d}T${t}`).getTime();
          };

          const timeMsA = parseTime(firstInWindow);
          const timeMsB = parseTime(lastInWindow);
          const diffMinutes = Math.max(0, (timeMsB - timeMsA) / (1000 * 60));

          if (diffMinutes <= windowMinutes) {
            const incidentKey = `${userKey}_${firstInWindow.id}_${lastInWindow.id}`;
            if (!incidents.some((inc) => inc.incidentKey === incidentKey)) {
              const startD = firstInWindow.date || firstInWindow.timestamp?.split(' ')[0] || '';
              const startT = firstInWindow.time || firstInWindow.timestamp?.split(' ')[1] || '';
              const endD = lastInWindow.date || lastInWindow.timestamp?.split(' ')[0] || '';
              const endT = lastInWindow.time || lastInWindow.timestamp?.split(' ')[1] || '';

              incidents.push({
                personId: lastInWindow.personId,
                personName: lastInWindow.personName,
                personType: lastInWindow.personType || 'student',
                failCount: consecutiveFails.length,
                startTime: `${startD} ${startT}`.trim(),
                endTime: `${endD} ${endT}`.trim(),
                durationMinutes: Math.round(diffMinutes * 10) / 10,
                attempts: [...consecutiveFails],
                firstLogId: firstInWindow.id,
                lastLogId: lastInWindow.id,
                incidentKey,
              });
            }
          }
        }
      } else {
        // A successful attempt resets consecutive failure chain
        consecutiveFails = [];
      }
    }
  });

  return incidents;
};

export const BiometricLogsTab: React.FC<BiometricLogsTabProps> = ({
  logs = [],
  teachers = [],
  students = [],
  config,
  onRefresh,
  onClearLogs,
  onUpdateLogs,
  onAddNotification,
  onAddBiometricLog,
  onAddMultipleBiometricLogs,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [personTypeFilter, setPersonTypeFilter] = useState<'all' | 'teacher' | 'student'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'face_scan' | 'webauthn_fingerprint'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Chart View Preference
  const [chartView, setChartView] = useState<ChartViewType>('area');
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(true);

  // Selected Log Modal for Audit Detail
  const [selectedLogDetail, setSelectedLogDetail] = useState<BiometricLog | null>(null);
  const [copiedAuditId, setCopiedAuditId] = useState(false);

  // Multi-selection and Bulk Action State
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  // Cleanup Old Logs Modal & Auto-Cleanup Policy State
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [autoCleanupPolicy, setAutoCleanupPolicy] = useState<'off' | '30' | '90' | '180'>(() => {
    return (localStorage.getItem('biometric_auto_cleanup_policy') as any) || '90';
  });

  const handleUpdateAutoCleanupPolicy = (policy: 'off' | '30' | '90' | '180') => {
    setAutoCleanupPolicy(policy);
    localStorage.setItem('biometric_auto_cleanup_policy', policy);
    if (onAddNotification) {
      onAddNotification({
        id: `policy_update_${Date.now()}`,
        title: '⚙️ Kebijakan Auto-Cleanup Disimpan',
        message:
          policy === 'off'
            ? 'Kebijakan auto-cleanup dinonaktifkan. Log hanya dibersihkan secara manual.'
            : `Kebijakan auto-cleanup diatur ke ${policy} hari. Sistem akan memantau log usang untuk menjaga performa.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
  };

  // Check logs exceeding the active auto-cleanup policy
  const logsExceedingPolicy = useMemo(() => {
    if (autoCleanupPolicy === 'off') return [];
    const retentionDays = Number(autoCleanupPolicy);
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    return logs.filter((log) => {
      const logDateStr = log.date || log.timestamp?.split(' ')[0] || '1970-01-01';
      const logTimeStr = log.time || log.timestamp?.split(' ')[1] || '00:00:00';
      const logTime = new Date(`${logDateStr}T${logTimeStr}`).getTime();
      return logTime < cutoffTime;
    });
  }, [logs, autoCleanupPolicy]);

  // Security Incident Tracking & Notification Trigger State
  const notifiedIncidentsRef = useRef<Set<string>>(new Set());
  const [dismissedIncidents, setDismissedIncidents] = useState<Set<string>>(new Set());
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);

  // Automated Notification Trigger for 3 consecutive failures within 5 minutes
  useEffect(() => {
    const incidents = detectConsecutiveFailures(logs, 5);
    incidents.forEach((inc) => {
      if (!notifiedIncidentsRef.current.has(inc.incidentKey)) {
        notifiedIncidentsRef.current.add(inc.incidentKey);
        if (onAddNotification) {
          onAddNotification({
            id: `bio-alert-3xfail-${inc.personId}-${Date.now()}`,
            title: '⚠️ Peringatan Keamanan Biometrik (3x Gagal)',
            message: `Peringatan: Pengguna ${inc.personName} (${inc.personType === 'student' ? 'Siswa' : 'Guru/GTK'}) mengalami 3 kali kegagalan otentikasi biometrik berturut-turut dalam rentang ${inc.durationMinutes <= 1 ? '<1' : inc.durationMinutes} menit (${inc.startTime} s.d ${inc.endTime}). Mohon verifikasi log audit dan status perangkat!`,
            type: 'system',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            read: false,
          });
        }
      }
    });
  }, [logs, onAddNotification]);

  // Executive Operational Health Summary Data for TODAY
  const todayOperationalStats = useMemo(() => {
    const todayLogs = logs.filter((l) => {
      const logDate = l.date || l.timestamp?.split(' ')[0] || '';
      return logDate === todayStr;
    });

    const totalToday = todayLogs.length;
    const successToday = todayLogs.filter((l) => l.status === 'success').length;
    const failedToday = todayLogs.filter((l) => l.status === 'failed' || getLogSeverity(l) === 'error').length;
    const warningToday = todayLogs.filter((l) => getLogSeverity(l) === 'warning').length;

    const successPercent = totalToday > 0 ? (successToday / totalToday) * 100 : 100;
    const failPercent = totalToday > 0 ? (failedToday / totalToday) * 100 : 0;

    // Detailed Success-to-Failure Ratio Display
    let ratioDisplay = '100% (0 Gagal)';
    if (totalToday === 0) {
      ratioDisplay = '0 : 0 (Belum ada aktivitas hari ini)';
    } else if (failedToday === 0) {
      ratioDisplay = `${successToday} : 0 (100% Sempurna)`;
    } else {
      const ratioNum = (successToday / failedToday).toFixed(1);
      ratioDisplay = `${ratioNum} : 1 (${successToday} Sukses / ${failedToday} Gagal)`;
    }

    // Consecutive 3x failures within 5 minutes in today's logs
    const todayIncidents = detectConsecutiveFailures(todayLogs, 5);
    const activeIncidents = todayIncidents.filter((inc) => !dismissedIncidents.has(inc.incidentKey));

    // Determine Operational Health Condition
    let healthCondition: 'optimal' | 'warning' | 'critical' = 'optimal';
    let healthTitle = 'Kondisi Operasional Normal';
    let healthBadgeText = '🟢 Operasional Optimal';
    let healthBadgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let healthDescription = 'Seluruh sesi otentikasi biometrik wajah dan sensor passkey WebAuthn berjalan stabil tanpa indikasi anomali.';

    if (activeIncidents.length > 0 || failPercent > 25) {
      healthCondition = 'critical';
      healthTitle = activeIncidents.length > 0
        ? `Peringatan Keamanan: Terdeteksi ${activeIncidents.length} Kasus Gagal Beruntun (3x / <5 Menit)`
        : 'Tingkat Kegagalan Tinggi (>25%)';
      healthBadgeText = '🚨 Anomali Terdeteksi';
      healthBadgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
      healthDescription = 'Ada personil yang mengalami 3 kali kegagalan otentikasi berturut-turut dalam waktu 5 menit. Potensi foto tidak jelas, wajah terhalang, atau brute-force spoofing.';
    } else if (failPercent > 10 || warningToday > 0) {
      healthCondition = 'warning';
      healthTitle = 'Perhatian: Ada Sesi Membutuhkan Kalibrasi';
      healthBadgeText = '🟡 Perlu Perhatian';
      healthBadgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
      healthDescription = 'Beberapa verifikasi menghasilkan skor akurasi di bawah 85% atau lokasi berada di dekat batas radius geofence.';
    }

    const avgMatchToday =
      totalToday > 0
        ? (todayLogs.reduce((acc, curr) => acc + (curr.matchScore || 0), 0) / totalToday).toFixed(1)
        : '0.0';

    const inRadiusCount = todayLogs.filter((l) => l.location?.inRadius === true).length;
    const inRadiusPercent = totalToday > 0 ? Math.round((inRadiusCount / totalToday) * 100) : 100;

    return {
      todayLogs,
      totalToday,
      successToday,
      failedToday,
      warningToday,
      successPercent: successPercent.toFixed(1),
      failPercent: failPercent.toFixed(1),
      ratioDisplay,
      healthCondition,
      healthTitle,
      healthBadgeText,
      healthBadgeBg,
      healthDescription,
      avgMatchToday,
      inRadiusPercent,
      todayIncidents,
      activeIncidents,
    };
  }, [logs, todayStr, dismissedIncidents]);

  // Handler to manually trigger a test simulation of 3 consecutive failed attempts within 5 minutes
  const handleTriggerConsecutiveFailSimulation = () => {
    setIsSimulationRunning(true);
    const targetUser = students[0] || teachers[0] || { id: 'std_test', name: 'Siswa Percobaan AI' };
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');

    const makeTimeStr = (minutesAgo: number, secondsOffset: number = 0) => {
      const d = new Date(now.getTime() - minutesAgo * 60 * 1000 - secondsOffset * 1000);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const simTime1 = makeTimeStr(3, 30);
    const simTime2 = makeTimeStr(2, 10);
    const simTime3 = makeTimeStr(0, 45);

    const testLogs: BiometricLog[] = [
      {
        id: `sim_fail_${Date.now()}_1`,
        timestamp: `${dateStr} ${simTime1}`,
        date: dateStr,
        time: simTime1,
        personId: targetUser.id,
        personName: targetUser.name,
        personType: 'nisn' in targetUser ? 'student' : 'teacher',
        type: 'masuk',
        status: 'failed',
        severity: 'error',
        method: 'face_scan',
        matchScore: 39.5,
        cameraFacing: 'user',
        deviceInfo: 'Browser Simulator (Anti-Spoofing Test)',
        ipAddress: '180.252.164.99',
        location: {
          lat: -1.86235,
          lng: 124.78912,
          address: 'Lokasi Uji Simulasi Keamanan SMAN 1',
          distanceMeter: 15,
          inRadius: true,
        },
        notes: 'Simulasi Kegagalan 1/3: Wajah terhalang / pencahayaan buruk',
      },
      {
        id: `sim_fail_${Date.now()}_2`,
        timestamp: `${dateStr} ${simTime2}`,
        date: dateStr,
        time: simTime2,
        personId: targetUser.id,
        personName: targetUser.name,
        personType: 'nisn' in targetUser ? 'student' : 'teacher',
        type: 'masuk',
        status: 'failed',
        severity: 'error',
        method: 'face_scan',
        matchScore: 36.2,
        cameraFacing: 'user',
        deviceInfo: 'Browser Simulator (Anti-Spoofing Test)',
        ipAddress: '180.252.164.99',
        location: {
          lat: -1.86235,
          lng: 124.78912,
          address: 'Lokasi Uji Simulasi Keamanan SMAN 1',
          distanceMeter: 15,
          inRadius: true,
        },
        notes: 'Simulasi Kegagalan 2/3: Liveness detection gagal memenuhi toleransi',
      },
      {
        id: `sim_fail_${Date.now()}_3`,
        timestamp: `${dateStr} ${simTime3}`,
        date: dateStr,
        time: simTime3,
        personId: targetUser.id,
        personName: targetUser.name,
        personType: 'nisn' in targetUser ? 'student' : 'teacher',
        type: 'masuk',
        status: 'failed',
        severity: 'error',
        method: 'face_scan',
        matchScore: 32.8,
        cameraFacing: 'user',
        deviceInfo: 'Browser Simulator (Anti-Spoofing Test)',
        ipAddress: '180.252.164.99',
        location: {
          lat: -1.86235,
          lng: 124.78912,
          address: 'Lokasi Uji Simulasi Keamanan SMAN 1',
          distanceMeter: 15,
          inRadius: true,
        },
        notes: 'Simulasi Kegagalan 3/3: Pemicu 3x gagal <5 menit aktif!',
      },
    ];

    if (onAddMultipleBiometricLogs) {
      onAddMultipleBiometricLogs(testLogs);
    } else if (onAddBiometricLog) {
      testLogs.forEach((l) => onAddBiometricLog(l));
    }

    setTimeout(() => {
      setIsSimulationRunning(false);
    }, 600);
  };

  // Build unique user list for the filter dropdown
  const uniqueUsers = useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; type: 'teacher' | 'student'; identifier?: string }>();

    // From teachers list
    teachers.forEach((t) => {
      userMap.set(t.id, {
        id: t.id,
        name: t.name,
        type: 'teacher',
        identifier: t.nip,
      });
    });

    // From students list
    students.forEach((s) => {
      userMap.set(s.id, {
        id: s.id,
        name: s.name,
        type: 'student',
        identifier: s.nisn,
      });
    });

    // Also include anyone in logs who might not be in master tables
    logs.forEach((l) => {
      if (l.personId && !userMap.has(l.personId)) {
        userMap.set(l.personId, {
          id: l.personId,
          name: l.personName,
          type: l.personType || 'teacher',
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [teachers, students, logs]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const isFilterActive =
    searchTerm !== '' ||
    selectedUserId !== 'all' ||
    personTypeFilter !== 'all' ||
    statusFilter !== 'all' ||
    severityFilter !== 'all' ||
    methodFilter !== 'all' ||
    dateFilterMode !== 'all';

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedUserId('all');
    setPersonTypeFilter('all');
    setStatusFilter('all');
    setSeverityFilter('all');
    setMethodFilter('all');
    setDateFilterMode('all');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setSortField('timestamp');
    setSortOrder('desc');
  };

  // Filter and Sort Logic
  const filteredAndSortedLogs = useMemo(() => {
    const result = logs.filter((log) => {
      const severity = getLogSeverity(log);

      // 1. Search Query (by Student/Teacher Name, User ID, Date, Biometric Method, Health Status, Device, Notes, IP, GPS Address)
      const q = searchTerm.toLowerCase().trim();
      const logDate = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : '');
      const logTime = log.time || (log.timestamp ? log.timestamp.split(' ')[1] : '');
      const methodKeywords =
        log.method === 'face_scan'
          ? 'face scan wajah kamera pengenalan biometrik liveness visual'
          : 'webauthn fingerprint sidik jari passkey sensor hardware fido fido2';
      const statusKeywords = log.status === 'success' ? 'sukses lolos valid terverifikasi' : 'gagal ditolak anomali error tidak valid';
      const healthInfo = getLogVerificationHealth(log);

      const matchSearch =
        !q ||
        log.personName.toLowerCase().includes(q) ||
        (log.personId && log.personId.toLowerCase().includes(q)) ||
        logDate.toLowerCase().includes(q) ||
        logTime.toLowerCase().includes(q) ||
        methodKeywords.includes(q) ||
        statusKeywords.includes(q) ||
        healthInfo.label.toLowerCase().includes(q) ||
        healthInfo.sublabel.toLowerCase().includes(q) ||
        (log.personType === 'student' ? 'siswa murid peserta didik' : 'guru gtk pendidik pengajar asn').includes(q) ||
        (log.deviceInfo && log.deviceInfo.toLowerCase().includes(q)) ||
        (log.notes && log.notes.toLowerCase().includes(q)) ||
        (log.ipAddress && log.ipAddress.includes(q)) ||
        (log.location?.address && log.location.address.toLowerCase().includes(q));

      // 2. Specific Teacher/User ID Selector
      const matchUserId = selectedUserId === 'all' || log.personId === selectedUserId;

      // 3. Person Type
      const matchPersonType =
        personTypeFilter === 'all' || (log.personType && log.personType === personTypeFilter);

      // 4. Status Filter
      const matchStatus = statusFilter === 'all' || log.status === statusFilter;

      // 5. Severity Filter
      const matchSeverity = severityFilter === 'all' || severity === severityFilter;

      // 6. Method Filter
      const matchMethod = methodFilter === 'all' || log.method === methodFilter;

      // 7. Date Range Filter
      let matchDate = true;

      if (dateFilterMode === 'today') {
        matchDate = logDate === todayStr;
      } else if (dateFilterMode === '7days') {
        const d = new Date(logDate);
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        matchDate = diffDays <= 7;
      } else if (dateFilterMode === 'month') {
        const logMonth = logDate.substring(0, 7);
        const currentMonth = todayStr.substring(0, 7);
        matchDate = logMonth === currentMonth;
      } else if (dateFilterMode === 'custom') {
        if (startDate && endDate) {
          matchDate = logDate >= startDate && logDate <= endDate;
        } else if (startDate) {
          matchDate = logDate >= startDate;
        } else if (endDate) {
          matchDate = logDate <= endDate;
        }
      }

      return (
        matchSearch &&
        matchUserId &&
        matchPersonType &&
        matchStatus &&
        matchSeverity &&
        matchMethod &&
        matchDate
      );
    });

    // Sorting
    return result.sort((a, b) => {
      let comp = 0;
      if (sortField === 'timestamp') {
        const timeA = `${a.date || ''} ${a.time || a.timestamp || ''}`;
        const timeB = `${b.date || ''} ${b.time || b.timestamp || ''}`;
        comp = timeA.localeCompare(timeB);
      } else if (sortField === 'name') {
        comp = a.personName.localeCompare(b.personName, 'id');
      } else if (sortField === 'matchScore') {
        comp = (a.matchScore || 0) - (b.matchScore || 0);
      } else if (sortField === 'status') {
        comp = a.status.localeCompare(b.status);
      } else if (sortField === 'severity') {
        const sevOrder = { error: 3, warning: 2, info: 1 };
        comp = (sevOrder[getLogSeverity(a)] || 0) - (sevOrder[getLogSeverity(b)] || 0);
      } else if (sortField === 'method') {
        comp = a.method.localeCompare(b.method);
      } else if (sortField === 'personType') {
        const typeA = a.personType || 'teacher';
        const typeB = b.personType || 'teacher';
        comp = typeA.localeCompare(typeB);
      }

      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [
    logs,
    searchTerm,
    selectedUserId,
    personTypeFilter,
    statusFilter,
    severityFilter,
    methodFilter,
    dateFilterMode,
    startDate,
    endDate,
    todayStr,
    sortField,
    sortOrder,
  ]);

  // Aggregate 30-Day Biometric Authentication Trend Data for Recharts
  const last30DaysChartData = useMemo(() => {
    // Generate dates for the past 30 days up to today
    const dateMap = new Map<
      string,
      {
        date: string;
        displayDate: string;
        success: number;
        failed: number;
        total: number;
        totalScore: number;
        scoreCount: number;
      }
    >();

    const baseDate = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const dayNum = d.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const displayDate = `${dayNum} ${monthNames[d.getMonth()]}`;

      dateMap.set(isoDate, {
        date: isoDate,
        displayDate,
        success: 0,
        failed: 0,
        total: 0,
        totalScore: 0,
        scoreCount: 0,
      });
    }

    // Populate data from all logs
    logs.forEach((log) => {
      const logDate = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : '');
      if (dateMap.has(logDate)) {
        const item = dateMap.get(logDate)!;
        item.total += 1;
        if (log.status === 'success') {
          item.success += 1;
        } else {
          item.failed += 1;
        }
        if (typeof log.matchScore === 'number' && log.matchScore > 0) {
          item.totalScore += log.matchScore;
          item.scoreCount += 1;
        }
      }
    });

    return Array.from(dateMap.values()).map((item) => ({
      date: item.date,
      displayDate: item.displayDate,
      total: item.total,
      success: item.success,
      failed: item.failed,
      avgScore: item.scoreCount > 0 ? Number((item.totalScore / item.scoreCount).toFixed(1)) : 0,
    }));
  }, [logs]);

  // Overall 30-Day Metrics from Chart Data
  const chart30DayStats = useMemo(() => {
    const totalEvents = last30DaysChartData.reduce((acc, curr) => acc + curr.total, 0);
    const totalSuccess = last30DaysChartData.reduce((acc, curr) => acc + curr.success, 0);
    const totalFailed = last30DaysChartData.reduce((acc, curr) => acc + curr.failed, 0);
    const peakDay = [...last30DaysChartData].sort((a, b) => b.total - a.total)[0];
    const successRate = totalEvents > 0 ? ((totalSuccess / totalEvents) * 100).toFixed(1) : '100.0';

    return {
      totalEvents,
      totalSuccess,
      totalFailed,
      successRate,
      peakDay: peakDay?.total > 0 ? `${peakDay.displayDate} (${peakDay.total} sesi)` : '0 Sesi',
    };
  }, [last30DaysChartData]);

  const successCount = filteredAndSortedLogs.filter((l) => l.status === 'success').length;
  const failCount = filteredAndSortedLogs.filter((l) => l.status === 'failed' || getLogSeverity(l) === 'error').length;
  const avgMatch =
    filteredAndSortedLogs.length > 0
      ? (
          filteredAndSortedLogs.reduce((acc, curr) => acc + (curr.matchScore || 0), 0) /
          filteredAndSortedLogs.length
        ).toFixed(1)
      : '0.0';

  // Overall verification health breakdown for filtered dataset
  const healthDistribution = useMemo(() => {
    return getBiometricHealthDistribution(filteredAndSortedLogs);
  }, [filteredAndSortedLogs]);

  // Export to CSV Functionality with full metadata
  const handleExportCsv = () => {
    if (filteredAndSortedLogs.length === 0) {
      alert('Tidak ada data log biometrik yang cocok untuk diekspor!');
      return;
    }

    const headers = [
      'No',
      'ID Log',
      'Tanggal',
      'Waktu',
      'Nama Personil',
      'ID Personil (NIP/NISN)',
      'Kategori',
      'Tipe Sesi',
      'Tingkat Keparahan (Severity)',
      'Status Verifikasi',
      'Metode Biometrik',
      'Skor Akurasi (%)',
      'Perangkat & Sensor',
      'Alamat IP',
      'Latitude GPS',
      'Longitude GPS',
      'Radius Geofence (Meter)',
      'Valid Geofence (In Radius)',
      'Lokasi / Alamat',
      'Catatan Audit Anti-Spoofing',
    ];

    const rows = filteredAndSortedLogs.map((l, idx) => {
      const sev = getLogSeverity(l);
      const sevLabel = sev === 'error' ? 'Error (Gagal)' : sev === 'warning' ? 'Warning (Peringatan)' : 'Info (Normal)';
      return [
        idx + 1,
        l.id,
        l.date || l.timestamp?.split(' ')[0] || '',
        l.time || l.timestamp?.split(' ')[1] || '',
        `"${l.personName.replace(/"/g, '""')}"`,
        `"${(l.personId || '').replace(/"/g, '""')}"`,
        l.personType === 'student' ? 'Siswa' : 'Guru / GTK',
        l.type ? (l.type === 'masuk' ? 'Presensi Masuk' : 'Presensi Pulang') : 'Presensi Masuk',
        `"${sevLabel}"`,
        l.status === 'success' ? 'Lolos Validasi' : 'Ditolak / Gagal',
        l.method === 'face_scan' ? 'Face Scan Liveness AI' : 'WebAuthn FIDO2 Passkey',
        l.matchScore,
        `"${(l.deviceInfo || l.cameraFacing || '').replace(/"/g, '""')}"`,
        `"${(l.ipAddress || '-').replace(/"/g, '""')}"`,
        l.location?.lat ?? '',
        l.location?.lng ?? '',
        l.location?.distanceMeter ?? '',
        l.location?.inRadius !== undefined ? (l.location.inRadius ? 'YA (Dalam Radius)' : 'TIDAK (Luar Radius)') : '',
        `"${(l.location?.address || '-').replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCsv(`Log_Audit_Biometrik_SMAN1_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  // Export to PDF Audit Report Functionality
  const handleExportPdf = () => {
    if (filteredAndSortedLogs.length === 0) {
      alert('Tidak ada data log biometrik yang cocok untuk diekspor ke PDF!');
      return;
    }
    const filterDesc = `${dateFilterMode === 'all' ? 'Semua Waktu' : dateFilterMode === 'today' ? 'Hari Ini' : dateFilterMode === '7days' ? '7 Hari Terakhir' : dateFilterMode === 'month' ? 'Bulan Ini' : `${startDate} s.d ${endDate}`} | Status: ${statusFilter === 'all' ? 'Semua Status' : statusFilter === 'success' ? 'Sukses Lolos' : 'Gagal Ditolak'}${searchTerm ? ` | Cari: "${searchTerm}"` : ''}`;
    exportBiometricLogsPdf(filteredAndSortedLogs, config, filterDesc);
    if (onAddNotification) {
      onAddNotification({
        id: `pdf_exported_${Date.now()}`,
        title: '📄 Laporan Audit PDF Berhasil Dibuat',
        message: `Sebanyak ${filteredAndSortedLogs.length} rekaman log biometrik telah berhasil diekspor ke file PDF siap cetak.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
  };

  // Export Raw Structured CSV for External School Reporting Tools (Dapodik, BKD, etc.)
  const handleExportRawCsv = () => {
    if (filteredAndSortedLogs.length === 0) {
      alert('Tidak ada data log biometrik untuk diunduh sebagai Raw CSV!');
      return;
    }
    const dateStamp = new Date().toISOString().split('T')[0];
    const rawFileName = `raw_biometric_logs_structured_${dateStamp}.csv`;
    downloadStructuredBiometricCsv(filteredAndSortedLogs, rawFileName);
    if (onAddNotification) {
      onAddNotification({
        id: `raw_csv_exported_${Date.now()}`,
        title: '📊 Raw Data CSV Berhasil Diunduh',
        message: `Data mentah terstruktur sebanyak ${filteredAndSortedLogs.length} log siap diintegrasikan dengan sistem pelaporan eksternal sekolah.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
  };

  // Multi-Selection and Bulk Actions Handlers
  const handleToggleSelectLog = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (
      filteredAndSortedLogs.length > 0 &&
      filteredAndSortedLogs.every((l) => selectedLogIds.has(l.id))
    ) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(filteredAndSortedLogs.map((l) => l.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedLogIds(new Set());
  };

  const handleBulkMarkStatus = (newStatus: 'success' | 'failed') => {
    if (selectedLogIds.size === 0) return;
    const count = selectedLogIds.size;
    const updatedLogs = logs.map((l) => {
      if (selectedLogIds.has(l.id)) {
        return {
          ...l,
          status: newStatus,
          severity: (newStatus === 'success' ? 'info' : 'error') as BiometricSeverity,
          matchScore:
            newStatus === 'success'
              ? Math.max(l.matchScore || 0, 95)
              : Math.min(l.matchScore || 100, 42),
          notes: `${l.notes || ''} [Status diperbarui massal ke ${newStatus.toUpperCase()} oleh Administrator]`.trim(),
        };
      }
      return l;
    });

    if (onUpdateLogs) {
      onUpdateLogs(updatedLogs);
    }

    if (onAddNotification) {
      onAddNotification({
        id: `bulk_update_${Date.now()}`,
        title: '✓ Pembaruan Status Massal Berhasil',
        message: `Sebanyak ${count} log biometrik telah berhasil diubah statusnya menjadi "${
          newStatus === 'success' ? 'Lolos Validasi (Sukses)' : 'Ditolak (Gagal)'
        }".`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
    setSelectedLogIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedLogIds.size === 0) return;
    const count = selectedLogIds.size;
    const remainingLogs = logs.filter((l) => !selectedLogIds.has(l.id));

    if (onUpdateLogs) {
      onUpdateLogs(remainingLogs);
    } else if (onClearLogs && remainingLogs.length === 0) {
      onClearLogs();
    }

    if (onAddNotification) {
      onAddNotification({
        id: `bulk_delete_${Date.now()}`,
        title: '🗑️ Penghapusan Massal Selesai',
        message: `Sebanyak ${count} log biometrik terpilih telah berhasil dihapus dari database audit.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }
    setSelectedLogIds(new Set());
  };

  const handleBulkExportSelectedCsv = () => {
    const selectedLogsList = filteredAndSortedLogs.filter((l) => selectedLogIds.has(l.id));
    if (selectedLogsList.length === 0) return;

    const headers = [
      'No',
      'ID Log',
      'Tanggal',
      'Waktu',
      'Nama Personil',
      'ID Personil (NIP/NISN)',
      'Kategori',
      'Tipe Sesi',
      'Tingkat Keparahan (Severity)',
      'Status Verifikasi',
      'Metode Biometrik',
      'Skor Akurasi (%)',
      'Perangkat & Sensor',
      'Alamat IP',
      'Latitude GPS',
      'Longitude GPS',
      'Radius Geofence (Meter)',
      'Valid Geofence (In Radius)',
      'Lokasi / Alamat',
      'Catatan Audit Anti-Spoofing',
    ];

    const rows = selectedLogsList.map((l, idx) => {
      const sev = getLogSeverity(l);
      const sevLabel =
        sev === 'error' ? 'Error (Gagal)' : sev === 'warning' ? 'Warning (Peringatan)' : 'Info (Normal)';
      return [
        idx + 1,
        l.id,
        l.date || l.timestamp?.split(' ')[0] || '',
        l.time || l.timestamp?.split(' ')[1] || '',
        `"${l.personName.replace(/"/g, '""')}"`,
        `"${(l.personId || '').replace(/"/g, '""')}"`,
        l.personType === 'student' ? 'Siswa' : 'Guru / GTK',
        l.type ? (l.type === 'masuk' ? 'Presensi Masuk' : 'Presensi Pulang') : 'Presensi Masuk',
        `"${sevLabel}"`,
        l.status === 'success' ? 'Lolos Validasi' : 'Ditolak / Gagal',
        l.method === 'face_scan' ? 'Face Scan Liveness AI' : 'WebAuthn FIDO2 Passkey',
        l.matchScore,
        `"${(l.deviceInfo || l.cameraFacing || '').replace(/"/g, '""')}"`,
        `"${(l.ipAddress || '-').replace(/"/g, '""')}"`,
        l.location?.lat ?? '',
        l.location?.lng ?? '',
        l.location?.distanceMeter ?? '',
        l.location?.inRadius !== undefined
          ? l.location.inRadius
            ? 'YA (Dalam Radius)'
            : 'TIDAK (Luar Radius)'
          : '',
        `"${(l.location?.address || '-').replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCsv(
      `Log_Biometrik_Terpilih_${selectedLogsList.length}_Item_${new Date().toISOString().split('T')[0]}.csv`,
      csvContent
    );
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 inline-block ml-1 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-600 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 inline-block ml-1" />
    );
  };

  // Get active filter description
  const activeDateDescription = useMemo(() => {
    if (dateFilterMode === 'today') return `Hari Ini (${formatDateIndo(todayStr)})`;
    if (dateFilterMode === '7days') return '7 Hari Terakhir';
    if (dateFilterMode === 'month') return 'Bulan Ini';
    if (dateFilterMode === 'custom') return `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;
    return 'Semua Rentang Waktu';
  }, [dateFilterMode, startDate, endDate, todayStr]);

  const handleCopyAuditId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedAuditId(true);
    setTimeout(() => setCopiedAuditId(false), 2000);
  };

  return (
    <div id="biometric-logs-container" className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                Log Otentikasi Biometrik & Audit Trail
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit verifikasi identitas, pengenalan wajah anti-spoofing, sensor WebAuthn FIDO2, dan koordinat GPS
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFilterActive && (
            <button
              id="reset-biometric-filters-btn"
              onClick={resetAllFilters}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
              title="Reset seluruh filter pencarian dan rentang tanggal"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}

          {/* Auto-Cleanup Policy Indicator / Button */}
          <button
            type="button"
            id="auto-cleanup-policy-btn"
            onClick={() => setIsCleanupModalOpen(true)}
            className={`px-3.5 py-2 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 border shadow-xs ${
              autoCleanupPolicy === 'off'
                ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
            title="Atur kebijakan pembersihan otomatis log usang (>30 atau >90 hari) untuk performa optimal"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Kebijakan Auto-Cleanup: {autoCleanupPolicy === 'off' ? 'Nonaktif' : `${autoCleanupPolicy} Hari`}</span>
            {logsExceedingPolicy.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          {/* Cleanup Old Logs Button */}
          <button
            type="button"
            id="cleanup-old-biometric-logs-btn"
            onClick={() => setIsCleanupModalOpen(true)}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 border border-amber-200 shadow-xs"
            title="Arsipkan & bersihkan rekaman log yang berusia lebih dari 30 atau 90 hari"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600" />
            <span>Cleanup Log Usang</span>
            {logsExceedingPolicy.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                {logsExceedingPolicy.length}
              </span>
            )}
          </button>

          {/* Export to PDF Button */}
          <button
            type="button"
            id="export-biometric-pdf-btn"
            onClick={handleExportPdf}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-2 border border-rose-700 shadow-sm"
            title="Cetak dan unduh laporan audit biometrik resmi berformat PDF lengkap dengan kop surat sekolah"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF ({filteredAndSortedLogs.length})</span>
          </button>

          {/* Export to CSV Button */}
          <button
            type="button"
            id="export-biometric-csv-btn"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-2 border border-emerald-700 shadow-sm"
            title="Download filtered biometric audit logs as CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({filteredAndSortedLogs.length})</span>
          </button>

          {/* Download Raw CSV for External School Reporting Tools (Dapodik / BKD) */}
          <button
            type="button"
            id="download-raw-biometric-csv-btn"
            onClick={handleExportRawCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-2 border border-slate-700 shadow-sm"
            title="Download raw data structured CSV for external school reporting tools (Dapodik, BKD, spreadsheets)"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Raw CSV (Dapodik/BKD)</span>
          </button>

          {onRefresh && (
            <button
              id="refresh-biometric-logs-btn"
              onClick={onRefresh}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
          )}

          {onClearLogs && logs.length > 0 && (
            <button
              id="clear-biometric-logs-btn"
              onClick={onClearLogs}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
              title="Bersihkan seluruh log biometrik lokal"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Log</span>
            </button>
          )}
        </div>
      </div>

      {/* Auto-Cleanup Policy Alert Banner if old logs detected */}
      {logsExceedingPolicy.length > 0 && (
        <div
          id="biometric-cleanup-policy-alert-banner"
          className="p-4.5 rounded-[2rem] bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200"
        >
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-xs sm:text-sm text-amber-950 flex items-center flex-wrap gap-2">
                <span>Kebijakan Auto-Cleanup: Ditemukan {logsExceedingPolicy.length} Log Usang (&gt;{autoCleanupPolicy} Hari)</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-mono font-bold">
                  Perlu Pengarsipan
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Sistem mendeteksi riwayat log otentikasi biometrik melampaui kebijakan retensi aktif ({autoCleanupPolicy} hari). Segera lakukan pengarsipan offline untuk menjaga kestabilan performa database.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setIsCleanupModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-2 active:scale-95"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Arsipkan & Bersihkan ({logsExceedingPolicy.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP SUMMARY CARD: OPERATIONAL HEALTH, TOTAL EVENTS TODAY & SUCCESS/FAILURE RATIO */}
      {/* ========================================================================= */}
      <div
        id="biometric-today-operational-health-summary-card"
        className="bg-white rounded-[2.5rem] border border-slate-200/90 shadow-sm p-6 lg:p-7 space-y-6 relative overflow-hidden"
      >
        {/* Subtle Background Accent Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        {/* Card Header: Operational Health Title & Real-time Health Status Pill */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20 shrink-0">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Ringkasan Kesehatan Operasional Otentikasi Biometrik Hari Ini
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {formatDateIndo(todayStr)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                {todayOperationalStats.healthDescription}
              </p>
            </div>
          </div>

          {/* Health Status Badge & Quick Action */}
          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            <div
              className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center space-x-2 shadow-2xs ${todayOperationalStats.healthBadgeBg}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  todayOperationalStats.healthCondition === 'optimal'
                    ? 'bg-emerald-500 animate-pulse'
                    : todayOperationalStats.healthCondition === 'warning'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500 animate-ping'
                }`}
              />
              <span>{todayOperationalStats.healthBadgeText}</span>
            </div>

            {/* Test Trigger Button for Admin Verification of 3x Failure Trigger */}
            <button
              type="button"
              id="simulate-consecutive-fails-btn"
              onClick={handleTriggerConsecutiveFailSimulation}
              disabled={isSimulationRunning}
              className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all active:scale-95 shadow-xs disabled:opacity-50"
              title="Simulasi 3x percobaan gagal beruntun dalam 5 menit untuk menguji automated notification trigger"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulationRunning ? 'animate-spin' : 'text-amber-400'}`} />
              <span>{isSimulationRunning ? 'Memproses Uji...' : '⚡ Uji Simulasi 3x Gagal'}</span>
            </button>
          </div>
        </div>

        {/* 4-Column Operational Health Insight Grid */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Biometric Authentication Events Today */}
          <div
            id="metric-today-total-events"
            className="p-5 rounded-3xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Total Otentikasi Hari Ini
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{todayOperationalStats.totalToday}</span>
              <span className="text-xs font-bold text-slate-500">Sesi Tercatat</span>
            </div>
            <div className="mt-3 flex items-center space-x-2 text-[11px] font-semibold text-slate-600">
              <span className="text-emerald-700 font-bold">{todayOperationalStats.successToday} Sukses</span>
              <span>•</span>
              <span className="text-rose-700 font-bold">{todayOperationalStats.failedToday} Gagal</span>
              <span>•</span>
              <span className="text-amber-700 font-bold">{todayOperationalStats.warningToday} Peringatan</span>
            </div>
          </div>

          {/* 2. Success-to-Failure Ratio */}
          <div
            id="metric-today-success-failure-ratio"
            className="p-5 rounded-3xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Rasio Sukses : Gagal
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {todayOperationalStats.ratioDisplay}
              </span>
            </div>
            {/* Visual Two-Tone Ratio Progress Bar */}
            <div className="mt-3 space-y-1">
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${todayOperationalStats.successPercent}%` }}
                  title={`Sukses: ${todayOperationalStats.successPercent}%`}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${todayOperationalStats.failPercent}%` }}
                  title={`Gagal: ${todayOperationalStats.failPercent}%`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-emerald-700">{todayOperationalStats.successPercent}% Lolos</span>
                <span className="text-rose-600">{todayOperationalStats.failPercent}% Ditolak</span>
              </div>
            </div>
          </div>

          {/* 3. Average Match Score & Geofence Validity */}
          <div
            id="metric-today-accuracy-geofence"
            className="p-5 rounded-3xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Akurasi & Geofence GPS
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{todayOperationalStats.avgMatchToday}%</span>
              <span className="text-xs font-bold text-slate-500">Skor Rata-rata</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 inline" />
                <span>Geofence Valid:</span>
              </span>
              <span className="font-bold text-emerald-700">{todayOperationalStats.inRadiusPercent}% Dalam Radius</span>
            </div>
          </div>

          {/* 4. Security Incident Tracker (3 Consecutive Failures Alert) */}
          <div
            id="metric-today-security-anomalies"
            className={`p-5 rounded-3xl border transition-colors ${
              todayOperationalStats.todayIncidents.length > 0
                ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                : 'bg-slate-50/80 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  todayOperationalStats.todayIncidents.length > 0 ? 'text-rose-700' : 'text-slate-500'
                }`}
              >
                Deteksi 3x Gagal (&lt;5 Menit)
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  todayOperationalStats.todayIncidents.length > 0
                    ? 'bg-rose-600 text-white animate-bounce'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {todayOperationalStats.todayIncidents.length > 0 ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span
                className={`text-3xl font-black ${
                  todayOperationalStats.todayIncidents.length > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {todayOperationalStats.todayIncidents.length}
              </span>
              <span className="text-xs font-bold text-slate-500">Insiden Terdeteksi</span>
            </div>
            <div className="mt-3 text-[11px] font-semibold text-slate-600 truncate">
              {todayOperationalStats.todayIncidents.length > 0 ? (
                <span className="text-rose-700 font-bold">
                  ⚠️ {todayOperationalStats.todayIncidents[0].personName} ({todayOperationalStats.todayIncidents[0].failCount}x gagal)
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">Anti-Spoofing & Liveness Aktif</span>
              )}
            </div>
          </div>
        </div>

        {/* Highlighted Consecutive Failure Security Incident Warning Banner if any detected */}
        {todayOperationalStats.todayIncidents.length > 0 && (
          <div
            id="biometric-consecutive-failure-alert-banner"
            className="relative z-10 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white p-4 sm:p-5 shadow-md border border-rose-600"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 mt-0.5">
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <h4 className="text-sm font-black tracking-wide uppercase text-amber-200">
                      🚨 Peringatan Keamanan: Terdeteksi 3x Percobaan Gagal Beruntun Dalam Rentang &lt; 5 Menit
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-mono font-bold">
                      Automated Trigger Aktif
                    </span>
                  </div>
                  <p className="text-xs text-rose-100 mt-1 leading-relaxed">
                    Sistem otomatis telah mendeteksi percobaan otentikasi gagal berulang kali oleh personil berikut dan telah memicu notifikasi peringatan ke panel administrator:
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {todayOperationalStats.todayIncidents.map((inc) => (
                      <div
                        key={inc.incidentKey}
                        className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs flex items-center space-x-2"
                      >
                        <User className="w-3.5 h-3.5 text-amber-300" />
                        <span className="font-bold text-white">{inc.personName}</span>
                        <span className="text-rose-200 text-[11px]">
                          ({inc.personType === 'student' ? 'Siswa' : 'Guru/GTK'} • {inc.failCount}x Gagal dlm {inc.durationMinutes <= 1 ? '&lt;1' : inc.durationMinutes} menit)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Actions for the Incident */}
              <div className="flex items-center space-x-2 shrink-0 self-end lg:self-center">
                {todayOperationalStats.todayIncidents[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm(todayOperationalStats.todayIncidents[0].personName);
                      setDateFilterMode('today');
                      setStatusFilter('all');
                      setSeverityFilter('all');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white text-rose-800 font-extrabold text-xs hover:bg-rose-50 transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Inspeksi Log Pengguna</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const nextDismissed = new Set(dismissedIncidents);
                    todayOperationalStats.todayIncidents.forEach((inc) => nextDismissed.add(inc.incidentKey));
                    setDismissedIncidents(nextDismissed);
                  }}
                  className="px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white font-semibold text-xs border border-white/20 transition-colors cursor-pointer"
                  title="Sembunyikan banner peringatan untuk sesi ini"
                >
                  Tandai Selesai
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Verification Health Summary & Badge System */}
      <div
        id="biometric-verification-health-summary"
        className="bg-white p-5 lg:p-6 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Distribusi Kesehatan Verifikasi Biometrik (Verification Health Summary)</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded-md">
                  {healthDistribution.total} Sesi Teranalisis
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring kesehatan verifikasi berdasarkan akurasi biometrik, liveness anti-spoofing, dan validitas radius GPS
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-400">Rasio Sehat:</span>
            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              {healthDistribution.optimalPct}% Optimal
            </span>
          </div>
        </div>

        {/* Multi-Segment Health Distribution Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${healthDistribution.optimalPct}%` }}
              title={`Optimal (Sehat): ${healthDistribution.optimalCount} (${healthDistribution.optimalPct}%)`}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${healthDistribution.warningPct}%` }}
              title={`Peringatan: ${healthDistribution.warningCount} (${healthDistribution.warningPct}%)`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${healthDistribution.criticalPct}%` }}
              title={`Kritis / Gagal: ${healthDistribution.criticalCount} (${healthDistribution.criticalPct}%)`}
            />
          </div>
        </div>

        {/* 3 Clickable Health Badge Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* 1. Optimal / Sehat */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('success');
              setSeverityFilter('info');
            }}
            className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 hover:bg-emerald-100/70 transition-colors cursor-pointer flex items-center justify-between text-left"
            title="Klik untuk filter hanya verifikasi berstatus optimal"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                  Status Optimal (Sehat)
                </span>
                <span className="text-xs text-emerald-700 font-medium">Lolos validasi biometrik & anti-spoofing</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black text-emerald-800">{healthDistribution.optimalCount}</span>
              <span className="text-[10px] font-bold text-emerald-600 block">{healthDistribution.optimalPct}%</span>
            </div>
          </button>

          {/* 2. Warning / Perlu Perhatian */}
          <button
            type="button"
            onClick={() => {
              setSeverityFilter('warning');
            }}
            className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 hover:bg-amber-100/70 transition-colors cursor-pointer flex items-center justify-between text-left"
            title="Klik untuk filter verifikasi dengan peringatan (akurasi marginal atau anomali minor)"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                  Peringatan (Warning)
                </span>
                <span className="text-xs text-amber-700 font-medium">Akurasi marginal 75-89% / luar radius</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black text-amber-800">{healthDistribution.warningCount}</span>
              <span className="text-[10px] font-bold text-amber-600 block">{healthDistribution.warningPct}%</span>
            </div>
          </button>

          {/* 3. Critical / Kritis / Gagal */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('failed');
            }}
            className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 hover:bg-rose-100/70 transition-colors cursor-pointer flex items-center justify-between text-left"
            title="Klik untuk filter verifikasi berstatus gagal atau kritis"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <div>
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
                  Kritis / Gagal (Critical)
                </span>
                <span className="text-xs text-rose-700 font-medium">Ditolak / Skor &lt;75% / Indikasi spoofing</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black text-rose-800">{healthDistribution.criticalCount}</span>
              <span className="text-[10px] font-bold text-rose-600 block">{healthDistribution.criticalPct}%</span>
            </div>
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-[2rem] bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hasil Filter / Total</span>
            <div className="text-xl font-extrabold text-slate-900">
              {filteredAndSortedLogs.length} <span className="text-xs font-normal text-slate-400">/ {logs.length}</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-[2rem] bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verifikasi Lolos</span>
            <div className="text-xl font-extrabold text-emerald-600">{successCount} Sesi</div>
          </div>
        </div>

        <div className="p-5 rounded-[2rem] bg-white border border-rose-200 shadow-xs flex items-center space-x-4 bg-rose-50/20">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Gagal / Anomali (Error)</span>
            <div className="text-xl font-extrabold text-rose-600">{failCount} Insiden</div>
          </div>
        </div>

        <div className="p-5 rounded-[2rem] bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rata-rata Akurasi</span>
            <div className="text-xl font-extrabold text-amber-600">{avgMatch}%</div>
          </div>
        </div>
      </div>

      {/* 30-Day Biometric Authentication Events Recharts Visualization */}
      <div
        id="biometric-30days-chart-card"
        className="bg-white p-5 lg:p-6 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Tren Otentikasi Biometrik Harian (30 Hari Terakhir)</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold rounded-md">
                  Recharts Analytics
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring volume sesi otentikasi wajah & WebAuthn untuk mendeteksi pola penggunaan dan anomali kegagalan
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle: Area vs Bar */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setChartView('area')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                  chartView === 'area'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilkan grafik area kontinyu"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Area Tren</span>
              </button>
              <button
                type="button"
                onClick={() => setChartView('bar')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                  chartView === 'bar'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilkan grafik kolom distribusi"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Distribusi Bar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsChartExpanded(!isChartExpanded)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title={isChartExpanded ? 'Ciutkan grafik' : 'Bentangkan grafik'}
            >
              {isChartExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isChartExpanded && (
          <div className="space-y-4">
            {/* 30-Day Highlight Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Event 30 Hari</span>
                <div className="font-extrabold text-slate-900 text-sm">{chart30DayStats.totalEvents} Sesi</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tingkat Keberhasilan</span>
                <div className="font-extrabold text-emerald-600 text-sm">{chart30DayStats.successRate}% Lolos</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Kegagalan/Anomali</span>
                <div className="font-extrabold text-rose-600 text-sm">{chart30DayStats.totalFailed} Insiden</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Puncak Aktivitas</span>
                <div className="font-extrabold text-indigo-700 text-sm truncate">{chart30DayStats.peakDay}</div>
              </div>
            </div>

            {/* Recharts Canvas */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'area' ? (
                  <AreaChart data={last30DaysChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      interval={3}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1.5 border border-slate-800">
                              <div className="font-extrabold text-indigo-300 border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
                                <span>{data.date}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {data.total} Total Sesi
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-emerald-400 gap-4 font-semibold">
                                <span className="flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>Lolos Validasi:</span>
                                </span>
                                <span className="font-bold">{data.success}</span>
                              </div>
                              <div className="flex items-center justify-between text-rose-400 gap-4 font-semibold">
                                <span className="flex items-center space-x-1">
                                  <X className="w-3 h-3" />
                                  <span>Gagal / Anomali:</span>
                                </span>
                                <span className="font-bold">{data.failed}</span>
                              </div>
                              {data.avgScore > 0 && (
                                <div className="text-[10px] text-amber-300 pt-1 border-t border-slate-800">
                                  Rata-rata Akurasi: {data.avgScore}%
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs font-bold text-slate-600">
                          {value === 'success' ? 'Verifikasi Sukses (Lolos)' : 'Verifikasi Gagal (Ditolak / Anomali)'}
                        </span>
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="success"
                      name="success"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSuccess)"
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      name="failed"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorFailed)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={last30DaysChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      interval={3}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1 border border-slate-800">
                              <div className="font-extrabold text-indigo-300 border-b border-slate-800 pb-1">
                                {data.date} ({data.total} Sesi)
                              </div>
                              <div className="text-emerald-400">✓ Lolos: {data.success}</div>
                              <div className="text-rose-400">✕ Gagal: {data.failed}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs font-bold text-slate-600">
                          {value === 'success' ? 'Verifikasi Sukses' : 'Verifikasi Gagal'}
                        </span>
                      )}
                    />
                    <Bar dataKey="success" name="success" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="failed" name="failed" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Filtering UI Matrix Card */}
      <div id="biometric-filtering-ui" className="bg-white p-5 lg:p-6 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Panel Filter Audit & Pencarian Log
            </h3>
          </div>

          <div className="text-[11px] font-semibold text-slate-500">
            Periode Aktif: <span className="font-bold text-indigo-600">{activeDateDescription}</span>
          </div>
        </div>

        {/* Primary Controls: Search Input & Date Preset Pickers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* 1. Search Input for Student / Teacher Name, Date, or Method */}
          <div className="lg:col-span-6 space-y-1.5">
            <label htmlFor="biometric-user-search-input" className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span>Cari Nama GTK / Siswa, Tanggal (YYYY-MM-DD), atau Metode Sensor Biometrik:</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="biometric-user-search-input"
                type="text"
                placeholder="Ketik nama siswa/guru, tanggal (misal 2026-09-07), metode (Face Scan / Passkey), NIP/NISN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              {searchTerm && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono">
                    {filteredAndSortedLogs.length}
                  </span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Hapus kata kunci pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Filter Search Chips */}
            <div className="flex items-center flex-wrap gap-1 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400">Pintasan:</span>
              <button
                type="button"
                onClick={() => setPersonTypeFilter(personTypeFilter === 'teacher' ? 'all' : 'teacher')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  personTypeFilter === 'teacher'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Guru / ASN
              </button>
              <button
                type="button"
                onClick={() => setPersonTypeFilter(personTypeFilter === 'student' ? 'all' : 'student')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  personTypeFilter === 'student'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Siswa
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter(methodFilter === 'face_scan' ? 'all' : 'face_scan')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  methodFilter === 'face_scan'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Face Scan AI
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter(methodFilter === 'webauthn_fingerprint' ? 'all' : 'webauthn_fingerprint')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  methodFilter === 'webauthn_fingerprint'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                WebAuthn Passkey
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'failed'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-rose-600 hover:bg-slate-200'
                }`}
              >
                Gagal / Anomali
              </button>
            </div>
          </div>

          {/* 2. Date Range Mode Selection Presets */}
          <div className="lg:col-span-6 space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pilih Rentang Waktu Audit:</span>
            </label>
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[
                { id: 'all', label: 'Semua Waktu' },
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari Terakhir' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'custom', label: 'Kustom Tanggal' },
              ].map((p) => (
                <button
                  key={p.id}
                  id={`biometric-date-preset-${p.id}`}
                  onClick={() => setDateFilterMode(p.id as DateFilterMode)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    dateFilterMode === p.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dedicated Date Range Picker (Rendered when Custom Date Range is chosen) */}
        {dateFilterMode === 'custom' && (
          <div
            id="biometric-custom-date-picker-card"
            className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-xs font-extrabold text-slate-800">Tentukan Rentang Tanggal Spesifik:</span>
                <p className="text-[11px] text-slate-500">
                  Filter log audit yang terjadi antara tanggal mulai dan tanggal selesai
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400">Mulai:</span>
                <input
                  id="biometric-filter-start-date"
                  type="date"
                  value={startDate}
                  max={endDate || todayStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <span className="text-xs font-bold text-slate-400">s/d</span>

              <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400">Selesai:</span>
                <input
                  id="biometric-filter-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setStartDate(todayStr);
                  setEndDate(todayStr);
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-indigo-600 text-[11px] font-bold rounded-xl border border-indigo-200 shadow-xs cursor-pointer"
              >
                Set Hari Ini
              </button>
            </div>
          </div>
        )}

        {/* Secondary Detailed Filter Dropdowns: User Dropdown, Category, Severity & Biometric Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {/* 1. Filter by Specific Teacher / User ID Dropdown */}
          <div className="space-y-1">
            <label htmlFor="biometric-user-select-dropdown" className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Daftar Guru / Siswa:</span>
            </label>
            <select
              id="biometric-user-select-dropdown"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Personil ({uniqueUsers.length} Terdaftar)</option>
              <optgroup label="Guru / Tenaga Pendidik">
                {uniqueUsers
                  .filter((u) => u.type === 'teacher')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.identifier ? `[NIP: ${u.identifier}]` : `[ID: ${u.id}]`}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Siswa / Peserta Didik">
                {uniqueUsers
                  .filter((u) => u.type === 'student')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.identifier ? `[NISN: ${u.identifier}]` : `[ID: ${u.id}]`}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* 2. Filter by Person Category (Guru vs Siswa) */}
          <div className="space-y-1">
            <label htmlFor="biometric-category-select" className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Kategori Personil:</span>
            </label>
            <select
              id="biometric-category-select"
              value={personTypeFilter}
              onChange={(e) => setPersonTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Kategori Personil</option>
              <option value="teacher">Guru / GTK ASN</option>
              <option value="student">Siswa</option>
            </select>
          </div>

          {/* 3. Filter by Severity Level (Info, Warning, Error) */}
          <div className="space-y-1">
            <label htmlFor="biometric-severity-select" className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Tingkat Keparahan:</span>
            </label>
            <select
              id="biometric-severity-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Severity</option>
              <option value="info">Info (Normal Lolos)</option>
              <option value="warning">Warning (Akurasi Rendah / Radius)</option>
              <option value="error">Error (Gagal / Ditolak / Anomali)</option>
            </select>
          </div>

          {/* 4. Filter by Biometric Sensor Method */}
          <div className="space-y-1">
            <label htmlFor="biometric-method-select" className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
              <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
              <span>Metode Sensor:</span>
            </label>
            <select
              id="biometric-method-select"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Metode Sensor</option>
              <option value="face_scan">Face Recognition (Kamera Selfie)</option>
              <option value="webauthn_fingerprint">WebAuthn FIDO2 (Passkey / Sidik Jari)</option>
            </select>
          </div>

          {/* 5. Filter by Verification Status */}
          <div className="space-y-1">
            <label htmlFor="biometric-status-select" className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Status Verifikasi:</span>
            </label>
            <select
              id="biometric-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="success">✓ Lolos Validasi</option>
              <option value="failed">✕ Gagal / Ditolak</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {isFilterActive && (
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Filter Aktif:</span>
            {searchTerm && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold inline-flex items-center space-x-1 border border-indigo-100">
                <span>Cari: "{searchTerm}"</span>
                <button onClick={() => setSearchTerm('')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedUserId !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold inline-flex items-center space-x-1 border border-indigo-100">
                <span>User: {uniqueUsers.find((u) => u.id === selectedUserId)?.name || selectedUserId}</span>
                <button onClick={() => setSelectedUserId('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {severityFilter !== 'all' && (
              <span
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center space-x-1 border ${
                  severityFilter === 'error'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : severityFilter === 'warning'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                <span>Severity: {severityFilter.toUpperCase()}</span>
                <button onClick={() => setSeverityFilter('all')} className="hover:opacity-80 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateFilterMode !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold inline-flex items-center space-x-1 border border-indigo-100">
                <span>Waktu: {activeDateDescription}</span>
                <button onClick={() => setDateFilterMode('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {personTypeFilter !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold inline-flex items-center space-x-1 border border-indigo-100">
                <span>Kategori: {personTypeFilter === 'teacher' ? 'Guru/GTK' : 'Siswa'}</span>
                <button onClick={() => setPersonTypeFilter('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {methodFilter !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold inline-flex items-center space-x-1 border border-indigo-100">
                <span>Sensor: {methodFilter === 'face_scan' ? 'Face Scan' : 'WebAuthn'}</span>
                <button onClick={() => setMethodFilter('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[11px] font-bold inline-flex items-center space-x-1 border border-indigo-100">
                <span>Status: {statusFilter === 'success' ? 'Lolos' : 'Ditolak'}</span>
                <button onClick={() => setStatusFilter('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Interactive Table with Row Click Behavior, Severity Tag, and Red Highlight on Failures */}
      <div className="rounded-[2.5rem] bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center space-x-2 font-medium">
            <Info className="w-4 h-4 text-indigo-600" />
            <span>
              Klik salah satu <strong>baris tabel</strong> untuk membuka rincian audit lengkap (koordinat GPS, perangkat, dan anti-spoofing).
            </span>
          </div>
          <div className="flex items-center space-x-2 font-semibold">
            <span className="inline-flex items-center space-x-1 text-rose-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Merah = Percobaan Gagal (Error)</span>
            </span>
            <span className="inline-flex items-center space-x-1 text-amber-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Kuning = Peringatan (Warning)</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-4 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="p-1 text-slate-500 hover:text-indigo-600 cursor-pointer rounded-lg hover:bg-slate-200 transition-colors"
                    title={
                      filteredAndSortedLogs.length > 0 &&
                      filteredAndSortedLogs.every((l) => selectedLogIds.has(l.id))
                        ? 'Batalkan semua pilihan'
                        : 'Pilih semua log pada tampilan ini'
                    }
                  >
                    {filteredAndSortedLogs.length > 0 &&
                    filteredAndSortedLogs.every((l) => selectedLogIds.has(l.id)) ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleHeaderSort('severity')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Severity</span>
                    {renderSortIndicator('severity')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('timestamp')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Waktu & Tanggal</span>
                    {renderSortIndicator('timestamp')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('name')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Nama GTK / Siswa</span>
                    {renderSortIndicator('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('personType')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Kategori</span>
                    {renderSortIndicator('personType')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('method')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Metode Sensor</span>
                    {renderSortIndicator('method')}
                  </div>
                </th>
                <th className="px-5 py-4">Perangkat & Lokasi GPS</th>
                <th
                  onClick={() => handleHeaderSort('matchScore')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Skor Akurasi</span>
                    {renderSortIndicator('matchScore')}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort('status')}
                  className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <span>Status</span>
                    {renderSortIndicator('status')}
                  </div>
                </th>
                <th className="px-5 py-4 text-center font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">
                  Kesehatan Verifikasi
                </th>
                <th className="px-5 py-4 text-center">Rincian Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Fingerprint className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600 text-xs">Tidak ada log biometrik yang cocok</p>
                      <p className="text-[11px] text-slate-400">
                        Coba sesuaikan rentang tanggal, filter tingkat keparahan, atau reset kata kunci pencarian.
                      </p>
                      {isFilterActive && (
                        <button
                          onClick={resetAllFilters}
                          className="mt-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                        >
                          Reset Semua Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedLogs.map((log) => {
                  const severity = getLogSeverity(log);
                  const isFailed = log.status === 'failed' || severity === 'error';
                  const isWarning = severity === 'warning';
                  const isSelected = selectedLogIds.has(log.id);

                  // Row highlight styling: failed in red, warning in amber, info standard
                  const rowClass = isSelected
                    ? 'bg-indigo-50/80 hover:bg-indigo-100/90 border-l-4 border-l-indigo-600 transition-colors cursor-pointer'
                    : isFailed
                    ? 'bg-rose-50/75 hover:bg-rose-100/90 border-l-4 border-l-rose-500 transition-colors cursor-pointer'
                    : isWarning
                    ? 'bg-amber-50/40 hover:bg-amber-100/60 border-l-4 border-l-amber-400 transition-colors cursor-pointer'
                    : 'hover:bg-slate-50/90 border-l-4 border-l-transparent transition-colors cursor-pointer';

                  return (
                    <tr
                      key={log.id}
                      id={`biometric-log-row-${log.id}`}
                      onClick={() => setSelectedLogDetail(log)}
                      className={rowClass}
                      title="Klik baris ini untuk membuka rincian audit & metadata lengkap"
                    >
                      {/* Checkbox Selection Cell */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectLog(log.id, e)}
                          className="p-1 rounded-lg hover:bg-slate-200/80 text-slate-500 cursor-pointer transition-colors"
                          title={isSelected ? 'Batalkan pilihan' : 'Pilih log ini'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* Severity Tag Column */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {severity === 'error' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center space-x-1 bg-rose-100 text-rose-800 border border-rose-300 shadow-xs">
                            <AlertOctagon className="w-3 h-3" />
                            <span>Error</span>
                          </span>
                        ) : severity === 'warning' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center space-x-1 bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Warning</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200">
                            <Info className="w-3 h-3" />
                            <span>Info</span>
                          </span>
                        )}
                      </td>

                      {/* Timestamp & Date Column */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div className="font-bold text-slate-900">{log.time || log.timestamp}</div>
                        <div className="text-[10px] text-slate-400">{log.date || '2026-08-31'}</div>
                      </td>

                      {/* Name & ID Column with Quick Profile Hover Card */}
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <BiometricUserProfileCard
                          personId={log.personId}
                          personName={log.personName}
                          personType={log.personType}
                          allLogs={logs}
                        >
                          <div
                            onClick={() => setSelectedLogDetail(log)}
                            className="cursor-pointer group"
                          >
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5 group-hover:text-indigo-600 transition-colors">
                              <span>{log.personName}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              ID: {log.personId || '-'}
                            </div>
                          </div>
                        </BiometricUserProfileCard>
                      </td>

                      {/* Category Column */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            log.personType === 'student'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {log.personType === 'student' ? 'Siswa' : 'Guru / GTK'}
                        </span>
                      </td>

                      {/* Sensor Method Column */}
                      <td className="px-5 py-3.5 text-slate-700">
                        <div className="flex items-center space-x-1.5">
                          {log.method === 'face_scan' ? (
                            <Camera className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Fingerprint className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          )}
                          <span className="font-medium whitespace-nowrap">
                            {log.method === 'face_scan'
                              ? 'Face Scan Liveness'
                              : 'WebAuthn Passkey'}
                          </span>
                        </div>
                      </td>

                      {/* Device & Location Preview Column */}
                      <td className="px-5 py-3.5 text-slate-600 text-[11px] max-w-[200px]">
                        <div className="truncate font-semibold text-slate-800" title={log.deviceInfo || ''}>
                          {log.deviceInfo || (log.cameraFacing === 'user' ? 'Kamera Depan (Selfie)' : 'Standard Web')}
                        </div>
                        {log.location && (
                          <div className="text-[10px] text-slate-500 flex items-center space-x-1 truncate mt-0.5" title={log.location.address || ''}>
                            <MapPin className={`w-3 h-3 shrink-0 ${log.location.inRadius === false ? 'text-rose-500' : 'text-emerald-600'}`} />
                            <span>
                              {log.location.distanceMeter !== undefined ? `${log.location.distanceMeter}m` : ''} • {log.location.address ? log.location.address.split(',')[0] : 'Tercatat GPS'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Match Score Column */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-mono font-extrabold ${
                              (log.matchScore || 0) >= 90
                                ? 'text-emerald-700'
                                : (log.matchScore || 0) >= 75
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {log.matchScore}%
                          </span>
                        </div>
                      </td>

                      {/* Status Badge Column */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center space-x-1 ${
                            log.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {log.status === 'success' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Lolos</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              <span>Ditolak</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Verification Health Badge Column */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {(() => {
                          const health = getLogVerificationHealth(log);
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center space-x-1.5 border shadow-2xs ${health.badgeClass}`}
                                title={health.description}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${health.dotColor}`} />
                                {health.level === 'optimal' ? (
                                  <ShieldCheck className="w-3 h-3" />
                                ) : health.level === 'warning' ? (
                                  <AlertTriangle className="w-3 h-3" />
                                ) : (
                                  <AlertOctagon className="w-3 h-3" />
                                )}
                                <span>{health.label}</span>
                              </span>
                              <span className="text-[9px] text-slate-500 font-semibold pl-1">
                                {health.sublabel}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Row Action / Detail Button */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogDetail(log);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer shadow-xs"
                          title="Lihat Detail Audit Lengkap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Rincian</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedLogIds.size > 0 && (
        <div
          id="biometric-bulk-action-bar"
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3.5 rounded-[2rem] shadow-2xl border border-slate-700/80 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-center space-x-2 pr-3 border-r border-slate-700">
            <CheckSquare2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-extrabold whitespace-nowrap">
              {selectedLogIds.size} Log Terpilih
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleBulkMarkStatus('success')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
              title="Tandai log terpilih sebagai Berhasil/Lolos"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tandai Sukses</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkMarkStatus('failed')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
              title="Tandai log terpilih sebagai Gagal/Ditolak"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tandai Gagal</span>
            </button>

            <button
              type="button"
              onClick={handleBulkExportSelectedCsv}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
              title="Ekspor hanya log yang dipilih ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({selectedLogIds.size})</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
              title="Hapus log yang dipilih dari sistem"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih</span>
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer ml-1"
              title="Batalkan Pilihan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Detail Modal with Full Metadata, Device Information, and GPS Coordinates */}
      {selectedLogDetail && (
        <div
          id="biometric-log-detail-modal"
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedLogDetail(null)}
        >
          <div
            className="bg-white rounded-[2.5rem] max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Rincian Lengkap Audit Biometrik & Forensik
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ID Transaksi:{' '}
                    <span className="font-mono font-bold text-slate-700">{selectedLogDetail.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup dialog rincian"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* User Overview & Severity Banner */}
              <div
                className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  getLogSeverity(selectedLogDetail) === 'error'
                    ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                    : getLogSeverity(selectedLogDetail) === 'warning'
                    ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center font-bold text-indigo-700 shadow-xs text-sm">
                    {selectedLogDetail.personName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {selectedLogDetail.personName}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono flex items-center space-x-2 mt-0.5">
                      <span>ID: {selectedLogDetail.personId || '-'}</span>
                      <span>•</span>
                      <span>{selectedLogDetail.personType === 'student' ? 'Siswa' : 'Guru / GTK ASN'}</span>
                      <span>•</span>
                      <span className="uppercase font-bold text-indigo-700">
                        {selectedLogDetail.type || 'MASUK'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Severity Tag */}
                  {getLogSeverity(selectedLogDetail) === 'error' ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-extrabold uppercase inline-flex items-center space-x-1 bg-rose-600 text-white shadow-xs">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Severity: Error</span>
                    </span>
                  ) : getLogSeverity(selectedLogDetail) === 'warning' ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-extrabold uppercase inline-flex items-center space-x-1 bg-amber-500 text-white shadow-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Severity: Warning</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full text-xs font-extrabold uppercase inline-flex items-center space-x-1 bg-blue-600 text-white shadow-xs">
                      <Info className="w-3.5 h-3.5" />
                      <span>Severity: Info</span>
                    </span>
                  )}

                  {/* Verification Status */}
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase inline-flex items-center space-x-1 ${
                      selectedLogDetail.status === 'success'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {selectedLogDetail.status === 'success' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Lolos Validasi</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" />
                        <span>Ditolak</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Photo Snapshot & Biometric Match Gauge */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {selectedLogDetail.photoUrl && (
                  <div className="sm:col-span-4 text-center space-y-1.5 bg-slate-50 p-3.5 rounded-3xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500">Foto Snapshot Biometrik:</span>
                    <img
                      src={selectedLogDetail.photoUrl}
                      alt="Biometric Snapshot"
                      className="w-full h-36 object-cover rounded-2xl border-2 border-indigo-200 shadow-sm"
                    />
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Timestamp: {selectedLogDetail.time}
                    </span>
                  </div>
                )}

                <div className={`${selectedLogDetail.photoUrl ? 'sm:col-span-8' : 'sm:col-span-12'} space-y-3`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                      <span className="text-slate-400 block font-bold text-[10px]">WAKTU TRANSAKSI</span>
                      <span className="font-bold text-slate-900 text-xs">
                        {selectedLogDetail.timestamp || `${selectedLogDetail.date} ${selectedLogDetail.time}`} WITA
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                      <span className="text-slate-400 block font-bold text-[10px]">SKOR KECOCOKAN AI</span>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span
                          className={`font-mono text-sm font-extrabold ${
                            (selectedLogDetail.matchScore || 0) >= 90
                              ? 'text-emerald-600'
                              : (selectedLogDetail.matchScore || 0) >= 75
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {selectedLogDetail.matchScore}%
                        </span>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (selectedLogDetail.matchScore || 0) >= 90
                                ? 'bg-emerald-500'
                                : (selectedLogDetail.matchScore || 0) >= 75
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, selectedLogDetail.matchScore || 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                      <span className="text-slate-400 block font-bold text-[10px]">METODE SENSOR</span>
                      <span className="font-bold text-slate-900 text-xs flex items-center space-x-1 mt-0.5">
                        {selectedLogDetail.method === 'face_scan' ? (
                          <Camera className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                        <span>
                          {selectedLogDetail.method === 'face_scan'
                            ? 'Face Recognition Liveness'
                            : 'WebAuthn FIDO2 Passkey'}
                        </span>
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                      <span className="text-slate-400 block font-bold text-[10px]">ALAMAT IP JARINGAN</span>
                      <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                        {selectedLogDetail.ipAddress || '180.252.164.12'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Information Card */}
              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-xs">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>Informasi Perangkat Keras & Sensor (Device Metadata)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block font-bold">Spesifikasi Perangkat / OS:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedLogDetail.deviceInfo || 'Chrome Mobile 127 / Android 14'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Orientasi & Sensor Kamera:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedLogDetail.cameraFacing === 'user'
                        ? 'Kamera Depan (TrueDepth / Front Sensor)'
                        : 'Kamera Belakang / Standar Sensor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leaflet Interactive Map Card within Modal */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-xs">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span>Peta Interaktif & Radius Geofence Presisi</span>
                </div>
                <BiometricLocationMap
                  log={selectedLogDetail}
                  schoolConfig={config}
                  height="260px"
                  showTitle={false}
                />
              </div>

              {/* GPS Coordinates & Geofence Metadata Card */}
              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-xs">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <span>Koordinat Lokasi GPS & Validasi Geofence</span>
                  </div>

                  {selectedLogDetail.location && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedLogDetail.location.lat},${selectedLogDetail.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 text-[10px] font-bold rounded-xl border border-slate-200 shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <span>Buka Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] pt-1">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-slate-400 block font-bold text-[10px]">KOORDINAT PRESISI</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedLogDetail.location
                        ? `${selectedLogDetail.location.lat.toFixed(5)}, ${selectedLogDetail.location.lng.toFixed(5)}`
                        : '-1.86235, 124.78912'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-slate-400 block font-bold text-[10px]">RADIUS DARI SEKOLAH</span>
                    <span className="font-bold text-slate-800">
                      {selectedLogDetail.location?.distanceMeter !== undefined
                        ? `${selectedLogDetail.location.distanceMeter} Meter`
                        : '18 Meter'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-slate-400 block font-bold text-[10px]">STATUS GEOFENCE</span>
                    <span
                      className={`font-bold ${
                        selectedLogDetail.location?.inRadius !== false
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {selectedLogDetail.location?.inRadius !== false
                        ? '✓ Terverifikasi Dalam Radius'
                        : '✕ Di Luar Radius Sekolah'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 font-bold block text-[10px]">ALAMAT / LOKASI GEOFISIK:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLogDetail.location?.address ||
                      'SMA Negeri 1 Taliabu Barat, Jl. Trans Taliabu, Bobong, Kab. Pulau Taliabu, Maluku Utara'}
                  </span>
                </div>
              </div>

              {/* Anti-Spoofing Notes & Compliance Card */}
              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-1.5">
                <span className="text-slate-500 font-bold block text-[10px] uppercase tracking-wider">
                  Catatan Anti-Spoofing & Kepatuhan Integritas:
                </span>
                <p className="text-slate-700 font-medium text-xs leading-relaxed">
                  {selectedLogDetail.notes ||
                    'Pemeriksaan liveness detection anti-foto cetak dan verifikasi passkey biometrik selesai.'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleCopyAuditId(JSON.stringify(selectedLogDetail, null, 2))}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs w-full sm:w-auto justify-center"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedAuditId ? '✓ JSON Audit Disalin' : 'Salin JSON Log'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Tutup Rincian Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup & Archive Old Logs (>30 or >90 Days) Modal */}
      {isCleanupModalOpen && (
        <BiometricCleanupModal
          logs={logs}
          onClose={() => setIsCleanupModalOpen(false)}
          onUpdateLogs={(remainingLogs) => {
            if (onUpdateLogs) {
              onUpdateLogs(remainingLogs);
            } else if (onClearLogs && remainingLogs.length === 0) {
              onClearLogs();
            }
          }}
          onAddNotification={onAddNotification}
          activeAutoCleanupPolicy={autoCleanupPolicy}
          onUpdateAutoCleanupPolicy={handleUpdateAutoCleanupPolicy}
        />
      )}
    </div>
  );
};
