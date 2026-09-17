import React, {
  useState,
  useEffect,
  useRef,
  Suspense,
} from 'react';
import {
  ActiveTab,
  AttendanceRecord,
  LeaveRequest,
  SchoolClass,
  SchoolConfig,
  Student,
  Teacher,
  UserRole,
  AcademicEvent,
  ToastNotification,
  ToastSeverity,
  GtkServiceRequest,
  ActivityLog,
  TeacherPiketDuty,
  BiometricLog,
  AppBackupData,
  BkdScheduleConfig,
  BkdDispatchLog,
  SyncQueueItem,
  HeartbeatState,
} from './types';
import {
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_CLASSES,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_SCHOOL_CONFIG,
  INITIAL_STUDENTS,
  INITIAL_TEACHERS,
  INITIAL_ACADEMIC_EVENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_GTK_SERVICES,
  INITIAL_TEACHER_PIKET_DUTIES,
  INITIAL_BKD_SCHEDULE_CONFIG,
  INITIAL_BKD_DISPATCH_LOGS,
  getTodayDateString,
} from './data/schoolData';
import { Sidebar } from './components/Sidebar';
import { NotificationBanner } from './components/NotificationBanner';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardStats } from './components/DashboardStats';
import { QrScannerTab } from './components/QrScannerTab';
import { SelfieGpsTab } from './components/SelfieGpsTab';
import { BatchClassAttendance } from './components/BatchClassAttendance';
import { LeaveRequestsTab } from './components/LeaveRequestsTab';
import { GtkServicesTab } from './components/GtkServicesTab';
import { ActivityLogsTab } from './components/ActivityLogsTab';
import { StudentManagementTab } from './components/StudentManagementTab';
import { TeacherManagementTab } from './components/TeacherManagementTab';
import { AcademicCalendarTab } from './components/AcademicCalendarTab';
import { TeacherPiketTab } from './components/TeacherPiketTab';
import { ServiceIntegrationTab } from './components/ServiceIntegrationTab';
import { ConfigTab } from './components/ConfigTab';
import { OfflineStatusGuideWidget } from './components/OfflineStatusGuideWidget';
import { PrintModal } from './components/PrintModal';
import { AppInstallModal } from './components/AppInstallModal';
import { AppIconCustomizerModal } from './components/AppIconCustomizerModal';
import { LoginPage } from './components/LoginPage';
import { TabSuspenseFallback } from './components/TabSuspenseFallback';
import { UserAccountsTab } from './components/UserAccountsTab';
import { ProfileView } from './components/ProfileView';
import {
  saveRecordsToDb,
  loadRecordsFromDb,
  saveActivityLogsToDb,
  loadActivityLogsFromDb,
  saveBiometricLogsToDb,
  loadBiometricLogsFromDb,
} from './utils/dbStorage';
import { runWorkerIntegrityCheck } from './utils/dataWorkerService';

// Heavy UI Tabs loaded asynchronously via React.lazy to drastically improve initial load time & responsiveness
const AsnAttendanceTableTab = React.lazy(() =>
  import('./components/AsnAttendanceTableTab').then((m) => ({ default: m.AsnAttendanceTableTab }))
);
const RekapitulasiView = React.lazy(() =>
  import('./components/RekapitulasiView').then((m) => ({ default: m.RekapitulasiView }))
);
const GoogleWorkspaceTab = React.lazy(() =>
  import('./components/GoogleWorkspaceTab').then((m) => ({ default: m.GoogleWorkspaceTab }))
);
const StudentCardsTab = React.lazy(() =>
  import('./components/StudentCardsTab').then((m) => ({ default: m.StudentCardsTab }))
);
const BiometricLogsTab = React.lazy(() =>
  import('./components/BiometricLogsTab').then((m) => ({ default: m.BiometricLogsTab }))
);
const HardwareDiagnosticTab = React.lazy(() =>
  import('./components/HardwareDiagnosticTab').then((m) => ({ default: m.HardwareDiagnosticTab }))
);
import { OnboardingGuide, ONBOARDING_STORAGE_KEY } from './components/OnboardingGuide';
import {
  updateDocumentAppIcon,
  initAppIconFromStorage,
  isAppRunningStandalone,
  applyDevicePlatformToDom,
} from './utils/appIconAndPwa';
import { polyfillGetUserMedia } from './utils/cameraOrientationUtils';
import { getLocalStorageStats } from './utils/storageMonitor';
import { checkFridayBkdReminder, getWeeklyExportStorageKey } from './utils/scheduledBkdReminder';
import { evaluateAndExecuteBkdDispatches } from './utils/bkdAutomationScheduler';
import {
  evaluateFridayAutoBackup,
  triggerJsonDownload,
  markFridayAutoBackupRun,
} from './utils/autoBackupScheduler';
import { performForceFullSyncToFirestore } from './lib/firebase';
import {
  registerServiceWorker,
  cacheAttendanceSnapshotToSw,
  getCachedAttendanceSnapshotFromSw,
  notifyServiceWorkerOnline,
} from './utils/serviceWorkerRegistration';
import { createEntityEditAuditLog } from './utils/activityDiffUtils';
import { Menu, Download } from 'lucide-react';
import { playBeepSound, formatDateIndo } from './utils/soundAndDate';
import {
  getSyncQueue,
  saveSyncQueue,
  enqueueAttendanceRecord,
  pushQueueToFirebase,
  pingFirebaseHeartbeat,
  setAutoSyncCallback,
  triggerImmediateOnlineSyncRetry,
  syncAllOfflineDataToCloud,
} from './utils/syncQueue';
import { SecurityAuthModal } from './components/SecurityAuthModal';
import { SecurityCenterTab } from './components/SecurityCenterTab';
import {
  validateAndSanitizeAttendance,
  validateAndSanitizeLeaveRequest,
  validateAndSanitizeStudent,
  validateAndSanitizeTeacher,
} from './utils/sanitizer';
import {
  attendanceScanLimiter,
  leaveRequestLimiter,
  onRateLimitViolation,
} from './utils/rateLimiter';
import {
  initializeServerCsrf,
  sendBiometricLogUpdate,
  sendDatabaseSync,
} from './utils/csrf';
import {
  TokenSession,
  createTokenSession,
  saveTokenSession,
  getActiveTokenSession,
  getActiveTokenSessionSync,
  getUserAccountBySessionSync,
  isAuthorizedForTab,
} from './utils/auth';
import {
  saveAttendanceToFirestore,
  saveLeaveToFirestore,
} from './lib/firebase';

export default function App() {
  const todayDate = getTodayDateString();

  // State initialization with localStorage persistence
  const [config, setConfig] = useState<SchoolConfig>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_config');
      return saved ? JSON.parse(saved) : INITIAL_SCHOOL_CONFIG;
    } catch {
      return INITIAL_SCHOOL_CONFIG;
    }
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_classes');
      return saved ? JSON.parse(saved) : INITIAL_CLASSES;
    } catch {
      return INITIAL_CLASSES;
    }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_students');
      return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
    } catch {
      return INITIAL_STUDENTS;
    }
  });

  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_teachers');
      return saved ? JSON.parse(saved) : INITIAL_TEACHERS;
    } catch {
      return INITIAL_TEACHERS;
    }
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_records');
      return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE_RECORDS;
    } catch {
      return INITIAL_ATTENDANCE_RECORDS;
    }
  });

  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_leaves');
      return saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
    } catch {
      return INITIAL_LEAVE_REQUESTS;
    }
  });

  const [gtkServices, setGtkServices] = useState<GtkServiceRequest[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_gtk_services');
      return saved ? JSON.parse(saved) : INITIAL_GTK_SERVICES;
    } catch {
      return INITIAL_GTK_SERVICES;
    }
  });

  const [events, setEvents] = useState<AcademicEvent[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_events');
      return saved ? JSON.parse(saved) : INITIAL_ACADEMIC_EVENTS;
    } catch {
      return INITIAL_ACADEMIC_EVENTS;
    }
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const savedRecords = localStorage.getItem('school_presensi_records');
      const savedLeaves = localStorage.getItem('school_presensi_leaves');
      const recs = savedRecords ? JSON.parse(savedRecords) : [];
      const lvs = savedLeaves ? JSON.parse(savedLeaves) : [];
      if (recs.length === 0 && lvs.length === 0) {
        return [];
      }
      const saved = localStorage.getItem('school_presensi_activity_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [piketDuties, setPiketDuties] = useState<TeacherPiketDuty[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_piket_duties');
      return saved ? JSON.parse(saved) : INITIAL_TEACHER_PIKET_DUTIES;
    } catch {
      return INITIAL_TEACHER_PIKET_DUTIES;
    }
  });

  const [biometricLogs, setBiometricLogs] = useState<BiometricLog[]>(() => {
    try {
      const savedRecords = localStorage.getItem('school_presensi_records');
      const savedLeaves = localStorage.getItem('school_presensi_leaves');
      const recs = savedRecords ? JSON.parse(savedRecords) : [];
      const lvs = savedLeaves ? JSON.parse(savedLeaves) : [];
      if (recs.length === 0 && lvs.length === 0) {
        return [];
      }
      const saved = localStorage.getItem('school_presensi_biometric_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<ToastNotification[]>(() => {
    try {
      const savedRecords = localStorage.getItem('school_presensi_records');
      const savedLeaves = localStorage.getItem('school_presensi_leaves');
      const recs = savedRecords ? JSON.parse(savedRecords) : [];
      const lvs = savedLeaves ? JSON.parse(savedLeaves) : [];
      if (recs.length === 0 && lvs.length === 0) {
        return [];
      }
      const saved = localStorage.getItem('school_presensi_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const showToast = (
    title: string,
    message: string,
    severity: ToastSeverity = 'success',
    duration = 4500,
    meta?: { leaveId?: string; serviceId?: string }
  ) => {
    const notif: ToastNotification = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      message,
      type: severity,
      severity,
      duration,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      leaveId: meta?.leaveId,
      serviceId: meta?.serviceId,
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 15)]);
  };

  const handleDismissToast = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleDismissAllToasts = () => {
    setNotifications([]);
  };

  const handleToastActionClick = (toast: ToastNotification) => {
    if (toast.leaveId) {
      setActiveTab('leaves');
    } else if (toast.serviceId) {
      setActiveTab('layanan_gtk');
    }
    handleDismissToast(toast.id);
  };

  const [bkdScheduleConfig, setBkdScheduleConfig] = useState<BkdScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_bkd_schedule');
      return saved ? JSON.parse(saved) : INITIAL_BKD_SCHEDULE_CONFIG;
    } catch {
      return INITIAL_BKD_SCHEDULE_CONFIG;
    }
  });

  const [bkdDispatchLogs, setBkdDispatchLogs] = useState<BkdDispatchLog[]>(() => {
    try {
      const saved = localStorage.getItem('school_presensi_bkd_logs');
      return saved ? JSON.parse(saved) : INITIAL_BKD_DISPATCH_LOGS;
    } catch {
      return INITIAL_BKD_DISPATCH_LOGS;
    }
  });

  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() => {
    return getSyncQueue();
  });

  const [heartbeatState, setHeartbeatState] = useState<HeartbeatState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    latencyMs: 24,
    lastCheckTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    cloudStatus: 'connected',
    pendingQueueCount: getSyncQueue().length,
    syncedCount: 48,
  });

  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [tokenSession, setTokenSession] = useState<TokenSession | null>(() => {
    return getActiveTokenSessionSync();
  });
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = getActiveTokenSessionSync();
    return saved?.claims?.role || 'admin';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = getActiveTokenSessionSync();
    const role = saved?.claims?.role || 'admin';
    if (role === 'guru' || role === 'siswa') return 'selfie';
    if (role === 'piket') return 'scan';
    return 'dashboard';
  });
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityTargetRole, setSecurityTargetRole] = useState<UserRole>('admin');

  // Inisialisasi token CSRF ke backend server saat mount
  useEffect(() => {
    initializeServerCsrf().catch((err) => {
      console.warn('Inisialisasi CSRF backend:', err);
    });
  }, []);

  // Hidrasi data besar (presensi, log aktivitas, biometrik) dari IndexedDB secara asinkron agar UI thread tidak macet
  useEffect(() => {
    let isMounted = true;
    const hydrateStorage = async () => {
      try {
        const [loadedRecords, loadedLogs, loadedBiometric] = await Promise.all([
          loadRecordsFromDb(INITIAL_ATTENDANCE_RECORDS),
          loadActivityLogsFromDb([]),
          loadBiometricLogsFromDb([]),
        ]);
        if (isMounted) {
          if (Array.isArray(loadedRecords) && loadedRecords.length > 0) {
            setRecords(loadedRecords);
          }
          if (Array.isArray(loadedLogs) && loadedLogs.length > 0) {
            setActivityLogs(loadedLogs);
          }
          if (Array.isArray(loadedBiometric) && loadedBiometric.length > 0) {
            setBiometricLogs(loadedBiometric);
          }
        }
      } catch (e) {
        console.warn('[IndexedDB Hydration Error]', e);
      }
    };
    hydrateStorage();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sinkronisasi Sesi Token saat peran pengguna (userRole) berganti
  useEffect(() => {
    if (!tokenSession) return;
    // Hanya perbarui jika peran di klaim token berbeda dengan peran aktif saat ini
    if (tokenSession.claims.role !== userRole) {
      const displayName =
        userRole === 'admin'
          ? 'Administrator Sekolah'
          : userRole === 'guru'
          ? 'Bpk/Ibu Guru Pengajar'
          : userRole === 'piket'
          ? 'Petugas Guru Piket'
          : 'Peserta Didik';
      createTokenSession(userRole, displayName).then((session) => {
        saveTokenSession(session);
        setTokenSession(session);
      });
    }
  }, [userRole]);

  // Pastikan tab yang sedang aktif sesuai batasan otorisasi peran:
  // Role Guru dan Siswa: Menu Utama dihapus, diganti dengan Metode Presensi
  useEffect(() => {
    if (userRole === 'guru') {
      const allowedTeacherTabs: ActiveTab[] = [
        'selfie',
        'batch_class',
        'cards',
        'layanan_gtk',
        'profile',
      ];
      if (!allowedTeacherTabs.includes(activeTab)) {
        setActiveTab('selfie');
      }
    } else if (userRole === 'siswa') {
      const allowedStudentTabs: ActiveTab[] = [
        'selfie',
        'cards',
        'leaves',
        'profile',
      ];
      if (!allowedStudentTabs.includes(activeTab)) {
        setActiveTab('selfie');
      }
    } else if (userRole === 'piket') {
      const allowedPiketTabs: ActiveTab[] = [
        'scan',
        'batch_class',
        'selfie',
        'piket',
        'asn_attendance_table',
        'layanan_gtk',
        'leaves',
        'profile',
      ];
      if (!allowedPiketTabs.includes(activeTab)) {
        setActiveTab('scan');
      }
    }
  }, [userRole, activeTab]);

  const handleLogout = () => {
    sessionStorage.removeItem('school_presensi_token_session');
    localStorage.removeItem('school_presensi_token_session');
    setTokenSession(null);
    showToast('Sesi Berakhir', 'Anda telah berhasil keluar dari akun.', 'info', 3000);
  };

  const handleOpenSecurityModal = (role: UserRole = 'admin') => {
    if (userRole !== 'admin') {
      showToast('Akses Dibatasi', 'Hanya Administrator yang dapat mengakses Pusat Keamanan.', 'warning', 3000);
      return;
    }
    setSecurityTargetRole(role);
    setIsSecurityModalOpen(true);
  };

  // Navigasi Tab dengan Otorisasi Ketat (Strict Role-Based Tab Guard)
  // Setiap role yang sudah masuk tidak bisa lagi mengakses menu atau role lain
  const handleTabChange = (targetTab: ActiveTab) => {
    const activeSession = tokenSession || getActiveTokenSessionSync();
    const authResult = isAuthorizedForTab(activeSession, targetTab);

    if (!authResult.authorized) {
      showToast(
        'Akses Ditolak',
        authResult.reason || 'Anda tidak memiliki hak akses untuk membuka halaman tersebut.',
        'error',
        4000
      );
      return;
    }

    setActiveTab(targetTab);
    if (autoHideOnSelect) {
      setIsSidebarOpen(false);
    }
  };

  // JIKA BELUM PERNAH MELAKUKAN ABSENSI & BELUM AJUKAN IZIN:
  // Notifikasi dan riwayat/histori dipastikan bersih/kosong (clean slate)
  useEffect(() => {
    if (records.length === 0 && leaves.length === 0) {
      if (activityLogs.length > 0) {
        setActivityLogs([]);
        try {
          localStorage.setItem('school_presensi_activity_logs', JSON.stringify([]));
        } catch (e) {
          console.error(e);
        }
      }
      if (notifications.length > 0) {
        setNotifications([]);
        try {
          localStorage.setItem('school_presensi_notifs', JSON.stringify([]));
        } catch (e) {
          console.error(e);
        }
      }
      if (biometricLogs.length > 0) {
        setBiometricLogs([]);
        try {
          localStorage.setItem('school_presensi_biometric_logs', JSON.stringify([]));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [records.length, leaves.length, activityLogs.length, notifications.length, biometricLogs.length]);

  // Sidebar state: open/closed, locked, and auto-hide on menu selection
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('school_sidebar_open');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
    } catch {
      return true;
    }
  });

  const [autoHideOnSelect, setAutoHideOnSelect] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('school_sidebar_autohide');
      if (saved !== null) return saved === 'true';
      return true; // Defaults to true: automatically hides sidebar on menu click
    } catch {
      return true;
    }
  });

  const [isSidebarLocked, setIsSidebarLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('school_sidebar_locked') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('school_sidebar_open', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    try {
      localStorage.setItem('school_sidebar_open', 'false');
    } catch (e) {
      console.warn(e);
    }
  };

  const handleToggleAutoHide = () => {
    setAutoHideOnSelect((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('school_sidebar_autohide', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  const handleToggleSidebarLock = () => {
    setIsSidebarLocked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('school_sidebar_locked', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  // Screen resize listener for responsive auto-collapse below lg (1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize and update App Icon / PWA favicon dynamically and apply OS-specific styling & camera polyfills
  useEffect(() => {
    initAppIconFromStorage(config.appIconUrl || config.logoUrl);
    setIsStandalone(isAppRunningStandalone());
    // Auto-detect OS and inject .os-ios / .os-android / .os-windows / .os-mac classes
    applyDevicePlatformToDom();
    // Polyfill getUserMedia for legacy iOS / mobile webview compatibility
    polyfillGetUserMedia();
  }, [config.appIconUrl, config.logoUrl]);

  // Verifikasi Integritas Relasional Rombel saat Startup menggunakan Web Worker di latar belakang
  const verifyIntegrity = async () => {
    try {
      const result = await runWorkerIntegrityCheck(classes, students, records);

      if (result.hasModifications) {
        setClasses(result.classes);
        setStudents(result.students);
        setRecords(result.records);

        try {
          localStorage.setItem('school_presensi_classes', JSON.stringify(result.classes));
          localStorage.setItem('school_presensi_students', JSON.stringify(result.students));
          saveRecordsToDb(result.records);
        } catch (storageErr) {
          console.error('[verifyIntegrity] Gagal menyimpan hasil rekonsiliasi:', storageErr);
        }

        const nowTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const todayDateStr = new Date().toISOString().split('T')[0];

        // Berikan notifikasi perbaikan otomatis kepada Admin
        const autoFixNotif: ToastNotification = {
          id: `integrity_auto_fix_${Date.now()}`,
          title: '🛡️ Pemulihan Integritas Data Rombel',
          message: `Sistem mendeteksi ${result.orphanedStudentsCount} siswa dan ${result.orphanedRecordsCount} rekaman presensi dengan classId tidak terdaftar. Perbaikan otomatis Web Worker berhasil merekonsiliasi ${result.repairedCount} item ke rombongan belajar aktif.`,
          type: 'system',
          timestamp: nowTimeStr,
          read: false,
        };
        setNotifications((prev) => [autoFixNotif, ...prev.slice(0, 15)]);

        // Simpan log aktivitas perbaikan ke riwayat audit sistem
        const fixLog: ActivityLog = {
          id: `log_integrity_${Date.now()}`,
          action: 'Rekonsiliasi Otomatis Integritas Rombel (Web Worker)',
          actor: {
            name: 'Web Worker Self-Healing Scanner',
            role: 'Administrator Sistem',
          },
          category: 'master_data',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: `${todayDateStr} ${nowTimeStr}`,
          date: todayDateStr,
          targetName: 'Master Data Rombel & Siswa',
          description: `Pemindaian latar belakang mendeteksi ${result.orphanedStudentsCount} siswa dan ${result.orphanedRecordsCount} catatan presensi dengan classId tidak terdaftar. Berhasil direkonsiliasi otomatis (${result.repairedCount} entitas diperbaiki).`,
          status: 'success',
        };
        setActivityLogs((prev) => [fixLog, ...prev.slice(0, 49)]);
      }
    } catch (err) {
      console.error('[verifyIntegrity Web Worker] Terjadi kesalahan:', err);
    }
  };

  // Pemicu otomatis verifyIntegrity saat startup
  const hasVerifiedIntegrityRef = useRef(false);
  useEffect(() => {
    if (!hasVerifiedIntegrityRef.current && (classes.length > 0 || students.length > 0)) {
      hasVerifiedIntegrityRef.current = true;
      verifyIntegrity();
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_bkd_schedule', JSON.stringify(bkdScheduleConfig));
    } catch (e) {
      console.error(e);
    }
  }, [bkdScheduleConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_bkd_logs', JSON.stringify(bkdDispatchLogs));
    } catch (e) {
      console.error(e);
    }
  }, [bkdDispatchLogs]);

  useEffect(() => {
    saveSyncQueue(syncQueue);
  }, [syncQueue]);

  // Background Sync Queue Worker
  const processSyncQueue = async (queueToProcess?: SyncQueueItem[]) => {
    const targetQueue = queueToProcess || syncQueue;
    if (targetQueue.length === 0 || isSyncingQueue) return;

    setIsSyncingQueue(true);
    try {
      const result = await pushQueueToFirebase(targetQueue);
      setSyncQueue(result.updatedQueue);

      if (result.successCount > 0) {
        // Merge synced notes into records
        setRecords((prevRecords) => {
          const syncedMap = new Map(result.syncedRecords.map((r) => [r.id, r]));
          return prevRecords.map((r) => syncedMap.get(r.id) || r);
        });

        // Add Toast notification
        const notif: ToastNotification = {
          id: `sync_notif_${Date.now()}`,
          title: 'Sinkronisasi Otomatis Berhasil',
          message: `${result.successCount} data presensi offline telah berhasil dikirim & diverifikasi ke Firebase Firestore.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);

        // Add activity log
        const newLog: ActivityLog = {
          id: `log_${Date.now()}`,
          action: 'Sync Queue Push to Firebase',
          actor: {
            name: 'Daemon Sync Firebase',
            role: 'System Background',
          },
          category: 'system',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: `${todayDate} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
          date: todayDate,
          description: `Mengirim ${result.successCount} data presensi offline dari antrian lokal ke Firebase Cloud.`,
          status: 'success',
        };
        setActivityLogs((prev) => [newLog, ...prev]);
      }
    } catch (err) {
      console.warn('Background sync failed:', err);
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const triggerHeartbeat = async () => {
    const currentQueue = getSyncQueue();
    const hb = await pingFirebaseHeartbeat(currentQueue.length);
    setHeartbeatState(hb);
    if (hb.isOnline && currentQueue.length > 0) {
      processSyncQueue(currentQueue);
    }
  };

  // Register auto-sync retry callback for syncQueue
  useEffect(() => {
    setAutoSyncCallback(async () => {
      const currentQueue = getSyncQueue();
      if (currentQueue.length > 0) {
        await processSyncQueue(currentQueue);
      }
    });
  }, []);

  // Rate Limiter Violation Listener -> Push directly into ActivityLog for Admin
  const tokenSessionRef = useRef(tokenSession);
  tokenSessionRef.current = tokenSession;
  const userRoleRef = useRef(userRole);
  userRoleRef.current = userRole;

  useEffect(() => {
    const unsubscribe = onRateLimitViolation((event) => {
      const todayDate = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const currentRole = userRoleRef.current;
      const currentSession = tokenSessionRef.current;

      const newLog: ActivityLog = {
        id: `sec_rl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        action: 'Pelanggaran Batas Panggilan API (Rate Limit Exceeded)',
        actor: {
          name: currentSession ? currentSession.displayName : (event.identifier || 'Klien Tidak Terotentikasi'),
          role: currentRole === 'admin' ? 'Administrator' : currentRole === 'piket' ? 'Petugas Piket' : 'Guru / ASN',
        },
        category: 'security',
        time: timeStr,
        timestamp: `${todayDate} ${timeStr}`,
        date: todayDate,
        targetName: event.keyPrefix,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'Browser Client',
        description: event.message || `Deteksi aktivitas mencurigakan: Frekuensi panggilan API melebihi ambang batas aman untuk modul "${event.keyPrefix}". Sistem memblokir sementara (retry setelah ${event.retryAfterSeconds}s) untuk melindungi integritas server.`,
        status: 'error',
      };

      setActivityLogs((prev) => [newLog, ...prev]);

      // Also trigger a system notification banner for visibility
      setNotifications((prev) => [
        {
          id: `notif_rl_${Date.now()}`,
          title: '🛡️ Peringatan Keamanan Sistem (Rate Limit)',
          message: event.message || `Aktivitas mencurigakan/berlebih terdeteksi pada "${event.keyPrefix}". Akses dibatasi sementara.`,
          type: 'warning',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
      ]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Heartbeat Mechanism (Runs every 30 seconds & on online/offline events)
  useEffect(() => {
    const runHeartbeatCheck = async () => {
      await triggerHeartbeat();
    };

    // Initial check
    runHeartbeatCheck();

    // Set 30s interval
    const interval = setInterval(runHeartbeatCheck, 30000);

    // Online & Offline listeners
    const handleOnline = () => {
      console.log('[App] Network restored to online. Notifying SW & triggering sync queue...');
      runHeartbeatCheck();
      notifyServiceWorkerOnline();
      triggerImmediateOnlineSyncRetry();

      // Sinkronisasi otomatis semua antrean offline (presensi, tabel absensi ASN, dan dokumentasi apel)
      syncAllOfflineDataToCloud()
        .then((res) => {
          if (res.totalSynced > 0) {
            const syncNotif: ToastNotification = {
              id: `offline_sync_${Date.now()}`,
              title: '⚡ Sinkronisasi Offline Sukses',
              message: `${res.totalSynced} data offline (${res.attendanceCount} presensi, ${res.tableCount} tabel absensi, ${res.docCount} dokumentasi apel) otomatis terkirim & tersimpan di Firebase Firestore.`,
              type: 'system',
              timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              read: false,
            };
            setNotifications((prev) => [syncNotif, ...prev.slice(0, 8)]);

            const actLog: ActivityLog = {
              id: `act_auto_sync_${Date.now()}`,
              action: 'Sinkronisasi Otomatis Data Offline ke Firebase',
              actor: {
                name: 'Daemon Auto-Sync Cloud',
                role: 'System Background',
              },
              category: 'system',
              time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              timestamp: `${todayDate} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
              date: todayDate,
              description: `Koneksi internet pulih. Berhasil mengirim otomatis ${res.totalSynced} item offline (${res.attendanceCount} absensi, ${res.tableCount} tabel ASN, ${res.docCount} dokumentasi apel) ke Firebase Firestore.`,
              status: 'success',
            };
            setActivityLogs((prev) => [actLog, ...prev]);
          }
        })
        .catch((e) => console.warn('[App] Auto-sync offline data error:', e));
    };
    const handleOffline = () => {
      setHeartbeatState((prev) => ({
        ...prev,
        isOnline: false,
        cloudStatus: 'offline',
        latencyMs: 0,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Service Worker background sync message listener
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'SW_TRIGGER_QUEUE_SYNC' || event.data.type === 'SW_ONLINE_BROADCAST')) {
        console.log('[App] SW background sync signal received:', event.data.reason || event.data.type);
        runHeartbeatCheck();
        triggerImmediateOnlineSyncRetry();
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Storage Space Monitoring (Alerts if available space falls below 10%)
  useEffect(() => {
    const checkStorageQuota = () => {
      // Jika belum pernah ada absensi & izin, jangan beri notifikasi sistem
      if (records.length === 0 && leaves.length === 0) return;
      const stats = getLocalStorageStats();
      if (stats.isLowSpace) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === 'storage_low_space_alert')) return prev;
          const storageAlert: ToastNotification = {
            id: 'storage_low_space_alert',
            title: '⚠️ Kapasitas Memori Lokal Kritis (<10%)',
            message: `Memori penyimpanan lokal browser tersisa ${stats.availablePercentage}% (${stats.usedFormatted} dari perkiraan ${stats.totalFormatted} terpakai). Lakukan pembersihan antrian lama atau ekspor cadangan ke Cloud untuk mencegah kehilangan data presensi di Pulau Taliabu.`,
            type: 'system',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            read: false,
          };
          return [storageAlert, ...prev];
        });
      }
    };

    checkStorageQuota();
    const storageTimer = setInterval(checkStorageQuota, 60000);
    return () => clearInterval(storageTimer);
  }, [records.length, leaves.length, syncQueue.length]);

  // Scheduled Reminder Notification (Every Friday at 14:00 WITA for BKD Export)
  useEffect(() => {
    const checkBkdReminder = () => {
      // Jika belum pernah ada absensi atau pengajuan izin, jangan kirim pengingat BKD
      if (records.length === 0 && leaves.length === 0) return;
      const teacherRecords = records.filter((r) => r.personType === 'teacher');
      const reminderStatus = checkFridayBkdReminder(teacherRecords.length);

      if (reminderStatus.shouldAlert) {
        const notifId = `bkd_friday_reminder_${getWeeklyExportStorageKey()}`;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notifId)) return prev;

          const bkdNotif: ToastNotification = {
            id: notifId,
            title: '📋 Pengingat Ekspor Presensi BKD (Jumat 14:00 WITA)',
            message: `Hari ini hari ${reminderStatus.currentDayName} (${reminderStatus.currentWitaTimeFormatted}). Laporan presensi mingguan GTK/ASN belum diekspor untuk BKD Kabupaten Pulau Taliabu. Buka tab Integrasi Layanan BKD untuk mengunduh laporan CSV/Excel resmi.`,
            type: 'system',
            timestamp: reminderStatus.currentWitaTimeFormatted,
            read: false,
          };
          return [bkdNotif, ...prev];
        });
      }
    };

    checkBkdReminder();
    const bkdTimer = setInterval(checkBkdReminder, 60000);
    return () => clearInterval(bkdTimer);
  }, [records, leaves.length]);

  // Refs to stabilize background timer callbacks and eliminate nested update loops
  const bkdScheduleConfigRef = useRef(bkdScheduleConfig);
  bkdScheduleConfigRef.current = bkdScheduleConfig;
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const teachersRef = useRef(teachers);
  teachersRef.current = teachers;
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const leavesRef = useRef(leaves);
  leavesRef.current = leaves;
  const gtkServicesRef = useRef(gtkServices);
  gtkServicesRef.current = gtkServices;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const piketDutiesRef = useRef(piketDuties);
  piketDutiesRef.current = piketDuties;
  const biometricLogsRef = useRef(biometricLogs);
  biometricLogsRef.current = biometricLogs;
  const activityLogsRef = useRef(activityLogs);
  activityLogsRef.current = activityLogs;
  const configRef = useRef(config);
  configRef.current = config;

  // BKD Automated Dispatch Evaluation Hook (WITA Timed Execution)
  useEffect(() => {
    const runBkdAutomation = () => {
      // Jangan jalankan dispatches jika belum pernah melakukan presensi dan izin
      if (recordsRef.current.length === 0 && leavesRef.current.length === 0) return;

      const { updatedConfig, newLogs } = evaluateAndExecuteBkdDispatches(
        bkdScheduleConfigRef.current,
        recordsRef.current,
        teachersRef.current,
        configRef.current
      );

      if (newLogs.length > 0) {
        setBkdScheduleConfig(updatedConfig);
        setBkdDispatchLogs((prev) => [...newLogs, ...prev]);

        newLogs.forEach((log) => {
          const autoNotif: ToastNotification = {
            id: `bkd_auto_dispatch_${log.id}`,
            title: `🚀 BKD Auto-Dispatch: ${String(log.dispatchType || 'AUTO').toUpperCase()}`,
            message: log.summary,
            type: 'system',
            timestamp: `${log.time} WITA`,
            read: false,
          };
          setNotifications((prev) => [autoNotif, ...prev]);

          const actLog: ActivityLog = {
            id: `act_bkd_${log.id}`,
            action: `BKD Auto-Export ${String(log.dispatchType || 'AUTO').toUpperCase()}`,
            actor: {
              name: 'BKD Automation Daemon',
              role: 'System Scheduler (WITA)',
            },
            category: 'system',
            time: log.time,
            timestamp: log.timestamp,
            date: todayDate,
            description: `Automated dispatch executed: ${log.summary}`,
            status: log.status === 'success' ? 'success' : 'error',
          };
          setActivityLogs((prev) => [actLog, ...prev]);
        });
      }
    };

    runBkdAutomation();
    const bkdAutoInterval = setInterval(runBkdAutomation, 60000);
    return () => clearInterval(bkdAutoInterval);
  }, []);

  // Automated Friday Full-System Auto-Backup to JSON Scheduler Hook
  useEffect(() => {
    const runFridayAutoBackup = () => {
      // Jangan membuat backup notification/log jika data presensi dan izin kosong
      if (recordsRef.current.length === 0 && leavesRef.current.length === 0) return;

      const backupSnapshot: AppBackupData = {
        id: `autobackup_jumat_${Date.now()}`,
        timestamp: new Date().toISOString(),
        createdDate: todayDate,
        createdTime: new Date().toLocaleTimeString('id-ID'),
        source: `Auto-Backup Jumat - ${configRef.current.schoolName}`,
        totalRecords: recordsRef.current.length,
        totalStudents: studentsRef.current.length,
        totalTeachers: teachersRef.current.length,
        totalClasses: classesRef.current.length,
        totalLeaves: leavesRef.current.length,
        totalGtkServices: gtkServicesRef.current.length,
        records: recordsRef.current,
        students: studentsRef.current,
        teachers: teachersRef.current,
        classes: classesRef.current,
        leaves: leavesRef.current,
        gtkServices: gtkServicesRef.current,
        events: eventsRef.current,
        config: configRef.current,
        piketDuties: piketDutiesRef.current,
        biometricLogs: biometricLogsRef.current,
        activityLogs: activityLogsRef.current,
      };

      const result = evaluateFridayAutoBackup(backupSnapshot, configRef.current);
      if (result.shouldBackup && result.payload) {
        triggerJsonDownload(result.payload, result.fileName);
        markFridayAutoBackupRun({
          timestamp: result.payload.timestamp,
          fileName: result.fileName,
          totalRecords: recordsRef.current.length,
        });

        const autoNotif: ToastNotification = {
          id: `auto_backup_${Date.now()}`,
          title: '📦 Auto-Backup JSON Jumat Berhasil!',
          message: `Salinan snapshot sistem (${recordsRef.current.length} presensi, ${studentsRef.current.length} siswa, ${teachersRef.current.length} guru) berhasil diunduh ke folder unduhan pengguna.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        };
        setNotifications((prev) => [autoNotif, ...prev]);

        const actLog: ActivityLog = {
          id: `act_autobackup_${Date.now()}`,
          action: 'Auto-Backup Snapshot Jumat (JSON)',
          actor: {
            name: 'Auto-Backup Scheduler',
            role: 'System Daemon',
          },
          category: 'system',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date().toISOString(),
          date: todayDate,
          description: `Snapshot komprehensif sistem otomatis diekspor ke format JSON (Arsip Mingguan Jumat).`,
          status: 'success',
        };
        setActivityLogs((prev) => [actLog, ...prev]);
      }
    };

    runFridayAutoBackup();
    const backupInterval = setInterval(runFridayAutoBackup, 120000);
    return () => clearInterval(backupInterval);
  }, [todayDate]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_config', JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_classes', JSON.stringify(classes));
    } catch (e) {
      console.error(e);
    }
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_students', JSON.stringify(students));
    } catch (e) {
      console.error(e);
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_teachers', JSON.stringify(teachers));
    } catch (e) {
      console.error(e);
    }
  }, [teachers]);

  // Service Worker Initialization & Stale-While-Revalidate Snapshot Sync
  useEffect(() => {
    registerServiceWorker();

    // Listen for background updates revalidated by the Service Worker
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_DATA_REVALIDATED') {
        console.log('[SW] Data presensi telah direvalidasi di background:', event.data.payload);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // Try recovering snapshot from SW cache if local records are empty
    if (records.length === 0) {
      getCachedAttendanceSnapshotFromSw().then((snapshot) => {
        if (snapshot && Array.isArray(snapshot.records) && snapshot.records.length > 0) {
          console.log('[SW] Memulihkan data presensi dari Service Worker Cache:', snapshot.records.length);
          setRecords(snapshot.records);
        }
      }).catch((e) => console.log('[SW Cache Recovery]', e));
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Sync attendance snapshot to Service Worker cache for offline stale-while-revalidate
  useEffect(() => {
    try {
      cacheAttendanceSnapshotToSw({
        timestamp: new Date().toISOString(),
        records,
        teachers,
        students,
        config,
      });
    } catch (e) {
      console.warn('[SW Snapshot Sync]', e);
    }
  }, [records, teachers, students, config]);

  useEffect(() => {
    saveRecordsToDb(records).catch((e) => console.warn('[IDB Records Save]', e));
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_leaves', JSON.stringify(leaves));
    } catch (e) {
      console.error(e);
    }
  }, [leaves]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_gtk_services', JSON.stringify(gtkServices));
    } catch (e) {
      console.error(e);
    }
  }, [gtkServices]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_events', JSON.stringify(events));
    } catch (e) {
      console.error(e);
    }
  }, [events]);

  useEffect(() => {
    saveActivityLogsToDb(activityLogs).catch((e) => console.warn('[IDB Activity Logs Save]', e));
  }, [activityLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_piket_duties', JSON.stringify(piketDuties));
    } catch (e) {
      console.error(e);
    }
  }, [piketDuties]);

  useEffect(() => {
    saveBiometricLogsToDb(biometricLogs).catch((e) => console.warn('[IDB Biometric Save]', e));
  }, [biometricLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('school_presensi_notifs', JSON.stringify(notifications));
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  const handleRestoreBackup = (data: AppBackupData) => {
    if (data.records) setRecords(data.records);
    if (data.students) setStudents(data.students);
    if (data.teachers) setTeachers(data.teachers);
    if (data.classes) setClasses(data.classes);
    if (data.leaves) setLeaves(data.leaves);
    if (data.gtkServices) setGtkServices(data.gtkServices);
    if (data.events) setEvents(data.events);
    if (data.config) setConfig(data.config);
    if (data.piketDuties) setPiketDuties(data.piketDuties);
    if (data.biometricLogs) setBiometricLogs(data.biometricLogs);
    if (data.activityLogs) setActivityLogs(data.activityLogs);

    // Add activity log
    const restoreLog: ActivityLog = {
      id: `log_${Date.now()}`,
      timestamp: `${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      category: 'system',
      actor: {
        name: config.adminName || 'Admin SIMPEG BKD',
        role: 'Administrator',
      },
      action: 'Pulihkan Cadangan (Restore)',
      description: `Memulihkan data sistem dari snapshot tanggal ${data.createdDate || data.timestamp}`,
      status: 'success',
    };
    setActivityLogs((prev) => [restoreLog, ...prev]);
  };

  // Attendance Handlers
  const handleRecordAttendance = (newRecord: AttendanceRecord) => {
    // 1. Sliding Window Rate Limiting Protection: Cegah spam pemindaian cepat
    const rateCheck = attendanceScanLimiter.check(newRecord.personId);
    if (!rateCheck.allowed) {
      const rateLimitNotif: ToastNotification = {
        id: `rate_limit_${Date.now()}`,
        title: '⚠️ Frekuensi Pemindaian Terlalu Cepat',
        message: rateCheck.message || 'Harap tunggu beberapa detik sebelum memindai personil yang sama.',
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setNotifications((prev) => [rateLimitNotif, ...prev.slice(0, 8)]);
      return;
    }
    attendanceScanLimiter.record(newRecord.personId);

    // 2. Centralized Sanitasi & Regex Validasi Input
    const { sanitized: sanitizedRecord, isValid, errors } = validateAndSanitizeAttendance(newRecord);
    if (!isValid) {
      const valErrNotif: ToastNotification = {
        id: `val_err_${Date.now()}`,
        title: '⚠️ Validasi Input Presensi Gagal',
        message: `Presensi ditolak: ${errors.join(', ')}`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setNotifications((prev) => [valErrNotif, ...prev.slice(0, 8)]);
      return;
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // If offline, stamp as offline queued and enqueue to SyncQueue
    let recordToSave = sanitizedRecord;
    if (!isOnline) {
      recordToSave = {
        ...sanitizedRecord,
        note: sanitizedRecord.note
          ? `${sanitizedRecord.note} • [Tersimpan Lokal - Menunggu Sinyal/Sync]`
          : '[Tersimpan Lokal - Menunggu Sinyal/Sync]',
      };
      enqueueAttendanceRecord(recordToSave);
      setSyncQueue(getSyncQueue());
      setHeartbeatState((prev) => ({
        ...prev,
        pendingQueueCount: getSyncQueue().length,
        cloudStatus: 'offline',
      }));
    } else {
      // Direct Firestore persistent sync with validation
      saveAttendanceToFirestore(recordToSave).catch((err) =>
        console.warn('Simpan Firestore background:', err)
      );
    }

    setRecords((prev) => {
      const existsIndex = prev.findIndex(
        (r) =>
          r.personId === recordToSave.personId &&
          r.date === recordToSave.date &&
          r.type === recordToSave.type
      );
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = recordToSave;
        return updated;
      }
      return [recordToSave, ...prev];
    });

    // Jika menggunakan biometrik/selfie, kirim log biometrik aman dengan verifikasi CSRF & HTTP-only cookies
    if (newRecord.method === 'webauthn_biometric' || newRecord.method === 'selfie_gps') {
      sendBiometricLogUpdate({
        personId: sanitizedRecord.personId,
        personName: sanitizedRecord.personName,
        method: sanitizedRecord.method,
        timestamp: new Date().toISOString(),
      }).catch((e) => console.warn('Biometric log update CSRF:', e));
    }

    const newNotif: ToastNotification = {
      id: `notif_${Date.now()}`,
      title: !isOnline
        ? `Presensi Tersimpan Offline (${recordToSave.personType === 'student' ? 'Siswa' : 'GTK'})`
        : `Presensi ${recordToSave.personType === 'student' ? 'Siswa' : 'Guru'} Berhasil`,
      message: !isOnline
        ? `${recordToSave.personName} disimpan aman di antrian lokal Taliabu. Akan otomatis sinkron ke Firebase saat online.`
        : `${recordToSave.personName} (${recordToSave.classOrSubject}) status: ${recordToSave.status.toUpperCase()} pada ${recordToSave.time} WITA.`,
      type: 'attendance',
      timestamp: recordToSave.time + ' WITA',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 8)]);

    // If online, check if any pending queue needs syncing
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue();
    }
  };

  const handleSaveBatchAttendance = (newRecords: AttendanceRecord[]) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      newRecords.forEach((rec) => {
        enqueueAttendanceRecord({
          ...rec,
          note: rec.note
            ? `${rec.note} • [Batch Offline Sync]`
            : '[Batch Offline Sync]',
        });
      });
      setSyncQueue(getSyncQueue());
    }

    setRecords((prev) => {
      const newIds = newRecords.map((r) => r.personId);
      const filteredOld = prev.filter(
        (r) => !(r.date === todayDate && newIds.includes(r.personId) && r.type === 'masuk')
      );
      return [...newRecords, ...filteredOld];
    });
  };

  const handleDeleteRecord = (id: string) => {
    const targetRecord = records.find((r) => r.id === id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    // Cascade delete from sync queue if queued
    setSyncQueue((prev) => prev.filter((q) => q.record.id !== id));
    // Cascade delete associated biometric log
    setBiometricLogs((prev) =>
      prev.filter(
        (b) =>
          b.recordId !== id &&
          (!targetRecord || b.personId !== targetRecord.personId || b.date !== targetRecord.date)
      )
    );

    if (targetRecord) {
      const actLog: ActivityLog = {
        id: `act_del_rec_${Date.now()}`,
        action: 'Hapus Rekaman Presensi & Log Terkait',
        actor: {
          name: config.adminName || 'Admin Presensi',
          role: 'Administrator',
        },
        category: 'attendance',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        date: todayDate,
        description: `Menghapus data presensi ${targetRecord.personName} (${targetRecord.date} ${targetRecord.time}) beserta riwayat/log terkait.`,
        status: 'info',
      };
      setActivityLogs((prev) => [actLog, ...prev]);
    }

    const notif: ToastNotification = {
      id: `del_rec_${Date.now()}`,
      title: '🗑️ Rekaman Presensi Berhasil Dihapus',
      message: targetRecord
        ? `Presensi ${targetRecord.personName} (${targetRecord.date} ${targetRecord.time}) telah dihapus dari sistem.`
        : 'Rekaman presensi berhasil dihapus.',
      type: 'system',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 15)]);
  };

  // Handlers for Student & Teacher Leaves
  const handleAddLeaveRequest = (newLeave: LeaveRequest) => {
    // 1. Sliding Window Rate Limiting
    const rateCheck = leaveRequestLimiter.check(newLeave.personId);
    if (!rateCheck.allowed) {
      const rateLimitNotif: ToastNotification = {
        id: `leave_rate_limit_${Date.now()}`,
        title: '⚠️ Terlalu Banyak Pengajuan Izin',
        message: rateCheck.message || 'Harap tunggu beberapa saat sebelum mengajukan permohonan izin baru.',
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setNotifications((prev) => [rateLimitNotif, ...prev.slice(0, 8)]);
      return;
    }
    leaveRequestLimiter.record(newLeave.personId);

    // 2. Centralized Sanitasi & Regex Validasi Input
    const { sanitized: sanitizedLeave, isValid, errors } = validateAndSanitizeLeaveRequest(newLeave);
    if (!isValid) {
      const valNotif: ToastNotification = {
        id: `leave_val_${Date.now()}`,
        title: '⚠️ Validasi Pengajuan Izin Gagal',
        message: `Pengajuan ditolak: ${errors.join(', ')}`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setNotifications((prev) => [valNotif, ...prev.slice(0, 8)]);
      return;
    }

    setLeaves((prev) => [sanitizedLeave, ...prev]);

    // Simpan ke Firestore
    saveLeaveToFirestore(sanitizedLeave).catch((e) =>
      console.warn('Save leave to Firestore:', e)
    );

    const newNotif: ToastNotification = {
      id: `notif_${Date.now()}`,
      title: `Pengajuan ${sanitizedLeave.type.toUpperCase()} Baru`,
      message: `${sanitizedLeave.personName} (${sanitizedLeave.classOrSubject}) mengajukan permohonan izin/sakit.`,
      type: 'leave_request',
      timestamp: sanitizedLeave.createdAt + ' WIB',
      leaveId: sanitizedLeave.id,
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleUpdateLeaveStatus = (
    id: string,
    status: 'approved' | 'rejected' | 'returned',
    reviewNote?: string,
    reviewerInfo?: { name: string; role: string }
  ) => {
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
    const targetLeave = leaves.find((l) => l.id === id);

    setLeaves((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated: LeaveRequest = {
          ...l,
          status,
          reviewNote,
        };
        if (status === 'approved') {
          updated.approvedBy = reviewerInfo?.name || (userRole === 'admin' ? 'Administrator' : 'Kepala Sekolah');
          updated.approvedAt = timeNow;
        } else if (status === 'returned') {
          updated.returnedBy = reviewerInfo?.name || (userRole === 'admin' ? 'Administrator' : 'Kepala Sekolah');
          updated.returnReason = reviewNote;
        } else if (status === 'rejected') {
          updated.rejectedBy = reviewerInfo?.name || (userRole === 'admin' ? 'Administrator' : 'Kepala Sekolah');
        }
        return updated;
      })
    );

    const statusLabel = status === 'approved' ? 'Disetujui' : status === 'returned' ? 'Dikembalikan (Revisi)' : 'Ditolak';
    const notif: ToastNotification = {
      id: `notif_${Date.now()}`,
      title: `Status Izin: ${statusLabel}`,
      message: `Permohonan ${targetLeave?.personName || 'GTK/Siswa'} telah ${statusLabel.toLowerCase()} oleh ${reviewerInfo?.name || 'Petugas'}.`,
      type: 'leave_request',
      timestamp: timeNow,
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    const activeAcc = getUserAccountBySessionSync(tokenSession);
    const actLog: ActivityLog = {
      id: `act_${Date.now()}`,
      action: `${statusLabel} Izin ${targetLeave?.type?.toUpperCase() || ''}`,
      actor: {
        name: reviewerInfo?.name || activeAcc?.name || 'Verifikator',
        role: reviewerInfo?.role || (userRole === 'admin' ? 'Admin' : 'Kepala Sekolah'),
      },
      category: 'leave',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      date: todayDate,
      description: `Izin atas nama ${targetLeave?.personName || ''} (${targetLeave?.classOrSubject || ''}) diputuskan [${statusLabel.toUpperCase()}]. Catatan: ${reviewNote || '-'}`,
      status: status === 'approved' ? 'success' : status === 'returned' ? 'warning' : 'error',
    };
    setActivityLogs((prev) => [actLog, ...prev]);
  };

  const handleEditLeaveRequest = (updatedLeave: LeaveRequest) => {
    setLeaves((prev) =>
      prev.map((l) => (l.id === updatedLeave.id ? updatedLeave : l))
    );
    const notif: ToastNotification = {
      id: `notif_${Date.now()}`,
      title: 'Pengajuan Izin Diperbarui',
      message: `Permohonan ${updatedLeave.type.toUpperCase()} atas nama ${updatedLeave.personName} berhasil disimpan.`,
      type: 'leave_request',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    const actLog: ActivityLog = {
      id: `act_${Date.now()}`,
      action: `Edit Permohonan ${updatedLeave.type.toUpperCase()}`,
      actor: { name: updatedLeave.personName, role: updatedLeave.classOrSubject },
      category: 'leave',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      date: todayDate,
      description: `Perubahan pengajuan ${updatedLeave.type} periode ${updatedLeave.startDate} s/d ${updatedLeave.endDate}. Alasan: ${updatedLeave.reason}`,
      status: 'info',
    };
    setActivityLogs((prev) => [actLog, ...prev]);
  };

  const handleDeleteLeaveRequest = (id: string) => {
    const target = leaves.find((l) => l.id === id);
    setLeaves((prev) => prev.filter((l) => l.id !== id));
    const notif: ToastNotification = {
      id: `notif_${Date.now()}`,
      title: 'Pengajuan Izin Dihapus',
      message: `Permohonan izin ${target?.personName || ''} berhasil dihapus dari sistem.`,
      type: 'system',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    const actLog: ActivityLog = {
      id: `act_${Date.now()}`,
      action: `Hapus Permohonan ${target?.type ? target.type.toUpperCase() : 'IZIN'}`,
      actor: { name: target?.personName || 'Pengguna', role: target?.classOrSubject || 'Siswa/Guru' },
      category: 'leave',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      date: todayDate,
      description: `Permohonan izin ${target?.personName || ''} berhasil dihapus dari sistem.`,
      status: 'warning',
    };
    setActivityLogs((prev) => [actLog, ...prev]);
  };

  // Setel posisi koordinat GPS sekolah secara manual
  const handleUpdateSchoolGps = (lat: number, lng: number, radius?: number) => {
    const newCfg: SchoolConfig = {
      ...config,
      schoolLat: lat,
      schoolLng: lng,
      maxRadiusMeters: radius !== undefined ? radius : (config.maxRadiusMeters || 100),
    };
    setConfig(newCfg);
    localStorage.setItem('school_presensi_config', JSON.stringify(newCfg));

    const notif: ToastNotification = {
      id: `gps_manual_${Date.now()}`,
      title: '📍 Posisi GPS Sekolah Diperbarui',
      message: `Pusat koordinat presensi manual berhasil disetel ke: [${lat.toFixed(6)}, ${lng.toFixed(6)}] dengan radius ${newCfg.maxRadiusMeters} meter.`,
      type: 'system',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    const actLog: ActivityLog = {
      id: `act_${Date.now()}`,
      action: 'Atur Posisi GPS Sekolah Manual',
      actor: { name: config.adminName || 'Admin Sekolah', role: 'Administrator' },
      category: 'system',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      date: todayDate,
      description: `Menyetel koordinat pusat geofence sekolah secara manual: Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}, Radius ${newCfg.maxRadiusMeters}m.`,
      status: 'success',
    };
    setActivityLogs((prev) => [actLog, ...prev]);
  };

  // Handlers for GTK Services & Dual Approval
  const handleAddGtkService = (newService: GtkServiceRequest) => {
    setGtkServices((prev) => [newService, ...prev]);
    const newNotif: ToastNotification = {
      id: `notif_${Date.now()}`,
      title: 'Permohonan Layanan GTK Baru',
      message: `${newService.teacherName} mengajukan ${newService.title}. Menunggu verifikasi Kepsek & Admin.`,
      type: 'leave_request',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleApproveGtkKepsek = (serviceId: string, note?: string) => {
    const todayStr = formatDateIndo(new Date().toISOString().split('T')[0]);
    setGtkServices((prev) =>
      prev.map((item) => {
        if (item.id !== serviceId) return item;
        const updatedKepsek = {
          approvedBy: config.principalName || 'Dr. H. Mulyadi, M.Pd.',
          approvedAt: `${todayStr} 09:30 WIB`,
          signatureStamp: `DIGITAL-SIGN-KEPSEK-${config.npsn}-${Date.now().toString().slice(-6)}`,
          status: 'approved' as const,
          role: 'kepala_sekolah' as const,
          note: note || 'Disetujui Kepala Sekolah untuk kelancaran tugas dinas/pengembangan profesi.',
        };

        const finalStatus = item.adminApproval?.status === 'approved' ? 'approved' : 'approved_by_kepsek';
        return {
          ...item,
          kepsekApproval: updatedKepsek,
          status: finalStatus,
        };
      })
    );
  };

  const handleApproveGtkAdmin = (serviceId: string, letterNumber?: string, note?: string) => {
    const todayStr = formatDateIndo(new Date().toISOString().split('T')[0]);
    setGtkServices((prev) =>
      prev.map((item) => {
        if (item.id !== serviceId) return item;
        const updatedAdmin = {
          approvedBy: config.adminName || 'Siti Aminah, S.Kom. (SIMPEG)',
          approvedAt: `${todayStr} 10:15 WIB`,
          signatureStamp: `SIMPEG-VERIFIED-${config.npsn}-${Date.now().toString().slice(-6)}`,
          status: 'approved' as const,
          role: 'admin' as const,
          note: note || 'Diverifikasi oleh SIMPEG dan dicatat ke sistem presensi resmi.',
        };

        const finalLetterNumber =
          letterNumber ||
          item.officialLetterNumber ||
          `800/${Math.floor(100 + Math.random() * 900)}/SMAN1-DISDIK/${new Date().getFullYear()}`;

        const finalStatus = item.kepsekApproval?.status === 'approved' ? 'approved' : 'approved_by_admin';
        return {
          ...item,
          adminApproval: updatedAdmin,
          officialLetterNumber: finalLetterNumber,
          status: finalStatus,
        };
      })
    );
  };

  const handleRejectGtkService = (
    serviceId: string,
    reason: string,
    actionType: 'reject' | 'return' = 'reject',
    reviewerRole: 'kepala_sekolah' | 'admin' | 'both' = 'both'
  ) => {
    const isReturn = actionType === 'return';
    const statusVal: 'rejected' | 'returned' = isReturn ? 'returned' : 'rejected';
    const actorName =
      reviewerRole === 'admin'
        ? config.adminName || 'Admin SIMPEG'
        : config.principalName || 'Kepala Sekolah';
    const actorRole = reviewerRole === 'admin' ? 'Administrator SIMPEG' : 'Kepala Sekolah';
    const todayStr = formatDateIndo(new Date().toISOString().split('T')[0]);

    let targetService: GtkServiceRequest | undefined;

    setGtkServices((prev) =>
      prev.map((item) => {
        if (item.id !== serviceId) return item;
        targetService = item;

        const newKepsekApproval =
          reviewerRole === 'admin'
            ? item.kepsekApproval
            : {
                approvedBy: config.principalName || 'Kepala Sekolah',
                role: 'kepala_sekolah' as const,
                status: statusVal,
                timestamp: `${todayStr} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
                note: reason,
              };

        const newAdminApproval =
          reviewerRole === 'kepala_sekolah'
            ? item.adminApproval
            : {
                approvedBy: config.adminName || 'Admin SIMPEG',
                role: 'admin' as const,
                status: statusVal,
                timestamp: `${todayStr} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
                note: reason,
              };

        return {
          ...item,
          status: statusVal,
          returnReason: isReturn ? reason : undefined,
          rejectionReason: !isReturn ? reason : undefined,
          returnedBy: isReturn ? actorName : undefined,
          rejectedBy: !isReturn ? actorName : undefined,
          kepsekApproval: newKepsekApproval,
          adminApproval: newAdminApproval,
        };
      })
    );

    const notif: ToastNotification = {
      id: `gtk_act_${Date.now()}`,
      title: isReturn ? '↩️ Berkas GTK Dikembalikan' : '✕ Pengajuan GTK Ditolak',
      message: `Permohonan "${targetService?.title || 'Layanan GTK'}" milik ${targetService?.teacherName || 'Guru'} telah ${isReturn ? 'dikembalikan untuk perbaikan' : 'ditolak'}. Alasan: ${reason}`,
      type: 'gtk_service',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    const actLog: ActivityLog = {
      id: `act_${Date.now()}`,
      action: isReturn ? 'Kembalikan Berkas Layanan GTK' : 'Tolak Permohonan Layanan GTK',
      actor: { name: actorName, role: actorRole },
      category: 'gtk_service',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      date: todayDate,
      description: `${isReturn ? 'Mengembalikan berkas untuk revisi' : 'Menolak permohonan'} ${targetService?.title || ''} milik ${targetService?.teacherName || ''}. Catatan: ${reason}`,
      status: isReturn ? 'warning' : 'error',
    };
    setActivityLogs((prev) => [actLog, ...prev]);
  };

  // Student CRUD
  const handleAddStudent = (student: Student) => {
    const { sanitized, isValid, errors } = validateAndSanitizeStudent(student);
    if (!isValid) {
      const errNotif: ToastNotification = {
        id: `stu_val_${Date.now()}`,
        title: '⚠️ Validasi Siswa Gagal',
        message: `Data siswa tidak valid: ${errors.join(', ')}`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setNotifications((prev) => [errNotif, ...prev.slice(0, 8)]);
      return;
    }
    setStudents((prev) => [sanitized, ...prev]);
    showToast('Siswa Baru Berhasil Ditambahkan', `Data siswa "${sanitized.name}" (${sanitized.className}) telah disimpan.`, 'success', 4000);
  };

  const handleUpdateStudent = (student: Student) => {
    const { sanitized, isValid, errors } = validateAndSanitizeStudent(student);
    if (!isValid) {
      showToast('Validasi Siswa Gagal', `Pembaruan siswa tidak valid: ${errors.join(', ')}`, 'error', 5000);
      return;
    }

    // Capture prevValue vs newValue for ActivityLog diffing
    const prevStudent = students.find((s) => s.id === sanitized.id);
    if (prevStudent) {
      const editAuditLog = createEntityEditAuditLog(
        'Student',
        sanitized.id,
        sanitized.name,
        prevStudent,
        sanitized,
        {
          name: config.adminName || 'Admin Presensi',
          role: userRole === 'admin' ? 'Administrator' : 'Petugas Sekolah',
        },
        todayDate
      );
      if (editAuditLog) {
        setActivityLogs((prev) => [editAuditLog, ...prev.slice(0, 49)]);
      }
    }

    setStudents((prev) => prev.map((s) => (s.id === sanitized.id ? sanitized : s)));
    showToast('Data Siswa Berhasil Diperbarui', `Perubahan data untuk siswa "${sanitized.name}" (${sanitized.className}) telah disimpan.`, 'success', 4000);
  };

  const handleDeleteStudent = (id: string) => {
    const targetStudent = students.find((s) => s.id === id);
    setStudents((prev) => prev.filter((s) => s.id !== id));
    // Cascade delete attendance records
    setRecords((prev) =>
      prev.filter((r) => r.personId !== id && (!targetStudent || r.identifier !== targetStudent.nisn))
    );
    // Cascade delete biometric logs
    setBiometricLogs((prev) => prev.filter((b) => b.personId !== id));
    // Cascade delete leave requests
    setLeaves((prev) => prev.filter((l) => l.personId !== id));

    showToast('Data Siswa Dihapus', `Siswa "${targetStudent?.name || 'Siswa'}" beserta catatan terkait telah dihapus dari sistem.`, 'warning', 4000);
  };

  // Teacher CRUD
  const handleAddTeacher = (teacher: Teacher) => {
    const { sanitized, isValid, errors } = validateAndSanitizeTeacher(teacher);
    if (!isValid) {
      showToast('Validasi Guru / GTK Gagal', `Data GTK tidak valid: ${errors.join(', ')}`, 'error', 5000);
      return;
    }
    setTeachers((prev) => [sanitized, ...prev]);
    showToast('Guru / GTK Berhasil Ditambahkan', `Data "${sanitized.name}" (${sanitized.subject}) berhasil disimpan ke sistem.`, 'success', 4000);
  };

  const handleUpdateTeacher = (teacher: Teacher) => {
    const { sanitized, isValid, errors } = validateAndSanitizeTeacher(teacher);
    if (!isValid) {
      showToast('Validasi Guru / GTK Gagal', `Pembaruan GTK tidak valid: ${errors.join(', ')}`, 'error', 5000);
      return;
    }

    // Capture prevValue vs newValue for ActivityLog diffing
    const prevTeacher = teachers.find((t) => t.id === sanitized.id);
    if (prevTeacher) {
      const editAuditLog = createEntityEditAuditLog(
        'Teacher',
        sanitized.id,
        sanitized.name,
        prevTeacher,
        sanitized,
        {
          name: config.adminName || 'Admin Presensi',
          role: userRole === 'admin' ? 'Administrator' : 'Petugas Sekolah',
        },
        todayDate
      );
      if (editAuditLog) {
        setActivityLogs((prev) => [editAuditLog, ...prev.slice(0, 49)]);
      }
    }

    setTeachers((prev) => prev.map((t) => (t.id === sanitized.id ? sanitized : t)));
    showToast('Data Guru / GTK Berhasil Diperbarui', `Perubahan data "${sanitized.name}" telah berhasil disimpan.`, 'success', 4000);
  };

  const handleDeleteTeacher = (id: string) => {
    const targetTeacher = teachers.find((t) => t.id === id);
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    // Cascade delete attendance records
    setRecords((prev) =>
      prev.filter((r) => r.personId !== id && (!targetTeacher || r.identifier !== targetTeacher.nip))
    );
    // Cascade delete biometric logs
    setBiometricLogs((prev) => prev.filter((b) => b.personId !== id));
    // Cascade delete leave requests
    setLeaves((prev) => prev.filter((l) => l.personId !== id));
    // Cascade delete GTK service requests
    setGtkServices((prev) => prev.filter((g) => g.teacherId !== id));
    // Cascade delete piket duties
    setPiketDuties((prev) => prev.filter((p) => p.teacherId !== id));

    showToast('Data Guru / GTK Dihapus', `Data "${targetTeacher?.name || 'Guru'}" beserta riwayat terkait telah dihapus dari sistem.`, 'warning', 4000);
  };

  // Academic Events
  const handleAddEvent = (event: AcademicEvent) => {
    setEvents((prev) => [...prev, event]);
    showToast('Agenda Kalender Ditambahkan', `Kegiatan "${event.title}" (${event.date}) berhasil dicatat di kalender akademik.`, 'success', 4000);
  };

  // Teacher Piket Handlers
  const handleAddPiketDuty = (duty: TeacherPiketDuty) => {
    setPiketDuties((prev) => [duty, ...prev]);
    showToast('Jadwal Guru Piket Ditambahkan', `Jadwal piket untuk ${duty.teacherName} (${duty.dayOfWeek}) berhasil disimpan.`, 'success', 4000);
  };

  const handleUpdatePiketDuty = (duty: TeacherPiketDuty) => {
    setPiketDuties((prev) => prev.map((d) => (d.id === duty.id ? duty : d)));
    showToast('Jadwal Guru Piket Diperbarui', `Perubahan jadwal piket ${duty.teacherName} berhasil disimpan.`, 'success', 4000);
  };

  const handleDeletePiketDuty = (id: string) => {
    const targetDuty = piketDuties.find((d) => d.id === id);
    setPiketDuties((prev) => prev.filter((d) => d.id !== id));
    showToast('Jadwal Guru Piket Dihapus', `Jadwal piket ${targetDuty?.teacherName || ''} (${targetDuty?.dayOfWeek || ''}) telah dihapus.`, 'warning', 4000);
  };

  const handleUpdateDutyStatus = (id: string, status: 'scheduled' | 'active' | 'completed') => {
    setPiketDuties((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status } : d))
    );
  };

  // Class / Rombel CRUD
  const handleAddClass = (newClass: SchoolClass) => {
    setClasses((prev) => [...prev, newClass]);
    showToast('Rombel Kelas Ditambahkan', `Kelas "${newClass.name}" (Tingkat ${newClass.grade}) berhasil dibuat.`, 'success', 4000);
  };

  const handleUpdateClass = (updatedClass: SchoolClass) => {
    setClasses((prev) => prev.map((c) => (c.id === updatedClass.id ? updatedClass : c)));
    setStudents((prev) =>
      prev.map((s) =>
        s.classId === updatedClass.id ? { ...s, className: updatedClass.name } : s
      )
    );
    showToast('Rombel Kelas Diperbarui', `Perubahan data untuk rombel "${updatedClass.name}" telah disimpan.`, 'success', 4000);
  };

  const handleDeleteClass = (classId: string) => {
    const targetClass = classes.find((c) => c.id === classId);
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    if (targetClass) {
      const studentIdsInClass = students.filter((s) => s.classId === classId).map((s) => s.id);
      setStudents((prev) => prev.filter((s) => s.classId !== classId));
      setRecords((prev) =>
        prev.filter(
          (r) =>
            !studentIdsInClass.includes(r.personId) &&
            r.classOrSubject !== targetClass.name
        )
      );
      setBiometricLogs((prev) => prev.filter((b) => !studentIdsInClass.includes(b.personId)));
      setLeaves((prev) => prev.filter((l) => !studentIdsInClass.includes(l.personId)));
    }
    showToast('Rombel Kelas Dihapus', `Kelas "${targetClass?.name || 'Kelas'}" berhasil dihapus dari sistem.`, 'warning', 4000);
  };

  const handleBatchUpdateClasses = (newClasses: SchoolClass[]) => {
    setClasses(newClasses);
    showToast('Data Rombel Disinkronkan', `${newClasses.length} rombongan belajar berhasil diperbarui.`, 'info', 4000);
  };

  // Clear all dummy data & history
  const handleClearAllData = () => {
    setStudents([]);
    setTeachers([]);
    setClasses([]);
    setRecords([]);
    setLeaves([]);
    setGtkServices([]);
    setEvents([]);
    setActivityLogs([]);
    setPiketDuties([]);
    setBiometricLogs([]);
    setNotifications([]);
    setBkdDispatchLogs([]);
    setSyncQueue([]);
    localStorage.removeItem('school_presensi_students');
    localStorage.removeItem('school_presensi_teachers');
    localStorage.removeItem('school_presensi_classes');
    localStorage.removeItem('school_presensi_records');
    localStorage.removeItem('school_presensi_leaves');
    localStorage.removeItem('school_presensi_gtk_services');
    localStorage.removeItem('school_presensi_events');
    localStorage.removeItem('school_presensi_activity_logs');
    localStorage.removeItem('school_presensi_piket_duties');
    localStorage.removeItem('school_presensi_biometric_logs');
    localStorage.removeItem('school_presensi_notifs');
    localStorage.removeItem('school_presensi_bkd_logs');
    localStorage.removeItem('school_presensi_sync_queue');
    setNotifications([
      {
        id: `clear_all_${Date.now()}`,
        title: '🧹 Seluruh Data & Riwayat Berhasil Dikosongkan',
        message: 'Seluruh data dummy, personil, dan riwayat presensi telah berhasil dihapus secara menyeluruh.',
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      },
    ]);
  };

  // Clear history and logs only, keeping master data intact
  const handleClearHistoryOnly = () => {
    setRecords([]);
    setLeaves([]);
    setGtkServices([]);
    setBiometricLogs([]);
    setActivityLogs([]);
    setNotifications([]);
    setBkdDispatchLogs([]);
    setSyncQueue([]);
    localStorage.removeItem('school_presensi_records');
    localStorage.removeItem('school_presensi_leaves');
    localStorage.removeItem('school_presensi_gtk_services');
    localStorage.removeItem('school_presensi_biometric_logs');
    localStorage.removeItem('school_presensi_activity_logs');
    localStorage.removeItem('school_presensi_notifs');
    localStorage.removeItem('school_presensi_bkd_logs');
    localStorage.removeItem('school_presensi_sync_queue');
    setNotifications([
      {
        id: `clear_hist_${Date.now()}`,
        title: '🧹 Riwayat Presensi & Log Berhasil Dikosongkan',
        message: 'Seluruh riwayat kehadiran, permohonan izin, log biometrik, dan aktivitas berhasil dibersihkan. Data master siswa & guru tetap aman.',
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      },
    ]);
  };

  const [isForceSyncing, setIsForceSyncing] = useState(false);

  // Force Full Sync: triggers a thorough synchronization between all local data and Firebase, ignoring queue and validating integrity
  const handleForceFullSync = async () => {
    setIsForceSyncing(true);
    try {
      const backupSnapshot: AppBackupData = {
        id: `full_sync_${Date.now()}`,
        timestamp: new Date().toISOString(),
        createdDate: todayDate,
        createdTime: new Date().toLocaleTimeString('id-ID'),
        source: `SIMPEG & Presensi Cloud Daemon - ${config.schoolName}`,
        totalRecords: records.length,
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalLeaves: leaves.length,
        totalGtkServices: gtkServices.length,
        records,
        students,
        teachers,
        classes,
        leaves,
        gtkServices,
        events,
        config,
        piketDuties,
        biometricLogs,
        activityLogs,
      };

      const result = await performForceFullSyncToFirestore(backupSnapshot);

      // Kirim event sinkronisasi database yang terproteksi CSRF ke backend server
      sendDatabaseSync({
        recordsCount: records.length,
        source: 'Force Full Sync Firebase',
      }).catch((csrfErr) => console.warn('Sync CSRF backend:', csrfErr));

      // Flush local sync queue as everything is validated
      setSyncQueue([]);
      saveSyncQueue([]);

      // Mark records as synced to cloud
      setRecords((prev) =>
        prev.map((r) => ({
          ...r,
          syncedToCloud: true,
          cloudSyncAt: new Date().toISOString(),
        }))
      );

      const syncNotif: ToastNotification = {
        id: `force_sync_${Date.now()}`,
        title: '✅ Force Full Sync Firebase Berhasil!',
        message: result.message,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setNotifications((prev) => [syncNotif, ...prev]);

      const actLog: ActivityLog = {
        id: `act_sync_${Date.now()}`,
        action: 'Force Full Sync Database',
        actor: {
          name: config.adminName || 'Admin SIMPEG / Sistem',
          role: 'Administrator',
        },
        category: 'system',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        date: todayDate,
        description: `Menyelaraskan ${records.length} presensi, ${students.length} siswa, ${teachers.length} guru secara utuh dengan server Firebase Firestore.`,
        status: 'success',
      };
      setActivityLogs((prev) => [actLog, ...prev]);
    } catch (err: any) {
      console.error('Force Full Sync Error:', err);
      setNotifications((prev) => [
        {
          id: `sync_err_${Date.now()}`,
          title: '⚠️ Status Sinkronisasi Disimpan',
          message: err.message || 'Sinkronisasi lokal selesai dan akan diteruskan ke server Firestore.',
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
      ]);
    } finally {
      setIsForceSyncing(false);
    }
  };

  // Notification handlers
  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleReviewLeave = (_leaveId?: string) => {
    setActiveTab('leaves');
  };

  // Simulation Trigger: simulate realistic incoming attendance / leave request
  const handleTriggerSimulation = () => {
    playBeepSound();
    const isLeave = Math.random() > 0.5;
    if (isLeave && students.length > 0) {
      const randStudent = students[Math.floor(Math.random() * students.length)];
      const simLeave: LeaveRequest = {
        id: `sim_leave_${Date.now()}`,
        personId: randStudent.id,
        personName: randStudent.name,
        personType: 'student',
        classOrSubject: randStudent.className,
        type: 'sakit',
        startDate: todayDate,
        endDate: todayDate,
        reason: 'Demam dan flu, sedang beristirahat di rumah (Simulasi Otomatis).',
        documentName: 'surat_keterangan_dokter_simulasi.pdf',
        status: 'pending',
        createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      handleAddLeaveRequest(simLeave);
    } else if (teachers.length > 0) {
      const randTeacher = teachers[Math.floor(Math.random() * teachers.length)];
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const simRecord: AttendanceRecord = {
        id: `sim_rec_${Date.now()}`,
        personId: randTeacher.id,
        personType: 'teacher',
        personName: randTeacher.name,
        identifier: randTeacher.nip,
        classOrSubject: randTeacher.subject,
        date: todayDate,
        time: timeStr,
        type: 'masuk',
        status: 'hadir',
        method: 'selfie_gps',
        employmentStatus: randTeacher.employmentStatus,
        location: {
          lat: config?.schoolLat ?? -1.8214,
          lng: config?.schoolLng ?? 124.7081,
          address: 'Lobby Gedung Utama (Verifikasi GPS Sukses)',
          inRadius: true,
          distanceMeter: 8,
        },
        photoUrl: randTeacher.avatar,
        note: 'Presensi Selfie + GPS Terverifikasi BKD (Simulasi)',
      };
      handleRecordAttendance(simRecord);
    }
  };

  // Reset to default factory settings
  const handleResetToDefault = () => {
    setConfig(INITIAL_SCHOOL_CONFIG);
    setClasses(INITIAL_CLASSES);
    setStudents(INITIAL_STUDENTS);
    setTeachers(INITIAL_TEACHERS);
    setRecords(INITIAL_ATTENDANCE_RECORDS);
    setLeaves(INITIAL_LEAVE_REQUESTS);
    setGtkServices(INITIAL_GTK_SERVICES);
    setEvents(INITIAL_ACADEMIC_EVENTS);
    setNotifications(INITIAL_NOTIFICATIONS);
    localStorage.clear();
    alert('Seluruh data presensi, GTK, siswa, kalender dan konfigurasi sekolah berhasil dikembalikan ke pengaturan awal!');
  };

  const safeLeaves = leaves || [];
  const safeRecords = records || [];
  const safeGtkServices = gtkServices || [];
  const pendingLeavesCount = safeLeaves.filter((l) => l.status === 'pending').length;
  const pendingGtkCount = safeGtkServices.filter((s) => s.status !== 'approved' && s.status !== 'rejected').length;
  const todayRecordsCount = safeRecords.filter((r) => r.date === todayDate).length;

  // Redirect otomatis ke halaman login jika pengguna mengakses web app tanpa sesi aktif
  if (!tokenSession) {
    return (
      <LoginPage
        config={config}
        students={students}
        onLoginSuccess={(session, role) => {
          saveTokenSession(session);
          setTokenSession(session);
          setUserRole(role);
          // Set tab awal sesuai role:
          // Pada role Guru dan Siswa, Menu Utama dihapus dan langsung aktif ke Metode Presensi
          const initialTab: ActiveTab =
            role === 'guru' || role === 'siswa'
              ? 'selfie'
              : role === 'piket'
              ? 'scan'
              : 'dashboard';
          setActiveTab(initialTab);
          showToast(
            'Login Berhasil',
            `Selamat datang! Anda masuk sebagai ${
              role === 'admin'
                ? 'Administrator'
                : role === 'guru'
                ? 'Guru'
                : role === 'piket'
                ? 'Petugas Guru Piket'
                : 'Peserta Didik'
            }. Peran terkunci selama sesi ini aktif.`,
            'success',
            3500
          );
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900 selection:bg-indigo-600 selection:text-white font-sans antialiased relative">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        config={config}
        userRole={userRole}
        setUserRole={setUserRole}
        pendingLeavesCount={pendingLeavesCount + pendingGtkCount}
        totalTodayCount={todayRecordsCount}
        isMobileOpen={isSidebarOpen}
        setIsMobileOpen={setIsSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onTriggerSimulation={handleTriggerSimulation}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenIconModal={() => setIsIconModalOpen(true)}
        onOpenOnboardingGuide={() => setIsOnboardingOpen(true)}
        isSidebarLocked={isSidebarLocked}
        onToggleSidebarLock={handleToggleSidebarLock}
        autoHideOnSelect={autoHideOnSelect}
        onToggleAutoHide={handleToggleAutoHide}
        onCloseSidebar={handleCloseSidebar}
        onOpenSecurityModal={handleOpenSecurityModal}
        onLogout={handleLogout}
      />

      {/* Floating 3-Line Menu Button when Sidebar is Closed */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={handleToggleSidebar}
          className="fixed bottom-5 left-5 z-40 bg-white hover:bg-slate-50 text-slate-800 shadow-md px-3.5 py-2 rounded-xl flex items-center space-x-2 text-xs font-semibold transition-all cursor-pointer border border-slate-200 group"
          title="Munculkan Menu Sidebar (Ikon Garis 3)"
          aria-label="Munculkan Sidebar"
        >
          <Menu className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" strokeWidth={2} />
          <span>Menu Presensi</span>
        </button>
      )}

      {/* Floating Download / Install App Button for All Phones & Laptops */}
      {!isStandalone && (
        <button
          type="button"
          onClick={() => setIsInstallModalOpen(true)}
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg px-3.5 py-2 rounded-xl flex items-center space-x-2 text-xs font-bold transition-all cursor-pointer border border-indigo-500/30 group"
          title="Download & Pasang Aplikasi untuk Semua Jenis HP & Laptop"
          aria-label="Download Aplikasi"
        >
          <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Download Aplikasi</span>
          <span className="sm:hidden">Download App</span>
        </button>
      )}

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col min-w-0 overflow-x-hidden transition-all duration-200 ${
          isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
        }`}
      >
        {/* Top Header & Notification Banner */}
        <NotificationBanner
          notifications={notifications}
          onDismissToast={handleDismissNotification}
          onReviewLeave={handleReviewLeave}
          onTriggerSimulation={handleTriggerSimulation}
          pendingLeaves={safeLeaves}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onOpenMobileMenu={handleToggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          config={config}
          userRole={userRole}
          syncQueueCount={syncQueue.length}
          isSyncingQueue={isSyncingQueue}
          onManualSync={() => processSyncQueue()}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          onOpenIconModal={() => setIsIconModalOpen(true)}
          onOpenOnboardingGuide={() => setIsOnboardingOpen(true)}
          onOpenSecurityModal={handleOpenSecurityModal}
          onLogout={handleLogout}
        />

        {/* Content Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <ErrorBoundary
            key={activeTab}
            activeTab={activeTab}
            onResetComponent={() => setActiveTab(activeTab)}
            onNavigateHome={() =>
              setActiveTab(
                userRole === 'guru' || userRole === 'siswa'
                  ? 'selfie'
                  : userRole === 'piket'
                  ? 'scan'
                  : 'dashboard'
              )
            }
          >
            <Suspense fallback={<TabSuspenseFallback />}>
              {activeTab === 'dashboard' && (
            <DashboardStats
              records={records}
              students={students}
              teachers={teachers}
              classes={classes}
              leaveRequests={leaves}
              leaves={leaves}
              gtkServices={gtkServices}
              config={config}
              setActiveTab={handleTabChange}
              onNavigateTab={handleTabChange}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
            />
          )}

          {activeTab === 'scan' && (
            <QrScannerTab
              todayDate={todayDate}
              students={students}
              teachers={teachers}
              config={config}
              events={events}
              onRecordAttendance={handleRecordAttendance}
              existingRecords={records}
              onAddActivityLog={(newLog) => setActivityLogs((prev) => [newLog, ...prev])}
            />
          )}

          {activeTab === 'selfie' && (
            <SelfieGpsTab
              todayDate={todayDate}
              students={students}
              teachers={teachers}
              config={config}
              events={events}
              onRecordAttendance={handleRecordAttendance}
              existingRecords={records}
              onUpdateSchoolGps={handleUpdateSchoolGps}
              onAddActivityLog={(newLog) => setActivityLogs((prev) => [newLog, ...prev])}
            />
          )}

          {activeTab === 'asn_attendance_table' && (
            <AsnAttendanceTableTab
              teachers={teachers}
              config={config}
              records={records}
              gtkServices={gtkServices}
              leaves={leaves}
              todayDate={todayDate}
              onRecordAttendance={handleRecordAttendance}
              onAddActivityLog={(newLog) => setActivityLogs((prev) => [newLog, ...prev])}
              onAddTeachers={(newTeachers) => {
                const merged = [...teachers];
                newTeachers.forEach((t) => {
                  if (!merged.some((m) => m.nip === t.nip || m.id === t.id)) {
                    merged.push(t);
                  }
                });
                setTeachers(merged);
                try {
                  localStorage.setItem('school_presensi_teachers', JSON.stringify(merged));
                } catch (e) {
                  console.warn(e);
                }
              }}
            />
          )}

          {activeTab === 'batch_class' && (
            <BatchClassAttendance
              todayDate={todayDate}
              classes={classes}
              students={students}
              config={config}
              events={events}
              existingRecords={records}
              onSaveBatchAttendance={handleSaveBatchAttendance}
            />
          )}

          {activeTab === 'rekap' && (
            <RekapitulasiView
              records={records}
              classes={classes}
              students={students}
              teachers={teachers}
              gtkServices={gtkServices}
              config={config}
              todayDate={todayDate}
              onDeleteRecord={handleDeleteRecord}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'layanan_gtk' && (
            <GtkServicesTab
              services={gtkServices}
              teachers={teachers}
              config={config}
              userRole={userRole}
              currentAccount={getUserAccountBySessionSync(tokenSession) || undefined}
              onAddService={handleAddGtkService}
              onApproveKepsek={handleApproveGtkKepsek}
              onApproveAdmin={handleApproveGtkAdmin}
              onRejectService={handleRejectGtkService}
            />
          )}

          {activeTab === 'workspace' && (
            <GoogleWorkspaceTab
              records={records}
              config={config}
              events={events}
              gtkServices={gtkServices}
              userRole={userRole}
            />
          )}

          {activeTab === 'logs' && (
            <ActivityLogsTab
              logs={activityLogs}
              onClearLogs={() => setActivityLogs([])}
              onAddLog={(partialLog) => {
                const now = new Date();
                const dStr = now.toISOString().split('T')[0];
                const tStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const fullLog: ActivityLog = {
                  ...partialLog,
                  id: `log_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  timestamp: `${dStr} ${tStr}`,
                  date: dStr,
                  time: tStr,
                };
                setActivityLogs((prev) => [fullLog, ...prev]);
              }}
              schoolConfig={config}
              userRole={userRole}
            />
          )}

          {activeTab === 'leaves' && (
            <LeaveRequestsTab
              leaves={leaves}
              students={students}
              teachers={teachers}
              todayDate={todayDate}
              config={config}
              userRole={userRole}
              currentAccount={getUserAccountBySessionSync(tokenSession) || undefined}
              onAddLeaveRequest={handleAddLeaveRequest}
              onUpdateLeaveStatus={handleUpdateLeaveStatus}
              onEditLeaveRequest={handleEditLeaveRequest}
              onDeleteLeaveRequest={handleDeleteLeaveRequest}
            />
          )}

          {activeTab === 'teachers' && (
            <TeacherManagementTab
              teachers={teachers}
              onAddTeacher={handleAddTeacher}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              setActiveTab={setActiveTab}
              onAddNotification={(notif) => setNotifications((prev) => [notif, ...prev])}
            />
          )}

          {activeTab === 'students' && (
            <StudentManagementTab
              students={students}
              classes={classes}
              teachers={teachers}
              config={config}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
              onBatchUpdateClasses={handleBatchUpdateClasses}
              onAddNotification={(notif) => setNotifications((prev) => [notif, ...prev])}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'cards' && (
            <StudentCardsTab
              students={students}
              teachers={teachers}
              classes={classes}
              config={config}
              userRole={userRole}
              currentAccount={getUserAccountBySessionSync(tokenSession) || undefined}
            />
          )}

          {activeTab === 'calendar' && (
            <AcademicCalendarTab
              events={events}
              onAddEvent={handleAddEvent}
              config={config}
            />
          )}

          {activeTab === 'piket' && (
            <TeacherPiketTab
              piketDuties={piketDuties}
              teachers={teachers}
              config={config}
              onAddDuty={handleAddPiketDuty}
              onUpdateDuty={handleUpdatePiketDuty}
              onDeleteDuty={handleDeletePiketDuty}
              onUpdateDutyStatus={handleUpdateDutyStatus}
              onAddNotification={(notif) => setNotifications((prev) => [notif, ...prev])}
            />
          )}

          {activeTab === 'biometric_logs' && (
            <BiometricLogsTab
              logs={biometricLogs}
              teachers={teachers}
              students={students}
              config={config}
              onClearLogs={() => setBiometricLogs([])}
              onUpdateLogs={(newLogs) => setBiometricLogs(newLogs)}
              onAddNotification={(notif) => setNotifications((prev) => [notif, ...prev])}
            />
          )}

          {activeTab === 'service_integration' && (
            <ServiceIntegrationTab
              records={records}
              teachers={teachers}
              config={config}
              scheduleConfig={bkdScheduleConfig}
              onUpdateScheduleConfig={setBkdScheduleConfig}
              dispatchLogs={bkdDispatchLogs}
              onAddDispatchLog={(log) => setBkdDispatchLogs((prev) => [log, ...prev])}
              syncQueue={syncQueue}
              onManualSync={() => processSyncQueue()}
              isSyncingQueue={isSyncingQueue}
              onQueueUpdated={() => setSyncQueue(getSyncQueue())}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab
              config={config}
              onSaveConfig={(newCfg) => {
                // Capture prevValue vs newValue for SchoolConfig audit trail
                const editAuditLog = createEntityEditAuditLog(
                  'SchoolConfig',
                  newCfg.npsn || 'config_school',
                  newCfg.schoolName || 'Pengaturan Sekolah',
                  config,
                  newCfg,
                  {
                    name: config.adminName || 'Admin Presensi',
                    role: userRole === 'admin' ? 'Administrator' : 'Petugas Sekolah',
                  },
                  todayDate
                );
                if (editAuditLog) {
                  setActivityLogs((prev) => [editAuditLog, ...prev.slice(0, 49)]);
                }

                setConfig(newCfg);
                try {
                  localStorage.setItem('school_presensi_config', JSON.stringify(newCfg));
                } catch (e) {
                  console.error(e);
                }
                updateDocumentAppIcon(newCfg.appIconUrl || newCfg.logoUrl);
                showToast(
                  'Pengaturan Aplikasi Disimpan',
                  `Konfigurasi sekolah ${newCfg.schoolName || ''} dan parameter presensi berhasil diperbarui.`,
                  'success',
                  4000
                );
              }}
              onResetToDefault={handleResetToDefault}
              onClearAllData={handleClearAllData}
              onClearHistoryOnly={handleClearHistoryOnly}
              onForceFullSync={handleForceFullSync}
              isForceSyncing={isForceSyncing}
              appBackupData={{
                records,
                students,
                teachers,
                classes,
                leaves,
                gtkServices,
                events,
                config,
                piketDuties,
                biometricLogs,
                activityLogs,
              }}
              onRestoreBackup={handleRestoreBackup}
            />
          )}

          {activeTab === 'security_center' && (
            <SecurityCenterTab
              userRole={userRole}
              tokenSession={tokenSession}
              onOpenSecurityModal={handleOpenSecurityModal}
              onOpenToast={(title, message) => {
                const secNotif: ToastNotification = {
                  id: `sec_${Date.now()}`,
                  title,
                  message,
                  type: 'system',
                  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  read: false,
                };
                setNotifications((prev) => [secNotif, ...prev.slice(0, 8)]);
              }}
            />
          )}

            {activeTab === 'hardware_diagnostic' && (
              <HardwareDiagnosticTab
                config={config}
                onAddActivityLog={(newLog) => setActivityLogs((prev) => [newLog, ...prev])}
                todayDate={todayDate}
              />
            )}

            {activeTab === 'accounts' && (
              <UserAccountsTab
                teachers={teachers}
                students={students}
                onOpenToast={(title, message) => showToast(title, message, 'info')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                userRole={userRole}
                tokenSession={tokenSession}
                config={config}
                records={records}
                students={students}
                teachers={teachers}
                classes={classes}
                leaves={leaves}
                gtkServices={gtkServices}
                piketDuties={piketDuties}
                onOpenToast={(title, message, severity = 'info') => showToast(title, message, severity)}
                onLogout={handleLogout}
                onNavigateTab={handleTabChange}
              />
            )}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Global Modal for Document Print Preview */}
        {isPrintModalOpen && (
          <PrintModal
            onClose={() => setIsPrintModalOpen(false)}
            config={config}
            records={records}
            students={students}
            teachers={teachers}
            todayDate={todayDate}
          />
        )}

        {/* Cross-Platform App Installation Modal (Android, iOS, Windows, Mac, Linux) */}
        <AppInstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
          config={config}
          onOpenIconModal={() => {
            setIsInstallModalOpen(false);
            setIsIconModalOpen(true);
          }}
        />

        {/* App Icon / School Logo Customizer Modal */}
        <AppIconCustomizerModal
          isOpen={isIconModalOpen}
          onClose={() => setIsIconModalOpen(false)}
          config={config}
          onSaveConfig={(updatedConfig) => {
            setConfig(updatedConfig);
            try {
              localStorage.setItem('school_presensi_config', JSON.stringify(updatedConfig));
            } catch (e) {
              console.error(e);
            }
          }}
          onSaveIcon={(newIconUrl) => {
            const updated = { ...config, logoUrl: newIconUrl, appIconUrl: newIconUrl };
            setConfig(updated);
            try {
              localStorage.setItem('school_presensi_config', JSON.stringify(updated));
            } catch (e) {
              console.error(e);
            }
            updateDocumentAppIcon(newIconUrl);
            setNotifications((prev) => [
              {
                id: 'icon-' + Date.now(),
                title: '🎨 Ikon Aplikasi Diperbarui',
                message: 'Ikon aplikasi dan favicon telah disesuaikan untuk seluruh sistem di HP & Laptop Anda.',
                type: 'system',
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                read: false,
              },
              ...prev.slice(0, 15),
            ]);
          }}
        />

        {/* First-Time User Interactive Onboarding Guide */}
        <OnboardingGuide
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
          }}
          config={config}
        />

        {/* Minimalist Clean Footer */}
        <footer className="border-t border-slate-200 py-4 mt-8 print:hidden text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  heartbeatState.cloudStatus === 'connected' && syncQueue.length === 0
                    ? 'bg-emerald-500'
                    : syncQueue.length > 0 || heartbeatState.cloudStatus === 'syncing'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-medium text-slate-700">
                {heartbeatState.cloudStatus === 'connected' && syncQueue.length === 0
                  ? 'Sistem Online'
                  : syncQueue.length > 0 || heartbeatState.cloudStatus === 'syncing'
                  ? `Antrean: ${syncQueue.length} record offline`
                  : 'Sistem Offline (Penyimpanan Lokal)'}
              </span>
              {syncQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => processSyncQueue()}
                  disabled={isSyncingQueue}
                  className="ml-2 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                >
                  {isSyncingQueue ? 'Sinkronisasi...' : 'Sinkronkan Sekarang'}
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3 text-slate-500">
              <span className="font-semibold text-slate-700">{config.schoolName}</span>
              <span>•</span>
              <span>NPSN {config.npsn}</span>
              <span>•</span>
              <span>T.A {config.academicYear}</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating Offline Notification & Feature Limitation Guide Widget in bottom-right corner */}
      <OfflineStatusGuideWidget
        isOnline={heartbeatState.isOnline}
        syncQueueCount={syncQueue.length}
        onRetryConnection={() => {
          triggerHeartbeat();
          if (heartbeatState.isOnline) {
            processSyncQueue();
          }
        }}
        onViewSyncQueue={() => handleTabChange('service_integration')}
      />

      {/* Security Auth & Audit Modal */}
      <SecurityAuthModal
        isOpen={isSecurityModalOpen}
        targetRole={securityTargetRole}
        currentRole={userRole}
        onClose={() => setIsSecurityModalOpen(false)}
        onNavigateToSecurityCenter={() => handleTabChange('security_center')}
        onSuccess={(newRole) => {
          setUserRole(newRole);
          getActiveTokenSession().then((current) => {
            if (current) setTokenSession(current);
          });
          setIsSecurityModalOpen(false);
        }}
        onOpenToast={(title, message) => {
          showToast(title, message, 'info', 4000);
        }}
      />

      {/* Global Real-Time Toasts (Top Right Notification Stack) */}
      <ToastContainer
        toasts={notifications}
        onDismiss={handleDismissToast}
        onDismissAll={handleDismissAllToasts}
        onActionClick={handleToastActionClick}
      />
    </div>
  );
}
