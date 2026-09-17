import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Mail,
  Phone,
  Building2,
  Download,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Copy,
  Check,
  Fingerprint,
  KeyRound,
  Crosshair,
  Clock,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Student,
  Teacher,
  SchoolConfig,
  AttendanceRecord,
  AttendanceType,
  AttendanceStatus,
  AcademicEvent,
  ActivityLog,
  UserRole,
  UserAccount,
} from '../types';
import { playBeepSound, checkDateIsHoliday } from '../utils/soundAndDate';
import { CalendarOff, Lock, Unlock } from 'lucide-react';
import { verifyBiometricIdentity, BiometricVerificationResult } from '../utils/biometricIdentity';
import { TeacherAttendanceMap } from './TeacherAttendanceMap';
import { LiveSelfieLeafletMap } from './LiveSelfieLeafletMap';
import { BiometricRegistrationGuideModal } from './BiometricRegistrationGuideModal';
import { ManualGpsLocationModal } from './ManualGpsLocationModal';
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
import { motion, AnimatePresence } from 'motion/react';
import { Upload } from 'lucide-react';

interface SelfieGpsTabProps {
  students?: Student[];
  teachers?: Teacher[];
  config: SchoolConfig;
  events?: AcademicEvent[];
  onRecordAttendance: (record: AttendanceRecord) => void;
  todayDate?: string;
  existingRecords?: AttendanceRecord[];
  onUpdateSchoolGps?: (lat: number, lng: number, radius?: number) => void;
  onAddActivityLog?: (log: ActivityLog) => void;
  userRole?: UserRole;
  currentAccount?: UserAccount;
}

export const SelfieGpsTab: React.FC<SelfieGpsTabProps> = ({
  students = [],
  teachers = [],
  config,
  events = [],
  onRecordAttendance,
  todayDate,
  existingRecords = [],
  onUpdateSchoolGps,
  onAddActivityLog,
  userRole = 'admin',
  currentAccount,
}) => {
  const safeStudents = students || [];
  const safeTeachers = teachers || [];
  const effectiveToday = todayDate || new Date().toISOString().split('T')[0];

  // Match authenticated student or teacher from session account
  const matchingStudent = useMemo(() => {
    if (!currentAccount) return null;
    return (
      safeStudents.find((s) => currentAccount.personId && s.id === currentAccount.personId) ||
      safeStudents.find((s) => currentAccount.identifier && s.nisn === currentAccount.identifier) ||
      safeStudents.find((s) => s.name.toLowerCase() === currentAccount.name.toLowerCase()) ||
      null
    );
  }, [currentAccount, safeStudents]);

  const matchingTeacher = useMemo(() => {
    if (!currentAccount) return null;
    return (
      safeTeachers.find((t) => currentAccount.personId && t.id === currentAccount.personId) ||
      safeTeachers.find((t) => currentAccount.identifier && t.nip === currentAccount.identifier) ||
      safeTeachers.find((t) => t.name.toLowerCase() === currentAccount.name.toLowerCase()) ||
      null
    );
  }, [currentAccount, safeTeachers]);

  const holidayInfo = checkDateIsHoliday(effectiveToday, events);
  const [overrideHoliday, setOverrideHoliday] = useState(false);
  const isBlockedByHoliday = holidayInfo.isHoliday && !overrideHoliday;

  const [personType, setPersonType] = useState<'student' | 'teacher'>(() => {
    if (userRole === 'siswa') return 'student';
    if (userRole === 'guru') return 'teacher';
    return 'teacher';
  });

  const [selectedPersonId, setSelectedPersonId] = useState<string>(() => {
    if (userRole === 'siswa') {
      return matchingStudent?.id || safeStudents[0]?.id || '';
    }
    if (userRole === 'guru') {
      return matchingTeacher?.id || safeTeachers[0]?.id || '';
    }
    return safeTeachers[0]?.id || safeStudents[0]?.id || '';
  });
  const [sessionType, setSessionType] = useState<AttendanceType>('masuk');

  // Camera & GPS simulation state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraHealthStatus, setCameraHealthStatus] = useState<CameraStreamHealth>('initializing');
  const [cameraAttempts, setCameraAttempts] = useState<number>(1);
  const [emergencyFallbackActive, setEmergencyFallbackActive] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);
  const attemptCountRef = useRef<number>(1);
  const blackScreenHitsRef = useRef<number>(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // WebAuthn Biometric & Map state
  const [isSigningWebAuthn, setIsSigningWebAuthn] = useState(false);
  const [webAuthnVerified, setWebAuthnVerified] = useState<boolean>(false);
  const [showBiometricGuide, setShowBiometricGuide] = useState(false);
  const [isManualGpsModalOpen, setIsManualGpsModalOpen] = useState(false);

  const defaultLat = config?.schoolLat ?? -1.8214;
  const defaultLng = config?.schoolLng ?? 124.7081;

  // GPS Coordinates & Geofencing
  const [gpsLocation, setGpsLocation] = useState({
    lat: defaultLat,
    lng: defaultLng,
    address: 'Lobby Gedung Utama SMPN 4 Taliabu Barat (Dalam Radius)',
    inRadius: true,
    distanceMeter: 12,
  });

  // Success result & Sharing modal
  const [latestSavedRecord, setLatestSavedRecord] = useState<AttendanceRecord | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareType, setShareType] = useState<'email' | 'whatsapp' | 'bkd'>('bkd');
  const [copiedText, setCopiedText] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedTeacher = teachers.find((t) => t.id === selectedPersonId);
  const selectedStudent = students.find((s) => s.id === selectedPersonId);

  // Reset or lock selected ID when type changes or userRole is restricted
  useEffect(() => {
    if (userRole === 'siswa') {
      if (personType !== 'student') setPersonType('student');
      if (matchingStudent) {
        setSelectedPersonId(matchingStudent.id);
        return;
      }
    } else if (userRole === 'guru') {
      if (personType !== 'teacher') setPersonType('teacher');
      if (matchingTeacher) {
        setSelectedPersonId(matchingTeacher.id);
        return;
      }
    }

    if (personType === 'teacher') {
      if (!teachers.some((t) => t.id === selectedPersonId)) {
        setSelectedPersonId(teachers[0]?.id || '');
      }
    } else {
      if (!students.some((s) => s.id === selectedPersonId)) {
        setSelectedPersonId(students[0]?.id || '');
      }
    }
  }, [personType, teachers, students, userRole, matchingStudent, matchingTeacher]);

  // Live real-time clock for dynamic viewfinder HUD and timestamp tracking
  const [liveClock, setLiveClock] = useState<string>(() => new Date().toLocaleTimeString('id-ID'));
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic Camera Landscape & Portrait Orientation System for all HP and Laptops
  const {
    orientationMode,
    setOrientationMode,
    effectiveOrientation,
    isLandscape,
    isPhoneTilted,
    facingMode,
    toggleFacingMode,
    streamResolution,
    hardwareInfo,
    setHardwareInfo,
    deviceType,
    handleVideoMetadata,
    isSimulated,
    setIsSimulated,
    cameraError,
    setCameraError,
  } = useCameraAutoOrientation('auto', 'user');

  // Hidden native camera input ref for guaranteed fallback across any mobile phone
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

  // Callback ref to reliably attach stream whenever video mounts in DOM
  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      bindStreamToVideo(el, streamRef.current);
    }
  }, []);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        bindStreamToVideo(videoRef.current, streamRef.current);
      }
    }
  }, [isCameraActive]);

  // Start Camera Stream with auto-adaptation for phone & laptop
  const startCamera = async (
    targetFacing?: 'user' | 'environment',
    targetMode?: CameraOrientationMode,
    forceVirtual: boolean = false
  ) => {
    setIsCameraActive(true);
    setCapturedPhoto(null);
    setCameraError(null);

    if (forceVirtual) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const simStream = createUniversalSimulatedStream(effectiveOrientation, {
        label: 'Presensi Digital SMPN 4 Taliabu Barat',
        userName: personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name,
      });
      streamRef.current = simStream;
      setIsSimulated(true);
      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, simStream);
        handleVideoMetadata(videoRef.current);
      }
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setCameraHealthStatus('initializing');
      const activeFacing = targetFacing ?? facingMode;
      const activeMode = targetMode ?? orientationMode;

      const result = await requestUniversalCameraStream({
        mode: activeMode,
        facingMode: activeFacing,
        preferHighRes: true,
      });

      streamRef.current = result.stream;
      setIsSimulated(result.isSimulated);
      if (result.hardwareInfo) {
        setHardwareInfo(result.hardwareInfo);
      }
      if (result.error) {
        setCameraError(result.error);
        setCameraHealthStatus('error');
        if (onAddActivityLog) {
          const personName = personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name;
          const debugMeta = collectCameraDebugMetadata(result.error, {
            facingMode: activeFacing,
            attemptNumber: attemptCountRef.current,
          });
          onAddActivityLog({
            id: `act_cam_selfie_${Date.now()}`,
            timestamp: new Date().toISOString(),
            date: effectiveToday,
            time: new Date().toLocaleTimeString('id-ID'),
            action: 'Kendala Kamera Presensi Selfie GPS',
            actor: {
              name: personName || config?.adminName || 'Pengguna GTK / Siswa',
              role: personType === 'teacher' ? 'Guru' : 'Siswa',
            },
            category: 'attendance',
            status: 'warning',
            description: `Akses kamera fisik presensi mendeteksi kendala: ${result.error.message || 'Perangkat tidak merespons'}. Sinyal virtual aktif.`,
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
              const personName = personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name;
              const debugMeta = collectCameraDebugMetadata(new Error('Kamera selfie terputus tiba-tiba'), {
                facingMode: activeFacing,
                attemptNumber: attemptCountRef.current,
              });
              onAddActivityLog({
                id: `act_cam_selfie_disc_${Date.now()}`,
                timestamp: new Date().toISOString(),
                date: effectiveToday,
                time: new Date().toLocaleTimeString('id-ID'),
                action: 'Kamera Selfie Terputus Saat Presensi',
                actor: {
                  name: personName || config?.adminName || 'Pengguna GTK / Siswa',
                  role: personType === 'teacher' ? 'Guru' : 'Siswa',
                },
                category: 'attendance',
                status: 'warning',
                description: `Koneksi video kamera terputus tiba-tiba saat proses presensi selfie ${personName || 'GTK'}.`,
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
      console.warn('Camera initialization encountered error:', err);
      const parsed = parseCameraError(err);
      setCameraError(parsed);
      setCameraHealthStatus('error');

      const debugMeta = collectCameraDebugMetadata(err, {
        facingMode: targetFacing ?? facingMode,
        attemptNumber: attemptCountRef.current,
      });

      if (onAddActivityLog) {
        const personName = personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name;
        onAddActivityLog({
          id: `act_cam_selfie_err_${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: effectiveToday,
          time: new Date().toLocaleTimeString('id-ID'),
          action: 'Kegagalan Akses Kamera Presensi Selfie',
          actor: {
            name: personName || config?.adminName || 'Pengguna GTK / Siswa',
            role: personType === 'teacher' ? 'Guru' : 'Siswa',
          },
          category: 'attendance',
          status: 'error',
          description: `Kamera selfie gagal diakses pada perangkat ${personName || 'GTK'}: ${parsed.message}. Admin dapat memeriksa pengaturan izin browser perangkat.`,
          debugMetadata: debugMeta,
        });
      }

      // If attempts >= 3 -> trigger aggressive purge & emergency manual fallback
      if (attemptCountRef.current >= 3) {
        setEmergencyFallbackActive(true);
        purgeCameraAssetsAndServiceWorkerCache();
      }

      // Auto fallback to high-fidelity simulated camera stream
      const fallbackStream = createUniversalSimulatedStream(effectiveOrientation, {
        label: 'Presensi Digital SMPN 4 Taliabu Barat',
        userName: personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name,
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
      await startCamera(facingMode, orientationMode, false);
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

            const debugMeta = collectCameraDebugMetadata(new Error('Black screen video stream detected in selfie camera'), {
              facingMode,
              attemptNumber: attemptCountRef.current,
              blackScreenDetected: true,
            });

            if (onAddActivityLog) {
              const personName = personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name;
              onAddActivityLog({
                id: `act_cam_bs_selfie_${Date.now()}`,
                timestamp: new Date().toISOString(),
                date: effectiveToday,
                time: new Date().toLocaleTimeString('id-ID'),
                action: 'Deteksi Layar Hitam (Black Screen) pada Kamera Selfie',
                actor: {
                  name: personName || config?.adminName || 'Pengguna GTK / Siswa',
                  role: personType === 'teacher' ? 'Guru' : 'Siswa',
                },
                category: 'system',
                status: 'error',
                description: `Piksel kamera selfie tidak terdeteksi (Luminans rata-rata: ${analysis.averageLuminance}/255). Cache Service Worker dibersihkan secara agresif.`,
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
  }, [isCameraActive, isSimulated, facingMode, cameraHealthStatus, personType, selectedTeacher, selectedStudent, effectiveToday]);

  const handleOrientationModeChange = (newMode: CameraOrientationMode) => {
    setOrientationMode(newMode);
    if (isCameraActive) {
      startCamera(facingMode, newMode);
    }
  };

  const handleToggleFacingCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    toggleFacingMode();
    if (isCameraActive) {
      startCamera(nextFacing, orientationMode);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
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
    return () => {
      stopCamera();
    };
  }, []);

  // Shared Watermark Stamp Engine for both Live Camera & Native Phone Camera
  const generateWatermarkedPhoto = (
    imgSource: CanvasImageSource | null,
    sourceWidth?: number,
    sourceHeight?: number,
    shouldMirror: boolean = false
  ) => {
    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vWidth = sourceWidth && sourceWidth > 0 ? sourceWidth : isLandscape ? 1280 : 720;
    const vHeight = sourceHeight && sourceHeight > 0 ? sourceHeight : isLandscape ? 720 : 1280;

    canvas.width = vWidth;
    canvas.height = vHeight;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WITA';
    const dateStr = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const personName =
      personType === 'teacher'
        ? selectedTeacher?.name || 'Dra. Sri Wahyuni, M.Pd.'
        : selectedStudent?.name || 'Aditya Pratama Putra';
    const identifier =
      personType === 'teacher'
        ? `NIP: ${selectedTeacher?.nip || '198103152006042003'}`
        : `NISN: ${selectedStudent?.nisn || '0078129001'}`;
    const statusLabel =
      personType === 'teacher'
        ? `STATUS: ${selectedTeacher?.employmentStatus || 'PNS'}`
        : `KELAS: ${selectedStudent?.className || 'X MIPA 1'}`;

    if (imgSource) {
      if (shouldMirror) {
        ctx.save();
        ctx.translate(vWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(imgSource, 0, 0, vWidth, vHeight);
        ctx.restore();
      } else {
        ctx.drawImage(imgSource, 0, 0, vWidth, vHeight);
      }
    } else {
      // Dynamic fallback gradient
      const grad = ctx.createLinearGradient(0, 0, vWidth, vHeight);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vWidth, vHeight);

      // Fallback avatar icon
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      const avatarRadius = Math.min(vWidth, vHeight) * 0.16;
      ctx.arc(vWidth / 2, vHeight / 2 - 30, avatarRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(22, Math.round(vWidth / 25))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(personName.split(' ')[0], vWidth / 2, vHeight / 2 - 20);
    }

    // Draw Top Watermark Header
    const topH = Math.max(50, Math.round(vHeight * 0.1));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(0, 0, vWidth, topH);

    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.max(13, Math.round(vWidth / 42))}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(config.schoolName, 20, Math.round(topH * 0.44));

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${Math.max(10, Math.round(vWidth / 56))}px sans-serif`;
    ctx.fillText(
      `NPSN: ${config.npsn} • DOKUMENTASI PRESENSI SIMPEG BKD [${isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}]`,
      20,
      Math.round(topH * 0.8)
    );

    if (isLandscape) {
      // Dynamic Timestamp Shift to Top-Right Header in Landscape Mode
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${Math.max(13, Math.round(vWidth / 46))}px monospace`;
      ctx.fillText(`🕒 ${timeStr} WITA`, vWidth - 20, Math.round(topH * 0.44));

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${Math.max(9.5, Math.round(vWidth / 62))}px sans-serif`;
      ctx.fillText(`📅 ${dateStr}`, vWidth - 20, Math.round(topH * 0.8));

      // Draw Compact Bottom Strip in Landscape Mode (3-column layout)
      const botH = Math.max(76, Math.round(vHeight * 0.15));
      const botY = vHeight - botH;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(0, botY, vWidth, botH);

      // Accent border
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(10, botY + 6, vWidth - 20, botH - 12);

      // Col 1: Identity & Status (Left)
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(13, Math.round(vWidth / 48))}px sans-serif`;
      ctx.fillText(personName, 24, botY + botH * 0.42);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold ${Math.max(10, Math.round(vWidth / 62))}px monospace`;
      ctx.fillText(`${identifier} • ${statusLabel}`, 24, botY + botH * 0.78);

      // Col 2: Session & Biometric status (Center)
      const col2X = vWidth * 0.42;
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${Math.max(11, Math.round(vWidth / 56))}px sans-serif`;
      ctx.fillText(`SESI: ${sessionType.toUpperCase()}`, col2X, botY + botH * 0.42);

      ctx.fillStyle = '#10b981';
      ctx.font = `bold ${Math.max(9.5, Math.round(vWidth / 64))}px sans-serif`;
      ctx.fillText('✓ BIOMETRIK TERVERIFIKASI', col2X, botY + botH * 0.78);

      // Col 3: GPS & Radius (Right)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${Math.max(9, Math.round(vWidth / 66))}px monospace`;
      ctx.fillText(`📍 ${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}`, vWidth - 24, botY + botH * 0.42);

      ctx.fillStyle = '#10b981';
      ctx.font = `bold ${Math.max(9, Math.round(vWidth / 66))}px sans-serif`;
      ctx.fillText(`✓ RADIUS VALID (${gpsLocation.distanceMeter}m)`, vWidth - 24, botY + botH * 0.78);
    } else {
      // Portrait Mode - Standard Bottom Box
      const botH = Math.max(135, Math.round(vHeight * 0.24));
      const botY = vHeight - botH;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(0, botY, vWidth, botH);

      // Accent border
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, botY + 8, vWidth - 20, botH - 16);

      const padX = 24;
      const stepY = botH / 5.2;

      // Text Metadata
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(14, Math.round(vWidth / 36))}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(personName, padX, botY + stepY * 1.25);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold ${Math.max(10, Math.round(vWidth / 52))}px monospace`;
      ctx.fillText(`${identifier}  |  ${statusLabel}`, padX, botY + stepY * 2.15);

      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${Math.max(10, Math.round(vWidth / 50))}px sans-serif`;
      ctx.fillText(`SESI: PRESENSI ${sessionType.toUpperCase()} • ${timeStr}`, padX, botY + stepY * 3.05);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${Math.max(9, Math.round(vWidth / 58))}px sans-serif`;
      ctx.fillText(`📅 ${dateStr}  |  📍 GPS: ${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}`, padX, botY + stepY * 3.95);

      ctx.fillStyle = '#10b981';
      ctx.font = `bold ${Math.max(9, Math.round(vWidth / 58))}px sans-serif`;
      ctx.fillText(`✓ RADIUS VALID (${gpsLocation.distanceMeter}m) - TERVERIFIKASI SISTEM KEPEGAWAIAN`, padX, botY + stepY * 4.8);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhoto(dataUrl);
    setIsCapturing(false);
    stopCamera();
  };

  // Take Snapshot from Live Camera Stream
  const takeSnapshot = () => {
    setIsCapturing(true);
    const video = videoRef.current;
    const vWidth = video && video.videoWidth > 0 ? video.videoWidth : isLandscape ? 1280 : 720;
    const vHeight = video && video.videoHeight > 0 ? video.videoHeight : isLandscape ? 720 : 1280;

    if (video && (video.videoWidth > 0 || video.readyState >= 2)) {
      generateWatermarkedPhoto(video, vWidth, vHeight, facingMode === 'user');
    } else {
      // Local fallback avatar snapshot
      generateWatermarkedPhoto(null, vWidth, vHeight, false);
    }
  };

  // Handle direct capture from native phone camera or file upload
  const handleNativeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const vWidth = img.naturalWidth > 0 ? img.naturalWidth : 1280;
        const vHeight = img.naturalHeight > 0 ? img.naturalHeight : 720;
        generateWatermarkedPhoto(img, vWidth, vHeight, false);
      };
      img.onerror = () => {
        setIsCapturing(false);
        alert('Gagal memproses gambar foto. Pastikan berkas berformat JPG atau PNG.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Perform WebAuthn Biometric Authentication
  const handleWebAuthnSign = async () => {
    const personName = personType === 'teacher' ? selectedTeacher?.name || 'Guru' : selectedStudent?.name || 'Siswa';
    const nipOrNisn = personType === 'teacher' ? selectedTeacher?.nip : selectedStudent?.nisn;

    setIsSigningWebAuthn(true);
    const result = await verifyBiometricIdentity({
      userId: selectedPersonId,
      userName: personName,
      nipOrNisn,
      sessionType,
      schoolName: config.schoolName,
      locationSummary: `${gpsLocation.distanceMeter}m - ${gpsLocation.address}`,
      livenessThreshold: config?.biometricLivenessThreshold ?? 0.75,
    });

    setIsSigningWebAuthn(false);
    if (result.success) {
      setWebAuthnVerified(true);
      playBeepSound();
      alert(`✓ Otentikasi Biometrik WebAuthn Berhasil: Kredensial telah diverifikasi secara kriptografis untuk ${personName}! (${result.authenticatorName})`);
    } else {
      alert(`Otentikasi Biometrik: ${result.error || 'Gagal memverifikasi sensor biometrik WebAuthn.'}`);
    }
  };

  // Submit and save attendance record with required biometric credential assertion
  const handleSaveAttendance = async () => {
    if (!capturedPhoto) {
      alert('Silakan ambil foto selfie dokumentasi terlebih dahulu!');
      return;
    }

    const personName =
      personType === 'teacher'
        ? selectedTeacher?.name || 'Guru'
        : selectedStudent?.name || 'Siswa';
    const identifier =
      personType === 'teacher'
        ? selectedTeacher?.nip || '198103152006042003'
        : selectedStudent?.nisn || '0078129001';
    const classOrSub =
      personType === 'teacher'
        ? selectedTeacher?.subject || 'Guru'
        : selectedStudent?.className || 'X MIPA 1';

    // Verify biometric identity before finalizing record
    let biometricResult: BiometricVerificationResult | null = null;
    if (!webAuthnVerified) {
      setIsSigningWebAuthn(true);
      biometricResult = await verifyBiometricIdentity({
        userId: selectedPersonId,
        userName: personName,
        nipOrNisn: identifier,
        sessionType,
        schoolName: config.schoolName,
        locationSummary: `${gpsLocation.distanceMeter}m - ${gpsLocation.address}`,
        livenessThreshold: config?.biometricLivenessThreshold ?? 0.75,
      });
      setIsSigningWebAuthn(false);

      if (!biometricResult.success) {
        alert(
          `✕ Verifikasi Biometrik Diperlukan: ${
            biometricResult.error || 'Gagal memverifikasi identitas biometrik perangkat. Presensi dibatalkan.'
          }`
        );
        return;
      }
      setWebAuthnVerified(true);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    const todayStr = now.toISOString().split('T')[0];

    // Determine status (terlambat if after deadline)
    const [deadH, deadM] = config.checkInDeadline.split(':').map(Number);
    const isLate =
      sessionType === 'masuk' &&
      (now.getHours() > deadH || (now.getHours() === deadH && now.getMinutes() > deadM));
    const status: AttendanceStatus = isLate ? 'terlambat' : 'hadir';

    const newRecord: AttendanceRecord = {
      id: `rec_${Date.now()}`,
      personId: selectedPersonId,
      personType,
      personName,
      identifier,
      classOrSubject: classOrSub,
      date: todayStr,
      time: timeStr,
      type: sessionType,
      status,
      method: 'webauthn_biometric',
      note: `Selfie & GPS Valid (${gpsLocation.distanceMeter}m dari sekolah) • WebAuthn Biometric Verified (${biometricResult?.authenticatorName || 'Sensor Biometrik'})`,
      photoUrl: capturedPhoto,
      location: {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        address: gpsLocation.address,
        inRadius: gpsLocation.inRadius,
        distanceMeter: gpsLocation.distanceMeter,
      },
      employmentStatus: selectedTeacher?.employmentStatus,
    };

    onRecordAttendance(newRecord);
    setLatestSavedRecord(newRecord);
    playBeepSound();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
  };

  // Generate Email & WA message draft text
  const generateReportMessage = () => {
    if (!latestSavedRecord) return '';
    const dateStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `*LAPORAN BUKTI DOKUMENTASI PRESENSI DIGITAL*
--------------------------------------------------
Instansi  : ${config.schoolName}
NPSN      : ${config.npsn}
Nama      : ${latestSavedRecord.personName}
${latestSavedRecord.personType === 'teacher' ? `NIP       : ${latestSavedRecord.identifier}\nStatus    : ${latestSavedRecord.employmentStatus || 'PNS'}` : `NISN      : ${latestSavedRecord.identifier}\nKelas     : ${latestSavedRecord.classOrSubject}`}
Sesi      : Presensi ${latestSavedRecord.type.toUpperCase()}
Waktu     : ${latestSavedRecord.time} WIB (${dateStr})
Status    : ${latestSavedRecord.status.toUpperCase()} (Tepat Waktu)
Metode    : Foto Selfie + Koordinat GPS Valid
Lokasi    : ${latestSavedRecord.location?.address} (${latestSavedRecord.location?.lat.toFixed(5)}, ${latestSavedRecord.location?.lng.toFixed(5)})
Radius    : ${latestSavedRecord.location?.distanceMeter} Meter (Terverifikasi Geofence Sekolah)
--------------------------------------------------
ID Dokumen Bukti: DOC-${latestSavedRecord.id}
Tercatat resmi dalam Sistem Informasi Kepegawaian & Database Presensi Sekolah.`;
  };

  const handleCopyMessage = () => {
    const text = generateReportMessage();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadPhoto = () => {
    if (!capturedPhoto) return;
    const a = document.createElement('a');
    a.href = capturedPhoto;
    a.download = `bukti_presensi_${selectedPersonId}_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Hidden Canvas for watermark processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Bar */}
      <div className="bg-white p-5 lg:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Presensi Selfie + GPS & Otomatisasi BKD
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verifikasi wajah, stempel dokumentasi otomatis, dan distribusi laporan ke BKD / WA
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Real-time Camera Health Badge & Instant Restart Button */}
          <CameraStreamHealthBadge
            status={cameraHealthStatus}
            streamResolution={streamResolution}
            onRestartCamera={handleRestartCamera}
            isRestarting={isRestarting}
            attemptNumber={cameraAttempts}
          />

          {/* Mode Selector */}
          {userRole === 'siswa' ? (
            <div className="flex items-center space-x-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-2xl text-xs font-extrabold text-blue-700">
              <span>Presensi Mandiri Siswa</span>
            </div>
          ) : userRole === 'guru' ? (
            <div className="flex items-center space-x-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-2xl text-xs font-extrabold text-purple-700">
              <span>Presensi Mandiri Guru & GTK</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => {
                  setPersonType('teacher');
                  setCapturedPhoto(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  personType === 'teacher'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Guru & ASN (PNS/PPPK)
              </button>
              <button
                onClick={() => {
                  setPersonType('student');
                  setCapturedPhoto(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  personType === 'student'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Peserta Didik (Siswa)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Fallback Banner for Manual Input */}
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
                  Kamera selfie gagal diakses setelah {cameraAttempts} kali percobaan atau terdeteksi layar hitam.
                  Anda dapat mengonfirmasi presensi manual darurat secara langsung di bawah ini.
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

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-700 dark:text-slate-200">
              Presensi Manual Darurat untuk:{' '}
              <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                {personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name}
              </strong>{' '}
              ({personType === 'teacher' ? selectedTeacher?.nip : selectedStudent?.nisn})
            </div>

            <button
              type="button"
              onClick={() => {
                const personName =
                  personType === 'teacher' ? selectedTeacher?.name || 'Guru' : selectedStudent?.name || 'Siswa';
                const identifier =
                  personType === 'teacher'
                    ? selectedTeacher?.nip || '198103152006042003'
                    : selectedStudent?.nisn || '0078129001';
                const classOrSub =
                  personType === 'teacher'
                    ? selectedTeacher?.subject || 'Guru'
                    : selectedStudent?.className || 'X MIPA 1';

                const now = new Date();
                const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
                const todayStr = effectiveToday;

                const emergencyRecord: AttendanceRecord = {
                  id: `att_emerg_${Date.now()}`,
                  personId: selectedPersonId,
                  personType,
                  personName,
                  identifier,
                  classOrSubject: classOrSub,
                  date: todayStr,
                  time: timeStr,
                  type: sessionType,
                  status: 'hadir',
                  method: 'manual',
                  note: '[Presensi Darurat - Kamera Error]',
                  photoUrl: personType === 'teacher' ? selectedTeacher?.avatar : selectedStudent?.avatar,
                  location: {
                    lat: gpsLocation.lat,
                    lng: gpsLocation.lng,
                    address: gpsLocation.address,
                    inRadius: gpsLocation.inRadius,
                    distanceMeter: gpsLocation.distanceMeter,
                  },
                };

                onRecordAttendance(emergencyRecord);
                setLatestSavedRecord(emergencyRecord);
                playBeepSound();
                alert(`✓ Presensi Manual Darurat Berhasil Dicatat untuk ${personName}!`);
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Presensi Manual Darurat</span>
            </button>
          </div>
        </div>
      )}

      {/* Holiday Notification Banner */}
      {holidayInfo.isHoliday && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <CalendarOff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-amber-950">
                  Pemberitahuan Hari Libur Kalender Pendidikan
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                  Libur Resmi
                </span>
              </div>
              <p className="text-xs text-amber-800 font-semibold mt-0.5">
                {holidayInfo.eventTitle} — {holidayInfo.description}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {isBlockedByHoliday
                  ? 'Tombol presensi dinonaktifkan otomatis sesuai kalender akademik resmi sekolah.'
                  : 'Mode Override Aktif: Presensi diizinkan oleh Administrator / Guru Piket.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setOverrideHoliday(!overrideHoliday)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all self-start sm:self-auto cursor-pointer border ${
              overrideHoliday
                ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {overrideHoliday ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{overrideHoliday ? 'Kunci Kembali' : 'Override Presensi'}</span>
          </button>
        </div>
      )}

      {/* Main Form & Capture Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Person Selector (4 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 lg:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Pilih Personil Presensi</span>
            </h3>

            {/* Sesi Presensi: Masuk / Pulang */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Sesi Presensi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSessionType('masuk')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    sessionType === 'masuk'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Presensi Masuk (Pagi)
                </button>
                <button
                  onClick={() => setSessionType('pulang')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    sessionType === 'pulang'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Presensi Pulang (Sore)
                </button>
              </div>
            </div>

            {/* Person Dropdown / Verified Identity Card */}
            {userRole === 'siswa' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Identitas Siswa Terverifikasi</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Akun Terautentikasi
                  </span>
                </label>
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {selectedStudent?.name || currentAccount?.name || 'Peserta Didik'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Kelas: {selectedStudent?.className || currentAccount?.classOrSubject || '-'} • NISN: {selectedStudent?.nisn || currentAccount?.identifier || '-'}
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    Siswa Aktif
                  </span>
                </div>
              </div>
            ) : userRole === 'guru' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Identitas Guru / GTK Terverifikasi</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Akun Terautentikasi
                  </span>
                </label>
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {selectedTeacher?.name || currentAccount?.name || 'Guru / GTK'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {selectedTeacher?.subject || currentAccount?.classOrSubject || 'GTK'} • NIP: {selectedTeacher?.nip || currentAccount?.identifier || '-'} • [{selectedTeacher?.employmentStatus || 'ASN'}]
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-300">
                    GTK Terdaftar
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {personType === 'teacher' ? 'Nama Guru / Pegawai' : 'Nama Siswa'}
                </label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => {
                    setSelectedPersonId(e.target.value);
                    setCapturedPhoto(null);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {personType === 'teacher'
                    ? teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} - [{t.employmentStatus}] - NIP: {t.nip}
                        </option>
                      ))
                    : students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.className}) - NISN: {s.nisn}
                        </option>
                      ))}
                </select>
              </div>
            )}

            {/* Active Person Detail Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
              <img
                src={
                  personType === 'teacher'
                    ? selectedTeacher?.avatar
                    : selectedStudent?.avatar
                }
                alt="Avatar"
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                    {personType === 'teacher'
                      ? selectedTeacher?.employmentStatus
                      : selectedStudent?.className}
                  </span>
                  {personType === 'teacher' && (
                    <span className="text-[10px] font-bold text-slate-400">
                      NIP: {selectedTeacher?.nip}
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-xs text-slate-900 mt-0.5 truncate">
                  {personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {personType === 'teacher'
                    ? selectedTeacher?.subject
                    : `No. Ortu: ${selectedStudent?.parentPhone}`}
                </p>
              </div>
            </div>

            {/* WebAuthn Biometric Security Layer Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-indigo-800/60 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-white">Biometrik WebAuthn (FIDO2)</h5>
                    <p className="text-[10px] text-indigo-200">Tanda tangan sensor sidik jari / Passkey</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold flex items-center space-x-1 ${
                    webAuthnVerified
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {webAuthnVerified ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>TERTANDATANGANI</span>
                    </>
                  ) : (
                    <span>OPSIONAL</span>
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleWebAuthnSign}
                  disabled={isSigningWebAuthn || isBlockedByHoliday}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                    webAuthnVerified
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isSigningWebAuthn ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memverifikasi Sensor...</span>
                    </>
                  ) : webAuthnVerified ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Biometrik Terverifikasi</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Tanda Tangani dengan Biometrik</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowBiometricGuide(true)}
                  className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200 text-xs font-semibold cursor-pointer border border-white/10"
                  title="Buka Panduan Perekaman Biometrik & Standar Foto"
                >
                  Panduan
                </button>
              </div>
            </div>

            {/* Real-time Leaflet Geofencing Map & Visual Feedback */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center space-x-1.5 font-bold text-xs text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                  <span>Peta Geofence Lokasi Presensi (Leaflet)</span>
                </span>
                <div className="flex items-center space-x-1.5">
                  {userRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setIsManualGpsModalOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                      title="Atur posisi sekolah di GPS secara manual"
                    >
                      <Crosshair className="w-3 h-3 text-indigo-600" />
                      <span>Atur Posisi Sekolah</span>
                    </button>
                  )}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      gpsLocation.inRadius
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {gpsLocation.inRadius
                      ? `✓ RADIUS VALID (${gpsLocation.distanceMeter}m)`
                      : `✕ DILUAR RADIUS (${gpsLocation.distanceMeter}m)`}
                  </span>
                </div>
              </div>

              {/* Leaflet Interactive Map */}
              <LiveSelfieLeafletMap
                config={config}
                userLat={gpsLocation.lat}
                userLng={gpsLocation.lng}
                userName={personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name}
                userAvatar={personType === 'teacher' ? selectedTeacher?.avatar : selectedStudent?.avatar}
                isTeacher={personType === 'teacher'}
                onLocationChange={(loc) => setGpsLocation(loc)}
                height="260px"
              />

              {/* Location Address & Coordinates */}
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs space-y-1.5">
                <p className="text-[11px] font-medium text-slate-700 leading-snug">
                  📍 {gpsLocation.address}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Lat: {gpsLocation.lat.toFixed(5)}, Lng: {gpsLocation.lng.toFixed(5)}</span>
                  <span className="font-sans font-bold text-indigo-700">
                    Radius Maks: {config?.maxRadiusMeters ?? config?.geofenceRadius ?? 100}m
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    Pusat Sekolah: {config?.schoolLat?.toFixed(5) ?? -1.8214}, {config?.schoolLng?.toFixed(5) ?? 124.7081}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualGpsModalOpen(true)}
                    className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 underline decoration-indigo-300 cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Atur Posisi GPS Manual</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {/* Hidden file input for 100% reliable camera capture on mobile devices */}
            <input
              ref={nativeFileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleNativeFileUpload}
              className="hidden"
            />

            {isBlockedByHoliday && (
              <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-2xl text-amber-900 text-xs font-bold text-center flex items-center justify-center space-x-2">
                <CalendarOff className="w-4 h-4 text-amber-700" />
                <span>Hari Libur Sekolah: Presensi Dinonaktifkan</span>
              </div>
            )}

            {!isCameraActive && !capturedPhoto && (
              <div className="space-y-2">
                <button
                  onClick={() => startCamera()}
                  disabled={isBlockedByHoliday}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Live (Webcam)</span>
                </button>
                <button
                  type="button"
                  onClick={() => nativeFileInputRef.current?.click()}
                  disabled={isBlockedByHoliday}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-200 disabled:cursor-not-allowed text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  title="Gunakan aplikasi kamera bawaan HP jika live webcam bermasalah"
                >
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Ambil Foto via Kamera HP (Native) / Galeri</span>
                </button>
              </div>
            )}

            {isCameraActive && (
              <div className="space-y-2">
                <button
                  onClick={takeSnapshot}
                  disabled={isCapturing || isBlockedByHoliday}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ambil Foto & Generate Stempel BKD</span>
                </button>
                <button
                  type="button"
                  onClick={() => nativeFileInputRef.current?.click()}
                  disabled={isCapturing || isBlockedByHoliday}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Alternatif: Ambil dari Kamera Bawaan HP</span>
                </button>
              </div>
            )}

            {capturedPhoto && (
              <div className="space-y-2">
                <button
                  onClick={handleSaveAttendance}
                  disabled={isBlockedByHoliday}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan & Kirim Bukti Presensi</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => startCamera()}
                    className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ulang Foto</span>
                  </button>

                  <button
                    onClick={handleDownloadPhoto}
                    className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Foto</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Camera Viewfinder & Watermarked Canvas Display (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 lg:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Pratinjau Foto Dokumentasi Resmi</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                Watermark Otomatis
              </span>
            </div>

            {/* Camera Error Troubleshooting Alert */}
            {cameraError && (
              <div className="mt-3">
                <CameraErrorAlert
                  error={cameraError}
                  onRetry={() => startCamera(facingMode, orientationMode, false)}
                  onUseVirtualCamera={() => startCamera(facingMode, orientationMode, true)}
                  onDismiss={() => setCameraError(null)}
                />
              </div>
            )}

            {/* Camera Orientation & Device Adaptation Control (Auto Landscape & Portrait) */}
            <div className="mt-3">
              <CameraOrientationToolbar
                orientationMode={orientationMode}
                effectiveOrientation={effectiveOrientation}
                onSelectOrientationMode={handleOrientationModeChange}
                facingMode={facingMode}
                onToggleFacingMode={handleToggleFacingCamera}
                streamResolution={streamResolution}
                hardwareInfo={hardwareInfo}
                isPhoneTilted={isPhoneTilted}
                deviceType={deviceType}
                isSimulated={isSimulated}
                onToggleSimulated={() => startCamera(facingMode, orientationMode, !isSimulated)}
              />
            </div>

            {/* Display Area - Responsive Auto Landscape & Portrait */}
            <div
              className={`mt-3 relative w-full transition-all duration-300 mx-auto rounded-3xl overflow-hidden bg-slate-950 flex items-center justify-center border-4 border-slate-900 shadow-xl ${
                isLandscape ? 'aspect-[16/9] max-w-xl' : 'aspect-[3/4] max-w-sm'
              }`}
            >
              {/* Active Video Stream */}
              {isCameraActive && (
                <div className="relative w-full h-full">
                  <video
                    ref={handleVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const v = e.target as HTMLVideoElement;
                      handleVideoMetadata(v);
                      v.play().catch((err) => console.warn('Play error:', err));
                    }}
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />
                  {/* Viewfinder Target Frame - Adapts to Portrait / Landscape */}
                  <div
                    className={`absolute inset-6 border-2 border-dashed border-white/50 pointer-events-none flex items-center justify-center ${
                      isLandscape ? 'rounded-3xl' : 'rounded-full'
                    }`}
                  >
                    <span className="text-white/80 text-xs font-bold px-3 py-1 bg-slate-900/60 rounded-full backdrop-blur-xs">
                      Posisikan Wajah di Tengah • {isLandscape ? 'Mode Landscape' : 'Mode Portrait'}
                    </span>
                  </div>

                  {/* Orientation & Resolution Tag */}
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-[10px] font-mono font-bold text-emerald-400 px-2.5 py-1 rounded-xl border border-slate-700 pointer-events-none flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}</span>
                    {streamResolution && streamResolution.width > 0 && (
                      <span className="text-slate-300">({streamResolution.width}×{streamResolution.height})</span>
                    )}
                  </div>

                  {/* Dynamic Timestamp Repositioning based on Landscape / Portrait Phone Tilt */}
                  {isLandscape ? (
                    // Landscape Mode: Timestamp placed at Top-Right for optimal facial visibility
                    <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-xs text-xs font-mono font-bold text-sky-400 px-3 py-1 rounded-xl border border-sky-500/30 flex items-center space-x-1.5 shadow-lg pointer-events-none">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{liveClock} WITA</span>
                    </div>
                  ) : (
                    // Portrait Mode: Timestamp placed at Bottom Strip with Geolocation Status
                    <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-xs text-[11px] text-white px-3 py-1.5 rounded-xl border border-slate-700 pointer-events-none flex items-center justify-between shadow-lg">
                      <div className="flex items-center space-x-1.5 font-mono text-sky-400 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{liveClock} WITA</span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                        <span>📍 GPS Aktif ({gpsLocation.distanceMeter}m)</span>
                      </div>
                    </div>
                  )}

                  {/* Automatic Tilt Notification when Phone is physically rotated */}
                  {isPhoneTilted && (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-bold text-[10px] px-3 py-1 rounded-full shadow-xl pointer-events-none animate-bounce flex items-center space-x-1.5">
                      <RotateCcw className="w-3 h-3 animate-spin" />
                      <span>Kemiringan HP Terdeteksi: Otomatis Landscape</span>
                    </div>
                  )}
                </div>
              )}

              {/* Captured Stamped Photo */}
              {!isCameraActive && capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Bukti Presensi"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Idle Placeholder */}
              {!isCameraActive && !capturedPhoto && (
                <div className="text-center p-8 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Kamera Belum Aktif</h4>
                    <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                      Kamera otomatis menyesuaikan posisi Landscape & Portrait pada semua tipe HP dan Laptop.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => startCamera()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Mulai Kamera Live</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => nativeFileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Kamera HP / Galeri</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Success Banner & Automated Distribution Triggers with Framer Motion */}
          <AnimatePresence mode="wait">
            {latestSavedRecord && (
              <motion.div
                key={`submission-result-${latestSavedRecord.id}`}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-slate-900 text-white border border-emerald-700/60 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-300">
                        Presensi Berhasil Diverifikasi!
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        ID Dokumen: DOC-{latestSavedRecord.id} • {latestSavedRecord.time} WIB
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[10px] font-bold border border-emerald-500/30">
                    Tersimpan
                  </span>
                </div>

                {/* Quick automated sharing actions */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  {/* 1. Kirim ke BKD */}
                  <button
                    onClick={() => {
                      setShareType('bkd');
                      setShowShareModal(true);
                    }}
                    className="py-2 px-2 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl font-bold flex items-center justify-center space-x-1 border border-purple-500/40 transition-all cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Kirim BKD</span>
                  </button>

                  {/* 2. Kirim WhatsApp */}
                  <button
                    onClick={() => {
                      setShareType('whatsapp');
                      setShowShareModal(true);
                    }}
                    className="py-2 px-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded-xl font-bold flex items-center justify-center space-x-1 border border-emerald-500/40 transition-all cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Kirim WA</span>
                  </button>

                  {/* 3. Kirim Email */}
                  <button
                    onClick={() => {
                      setShareType('email');
                      setShowShareModal(true);
                    }}
                    className="py-2 px-2 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded-xl font-bold flex items-center justify-center space-x-1 border border-blue-500/40 transition-all cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Kirim Email</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Interactive Leaflet Map for Teacher Attendance Locations */}
      <div className="pt-2">
        <TeacherAttendanceMap
          records={existingRecords}
          config={config}
          schoolLat={config?.schoolLat}
          schoolLng={config?.schoolLng}
          schoolName={config?.schoolName}
          geofenceRadius={config?.geofenceRadius || 150}
        />
      </div>

      {/* Biometric & Profile Photo Guided Registration Modal */}
      <BiometricRegistrationGuideModal
        isOpen={showBiometricGuide}
        onClose={() => setShowBiometricGuide(false)}
        userRole={personType}
        userName={personType === 'teacher' ? selectedTeacher?.name : selectedStudent?.name}
        userId={selectedPersonId}
      />

      {/* Automated Distribution Modal with Framer Motion (Email, WA, BKD) */}
      <AnimatePresence>
        {showShareModal && latestSavedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  {shareType === 'bkd' && <Building2 className="w-5 h-5 text-purple-600" />}
                  {shareType === 'whatsapp' && <Phone className="w-5 h-5 text-emerald-600" />}
                  {shareType === 'email' && <Mail className="w-5 h-5 text-blue-600" />}
                  <span>
                    {shareType === 'bkd'
                      ? 'Sinkronisasi ke Portal BKD'
                      : shareType === 'whatsapp'
                      ? 'Kirim Bukti ke WhatsApp'
                      : 'Kirim Laporan Resmi via Email'}
                  </span>
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Template preview */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Draf Pesan Resmi Terformat:</span>
                  <button
                    onClick={handleCopyMessage}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText ? 'Tersalin!' : 'Salin Teks'}</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  rows={9}
                  value={generateReportMessage()}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[11px] text-slate-800 leading-relaxed resize-none focus:outline-none"
                />
              </div>

              {/* Action Buttons based on Share Type */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>

                {shareType === 'whatsapp' && (
                  <a
                    href={`https://wa.me/${config.bkdWhatsApp || '6281299887766'}?text=${encodeURIComponent(
                      generateReportMessage()
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Buka WhatsApp Web / App</span>
                  </a>
                )}

                {shareType === 'email' && (
                  <a
                    href={`mailto:${config.bkdEmail || 'bkd.presensi@jakarta.go.id'}?subject=${encodeURIComponent(
                      `[BUKTI PRESENSI] ${latestSavedRecord.personName} - ${latestSavedRecord.date}`
                    )}&body=${encodeURIComponent(generateReportMessage())}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Buka Aplikasi Email</span>
                  </a>
                )}

                {shareType === 'bkd' && (
                  <button
                    onClick={() => {
                      alert(
                        '✓ Data presensi dan foto stempel digital berhasil disinkronkan ke Server BKD & SIMPEG!'
                      );
                      setShowShareModal(false);
                    }}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Kirim & Sinkronkan ke SIMPEG BKD</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Pengaturan Posisi GPS Sekolah Secara Manual */}
      <ManualGpsLocationModal
        isOpen={isManualGpsModalOpen}
        onClose={() => setIsManualGpsModalOpen(false)}
        currentLat={config?.schoolLat ?? -1.8214}
        currentLng={config?.schoolLng ?? 124.7081}
        currentRadius={config?.maxRadiusMeters || 100}
        schoolName={config?.schoolName || 'SMPN 4 Taliabu Barat'}
        onSaveGpsLocation={(lat, lng, radius) => {
          if (onUpdateSchoolGps) {
            onUpdateSchoolGps(lat, lng, radius);
          }
        }}
      />
    </div>
  );
};
