import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Copy,
  Download,
  ShieldCheck,
  Video,
  SwitchCamera,
  Sparkles,
  Info,
  Check,
  AlertCircle,
} from 'lucide-react';
import { SchoolConfig, ActivityLog, CameraDebugMetadata } from '../types';
import {
  collectCameraDebugMetadata,
  analyzeFrameForBlackScreen,
  purgeCameraAssetsAndServiceWorkerCache,
  bindStreamToVideo,
  CameraStreamHealth,
  CameraStreamHealthBadge,
} from '../utils/cameraOrientationUtils';

interface HardwareDiagnosticTabProps {
  config: SchoolConfig;
  onAddActivityLog?: (log: ActivityLog) => void;
  todayDate?: string;
}

interface DeviceItem {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId: string;
}

export const HardwareDiagnosticTab: React.FC<HardwareDiagnosticTabProps> = ({
  config,
  onAddActivityLog,
  todayDate = new Date().toISOString().split('T')[0],
}) => {
  // Test Stream States
  const [selectedFacingMode, setSelectedFacingMode] = useState<'user' | 'environment'>('environment');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isTestingCamera, setIsTestingCamera] = useState<boolean>(false);
  const [cameraHealth, setCameraHealth] = useState<CameraStreamHealth>('initializing');
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number } | null>(null);
  const [activeFps, setActiveFps] = useState<number>(0);
  const [blackScreenLuminance, setBlackScreenLuminance] = useState<number>(0);
  const [isBlackScreenWarning, setIsBlackScreenWarning] = useState<boolean>(false);
  const [diagnosticLogMessage, setDiagnosticLogMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  // Hardware and Browser Info
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [browserInfo, setBrowserInfo] = useState<CameraDebugMetadata | null>(null);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const blackScreenCounterRef = useRef<number>(0);

  // 1. Initial Device & Browser Audit
  const runHardwareAudit = async () => {
    // Collect browser metadata
    const meta = collectCameraDebugMetadata(undefined, {
      facingMode: selectedFacingMode,
      permissionStatus: permissionStatus,
    });
    setBrowserInfo(meta);

    // Check camera permission
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'camera' as any });
        setPermissionStatus(status.state as any);
        status.onchange = () => {
          setPermissionStatus(status.state as any);
        };
      } catch {
        setPermissionStatus('unsupported');
      }
    } else {
      setPermissionStatus('unsupported');
    }

    // Enumerate hardware devices
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const mapped = deviceList.map((d) => ({
          deviceId: d.deviceId,
          kind: d.kind,
          label: d.label || `${d.kind} (${d.deviceId.substring(0, 8)}...)`,
          groupId: d.groupId,
        }));
        setDevices(mapped);
      } catch (err: any) {
        console.warn('Gagal memindai perangkat media:', err);
      }
    }
  };

  useEffect(() => {
    runHardwareAudit();
    startDiagnosticCamera();

    return () => {
      stopDiagnosticCamera();
    };
  }, []);

  // 2. Start Diagnostic Camera Stream
  const startDiagnosticCamera = async (targetDeviceId?: string, targetFacing?: 'user' | 'environment') => {
    stopDiagnosticCamera();
    setIsTestingCamera(true);
    setCameraHealth('initializing');
    setDiagnosticLogMessage('Menghubungi hardware sensor video...');

    const facing = targetFacing || selectedFacingMode;
    const deviceId = targetDeviceId || selectedDeviceId;

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: facing === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        setStreamResolution({
          width: settings.width || 1280,
          height: settings.height || 720,
        });
        if (settings.frameRate) {
          setActiveFps(Math.round(settings.frameRate));
        }

        track.onended = () => {
          setCameraHealth('error');
          setDiagnosticLogMessage('Stream kamera dihentikan oleh sistem operasi atau aplikasi lain.');
        };
      }

      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, stream);
      }

      setCameraHealth('healthy');
      setDiagnosticLogMessage('Sensor video aktif normal. Monitor real-time beroperasi.');
      runAuditLoop();
    } catch (err: any) {
      console.error('Diagnostic camera error:', err);
      setCameraHealth('error');
      const debugMeta = collectCameraDebugMetadata(err, {
        facingMode: facing,
        attemptNumber: 1,
        hardwareDevicesCount: devices.filter((d) => d.kind === 'videoinput').length,
        permissionStatus,
      });

      setDiagnosticLogMessage(`Error inisialisasi: ${err.name || 'CameraAccessError'} - ${err.message}`);

      // Automatically add to ActivityLog
      if (onAddActivityLog) {
        onAddActivityLog({
          id: `act_diag_cam_${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayDate,
          time: new Date().toLocaleTimeString('id-ID'),
          category: 'system',
          actor: {
            name: config?.adminName || 'Administrator',
            role: 'Admin Sistem',
          },
          action: 'Kegagalan Akses Sensor Kamera (Diagnostik Hardware)',
          description: `Pengujian diagnostik kamera mendeteksi error [${err.name}]: ${err.message}.`,
          status: 'error',
          debugMetadata: debugMeta,
        });
      }
    }
  };

  const stopDiagnosticCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTestingCamera(false);
  };

  // 3. Continuous Video Analysis Loop (Black Screen & FPS)
  const runAuditLoop = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const checkFrame = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const analysis = analyzeFrameForBlackScreen(videoRef.current);
        setBlackScreenLuminance(analysis.averageLuminance);

        if (analysis.isBlackScreen) {
          blackScreenCounterRef.current += 1;
          if (blackScreenCounterRef.current >= 3) {
            setIsBlackScreenWarning(true);
            setCameraHealth('error');
            setDiagnosticLogMessage(
              'PERINGATAN: Layar Hitam (Black Screen) terdeteksi! Sensor kamera tidak mengirimkan piksel cahaya (Luminans <= 2.5).'
            );
          }
        } else {
          blackScreenCounterRef.current = 0;
          setIsBlackScreenWarning(false);
          if (cameraHealth !== 'healthy') {
            setCameraHealth('healthy');
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(checkFrame);
    };

    animFrameRef.current = requestAnimationFrame(checkFrame);
  };

  // 4. Aggressive Service Worker & WebRTC Cache Purge
  const handleAggressivePurge = async () => {
    setIsPurgingCache(true);
    setPurgeStatus('Sedang membersihkan CacheStorage & Service Worker...');
    try {
      const result = await purgeCameraAssetsAndServiceWorkerCache();
      setPurgeStatus(result.message);

      // Re-initialize camera after purge
      setTimeout(async () => {
        await startDiagnosticCamera();
        setIsPurgingCache(false);
        setPurgeStatus('Pembersihan tuntas. Sensor kamera telah di-restart.');
      }, 800);
    } catch (err: any) {
      setIsPurgingCache(false);
      setPurgeStatus(`Gagal membersihkan cache: ${err.message}`);
    }
  };

  // 5. Generate Diagnostic Report (JSON)
  const generateDiagnosticReport = () => {
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');
    return {
      appName: config?.schoolName || 'SMP Negeri 4 Taliabu Barat',
      reportType: 'Hardware & Camera Diagnostic Audit',
      timestamp: new Date().toISOString(),
      system: browserInfo,
      cameraStatus: {
        health: cameraHealth,
        facingMode: selectedFacingMode,
        resolution: streamResolution,
        activeFps,
        averageLuminance: blackScreenLuminance,
        blackScreenDetected: isBlackScreenWarning,
        permissionStatus,
      },
      detectedHardware: {
        totalDevices: devices.length,
        videoInputsCount: videoDevices.length,
        devicesList: devices.map((d) => ({
          kind: d.kind,
          label: d.label,
          deviceId: d.deviceId ? `${d.deviceId.substring(0, 12)}...` : 'empty',
        })),
      },
      browserAPIs: {
        mediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
        getUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
        permissionsAPI: typeof navigator !== 'undefined' && !!navigator.permissions,
        serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        cacheStorage: typeof window !== 'undefined' && 'caches' in window,
        barcodeDetector: typeof window !== 'undefined' && 'BarcodeDetector' in window,
        canvas2d: typeof document !== 'undefined' && !!document.createElement('canvas').getContext('2d'),
      },
    };
  };

  const handleCopyReport = () => {
    const jsonStr = JSON.stringify(generateDiagnosticReport(), null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadReport = () => {
    const jsonStr = JSON.stringify(generateDiagnosticReport(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hardware_Camera_Diagnostic_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRecordToAuditLog = () => {
    const report = generateDiagnosticReport();
    if (onAddActivityLog) {
      onAddActivityLog({
        id: `act_diag_manual_${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayDate,
        time: new Date().toLocaleTimeString('id-ID'),
        category: 'system',
        actor: {
          name: config?.adminName || 'Administrator',
          role: 'Admin Sistem',
        },
        action: 'Inspeksi & Diagnostik Mandiri Hardware Kamera',
        description: `Audit real-time hardware selesai: ${report.detectedHardware.videoInputsCount} sensor kamera terdeteksi, status stream: ${cameraHealth}.`,
        status: isBlackScreenWarning ? 'warning' : 'success',
        debugMetadata: report.system || undefined,
      });
      setDiagnosticLogMessage('Hasil diagnostik telah dicatat ke Log Audit Sistem.');
    }
  };

  const videoInputs = devices.filter((d) => d.kind === 'videoinput');

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Live Hardware Diagnostic Suite
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-300">
                v2.6.4
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Diagnostik Perangkat Keras & Sensor Kamera
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Panel investigasi real-time untuk mendeteksi kesiapan sensor video, status izin peramban,
              pencegahan <span className="text-amber-300 font-semibold">black screen</span>, dan perbaikan
              cache Service Worker agresif.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
              title="Salin laporan diagnostik ke papan klip"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'Tersalin!' : 'Salin Laporan'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadReport}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Live Camera Stream & Health on Left, Hardware Matrix on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Camera Monitor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Uji Langsung Sensor Kamera
                </h3>
              </div>

              {/* Status Badge */}
              <CameraStreamHealthBadge
                status={cameraHealth}
                streamResolution={streamResolution}
                fps={activeFps}
                onRestartCamera={() => startDiagnosticCamera()}
                isRestarting={cameraHealth === 'initializing'}
              />
            </div>

            {/* Video Viewfinder Container */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Black Screen Warning Overlay */}
              {isBlackScreenWarning && (
                <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3 animate-in fade-in">
                  <div className="p-3 rounded-full bg-rose-500/20 text-rose-300">
                    <AlertCircle className="w-8 h-8 text-rose-400 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-rose-200">Terdeteksi Layar Hitam (Black Screen)</h4>
                    <p className="text-xs text-rose-300/90 max-w-sm mt-1">
                      Frame video tidak memiliki intensitas cahaya (Luminans: {blackScreenLuminance.toFixed(1)}/255).
                      Hardware kamera kemungkinan sedang terkunci atau membutuhkan reset cache.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAggressivePurge}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge Cache & Reset WebRTC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startDiagnosticCamera()}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                    >
                      Restart Stream
                    </button>
                  </div>
                </div>
              )}

              {/* Overlay HUD (Real-time telemetry) */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
                <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-emerald-400 font-bold border border-white/10">
                  LUMA: {blackScreenLuminance.toFixed(1)} / 255
                </span>
                {streamResolution && (
                  <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-cyan-300 font-bold border border-white/10">
                    {streamResolution.width}×{streamResolution.height}
                  </span>
                )}
                <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono text-amber-300 font-bold border border-white/10">
                  {selectedFacingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}
                </span>
              </div>
            </div>

            {/* Camera Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextFacing = selectedFacingMode === 'user' ? 'environment' : 'user';
                    setSelectedFacingMode(nextFacing);
                    startDiagnosticCamera(selectedDeviceId, nextFacing);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                  <span>
                    Beralih ke {selectedFacingMode === 'user' ? 'Kamera Belakang' : 'Kamera Depan'}
                  </span>
                </button>

                {videoInputs.length > 1 && (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      startDiagnosticCamera(e.target.value, selectedFacingMode);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    <option value="">-- Pilih Sensor Kamera Fisik --</option>
                    {videoInputs.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Kamera #${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleAggressivePurge}
                  disabled={isPurgingCache}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Hapus cache WebRTC dan Service Worker"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${isPurgingCache ? 'animate-spin' : ''}`} />
                  <span>{isPurgingCache ? 'Membersihkan...' : 'Purge Cache SW'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRecordToAuditLog}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Catat ke Audit Log</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Message Alert */}
            {diagnosticLogMessage && (
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start space-x-2">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="font-mono leading-relaxed">{diagnosticLogMessage}</p>
              </div>
            )}

            {purgeStatus && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{purgeStatus}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Hardware Details, Capabilities & Matrix (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Permission & System Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center justify-between">
              <span>Status Izin & Platform Perangkat</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  permissionStatus === 'granted'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : permissionStatus === 'denied'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                Izin: {permissionStatus}
              </span>
            </h3>

            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Browser & Versi:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {browserInfo?.browserName} {browserInfo?.browserVersion}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Sistem Operasi (OS):</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {browserInfo?.os}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Tipe Perangkat:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                  {browserInfo?.deviceType}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Resolusi Layar:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {browserInfo?.screenResolution}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Viewport Area:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {browserInfo?.viewportSize}
                </span>
              </div>
            </div>
          </div>

          {/* Web API Support Matrix */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              Matriks Kesiapan Web API Peramban
            </h3>

            <div className="space-y-2 text-xs">
              {[
                {
                  name: 'WebRTC MediaDevices (getUserMedia)',
                  supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
                  desc: 'Akses hardware kamera langsung',
                },
                {
                  name: 'Service Worker & CacheStorage',
                  supported: typeof window !== 'undefined' && 'serviceWorker' in navigator && 'caches' in window,
                  desc: 'Penyimpanan cache offline & hook pembersihan',
                },
                {
                  name: 'Canvas 2D Frame Processing',
                  supported: typeof document !== 'undefined' && !!document.createElement('canvas').getContext('2d'),
                  desc: 'Analisis luminans detektor black screen',
                },
                {
                  name: 'BarcodeDetector API (Native QR)',
                  supported: typeof window !== 'undefined' && 'BarcodeDetector' in window,
                  desc: 'Pemindaian QR berbasis hardware akselerasi',
                },
                {
                  name: 'Geolocation API (GPS Koordinat)',
                  supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
                  desc: 'Validasi radius lokasi presensi selfie',
                },
              ].map((api, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{api.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{api.desc}</div>
                  </div>
                  {api.supported ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Didukung
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      Fallback
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Enumerate Devices List */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Sensor Video Terdeteksi ({videoInputs.length})
              </h3>
              <button
                type="button"
                onClick={runHardwareAudit}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Pindai Ulang
              </button>
            </div>

            {videoInputs.length === 0 ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                Tidak ada sensor kamera video yang terdeteksi. Pastikan izin kamera telah diberikan.
              </div>
            ) : (
              <div className="space-y-2">
                {videoInputs.map((d, index) => (
                  <div
                    key={d.deviceId || index}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {d.label || `Video Input #${index + 1}`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold">
                        Sensor #{index + 1}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">
                      ID: {d.deviceId ? `${d.deviceId.substring(0, 24)}...` : 'Label tersembunyi (Izin dibutuhkan)'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
