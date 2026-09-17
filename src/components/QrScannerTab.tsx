import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Camera,
  CheckCircle2,
  Users,
  Search,
  Sparkles,
  RefreshCw,
  Zap,
  Volume2,
  CalendarOff,
  AlertTriangle,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
  SchoolConfig,
  Student,
  Teacher,
  AcademicEvent,
  ActivityLog,
} from '../types';
import { formatTimeIndo, playBeepSound, checkDateIsHoliday } from '../utils/soundAndDate';
import {
  useCameraAutoOrientation,
  CameraOrientationToolbar,
  requestUniversalCameraStream,
  createUniversalSimulatedStream,
  parseCameraError,
  CameraErrorAlert,
  CameraOrientationMode,
  bindStreamToVideo,
  stopAllActiveMediaTracks,
  collectCameraDebugMetadata,
  analyzeFrameForBlackScreen,
  purgeCameraAssetsAndServiceWorkerCache,
  CameraStreamHealth,
  CameraStreamHealthBadge,
} from '../utils/cameraOrientationUtils';

interface QrScannerTabProps {
  todayDate: string;
  students?: Student[];
  teachers?: Teacher[];
  config: SchoolConfig;
  events?: AcademicEvent[];
  onRecordAttendance: (record: AttendanceRecord) => void;
  existingRecords?: AttendanceRecord[];
  onAddActivityLog?: (log: ActivityLog) => void;
}

export const QrScannerTab: React.FC<QrScannerTabProps> = ({
  todayDate,
  students = [],
  teachers = [],
  config,
  events = [],
  onRecordAttendance,
  existingRecords = [],
  onAddActivityLog,
}) => {
  const safeStudents = students || [];
  const safeTeachers = teachers || [];

  const [attendanceType, setAttendanceType] = useState<AttendanceType>('masuk');
  const [personType, setPersonType] = useState<'student' | 'teacher'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputIdentifier, setInputIdentifier] = useState('');
  const [overrideHoliday, setOverrideHoliday] = useState(false);
  const [lastScanned, setLastScanned] = useState<{
    person: Student | Teacher;
    status: AttendanceStatus;
    time: string;
    note: string;
  } | null>(null);
  const [isScanning] = useState(true);

  // 60-Second Auto-Expiring QR Security System
  const [qrCountdown, setQrCountdown] = useState<number>(60);
  const [qrCreatedAt, setQrCreatedAt] = useState<number>(Date.now());
  const [qrToken, setQrToken] = useState<string>(
    () => `QR_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`
  );
  const [enableQrExpiration] = useState<boolean>(true);
  const [expiredAlert, setExpiredAlert] = useState<{
    show: boolean;
    name?: string;
    reason: string;
  } | null>(null);

  // Camera stream and orientation management
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [cameraHealthStatus, setCameraHealthStatus] = useState<CameraStreamHealth>('initializing');
  const [cameraAttempts, setCameraAttempts] = useState<number>(1);
  const [emergencyFallbackActive, setEmergencyFallbackActive] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);
  const attemptCountRef = useRef<number>(1);
  const blackScreenHitsRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    orientationMode,
    setOrientationMode,
    effectiveOrientation,
    isLandscape,
    facingMode,
    toggleFacingMode,
    streamResolution,
    deviceType,
    handleVideoMetadata,
    isSimulated,
    setIsSimulated,
    cameraError,
    setCameraError,
  } = useCameraAutoOrientation('auto', 'environment');

  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      bindStreamToVideo(el, streamRef.current);
    }
  }, []);

  const startScannerCamera = async (
    targetFacing?: 'user' | 'environment',
    targetMode?: CameraOrientationMode,
    forceVirtual: boolean = false
  ) => {
    setIsCameraActive(true);
    setCameraError(null);
    setCameraHealthStatus('initializing');

    if (forceVirtual) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const simStream = createUniversalSimulatedStream(effectiveOrientation, {
        label: 'Pemindai QR Gerbang Sekolah SMPN 4 Taliabu Barat',
        userName: 'Siswa / Guru Aktif',
      });
      streamRef.current = simStream;
      setIsSimulated(true);
      setCameraHealthStatus('warning');
      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, simStream);
        handleVideoMetadata(videoRef.current);
      }
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const activeFacing = targetFacing ?? facingMode;
      const activeMode = targetMode ?? orientationMode;

      const result = await requestUniversalCameraStream({
        mode: activeMode,
        facingMode: activeFacing,
        preferHighRes: false,
      });

      streamRef.current = result.stream;
      setIsSimulated(result.isSimulated);
      if (result.error) {
        setCameraError(result.error);
        setCameraHealthStatus('error');
        const debugMeta = collectCameraDebugMetadata(result.error, {
          facingMode: activeFacing,
          attemptNumber: attemptCountRef.current,
        });
        if (onAddActivityLog) {
          onAddActivityLog({
            id: `act_cam_qr_${Date.now()}`,
            timestamp: new Date().toISOString(),
            date: todayDate,
            time: new Date().toLocaleTimeString('id-ID'),
            action: 'Kendala Akses Kamera QR Pemindai Gerbang',
            actor: {
              name: config?.adminName || 'Petugas Gerbang / Operator',
              role: 'Administrator',
            },
            category: 'attendance',
            status: 'warning',
            description: `Akses kamera fisik pemindai QR mengalami kendala: ${result.error.message || 'Kamera tidak merespons'}. Sinyal virtual aktif.`,
            debugMetadata: debugMeta,
          });
        }
      } else {
        setCameraError(null);
        setCameraHealthStatus(result.isSimulated ? 'warning' : 'healthy');
      }

      if (result.stream) {
        result.stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setCameraHealthStatus('error');
            if (onAddActivityLog) {
              const debugMeta = collectCameraDebugMetadata(new Error('Koneksi stream kamera QR terputus'), {
                facingMode: activeFacing,
                attemptNumber: attemptCountRef.current,
              });
              onAddActivityLog({
                id: `act_cam_qr_disc_${Date.now()}`,
                timestamp: new Date().toISOString(),
                date: todayDate,
                time: new Date().toLocaleTimeString('id-ID'),
                action: 'Kamera QR Scanner Terputus',
                actor: {
                  name: config?.adminName || 'Petugas Gerbang / Operator',
                  role: 'Administrator',
                },
                category: 'attendance',
                status: 'warning',
                description: 'Sinyal video kamera QR scanner terputus di tengah proses pemindaian.',
                debugMetadata: debugMeta,
              });
            }
          };
        });
      }

      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, result.stream);
        handleVideoMetadata(videoRef.current);
      }
    } catch (err: any) {
      console.warn('QR Camera initialization error:', err);
      const parsed = parseCameraError(err);
      setCameraError(parsed);
      setCameraHealthStatus('error');

      const debugMeta = collectCameraDebugMetadata(err, {
        facingMode: targetFacing ?? facingMode,
        attemptNumber: attemptCountRef.current,
      });

      if (onAddActivityLog) {
        onAddActivityLog({
          id: `act_cam_qr_err_${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayDate,
          time: new Date().toLocaleTimeString('id-ID'),
          action: 'Kegagalan Inisialisasi Kamera QR',
          actor: {
            name: config?.adminName || 'Petugas Gerbang / Operator',
            role: 'Administrator',
          },
          category: 'attendance',
          status: 'error',
          description: `Gagal menginisialisasi kamera video QR scanner: ${err?.message || 'Black screen / device unavailable'}.`,
          debugMetadata: debugMeta,
        });
      }

      // Check if maximum attempts reached -> trigger emergency fallback & purge
      if (attemptCountRef.current >= 3) {
        setEmergencyFallbackActive(true);
        purgeCameraAssetsAndServiceWorkerCache();
      }

      const fallbackStream = createUniversalSimulatedStream(effectiveOrientation, {
        label: 'Pemindai QR Gerbang Sekolah SMPN 4 Taliabu Barat',
        userName: 'Siswa / Guru Aktif',
      });
      streamRef.current = fallbackStream;
      setIsSimulated(true);
      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, fallbackStream);
        handleVideoMetadata(videoRef.current);
      }
    }
  };

  const handleRestartCamera = async () => {
    setIsRestarting(true);
    attemptCountRef.current += 1;
    setCameraAttempts(attemptCountRef.current);
    try {
      await purgeCameraAssetsAndServiceWorkerCache();
      await startScannerCamera(facingMode, orientationMode, false);
    } finally {
      setIsRestarting(false);
    }
  };

  // Real-time Black Screen detector loop with aggressive Service Worker cache purge
  useEffect(() => {
    if (!isCameraActive || isSimulated) return;

    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const analysis = analyzeFrameForBlackScreen(videoRef.current);
        if (analysis.isBlackScreen) {
          blackScreenHitsRef.current += 1;
          if (blackScreenHitsRef.current >= 3) {
            setCameraHealthStatus('error');
            // Purge cache aggressively
            await purgeCameraAssetsAndServiceWorkerCache();

            const debugMeta = collectCameraDebugMetadata(new Error('Black screen detected on QR video element'), {
              facingMode,
              attemptNumber: attemptCountRef.current,
              blackScreenDetected: true,
            });

            if (onAddActivityLog) {
              onAddActivityLog({
                id: `act_cam_bs_qr_${Date.now()}`,
                timestamp: new Date().toISOString(),
                date: todayDate,
                time: new Date().toLocaleTimeString('id-ID'),
                action: 'Deteksi Layar Hitam (Black Screen) pada Pemindai QR',
                actor: {
                  name: config?.adminName || 'Petugas Gerbang / Operator',
                  role: 'Administrator',
                },
                category: 'system',
                status: 'error',
                description: `Piksel video pemindai QR gelap gulita (Luminans rata-rata: ${analysis.averageLuminance}/255). Cache Service Worker dibersihkan secara agresif.`,
                debugMetadata: debugMeta,
              });
            }

            if (attemptCountRef.current >= 3) {
              setEmergencyFallbackActive(true);
            }
          }
        } else {
          blackScreenHitsRef.current = 0;
          if (cameraHealthStatus === 'error') {
            setCameraHealthStatus('healthy');
          }
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isCameraActive, isSimulated, facingMode, cameraHealthStatus]);

  const stopScannerCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {
          console.warn(e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.load();
      } catch (e) {
        console.warn(e);
      }
    }
    stopAllActiveMediaTracks();
    setIsCameraActive(false);
  };

  useEffect(() => {
    startScannerCamera();
    return () => {
      stopScannerCamera();
    };
  }, []);

  const handleOrientationModeChange = (newMode: CameraOrientationMode) => {
    setOrientationMode(newMode);
    if (isCameraActive) {
      startScannerCamera(facingMode, newMode, isSimulated);
    }
  };

  const handleToggleFacingCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    toggleFacingMode();
    if (isCameraActive) {
      startScannerCamera(nextFacing, orientationMode, isSimulated);
    }
  };

  // Countdown timer for 60-second QR expiration
  useEffect(() => {
    const interval = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          // Auto rotate / regenerate token every 60 seconds
          setQrToken(`QR_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
          setQrCreatedAt(Date.now());
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRegenerateQr = () => {
    setQrToken(`QR_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    setQrCreatedAt(Date.now());
    setQrCountdown(60);
    setExpiredAlert(null);
  };

  // Check if today is a holiday in academic events
  const holidayInfo = checkDateIsHoliday(todayDate, events);
  const isHolidayLocked = holidayInfo.isHoliday && !overrideHoliday;

  // Determine attendance status based on current time
  const evaluateStatus = (): { status: AttendanceStatus; note: string } => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [deadlineH, deadlineM] = config.checkInDeadline.split(':').map(Number);
    const deadlineMins = deadlineH * 60 + deadlineM;

    if (attendanceType === 'masuk') {
      if (currentMins <= deadlineMins) {
        return { status: 'hadir', note: 'Hadir Tepat Waktu (Gerbang Depan)' };
      } else {
        const diffMins = currentMins - deadlineMins;
        return { status: 'terlambat', note: `Terlambat ${diffMins} menit` };
      }
    } else {
      return { status: 'hadir', note: 'Presensi Pulang Sekolah' };
    }
  };

  const handleScanPerson = (person: Student | Teacher, forceExpiredTest: boolean = false) => {
    if (isHolidayLocked) {
      alert(`⚠️ Perekaman Presensi Ditutup: Hari ini terdaftar sebagai Hari Libur (${holidayInfo.eventTitle}). Presensi tidak dapat dilakukan kecuali Anda mengaktifkan Bypass Override Admin.`);
      return;
    }

    // 60-Second QR Security Expiration Check
    if (enableQrExpiration) {
      const ageSeconds = Math.round((Date.now() - qrCreatedAt) / 1000);
      if (forceExpiredTest || ageSeconds > 60 || qrCountdown <= 0) {
        setExpiredAlert({
          show: true,
          name: person.name,
          reason: `Kode QR Presensi ini telah KADALUARSA (Expired). Kode QR hanya berlaku 60 detik untuk mencegah manipulasi titip absen atau foto barcode berulang. Silakan generate ulang QR terbaru.`
        });
        return;
      }
    }

    const now = new Date();
    const timeStr = formatTimeIndo(now);
    const isStudent = 'nisn' in person;
    const identifier = isStudent ? (person as Student).nisn : (person as Teacher).nip;
    const classOrSubj = isStudent ? (person as Student).className : (person as Teacher).subject;

    // Check if already checked in today for this type
    const alreadyRecorded = existingRecords.some(
      (r) => r.date === todayDate && r.personId === person.id && r.type === attendanceType
    );

    if (alreadyRecorded) {
      alert(`${person.name} sudah melakukan presensi ${attendanceType} hari ini!`);
      return;
    }

    const { status, note } = evaluateStatus();

    const newRecord: AttendanceRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      personId: person.id,
      personType: isStudent ? 'student' : 'teacher',
      personName: person.name,
      identifier,
      classOrSubject: classOrSubj,
      date: todayDate,
      time: timeStr,
      type: attendanceType,
      status,
      method: 'qrcode',
      note: overrideHoliday ? `${note} (Override Hari Libur)` : note,
      photoUrl: person.avatar,
      location: {
        lat: config?.schoolLat ?? -1.8214,
        lng: config?.schoolLng ?? 124.7081,
        address: 'Pos Pemindai QR Gerbang Sekolah',
        inRadius: true,
        distanceMeter: 5,
      },
    };

    playBeepSound();
    onRecordAttendance(newRecord);
    setLastScanned({
      person,
      status,
      time: timeStr,
      note,
    });
    setInputIdentifier('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHolidayLocked) {
      alert(`⚠️ Hari Libur: Presensi ditutup otomatis (${holidayInfo.eventTitle}).`);
      return;
    }
    if (!inputIdentifier.trim()) return;

    if (personType === 'student') {
      const found = students.find(
        (s) => s.nisn === inputIdentifier.trim() || s.name.toLowerCase().includes(inputIdentifier.toLowerCase())
      );
      if (found) {
        handleScanPerson(found);
      } else {
        alert('NISN atau Nama Siswa tidak ditemukan dalam database.');
      }
    } else {
      const found = teachers.find(
        (t) => t.nip === inputIdentifier.trim() || t.name.toLowerCase().includes(inputIdentifier.toLowerCase())
      );
      if (found) {
        handleScanPerson(found);
      } else {
        alert('NIP atau Nama Guru tidak ditemukan dalam database.');
      }
    }
  };

  // Filter list for quick click simulation
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.includes(searchQuery) ||
      s.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nip.includes(searchQuery) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Holiday Notification Banner */}
      {holidayInfo.isHoliday && (
        <div
          className={`p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs ${
            isHolidayLocked
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start space-x-3.5">
            <div
              className={`p-2.5 rounded-2xl shrink-0 ${
                isHolidayLocked ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <CalendarOff className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-rose-600 text-white">
                  HARI LIBUR TERDAFTAR
                </span>
                <span className="font-extrabold text-sm">{holidayInfo.eventTitle}</span>
              </div>
              <p className="text-xs mt-1 text-slate-600">
                {holidayInfo.description} • Sistem otomatis mengunci perekaman presensi untuk mencegah kekeliruan absensi di hari libur.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setOverrideHoliday(!overrideHoliday)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                overrideHoliday
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-xs'
              }`}
            >
              {overrideHoliday ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{overrideHoliday ? 'Bypass Aktif (Testing)' : 'Bypass Override Admin'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Config Header for Scanner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs">
        <div>
          <h2 className="font-extrabold text-lg text-slate-900 flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-indigo-600" />
            <span>Pemindai QR Code Presensi Siswa & Guru</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Arahkan kamera ke Kartu Pelajar Digital atau pilih siswa dari daftar untuk simulasi tap kartu
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Real-time Camera Stream Health Badge */}
          <CameraStreamHealthBadge
            status={cameraHealthStatus}
            streamResolution={streamResolution}
            onRestartCamera={handleRestartCamera}
            isRestarting={isRestarting}
            attemptNumber={cameraAttempts}
          />

          {/* Type Toggle: Masuk vs Pulang */}
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-full border border-slate-200">
            <button
              onClick={() => setAttendanceType('masuk')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                attendanceType === 'masuk'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Presensi Masuk (Check-In)
            </button>
            <button
              onClick={() => setAttendanceType('pulang')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                attendanceType === 'pulang'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Presensi Pulang (Check-Out)
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Fallback Banner (Manual Input Fallback) */}
      {emergencyFallbackActive && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 shadow-md animate-in fade-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-2xl bg-amber-200 text-amber-900 shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-600 text-white">
                    MODE DARURAT AKTIF
                  </span>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Mekanisme Emergency Fallback Presensi Manual
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Kamera sensor gagal memuat setelah {cameraAttempts} kali percobaan atau terdeteksi kendala layar hitam.
                  Gunakan input teks manual di bawah untuk tetap mencatat presensi tanpa hambatan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                attemptCountRef.current = 1;
                setCameraAttempts(1);
                setEmergencyFallbackActive(false);
                handleRestartCamera();
              }}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Ulang Kamera Fisik</span>
            </button>
          </div>

          {/* Quick Manual Text Input Form */}
          <form
            onSubmit={handleManualSubmit}
            className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-amber-200 dark:border-amber-800/60"
          >
            <input
              type="text"
              value={inputIdentifier}
              onChange={(e) => setInputIdentifier(e.target.value)}
              placeholder="Ketik NISN / NIP / Nama Lengkap Siswa atau Guru..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Konfirmasi Presensi Manual Darurat</span>
            </button>
          </form>
        </div>
      )}

      {/* Main Scanner Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewport & Scanner Feedback */}
        <div className="lg:col-span-6 space-y-4">
          {/* Camera Error Troubleshooting Alert */}
          {cameraError && (
            <CameraErrorAlert
              error={cameraError}
              onRetry={() => startScannerCamera(facingMode, orientationMode, false)}
              onUseVirtualCamera={() => startScannerCamera(facingMode, orientationMode, true)}
              onDismiss={() => setCameraError(null)}
            />
          )}

          {/* Camera Orientation & Device Toolbar */}
          <CameraOrientationToolbar
            orientationMode={orientationMode}
            effectiveOrientation={effectiveOrientation}
            onSelectOrientationMode={handleOrientationModeChange}
            facingMode={facingMode}
            onToggleFacingMode={handleToggleFacingCamera}
            streamResolution={streamResolution}
            deviceType={deviceType}
            isSimulated={isSimulated}
            onToggleSimulated={() => startScannerCamera(facingMode, orientationMode, !isSimulated)}
          />

          {/* Dynamic Responsive Viewfinder - Auto adapts to Portrait & Landscape */}
          <div
            className={`relative w-full mx-auto rounded-[2.5rem] bg-slate-950 overflow-hidden border-2 border-slate-800 flex flex-col items-center justify-center text-white shadow-xl transition-all duration-300 ${
              isLandscape ? 'aspect-[16/9] max-w-2xl' : 'aspect-[3/4] max-w-md'
            }`}
          >
            {/* Live Video Element */}
            {isCameraActive && (
              <video
                ref={handleVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  const v = e.target as HTMLVideoElement;
                  handleVideoMetadata(v);
                  v.play().catch((err) => console.warn('QR Video play error:', err));
                }}
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
            )}

            {/* Live Camera View Overlay Frame */}
            <div className="absolute inset-4 rounded-3xl border border-dashed border-indigo-500/40 flex flex-col items-center justify-center overflow-hidden pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />

              {/* Top Security Expiration Badge */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-slate-300 font-medium">Berlaku:</span>
                  <span
                    className={`font-mono font-extrabold ${
                      qrCountdown <= 10
                        ? 'text-rose-400 animate-pulse'
                        : qrCountdown <= 25
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {qrCountdown}s
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRegenerateQr}
                  title="Generate Token QR Baru (Reset 60 Detik)"
                  className="px-2.5 py-1 rounded-full bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/40 text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>Reset QR</span>
                </button>
              </div>

              {/* Animated Laser Scanning Line */}
              {isScanning && (
                <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-bounce duration-1000" />
              )}

              {/* Center Targeting Box */}
              <div className="p-4 rounded-2xl bg-slate-950/60 backdrop-blur-xs border border-white/20 text-center space-y-1 z-10">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center mx-auto text-indigo-300">
                  <QrCode className="w-6 h-6 animate-pulse" />
                </div>
                <p className="font-bold text-xs text-white">
                  {isLandscape ? 'Mode Landscape Kamera' : 'Mode Portrait Kamera'}
                </p>
                <p className="text-[10px] text-slate-300">
                  Arahkan barcode / QR kartu pelajar ke kotak ini
                </p>
                <div className="text-[9px] font-mono text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-md inline-block">
                  Token: {qrToken.substring(0, 16)}...
                </div>
              </div>

              {/* Audio chime badge & Orientation info */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] text-slate-300 border border-slate-700">
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                  <span>Audio Beep Aktif</span>
                </div>

                {streamResolution && streamResolution.width > 0 && (
                  <div className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] text-emerald-400 font-mono border border-slate-700">
                    {streamResolution.width}×{streamResolution.height}
                  </div>
                )}
              </div>

              {/* Expiration Progress Bar */}
              <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    qrCountdown <= 10
                      ? 'bg-rose-500'
                      : qrCountdown <= 25
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(qrCountdown / 60) * 100}%` }}
                />
              </div>
            </div>

            {/* Inactive Camera State Overlay */}
            {!isCameraActive && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Kamera Sedang Dinonaktifkan</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Klik tombol di bawah untuk mengaktifkan kembali sensor kamera pemindai.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startScannerCamera()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  Aktifkan Kamera
                </button>
              </div>
            )}
          </div>

          {/* 60s Expiration Security Bar & Expired Test Simulator */}
          <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-800">
                  Proteksi Anti-Manipulasi (60s Expire)
                </p>
                <p className="text-[10px] text-slate-500">
                  Mencegah titip absen / screenshot QR berulang
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const target = personType === 'student' ? safeStudents[0] : safeTeachers[0];
                  if (target) {
                    handleScanPerson(target, true);
                  } else {
                    alert('Tidak ada data anggota untuk uji coba expired.');
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                title="Simulasikan pemindaian kode QR yang sudah lewat masa berlaku 60 detik"
              >
                Uji Simulasi QR Kadaluarsa
              </button>
            </div>
          </div>

          {/* Expired QR Warning Modal / Alert */}
          {expiredAlert && expiredAlert.show && (
            <div className="p-4 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start space-x-3.5 shadow-sm animate-in slide-in-from-top-3">
              <div className="p-2 rounded-2xl bg-rose-200/80 text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 text-xs">
                <h4 className="font-extrabold text-rose-900 text-sm">
                  ⚠️ Presensi Ditolak: Kode QR Kadaluarsa (Expired)!
                </h4>
                <p className="text-rose-800 mt-1 leading-relaxed">
                  {expiredAlert.reason}
                </p>
                <div className="flex items-center space-x-2 mt-3">
                  <button
                    type="button"
                    onClick={handleRegenerateQr}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Perbarui QR (Masa Baru 60s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiredAlert(null)}
                    className="px-3 py-1.5 bg-white text-slate-700 border border-rose-200 rounded-xl font-bold text-xs hover:bg-rose-100/50 transition-colors cursor-pointer"
                  >
                    Tutup Peringatan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Last Scanned Instant Notification Card */}
          {lastScanned && (
            <div className="p-5 rounded-[2rem] bg-emerald-50 border border-emerald-200/90 flex items-center space-x-4 animate-in zoom-in-95 duration-200">
              <img
                src={lastScanned.person.avatar}
                alt={lastScanned.person.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    Berhasil Dipindai!
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-900">
                    {lastScanned.time} WIB
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 truncate mt-1">
                  {lastScanned.person.name}
                </h4>
                <p className="text-xs text-slate-600">
                  {'className' in lastScanned.person ? lastScanned.person.className : lastScanned.person.subject} • {lastScanned.note}
                </p>
              </div>
            </div>
          )}

          {/* Manual Input / Barcode Scanner Field */}
          <form onSubmit={handleManualSubmit} className="p-5 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Input Manual / Scanner Barcode USB</span>
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputIdentifier}
                onChange={(e) => setInputIdentifier(e.target.value)}
                placeholder={personType === 'student' ? 'Ketik / Scan NISN (Contoh: 0078129001)' : 'Ketik NIP Guru...'}
                className="flex-1 text-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-full shadow-xs transition-colors cursor-pointer"
              >
                Proses
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Quick Tap Roster List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-6 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Daftar Cepat Tap Kartu Pelajar</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Klik tombol <strong>"Tap Kartu"</strong> pada siswa untuk mensimulasikan scan instan
                </p>
              </div>

              {/* Student vs Teacher Switcher */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-full border border-slate-200">
                <button
                  onClick={() => setPersonType('student')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    personType === 'student'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Siswa ({students.length})
                </button>
                <button
                  onClick={() => setPersonType('teacher')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    personType === 'teacher'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Guru & GTK ({teachers.length})
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan nama, NISN/NIP, atau kelas..."
                className="w-full text-xs pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Scrollable Person List */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {personType === 'student' ? (
                filteredStudents.map((std) => {
                  const alreadyChecked = existingRecords.some(
                    (r) => r.date === todayDate && r.personId === std.id && r.type === attendanceType
                  );

                  return (
                    <div
                      key={std.id}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={std.avatar}
                          alt={std.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {std.name}
                            </p>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                              {std.className}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            NISN: {std.nisn}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleScanPerson(std)}
                        disabled={alreadyChecked}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 ${
                          alreadyChecked
                            ? 'bg-emerald-100 text-emerald-800 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{alreadyChecked ? 'Sudah Presensi' : 'Tap Kartu QR'}</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                filteredTeachers.map((tch) => {
                  const alreadyChecked = existingRecords.some(
                    (r) => r.date === todayDate && r.personId === tch.id && r.type === attendanceType
                  );

                  return (
                    <div
                      key={tch.id}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={tch.avatar}
                          alt={tch.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {tch.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            NIP: {tch.nip} • {tch.subject}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleScanPerson(tch)}
                        disabled={alreadyChecked}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 ${
                          alreadyChecked
                            ? 'bg-emerald-100 text-emerald-800 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{alreadyChecked ? 'Sudah Presensi' : 'Tap Kartu NIP'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
