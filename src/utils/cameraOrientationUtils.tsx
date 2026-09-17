import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Smartphone,
  Laptop,
  RotateCw,
  SwitchCamera,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Video,
  VideoOff,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { CameraDebugMetadata } from '../types';

export type CameraOrientationMode = 'auto' | 'portrait' | 'landscape';
export type DeviceOrientationType = 'portrait' | 'landscape';
export type DeviceType = 'mobile' | 'tablet' | 'laptop_or_desktop';
export type CameraFacingMode = 'user' | 'environment';

export interface UniversalCameraErrorInfo {
  code: 'PERMISSION_DENIED' | 'DEVICE_NOT_FOUND' | 'CAMERA_BUSY' | 'SECURITY_RESTRICTION' | 'OVERCONSTRAINED' | 'UNKNOWN';
  title: string;
  message: string;
  suggestion: string;
}

/**
 * Robust error classifier for WebRTC camera initialization errors
 */
export function parseCameraError(err: any): UniversalCameraErrorInfo {
  const errorName = err?.name || '';
  const errorMessage = (err?.message || '').toLowerCase();

  if (
    errorName === 'NotAllowedError' ||
    errorName === 'PermissionDeniedError' ||
    errorMessage.includes('permission') ||
    errorMessage.includes('denied')
  ) {
    return {
      code: 'PERMISSION_DENIED',
      title: 'Izin Akses Kamera Ditolak',
      message: 'Browser memblokir akses ke kamera perangkat. Mohon izinkan akses kamera agar fitur presensi dan pemindai dapat aktif.',
      suggestion: 'Klik ikon gembok atau setelan situs pada bilah alamat peramban (URL), ubah izin "Kamera" menjadi "Izinkan (Allow)", lalu segarkan halaman.',
    };
  }

  if (
    errorName === 'NotFoundError' ||
    errorName === 'DevicesNotFoundError' ||
    errorMessage.includes('not found') ||
    errorMessage.includes('no camera')
  ) {
    return {
      code: 'DEVICE_NOT_FOUND',
      title: 'Perangkat Kamera Tidak Ditemukan',
      message: 'Tidak ada sensor kamera fisik atau webcam eksternal yang terdeteksi di perangkat Anda.',
      suggestion: 'Pastikan webcam eksternal terhubung dengan baik, atau gunakan "Mode Simulasi AI Virtual Camera" yang telah disediakan.',
    };
  }

  if (
    errorName === 'NotReadableError' ||
    errorName === 'TrackStartError' ||
    errorMessage.includes('in use') ||
    errorMessage.includes('busy')
  ) {
    return {
      code: 'CAMERA_BUSY',
      title: 'Kamera Sedang Digunakan Aplikasi Lain',
      message: 'Sensor kamera sedang dikunci oleh aplikasi lain (seperti Zoom, Google Meet, WhatsApp, atau tab browser lain).',
      suggestion: 'Tutup aplikasi atau tab lain yang saat ini mengakses kamera, lalu klik tombol "Coba Lagi (Retry)".',
    };
  }

  if (
    errorName === 'OverconstrainedError' ||
    errorMessage.includes('overconstrained') ||
    errorMessage.includes('constraint')
  ) {
    return {
      code: 'OVERCONSTRAINED',
      title: 'Resolusi / Rasio Kamera Menyesuaikan',
      message: 'Sensor fisik kamera tidak mendukung resolusi atau rasio yang diminta secara kaku.',
      suggestion: 'Sistem otomatis mengalihkan resolusi ke rasio dinamis fleksibel yang didukung perangkat Anda.',
    };
  }

  if (errorName === 'SecurityError' || errorMessage.includes('security')) {
    return {
      code: 'SECURITY_RESTRICTION',
      title: 'Batasan Keamanan Peramban (IFrame/Origin)',
      message: 'Peramban membatasi akses perangkat keras kamera karena konteks keamanan atau batasan dokumen.',
      suggestion: 'Buka aplikasi dalam jendela peramban utama secara langsung atau aktifkan opsi kamera virtual.',
    };
  }

  return {
    code: 'UNKNOWN',
    title: 'Gagal Memulai Aliran Media Kamera',
    message: err?.message || 'Terjadi gangguan saat menginisialisasi media stream kamera.',
    suggestion: 'Periksa koneksi kamera Anda, muat ulang halaman, atau beralih ke Mode Simulasi AI Virtual Camera.',
  };
}

/**
 * Reusable Alert Banner for displaying camera errors with actionable troubleshooting steps
 */
export const CameraErrorAlert: React.FC<{
  error: UniversalCameraErrorInfo;
  onRetry?: () => void;
  onUseVirtualCamera?: () => void;
  onDismiss?: () => void;
}> = ({ error, onRetry, onUseVirtualCamera, onDismiss }) => {
  return (
    <div
      role="alert"
      className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-white shadow-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-rose-800/80 text-rose-200">
                {error.code}
              </span>
              <h4 className="font-bold text-sm text-rose-200">{error.title}</h4>
            </div>
            <p className="text-xs text-rose-100/90 mt-1 leading-relaxed">{error.message}</p>
            <div className="mt-2 text-xs text-rose-300/90 bg-black/30 p-2.5 rounded-xl border border-rose-500/20 font-sans">
              <strong className="text-white">Solusi Cepat:</strong> {error.suggestion}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-rose-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-end space-x-2 pt-1">
        {onUseVirtualCamera && (
          <button
            type="button"
            onClick={onUseVirtualCamera}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Gunakan Kamera Virtual AI</span>
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi (Retry)</span>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Detect current device type based on userAgent and touch capabilities
 */
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'laptop_or_desktop';
  const ua = navigator.userAgent.toLowerCase();
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua);
  if (isTablet) return 'tablet';
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/.test(ua) || (window.innerWidth <= 768 && 'ontouchstart' in window);
  if (isMobile) return 'mobile';
  return 'laptop_or_desktop';
}

/**
 * Detect device or viewport orientation
 */
export function getDeviceOrientation(): DeviceOrientationType {
  if (typeof window === 'undefined') return 'landscape';

  // 1. Check screen.orientation API if available
  if (window.screen && window.screen.orientation && window.screen.orientation.type) {
    return window.screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
  }

  // 2. Check window.orientation legacy API
  if (typeof (window as any).orientation === 'number') {
    return Math.abs((window as any).orientation) === 90 ? 'landscape' : 'portrait';
  }

  // 3. Fallback to viewport aspect ratio comparison
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

// Global registry of all active media streams to guarantee zero hardware camera lockouts
const activeStreamsRegistry = new Set<MediaStream>();

export function registerActiveStream(stream: MediaStream): void {
  if (!stream) return;
  activeStreamsRegistry.add(stream);
  try {
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        activeStreamsRegistry.delete(stream);
      });
    });
  } catch {}
}

/**
 * Polyfill for navigator.mediaDevices.getUserMedia for older iOS Safari / Android WebViews
 */
export function polyfillGetUserMedia(): void {
  if (typeof window === 'undefined') return;

  if (!navigator.mediaDevices) {
    (navigator as any).mediaDevices = {};
  }

  if (!navigator.mediaDevices.getUserMedia) {
    const legacyGetUserMedia =
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia ||
      (navigator as any).msGetUserMedia;

    if (legacyGetUserMedia) {
      navigator.mediaDevices.getUserMedia = function (constraints: MediaStreamConstraints) {
        return new Promise((resolve, reject) => {
          legacyGetUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }
}

/**
 * Stop and disable all media tracks in all active streams
 */
export function stopAllActiveMediaTracks(): void {
  activeStreamsRegistry.forEach((stream) => {
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
    } catch {}
  });
  activeStreamsRegistry.clear();
}

/**
 * Strict, leak-free cleanup for HTMLVideoElement and MediaStream.
 * Prevents mobile black screen, memory leaks, and lingering camera locks
 * when switching tabs in the application or switching browser windows.
 */
export function releaseVideoElementAndStream(
  videoElement?: HTMLVideoElement | null,
  stream?: MediaStream | null
): void {
  // 1. Thoroughly stop, mute, and detach all media tracks
  if (stream) {
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch (e) {
          console.warn('[CameraCleanup] Track stop warning:', e);
        }
      });
    } catch {}
    activeStreamsRegistry.delete(stream);
  }

  // 2. Clean HTMLVideoElement decoder pipeline
  if (videoElement) {
    try {
      // Pause playback immediately
      videoElement.pause();

      // Clear source objects & attributes
      videoElement.srcObject = null;
      videoElement.removeAttribute('src');

      // Clear callback event listeners to prevent retained closures
      videoElement.onloadedmetadata = null;
      videoElement.oncanplay = null;
      videoElement.onerror = null;
      videoElement.ontimeupdate = null;

      // Force HTML5 video decoder reset to free WebGL/GPU texture buffer
      videoElement.load();
    } catch (e) {
      console.warn('[CameraCleanup] VideoElement cleanup warning:', e);
    }
  }

  // 3. Purge from active streams registry
  try {
    stopAllActiveMediaTracks();
  } catch {}
}

/**
 * Custom React Hook to manage strict camera lifecycle across mobile browser tab switching,
 * visibilitychange (switching apps / WhatsApp / screen lock), and component unmount.
 */
export function useStrictCameraLifecycle(options: {
  isCameraActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  onAutoRestart?: () => void;
  onPause?: () => void;
}) {
  const { isCameraActive, videoRef, streamRef, onAutoRestart, onPause } = options;
  const wasActiveBeforeHideRef = useRef<boolean>(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background (e.g. user answered phone, switched apps, or backgrounded tab)
        if (isCameraActive) {
          wasActiveBeforeHideRef.current = true;
          console.info('[StrictCameraLifecycle] Document hidden - pausing stream to prevent mobile black screen.');
          if (onPause) {
            onPause();
          } else if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
          }
        }
      } else {
        // App returned to foreground
        if (wasActiveBeforeHideRef.current) {
          wasActiveBeforeHideRef.current = false;
          console.info('[StrictCameraLifecycle] Document visible again - restoring camera stream.');
          if (streamRef.current && videoRef.current) {
            const activeTracks = streamRef.current.getVideoTracks().filter((t) => t.readyState === 'live');
            if (activeTracks.length > 0) {
              activeTracks.forEach((t) => (t.enabled = true));
              bindStreamToVideo(videoRef.current, streamRef.current);
            } else if (onAutoRestart) {
              onAutoRestart();
            }
          } else if (onAutoRestart) {
            onAutoRestart();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isCameraActive, onAutoRestart, onPause, streamRef, videoRef]);

  // Mandatory cleanup on component unmount
  useEffect(() => {
    return () => {
      releaseVideoElementAndStream(videoRef.current, streamRef.current);
      streamRef.current = null;
    };
  }, [videoRef, streamRef]);
}

export async function getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

/**
 * Safely bind a MediaStream to an HTMLVideoElement across all browsers (iOS Safari, Android Chrome, Desktop)
 */
export async function bindStreamToVideo(
  videoElement: HTMLVideoElement | null,
  stream: MediaStream | null
): Promise<boolean> {
  if (!videoElement) return false;

  try {
    // Ensure iOS Safari and mobile Chrome autoplay compliance
    videoElement.muted = true;
    videoElement.volume = 0;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('autoplay', 'true');

    if (stream) {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }

      // Trigger play directly and cleanly without blocking or black screen delays
      const startPlay = () => {
        videoElement.play().catch((playErr) => {
          if (playErr?.name !== 'AbortError') {
            console.warn('[Camera] Autoplay retry queued:', playErr?.message);
          }
        });
      };

      if (videoElement.readyState >= 2) {
        startPlay();
      } else {
        videoElement.onloadedmetadata = () => startPlay();
        videoElement.oncanplay = () => startPlay();
        startPlay();
      }
      return true;
    } else {
      videoElement.srcObject = null;
      return false;
    }
  } catch (err) {
    console.warn('[CameraAutoOrientation] bindStreamToVideo error:', err);
    return false;
  }
}

/**
 * Creates a high-fidelity, interactive simulated camera stream using an animated Canvas.
 * This guarantees that even without a physical webcam (e.g. laptop without camera,
 * blocked iframe permissions), the entire presensi and face recognition works seamlessly.
 */
export function createUniversalSimulatedStream(
  orientation: DeviceOrientationType,
  options?: { label?: string; userName?: string }
): MediaStream {
  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 640 : 480;
  const height = isLandscape ? 480 : 640;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let frameCount = 0;
  const drawFrame = () => {
    if (!ctx) return;
    frameCount++;

    // Background gradient (simulating office/classroom ambient lighting)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle ambient grid pattern
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Dynamic simulated head position (breathing and subtle movement)
    const centerX = width / 2 + Math.sin(frameCount * 0.03) * 6;
    const centerY = height / 2 - (isLandscape ? 10 : 30) + Math.cos(frameCount * 0.04) * 4;
    const headRadius = isLandscape ? 90 : 105;

    // Head Silhouette
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(centerX, centerY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Shoulders
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + headRadius + 60, headRadius * 1.5, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4f46e5';
    ctx.stroke();

    // Eyes with blinking
    const blink = frameCount % 90 > 85;
    const eyeSpacing = headRadius * 0.38;
    const eyeY = centerY - 15;
    ctx.fillStyle = '#818cf8';

    if (blink) {
      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - eyeSpacing - 12, eyeY);
      ctx.lineTo(centerX - eyeSpacing + 12, eyeY);
      ctx.moveTo(centerX + eyeSpacing - 12, eyeY);
      ctx.lineTo(centerX + eyeSpacing + 12, eyeY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(centerX - eyeSpacing, eyeY, 7, 0, Math.PI * 2);
      ctx.arc(centerX + eyeSpacing, eyeY, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smile / mouth
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY + 35, 18, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.stroke();

    // Biometric scanning reticle & landmarks overlay
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.lineWidth = 1.5;
    const reticleSize = headRadius + 24;
    ctx.strokeRect(centerX - reticleSize, centerY - reticleSize, reticleSize * 2, reticleSize * 2);

    // Scanning laser line
    const laserY = centerY - reticleSize + ((frameCount * 2.5) % (reticleSize * 2));
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - reticleSize, laserY);
    ctx.lineTo(centerX + reticleSize, laserY);
    ctx.stroke();

    // Information HUD Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 10, width - 20, 26);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(
      `● AI SIMULATOR CAMERA • ${isLandscape ? 'LANDSCAPE' : 'PORTRAIT'} (${width}x${height}) • 30FPS`,
      16,
      27
    );

    // Bottom Watermark
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, height - 32, width - 20, 24);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    const nowStr = new Date().toLocaleTimeString('id-ID');
    ctx.fillText(`${options?.label || 'Presensi Digital Otomatis'} • ${nowStr} WITA`, 16, height - 16);
  };

  // Run animation loop
  const intervalId = setInterval(drawFrame, 1000 / 30);
  drawFrame();

  // Create stream from canvas (captureStream)
  let stream: MediaStream;
  if ((canvas as any).captureStream) {
    stream = (canvas as any).captureStream(30);
  } else if ((canvas as any).mozCaptureStream) {
    stream = (canvas as any).mozCaptureStream(30);
  } else {
    // Ultimate fallback: empty media stream
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioContext.createMediaStreamDestination();
    stream = dest.stream;
  }

  // Cleanup loop when track ends
  const tracks = stream.getVideoTracks();
  if (tracks.length > 0) {
    const originalStop = tracks[0].stop.bind(tracks[0]);
    tracks[0].stop = () => {
      clearInterval(intervalId);
      originalStop();
    };
  }

  return stream;
}

export interface HardwareCameraInfo {
  width?: number;
  height?: number;
  aspectRatio?: number;
  frameRate?: number;
  facingMode?: string;
  label?: string;
}

export interface CameraStreamResult {
  stream: MediaStream;
  effectiveOrientation: DeviceOrientationType;
  isSimulated: boolean;
  error?: UniversalCameraErrorInfo | null;
  hardwareInfo?: HardwareCameraInfo | null;
}

/**
 * Universal lightweight getUserMedia request with minimal overhead and reliable fallbacks.
 * Dynamically requests native phone camera resolutions and aspect ratios matching device orientation.
 */
export async function requestUniversalCameraStream(options: {
  mode: CameraOrientationMode;
  facingMode?: CameraFacingMode;
  preferHighRes?: boolean;
  deviceId?: string;
  onStreamDisconnected?: (reason?: string) => void;
}): Promise<CameraStreamResult> {
  const naturalOrientation = getDeviceOrientation();
  const targetOrientation: DeviceOrientationType =
    options.mode === 'auto' ? naturalOrientation : options.mode;
  const facing = options.facingMode || 'user';

  // Safely release any lingering hardware stream locks before requesting a new stream
  stopAllActiveMediaTracks();

  // Ensure polyfill is applied for legacy mobile/Safari browsers
  polyfillGetUserMedia();

  // Check WebRTC API availability
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('[CameraAutoOrientation] WebRTC mediaDevices not available in this context. Generating simulated stream.');
    const simStream = createUniversalSimulatedStream(targetOrientation);
    registerActiveStream(simStream);
    const parsedErr: UniversalCameraErrorInfo = {
      code: 'SECURITY_RESTRICTION',
      title: 'Akses Kamera Tidak Tersedia',
      message: 'Browser atau konteks keamanan tidak menyediakan API kamera (MediaDevices).',
      suggestion: 'Buka aplikasi di tab baru via HTTPS atau gunakan Mode Kamera Simulasi AI.',
    };
    return {
      stream: simStream,
      effectiveOrientation: targetOrientation,
      isSimulated: true,
      error: parsedErr,
      hardwareInfo: {
        width: targetOrientation === 'landscape' ? 640 : 480,
        height: targetOrientation === 'landscape' ? 480 : 640,
        label: 'Kamera Simulasi AI Virtual',
      },
    };
  }

  let lastCapturedError: any = null;

  // Compute adaptive resolution target matching phone sensor & orientation
  const isLandscapeTarget = targetOrientation === 'landscape';
  const idealWidth = isLandscapeTarget ? 1920 : 1080;
  const idealHeight = isLandscapeTarget ? 1080 : 1920;
  const idealAspect = isLandscapeTarget ? 16 / 9 : 9 / 16;

  // Helper to extract hardware info from video track
  const extractHwInfo = (stream: MediaStream): HardwareCameraInfo | null => {
    try {
      const track = stream.getVideoTracks()[0];
      if (!track) return null;
      const settings = track.getSettings ? track.getSettings() : {};
      return {
        width: settings.width,
        height: settings.height,
        aspectRatio: settings.aspectRatio,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode || facing,
        label: track.label || 'Kamera HP Bawaan',
      };
    } catch {
      return null;
    }
  };

  // Primary attempt: Request native phone camera resolution and orientation-matching aspect ratio
  try {
    let videoConstraint: MediaTrackConstraints;
    if (options.deviceId) {
      videoConstraint = {
        deviceId: { exact: options.deviceId },
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
      };
    } else {
      videoConstraint = {
        facingMode: facing === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
        aspectRatio: { ideal: idealAspect },
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraint,
      audio: false,
    });

    // Attach stream disconnection detection
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        console.warn('[Camera] Video track ended unexpectedly.');
        if (options.onStreamDisconnected) {
          options.onStreamDisconnected('TRACK_ENDED');
        }
      };
    });

    registerActiveStream(stream);
    const hwInfo = extractHwInfo(stream);
    return {
      stream,
      effectiveOrientation: targetOrientation,
      isSimulated: false,
      error: null,
      hardwareInfo: hwInfo,
    };
  } catch (err1: any) {
    lastCapturedError = err1;
    console.warn('[Camera] High-res request failed, attempting standard facingMode constraint:', err1);
  }

  // Secondary attempt: Facing mode without rigid resolution constraints
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
      },
      audio: false,
    });

    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        console.warn('[Camera] Video track ended.');
        if (options.onStreamDisconnected) {
          options.onStreamDisconnected('TRACK_ENDED');
        }
      };
    });

    registerActiveStream(stream);
    const hwInfo = extractHwInfo(stream);
    return {
      stream,
      effectiveOrientation: targetOrientation,
      isSimulated: false,
      error: null,
      hardwareInfo: hwInfo,
    };
  } catch (err2: any) {
    lastCapturedError = err2;
    console.warn('[Camera] Facing mode constraint failed, attempting generic video fallback:', err2);
  }

  // Fallback attempt: Standard generic video (guaranteed for single-camera laptops/desktops)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        console.warn('[Camera] Fallback video track ended.');
        if (options.onStreamDisconnected) {
          options.onStreamDisconnected('TRACK_ENDED');
        }
      };
    });

    registerActiveStream(stream);
    const hwInfo = extractHwInfo(stream);
    return {
      stream,
      effectiveOrientation: targetOrientation,
      isSimulated: false,
      error: null,
      hardwareInfo: hwInfo,
    };
  } catch (err3: any) {
    lastCapturedError = err3;
    console.warn('[Camera] Generic video fallback also failed:', err3);
  }

  // If hardware camera fails or access was denied, provide clear error & simulated stream fallback
  const parsed = parseCameraError(lastCapturedError);
  console.info('[Camera] Hardware camera failed. Providing fallback simulated stream. Code:', parsed.code);
  const fallbackStream = createUniversalSimulatedStream(targetOrientation);
  registerActiveStream(fallbackStream);
  return {
    stream: fallbackStream,
    effectiveOrientation: targetOrientation,
    isSimulated: true,
    error: parsed,
    hardwareInfo: {
      width: targetOrientation === 'landscape' ? 640 : 480,
      height: targetOrientation === 'landscape' ? 480 : 640,
      label: 'Kamera Simulasi AI Virtual',
    },
  };
}

/**
 * Custom React Hook to manage dynamic orientation state and live adaptation
 */
export function useCameraAutoOrientation(
  defaultMode: CameraOrientationMode = 'auto',
  defaultFacing: CameraFacingMode = 'user'
) {
  const [orientationMode, setOrientationMode] = useState<CameraOrientationMode>(defaultMode);
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientationType>(getDeviceOrientation);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>(defaultFacing);
  const [deviceType, setDeviceType] = useState<DeviceType>('laptop_or_desktop');
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number } | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareCameraInfo | null>(null);
  const [isPhoneTilted, setIsPhoneTilted] = useState<boolean>(false);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<UniversalCameraErrorInfo | null>(null);

  // Detect device type on mount
  useEffect(() => {
    setDeviceType(detectDeviceType());
  }, []);

  // Live listener for screen orientation change, window resize & physical gyroscope/accelerometer tilt
  useEffect(() => {
    const updateOrientation = () => {
      const current = getDeviceOrientation();
      setDeviceOrientation(current);
    };

    updateOrientation();

    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
      window.screen.orientation.addEventListener('change', updateOrientation);
    }

    // Physical tilt sensor handler (DeviceOrientationEvent)
    // Detects when user tilts the phone horizontally even if screen rotation lock is active
    const handleDeviceTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const absGamma = Math.abs(e.gamma);
        const absBeta = Math.abs(e.beta);
        // Gamma: sideways tilt (-90 to 90 deg). Beta: front-to-back tilt (-180 to 180 deg).
        // If phone is tilted sideways (absGamma > 45 deg and absBeta < 70 deg)
        if (absGamma > 45 && absBeta < 70) {
          setDeviceOrientation('landscape');
          setIsPhoneTilted(true);
        } else if (absBeta > 45 && absGamma < 40) {
          setDeviceOrientation('portrait');
          setIsPhoneTilted(false);
        }
      }
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleDeviceTilt);
    }

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      if (window.screen && window.screen.orientation && window.screen.orientation.removeEventListener) {
        window.screen.orientation.removeEventListener('change', updateOrientation);
      }
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleDeviceTilt);
      }
    };
  }, []);

  // Effective orientation considering user override mode ('auto' vs 'portrait' vs 'landscape')
  const effectiveOrientation: DeviceOrientationType = useMemo(() => {
    if (orientationMode === 'auto') {
      return deviceOrientation;
    }
    return orientationMode;
  }, [orientationMode, deviceOrientation]);

  // Cycle orientation mode: auto -> portrait -> landscape -> auto
  const cycleOrientationMode = useCallback(() => {
    setOrientationMode((prev) => {
      if (prev === 'auto') return 'portrait';
      if (prev === 'portrait') return 'landscape';
      return 'auto';
    });
  }, []);

  // Toggle front/back camera
  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // On metadata loaded, extract natural stream resolution and calculate aspect ratio
  const handleVideoMetadata = useCallback((videoElement: HTMLVideoElement | null) => {
    if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      const newWidth = videoElement.videoWidth;
      const newHeight = videoElement.videoHeight;
      setStreamResolution((prev) => {
        if (prev && prev.width === newWidth && prev.height === newHeight) {
          return prev;
        }
        return {
          width: newWidth,
          height: newHeight,
        };
      });
    }
  }, []);

  return {
    orientationMode,
    setOrientationMode,
    deviceOrientation,
    effectiveOrientation,
    isLandscape: effectiveOrientation === 'landscape',
    isPortrait: effectiveOrientation === 'portrait',
    isPhoneTilted,
    facingMode,
    setFacingMode,
    toggleFacingMode,
    cycleOrientationMode,
    deviceType,
    streamResolution,
    setStreamResolution,
    hardwareInfo,
    setHardwareInfo,
    handleVideoMetadata,
    isSimulated,
    setIsSimulated,
    cameraError,
    setCameraError,
  };
}

/**
 * UI Toolbar Component to display and control Camera Orientation and Facing Mode
 */
interface CameraOrientationToolbarProps {
  orientationMode: CameraOrientationMode;
  effectiveOrientation: DeviceOrientationType;
  onSelectOrientationMode: (mode: CameraOrientationMode) => void;
  facingMode?: CameraFacingMode;
  onToggleFacingMode?: () => void;
  streamResolution?: { width: number; height: number } | null;
  hardwareInfo?: HardwareCameraInfo | null;
  isPhoneTilted?: boolean;
  deviceType?: DeviceType;
  isSimulated?: boolean;
  onToggleSimulated?: () => void;
  compact?: boolean;
}

export const CameraOrientationToolbar: React.FC<CameraOrientationToolbarProps> = ({
  orientationMode,
  effectiveOrientation,
  onSelectOrientationMode,
  facingMode,
  onToggleFacingMode,
  streamResolution,
  hardwareInfo,
  isPhoneTilted = false,
  deviceType = 'laptop_or_desktop',
  isSimulated = false,
  onToggleSimulated,
  compact = false,
}) => {
  const isLandscape = effectiveOrientation === 'landscape';

  return (
    <div
      id="camera-orientation-toolbar"
      className={`flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/70 shadow-lg text-white ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      {/* Left: Orientation Selector Buttons */}
      <div className="flex items-center space-x-1.5 flex-wrap">
        {/* Auto Mode Button */}
        <button
          type="button"
          id="camera-orientation-auto-btn"
          onClick={() => onSelectOrientationMode('auto')}
          className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1 cursor-pointer ${
            orientationMode === 'auto'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Mode Otomatis: Otomatis berubah saat HP dimiringkan dan menyesuaikan layar"
        >
          <RotateCw className={`w-3.5 h-3.5 ${orientationMode === 'auto' ? 'text-cyan-300 animate-spin-slow' : 'text-slate-400'}`} />
          <span>Auto</span>
          {orientationMode === 'auto' && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>

        {/* Portrait Mode Button */}
        <button
          type="button"
          id="camera-orientation-portrait-btn"
          onClick={() => onSelectOrientationMode('portrait')}
          className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1 cursor-pointer ${
            orientationMode === 'portrait'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Kunci Mode Portrait: Optimal untuk smartphone posisi tegak"
        >
          <Smartphone className={`w-3.5 h-3.5 ${orientationMode === 'portrait' ? 'text-cyan-300' : 'text-slate-400'}`} />
          <span className={compact ? 'hidden sm:inline' : 'inline'}>Portrait</span>
        </button>

        {/* Landscape Mode Button */}
        <button
          type="button"
          id="camera-orientation-landscape-btn"
          onClick={() => onSelectOrientationMode('landscape')}
          className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1 cursor-pointer ${
            orientationMode === 'landscape'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Kunci Mode Landscape: Optimal untuk HP posisi horizontal & laptop"
        >
          <Laptop className={`w-3.5 h-3.5 ${orientationMode === 'landscape' ? 'text-cyan-300' : 'text-slate-400'}`} />
          <span className={compact ? 'hidden sm:inline' : 'inline'}>Landscape</span>
        </button>
      </div>

      {/* Center/Right: Current Status Pill, Phone Tilt Indicator, Sensor Resolution & Facing Switch */}
      <div className="flex items-center space-x-2 flex-wrap">
        {/* Tilt Notice Badge if HP is actively tilted sideways */}
        {isPhoneTilted && orientationMode === 'auto' && (
          <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center space-x-1 animate-pulse">
            <RotateCw className="w-3 h-3 text-cyan-300" />
            <span>HP Dimiringkan</span>
          </span>
        )}

        {/* Simulated Badge if active */}
        {isSimulated && (
          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
            <span>AI Virtual Cam</span>
          </span>
        )}

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 text-[10px] font-mono border border-slate-700">
          {isLandscape ? (
            <Laptop className="w-3 h-3 text-emerald-400" />
          ) : (
            <Smartphone className="w-3 h-3 text-emerald-400" />
          )}
          <span className="text-slate-300 font-sans font-bold">
            {isLandscape ? 'Landscape' : 'Portrait'}
            {orientationMode === 'auto' ? ' (Auto)' : ''}
          </span>
          {streamResolution && streamResolution.width > 0 && (
            <span className="text-emerald-400 font-mono hidden sm:inline" title={hardwareInfo?.label || 'Resolusi Sensor Kamera HP'}>
              • {streamResolution.width}×{streamResolution.height}
            </span>
          )}
        </div>

        {/* Camera Flip (Front/Back) Button if handler provided */}
        {onToggleFacingMode && (
          <button
            type="button"
            id="camera-flip-facing-btn"
            onClick={onToggleFacingMode}
            className="p-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center space-x-1 border border-slate-700 cursor-pointer"
            title={`Ganti ke kamera ${facingMode === 'user' ? 'belakang (environment)' : 'depan (selfie)'}`}
          >
            <SwitchCamera className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold hidden sm:inline">
              {facingMode === 'user' ? 'Depan' : 'Belakang'}
            </span>
          </button>
        )}

        {/* Optional Toggle between Hardware & AI Simulated Cam */}
        {onToggleSimulated && (
          <button
            type="button"
            onClick={onToggleSimulated}
            className="p-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[10px] font-medium border border-slate-700 cursor-pointer flex items-center space-x-1"
            title="Beralih antara Kamera Fisik dan AI Virtual Camera"
          >
            {isSimulated ? <Video className="w-3 h-3 text-emerald-400" /> : <Sparkles className="w-3 h-3 text-amber-400" />}
            <span className="hidden sm:inline">{isSimulated ? 'Gunakan Cam Fisik' : 'Simulasi Cam'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Gathers rich diagnostic and debug metadata for ActivityLog whenever a camera error or event occurs.
 */
export function collectCameraDebugMetadata(
  err?: any,
  extra?: {
    facingMode?: string;
    attemptNumber?: number;
    blackScreenDetected?: boolean;
    hardwareDevicesCount?: number;
    permissionStatus?: string;
  }
): CameraDebugMetadata {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // Detect Browser
  let browserName = 'Unknown Browser';
  let browserVersion = '';
  if (/Edg\/([0-9.]+)/.test(ua)) {
    browserName = 'Microsoft Edge';
    browserVersion = ua.match(/Edg\/([0-9.]+)/)?.[1] || '';
  } else if (/Chrome\/([0-9.]+)/.test(ua)) {
    browserName = 'Google Chrome';
    browserVersion = ua.match(/Chrome\/([0-9.]+)/)?.[1] || '';
  } else if (/Version\/([0-9.]+).*Safari/.test(ua)) {
    browserName = 'Apple Safari';
    browserVersion = ua.match(/Version\/([0-9.]+)/)?.[1] || '';
  } else if (/Firefox\/([0-9.]+)/.test(ua)) {
    browserName = 'Mozilla Firefox';
    browserVersion = ua.match(/Firefox\/([0-9.]+)/)?.[1] || '';
  } else if (/SamsungBrowser\/([0-9.]+)/.test(ua)) {
    browserName = 'Samsung Internet';
    browserVersion = ua.match(/SamsungBrowser\/([0-9.]+)/)?.[1] || '';
  }

  // Detect OS
  let os = 'Unknown OS';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS (Apple Mobile)';
  else if (/Android/.test(ua)) os = 'Android OS';
  else if (/Windows NT/.test(ua)) os = 'Windows NT';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux OS';

  // Device Type
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/Mobi|Android/i.test(ua)) {
    deviceType = /Tablet|iPad/i.test(ua) ? 'tablet' : 'mobile';
  }

  // Screen & Viewport
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const screenResolution =
    typeof window !== 'undefined'
      ? `${window.screen?.width || 0}×${window.screen?.height || 0} (DPR ${dpr.toFixed(1)})`
      : 'Unknown';
  const viewportSize =
    typeof window !== 'undefined'
      ? `${window.innerWidth || 0}×${window.innerHeight || 0}`
      : 'Unknown';

  const mediaDevicesAvailable =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  return {
    browserName,
    browserVersion: browserVersion || 'Unknown',
    userAgent: ua,
    screenResolution,
    viewportSize,
    os,
    deviceType,
    errorName: err?.name || (err ? String(err) : undefined),
    errorMessage: err?.message || (typeof err === 'string' ? err : undefined),
    errorStack: err?.stack || undefined,
    permissionStatus: extra?.permissionStatus || 'unknown',
    cameraFacingMode: extra?.facingMode,
    blackScreenDetected: extra?.blackScreenDetected || false,
    attemptNumber: extra?.attemptNumber || 1,
    hardwareDevicesCount: extra?.hardwareDevicesCount,
    mediaDevicesAvailable,
  };
}

/**
 * Real-time canvas-based pixel luminance analyzer to detect black screen or frozen camera feed
 */
export function analyzeFrameForBlackScreen(videoElement: HTMLVideoElement | null): {
  isBlackScreen: boolean;
  averageLuminance: number;
  sampleWidth: number;
  sampleHeight: number;
} {
  try {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return { isBlackScreen: false, averageLuminance: 0, sampleWidth: 0, sampleHeight: 0 };
    }

    const canvas = document.createElement('canvas');
    const sampleSize = 32;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { isBlackScreen: false, averageLuminance: 0, sampleWidth: 0, sampleHeight: 0 };
    }

    ctx.drawImage(videoElement, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imgData.data;

    let totalLuminance = 0;
    let maxPixelLuma = 0;
    const totalPixels = sampleSize * sampleSize;

    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLuminance += luma;
      if (luma > maxPixelLuma) {
        maxPixelLuma = luma;
      }
    }

    const avgLuma = totalLuminance / totalPixels;
    // Considered black screen if average luminance is practically zero (<= 2.5) AND max luminance is <= 6.0
    const isBlack = avgLuma <= 2.5 && maxPixelLuma <= 6.0;

    return {
      isBlackScreen: isBlack,
      averageLuminance: Math.round(avgLuma * 10) / 10,
      sampleWidth: videoElement.videoWidth,
      sampleHeight: videoElement.videoHeight,
    };
  } catch {
    return { isBlackScreen: false, averageLuminance: 50, sampleWidth: 0, sampleHeight: 0 };
  }
}

/**
 * Aggressively clears CacheStorage, resets Service Worker registrations,
 * and purges media track locks to resolve WebRTC / Black Screen hardware lockups.
 */
export async function purgeCameraAssetsAndServiceWorkerCache(): Promise<{
  cacheCleared: boolean;
  swRefreshed: boolean;
  message: string;
}> {
  let cacheCleared = false;
  let swRefreshed = false;

  // 1. Release active media stream locks
  stopAllActiveMediaTracks();

  // 2. Aggressive CacheStorage purge
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (const key of keys) {
        await window.caches.delete(key);
      }
      cacheCleared = true;
    } catch (e) {
      console.warn('[CachePurge] Error clearing caches:', e);
    }
  }

  // 3. Service Worker Lifecycle Hook
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          await reg.update();
        } catch {
          // Continue
        }
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PURGE_CAMERA_CACHE',
          timestamp: Date.now(),
        });
      }
      swRefreshed = true;
    } catch (e) {
      console.warn('[ServiceWorkerPurge] Error updating service worker:', e);
    }
  }

  return {
    cacheCleared,
    swRefreshed,
    message: 'Cache aset kamera dan Service Worker berhasil dibersihkan secara agresif.',
  };
}

export type CameraStreamHealth = 'healthy' | 'warning' | 'error' | 'initializing';

export interface CameraStreamHealthBadgeProps {
  status: CameraStreamHealth;
  streamResolution?: { width: number; height: number } | null;
  fps?: number;
  onRestartCamera: () => void;
  isRestarting?: boolean;
  attemptNumber?: number;
  compact?: boolean;
}

export const CameraStreamHealthBadge: React.FC<CameraStreamHealthBadgeProps> = ({
  status,
  streamResolution,
  fps,
  onRestartCamera,
  isRestarting = false,
  attemptNumber = 1,
  compact = false,
}) => {
  const statusConfig = {
    healthy: {
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      dotColor: 'bg-emerald-400',
      label: 'Kamera Normal',
      icon: CheckCircle2,
    },
    warning: {
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      dotColor: 'bg-amber-400',
      label: 'Degradasi / AI Virtual',
      icon: AlertTriangle,
    },
    error: {
      color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      dotColor: 'bg-rose-400',
      label: 'Kamera Error / Terputus',
      icon: AlertCircle,
    },
    initializing: {
      color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      dotColor: 'bg-sky-400',
      label: 'Memuat Kamera...',
      icon: RefreshCw,
    },
  }[status];

  const Icon = statusConfig.icon;

  return (
    <div
      id="camera-stream-health-indicator"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all ${statusConfig.color}`}
    >
      <div className="relative flex items-center justify-center">
        <span
          className={`w-2 h-2 rounded-full ${statusConfig.dotColor} ${
            status === 'healthy' || status === 'initializing' ? 'animate-pulse' : ''
          }`}
        />
        {status === 'healthy' && (
          <span className={`absolute w-3 h-3 rounded-full ${statusConfig.dotColor} opacity-75 animate-ping`} />
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${status === 'initializing' || isRestarting ? 'animate-spin' : ''}`} />
        <span>{statusConfig.label}</span>
        {streamResolution && streamResolution.width > 0 && (
          <span className="font-mono text-[10px] opacity-85 hidden sm:inline">
            ({streamResolution.width}×{streamResolution.height}
            {fps ? ` @${fps}fps` : ''})
          </span>
        )}
        {attemptNumber > 1 && status !== 'healthy' && (
          <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-black/40 font-mono font-bold">
            Coba {attemptNumber}/3
          </span>
        )}
      </div>

      <button
        type="button"
        id="btn-restart-camera-quick"
        onClick={onRestartCamera}
        disabled={isRestarting}
        className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
        title="Restart ulang koneksi kamera tanpa memuat ulang aplikasi"
      >
        <RefreshCw className={`w-3 h-3 ${isRestarting ? 'animate-spin' : ''}`} />
        <span>{isRestarting ? 'Memulai...' : 'Restart Kamera'}</span>
      </button>
    </div>
  );
};

