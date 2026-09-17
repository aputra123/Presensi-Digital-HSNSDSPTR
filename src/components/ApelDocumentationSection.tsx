import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Camera,
  Upload,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  RefreshCw,
  Eye,
  X,
  Sparkles,
  AlertTriangle,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SchoolConfig, DailyApelDocumentation, ApelPhotoRecord, ActivityLog } from '../types';
import {
  stampPhotoWithGpsMetadata,
  DEFAULT_TALIABU_LOCATION,
} from '../utils/photoWatermark';
import { formatDateIndo } from '../utils/soundAndDate';
import {
  useCameraAutoOrientation,
  CameraOrientationToolbar,
  requestUniversalCameraStream,
  createUniversalSimulatedStream,
  CameraOrientationMode,
  bindStreamToVideo,
  stopAllActiveMediaTracks,
} from '../utils/cameraOrientationUtils';

interface ApelDocumentationSectionProps {
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  config: SchoolConfig;
  apelDocumentation: DailyApelDocumentation;
  onUpdateDocumentation: (doc: DailyApelDocumentation) => void;
  totalTeachersCount?: number;
  onAddActivityLog?: (log: ActivityLog) => void;
}

export const ApelDocumentationSection: React.FC<ApelDocumentationSectionProps> = ({
  selectedDate,
  onSelectDate,
  config,
  apelDocumentation,
  onUpdateDocumentation,
  totalTeachersCount = 10,
  onAddActivityLog,
}) => {
  const [activeCaptureTarget, setActiveCaptureTarget] = useState<{
    session: 'apel_pagi' | 'apel_siang';
    index: number;
  } | null>(null);

  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<ApelPhotoRecord | null>(null);

  // Upload target tracking
  const [uploadTarget, setUploadTarget] = useState<{
    session: 'apel_pagi' | 'apel_siang';
    index: number;
  } | null>(null);
  const generalFileInputRef = useRef<HTMLInputElement | null>(null);

  // GPS state
  const [currentGps, setCurrentGps] = useState({
    lat: config?.schoolLat || DEFAULT_TALIABU_LOCATION.latitude,
    lng: config?.schoolLng || DEFAULT_TALIABU_LOCATION.longitude,
    desa: DEFAULT_TALIABU_LOCATION.desa,
    kecamatan: DEFAULT_TALIABU_LOCATION.kecamatan,
    kabupaten: DEFAULT_TALIABU_LOCATION.kabupaten,
    provinsi: DEFAULT_TALIABU_LOCATION.provinsi,
    addressFormatted: DEFAULT_TALIABU_LOCATION.addressFormatted,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSimulatedStream, setIsSimulatedStream] = useState<boolean>(false);

  // Normalize photo arrays from prop
  const pagiPhotos: ApelPhotoRecord[] = useMemo(() => {
    if (apelDocumentation.apelPagiPhotos && apelDocumentation.apelPagiPhotos.length > 0) {
      return apelDocumentation.apelPagiPhotos;
    }
    if (apelDocumentation.apelPagi) {
      return [apelDocumentation.apelPagi];
    }
    return [];
  }, [apelDocumentation.apelPagiPhotos, apelDocumentation.apelPagi]);

  const siangPhotos: ApelPhotoRecord[] = useMemo(() => {
    if (apelDocumentation.apelSiangPhotos && apelDocumentation.apelSiangPhotos.length > 0) {
      return apelDocumentation.apelSiangPhotos;
    }
    if (apelDocumentation.apelSiang) {
      return [apelDocumentation.apelSiang];
    }
    return [];
  }, [apelDocumentation.apelSiangPhotos, apelDocumentation.apelSiang]);

  // Callback ref to reliably attach stream whenever video mounts in DOM
  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      el.play().catch((err) => console.warn('Webcam play callback caught:', err));
    }
  }, []);

  useEffect(() => {
    if (isWebcamActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((err) => console.warn('Webcam play effect caught:', err));
    }
  }, [isWebcamActive]);

  // Auto-acquire current real GPS on mount
  const refreshGpsLocation = async () => {
    setStatusMessage('Memindai titik koordinat GPS presisi...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentGps((prev) => ({
            ...prev,
            lat,
            lng,
            addressFormatted: `SMPN 4 Satu Atap Taliabu Barat (GPS: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°)`,
          }));
          setStatusMessage('Koordinat GPS berhasil diperbarui secara akurat.');
          setTimeout(() => setStatusMessage(null), 3000);
        },
        () => {
          setStatusMessage('GPS perangkat lambat, menggunakan titik sekolah terdaftar.');
          setTimeout(() => setStatusMessage(null), 3000);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  useEffect(() => {
    refreshGpsLocation();
  }, [config?.schoolLat, config?.schoolLng]);

  // Automatic Camera Landscape & Portrait Orientation System
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
  } = useCameraAutoOrientation('auto', 'environment');

  // Start webcam with universal lightweight initialization
  const startCamera = async (
    session: 'apel_pagi' | 'apel_siang',
    index: number,
    targetFacing?: 'user' | 'environment',
    targetMode?: CameraOrientationMode,
    forceSimulated = false
  ) => {
    setActiveCaptureTarget({ session, index });
    setIsWebcamActive(true);
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const activeFacing = targetFacing ?? facingMode;
    const activeMode = targetMode ?? orientationMode;

    if (forceSimulated) {
      const simStream = createUniversalSimulatedStream(effectiveOrientation, {
        label: session === 'apel_pagi' ? 'Apel Pagi SMPN 4 Taliabu Barat' : 'Apel Siang SMPN 4 Taliabu Barat',
      });
      streamRef.current = simStream;
      setIsSimulatedStream(true);
      setCameraError(null);
      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, simStream);
        handleVideoMetadata(videoRef.current);
      }
      return;
    }

    try {
      const result = await requestUniversalCameraStream({
        mode: activeMode,
        facingMode: activeFacing,
        preferHighRes: true,
      });

      streamRef.current = result.stream;
      setIsSimulatedStream(result.isSimulated);

      if (result.error && result.isSimulated) {
        setCameraError(result.error.message || 'Kamera fisik tidak dapat diakses, mode virtual AI aktif.');
        if (onAddActivityLog) {
          const now = new Date();
          const dStr = now.toISOString().split('T')[0];
          const tStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          onAddActivityLog({
            id: `act_cam_apel_${Date.now()}`,
            timestamp: now.toISOString(),
            date: dStr,
            time: tStr,
            action: 'Kendala Kamera Dokumentasi Apel',
            actor: {
              name: config?.adminName || 'Admin / Operator GTK',
              role: 'Administrator',
            },
            category: 'attendance',
            status: 'warning',
            description: `Akses kamera fisik untuk ${session === 'apel_pagi' ? 'Apel Pagi' : 'Apel Siang'} foto #${index + 1} mengalami kendala: ${result.error.message || 'Kamera offline'}. Mode virtual aktif.`,
          });
        }
      } else {
        setCameraError(null);
      }

      // Track disconnection listener
      if (result.stream) {
        result.stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            if (onAddActivityLog) {
              const now = new Date();
              const dStr = now.toISOString().split('T')[0];
              const tStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              onAddActivityLog({
                id: `act_cam_apel_disc_${Date.now()}`,
                timestamp: now.toISOString(),
                date: dStr,
                time: tStr,
                action: 'Kamera Dokumentasi Apel Terputus',
                actor: {
                  name: config?.adminName || 'Admin / Operator GTK',
                  role: 'Administrator',
                },
                category: 'attendance',
                status: 'warning',
                description: `Koneksi video kamera terputus saat mengambil foto ${session === 'apel_pagi' ? 'Apel Pagi' : 'Apel Siang'} #${index + 1}.`,
              });
            }
          };
        });
      }

      if (videoRef.current && result.stream) {
        await bindStreamToVideo(videoRef.current, result.stream);
        handleVideoMetadata(videoRef.current);
      }
    } catch (err: any) {
      console.warn('Camera access fallback caught:', err);
      const simStream = createUniversalSimulatedStream(effectiveOrientation, {
        label: session === 'apel_pagi' ? 'Apel Pagi SMPN 4 Taliabu Barat' : 'Apel Siang SMPN 4 Taliabu Barat',
      });
      streamRef.current = simStream;
      setIsSimulatedStream(true);
      setCameraError('Kamera fisik tidak merespons. Virtual camera AI aktif agar pengambilan foto tetap berjalan.');

      if (onAddActivityLog) {
        const now = new Date();
        const dStr = now.toISOString().split('T')[0];
        const tStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        onAddActivityLog({
          id: `act_cam_apel_err_${Date.now()}`,
          timestamp: now.toISOString(),
          date: dStr,
          time: tStr,
          action: 'Kegagalan Kamera Dokumentasi Apel',
          actor: {
            name: config?.adminName || 'Admin / Operator GTK',
            role: 'Administrator',
          },
          category: 'attendance',
          status: 'error',
          description: `Gagal menginisialisasi kamera video untuk sesi ${session === 'apel_pagi' ? 'Apel Pagi' : 'Apel Siang'} foto #${index + 1}: ${err?.message || 'Black screen / Device busy'}.`,
        });
      }

      if (videoRef.current) {
        await bindStreamToVideo(videoRef.current, simStream);
        handleVideoMetadata(videoRef.current);
      }
    }
  };

  const handleOrientationModeChange = (newMode: CameraOrientationMode) => {
    setOrientationMode(newMode);
    if (activeCaptureTarget) {
      startCamera(activeCaptureTarget.session, activeCaptureTarget.index, facingMode, newMode, isSimulatedStream);
    }
  };

  const handleToggleFacingCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    toggleFacingMode();
    if (activeCaptureTarget) {
      startCamera(activeCaptureTarget.session, activeCaptureTarget.index, nextFacing, orientationMode, false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    stopAllActiveMediaTracks();
    setIsWebcamActive(false);
    setActiveCaptureTarget(null);
    setCameraError(null);
    setIsSimulatedStream(false);
  };

  // Capture from webcam & stamp bottom-right GPS
  const handleCaptureWebcam = async () => {
    if (!videoRef.current || !activeCaptureTarget) return;

    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const vWidth = video.videoWidth > 0 ? video.videoWidth : isLandscape ? 1280 : 720;
      const vHeight = video.videoHeight > 0 ? video.videoHeight : isLandscape ? 720 : 1280;
      canvas.width = vWidth;
      canvas.height = vHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context error');

      if (facingMode === 'user') {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      await processAndSaveStampedPhoto(activeCaptureTarget.session, activeCaptureTarget.index, rawDataUrl);
      stopCamera();
    } catch (e: any) {
      alert('Gagal mengambil foto: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Trigger file upload for specific slot
  const triggerFileUpload = (session: 'apel_pagi' | 'apel_siang', index: number) => {
    setUploadTarget({ session, index });
    if (generalFileInputRef.current) {
      generalFileInputRef.current.value = '';
      generalFileInputRef.current.click();
    }
  };

  // Handle uploaded file & stamp bottom-right GPS
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !uploadTarget) return;

    setIsProcessing(true);
    try {
      await processAndSaveStampedPhoto(uploadTarget.session, uploadTarget.index, file);
    } catch (err: any) {
      alert('Gagal memproses foto: ' + (err.message || 'Format tidak didukung'));
    } finally {
      setIsProcessing(false);
      setUploadTarget(null);
      e.target.value = '';
    }
  };

  // Core processing: Apply bottom-right watermark stamp and save to doc state
  const processAndSaveStampedPhoto = async (
    session: 'apel_pagi' | 'apel_siang',
    index: number,
    imageSource: string | File | Blob,
    overrideDate?: string
  ) => {
    const targetDate = overrideDate || selectedDate;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateFormatted = formatDateIndo(targetDate);
    const sessionTitle = session === 'apel_pagi' ? `Dokumentasi Apel Pagi #${index + 1}` : `Dokumentasi Apel Siang #${index + 1}`;

    // Read imageSource as raw data url if it is a File or Blob
    let rawPhotoUrl: string | undefined;
    if (typeof imageSource === 'string') {
      rawPhotoUrl = imageSource;
    } else if (imageSource instanceof Blob) {
      try {
        rawPhotoUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(imageSource);
        });
      } catch (err) {
        console.warn('Could not read raw image url:', err);
      }
    }

    // 1. Stamp photo with bottom-right non-obtrusive GPS badge
    const stampedUrl = await stampPhotoWithGpsMetadata(imageSource, {
      latitude: currentGps.lat,
      longitude: currentGps.lng,
      desa: currentGps.desa,
      kecamatan: currentGps.kecamatan,
      kabupaten: currentGps.kabupaten,
      provinsi: currentGps.provinsi,
      addressFormatted: currentGps.addressFormatted,
      dateStr: dateFormatted,
      timeStr: timeStr,
      timezoneStr: 'WITA (GMT+8)',
      sessionTitle: sessionTitle,
      schoolName: config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT',
    });

    const defaultLeader =
      session === 'apel_pagi'
        ? config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.'
        : 'Guru Piket / Pembina Apel';

    const defaultNote =
      session === 'apel_pagi'
        ? index === 0
          ? 'Kesiapan barisan dan kedisiplinan ASN'
          : index === 1
          ? 'Amanat pembina apel pagi'
          : 'Doa bersama & penghormatan'
        : index === 0
        ? 'Evaluasi kinerja harian dan penyelesaian tugas'
        : 'Pengarahan jam pulang & pembubaran barisan';

    const newRecord: ApelPhotoRecord = {
      id: `apel_${session}_${index}_${Date.now()}`,
      session,
      photoUrl: stampedUrl,
      rawPhotoUrl: rawPhotoUrl || stampedUrl,
      timestamp: `${targetDate}T${timeStr}`,
      date: targetDate,
      time: timeStr,
      timezone: 'WITA (GMT+8)',
      location: {
        latitude: currentGps.lat,
        longitude: currentGps.lng,
        desa: currentGps.desa,
        kecamatan: currentGps.kecamatan,
        kabupaten: currentGps.kabupaten,
        provinsi: currentGps.provinsi,
        addressFormatted: currentGps.addressFormatted,
      },
      leaderName: defaultLeader,
      totalParticipants: totalTeachersCount,
      notes: defaultNote,
    };

    if (session === 'apel_pagi') {
      const updatedList = [...pagiPhotos];
      if (index >= updatedList.length) {
        updatedList.push(newRecord);
      } else {
        updatedList[index] = newRecord;
      }

      const updatedDoc: DailyApelDocumentation = {
        ...apelDocumentation,
        date: targetDate,
        apelPagiPhotos: updatedList,
        apelPagi: updatedList[0] || null,
      };
      onUpdateDocumentation(updatedDoc);
    } else {
      const updatedList = [...siangPhotos];
      if (index >= updatedList.length) {
        updatedList.push(newRecord);
      } else {
        updatedList[index] = newRecord;
      }

      const updatedDoc: DailyApelDocumentation = {
        ...apelDocumentation,
        date: targetDate,
        apelSiangPhotos: updatedList,
        apelSiang: updatedList[0] || null,
      };
      onUpdateDocumentation(updatedDoc);
    }

    setStatusMessage(`Foto ${sessionTitle} berhasil disimpan (Tanggal: ${dateFormatted})!`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Delete specific photo
  const handleDeletePhoto = (session: 'apel_pagi' | 'apel_siang', index: number) => {
    const sessionName = session === 'apel_pagi' ? 'Apel Pagi' : 'Apel Siang';
    if (confirm(`Hapus foto #${index + 1} dokumentasi ${sessionName}?`)) {
      if (session === 'apel_pagi') {
        const updatedList = pagiPhotos.filter((_, i) => i !== index);
        const updatedDoc: DailyApelDocumentation = {
          ...apelDocumentation,
          date: selectedDate,
          apelPagiPhotos: updatedList,
          apelPagi: updatedList[0] || null,
        };
        onUpdateDocumentation(updatedDoc);
      } else {
        const updatedList = siangPhotos.filter((_, i) => i !== index);
        const updatedDoc: DailyApelDocumentation = {
          ...apelDocumentation,
          date: selectedDate,
          apelSiangPhotos: updatedList,
          apelSiang: updatedList[0] || null,
        };
        onUpdateDocumentation(updatedDoc);
      }
    }
  };

  // Update notes/leader/date/time for a specific photo
  const handleUpdateField = (
    session: 'apel_pagi' | 'apel_siang',
    index: number,
    field: 'leaderName' | 'totalParticipants' | 'notes' | 'date' | 'time',
    value: any
  ) => {
    if (session === 'apel_pagi') {
      const existing = pagiPhotos[index];
      if (!existing) return;
      const updatedRecord: ApelPhotoRecord = { ...existing, [field]: value };
      if (field === 'date' || field === 'time') {
        const d = field === 'date' ? value : existing.date;
        const t = field === 'time' ? value : existing.time;
        updatedRecord.timestamp = `${d}T${t}`;
      }
      const updatedList = [...pagiPhotos];
      updatedList[index] = updatedRecord;

      onUpdateDocumentation({
        ...apelDocumentation,
        apelPagiPhotos: updatedList,
        apelPagi: updatedList[0] || null,
      });
    } else {
      const existing = siangPhotos[index];
      if (!existing) return;
      const updatedRecord: ApelPhotoRecord = { ...existing, [field]: value };
      if (field === 'date' || field === 'time') {
        const d = field === 'date' ? value : existing.date;
        const t = field === 'time' ? value : existing.time;
        updatedRecord.timestamp = `${d}T${t}`;
      }
      const updatedList = [...siangPhotos];
      updatedList[index] = updatedRecord;

      onUpdateDocumentation({
        ...apelDocumentation,
        apelSiangPhotos: updatedList,
        apelSiang: updatedList[0] || null,
      });
    }
  };

  // Re-stamp photo with updated date/time/location
  const handleRestampPhoto = async (
    session: 'apel_pagi' | 'apel_siang',
    index: number,
    customDate?: string
  ) => {
    const existing = session === 'apel_pagi' ? pagiPhotos[index] : siangPhotos[index];
    if (!existing || !existing.photoUrl) return;

    setIsProcessing(true);
    try {
      const sessionTitle =
        session === 'apel_pagi'
          ? `Dokumentasi Apel Pagi #${index + 1}`
          : `Dokumentasi Apel Siang #${index + 1}`;

      const activeDate = customDate || existing.date || selectedDate;
      const sourceImage = existing.rawPhotoUrl || existing.photoUrl;

      const stampedUrl = await stampPhotoWithGpsMetadata(sourceImage, {
        latitude: existing.location?.latitude || currentGps.lat,
        longitude: existing.location?.longitude || currentGps.lng,
        desa: (existing.location as any)?.desa || currentGps.desa,
        kecamatan: (existing.location as any)?.kecamatan || currentGps.kecamatan,
        kabupaten: (existing.location as any)?.kabupaten || currentGps.kabupaten,
        provinsi: (existing.location as any)?.provinsi || currentGps.provinsi,
        addressFormatted: existing.location?.addressFormatted || currentGps.addressFormatted,
        dateStr: formatDateIndo(activeDate),
        timeStr: existing.time,
        timezoneStr: 'WITA (GMT+8)',
        sessionTitle: sessionTitle,
        schoolName: config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT',
      });

      const updatedRecord: ApelPhotoRecord = {
        ...existing,
        date: activeDate,
        photoUrl: stampedUrl,
        rawPhotoUrl: sourceImage,
        timestamp: `${activeDate}T${existing.time}`,
      };

      if (session === 'apel_pagi') {
        const updatedList = [...pagiPhotos];
        updatedList[index] = updatedRecord;
        onUpdateDocumentation({
          ...apelDocumentation,
          apelPagiPhotos: updatedList,
          apelPagi: updatedList[0] || null,
        });
      } else {
        const updatedList = [...siangPhotos];
        updatedList[index] = updatedRecord;
        onUpdateDocumentation({
          ...apelDocumentation,
          apelSiangPhotos: updatedList,
          apelSiang: updatedList[0] || null,
        });
      }

      setStatusMessage(`Stempel foto #${index + 1} berhasil diperbarui (Tanggal: ${formatDateIndo(activeDate)})!`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      alert('Gagal memperbarui stempel foto: ' + (err.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply chosen date to all existing photos and re-stamp them
  const handleApplyDateToAllPhotos = async () => {
    if (!selectedDate) return;
    setIsProcessing(true);
    setStatusMessage('Memperbarui tanggal dan stempel pada seluruh foto apel...');
    try {
      const dateFormatted = formatDateIndo(selectedDate);

      // Update Pagi
      const updatedPagi = await Promise.all(
        pagiPhotos.map(async (photo, idx) => {
          const source = photo.rawPhotoUrl || photo.photoUrl;
          const sessionTitle = `Dokumentasi Apel Pagi #${idx + 1}`;
          const stampedUrl = await stampPhotoWithGpsMetadata(source, {
            latitude: photo.location?.latitude || currentGps.lat,
            longitude: photo.location?.longitude || currentGps.lng,
            desa: (photo.location as any)?.desa || currentGps.desa,
            kecamatan: (photo.location as any)?.kecamatan || currentGps.kecamatan,
            kabupaten: (photo.location as any)?.kabupaten || currentGps.kabupaten,
            provinsi: (photo.location as any)?.provinsi || currentGps.provinsi,
            addressFormatted: photo.location?.addressFormatted || currentGps.addressFormatted,
            dateStr: dateFormatted,
            timeStr: photo.time,
            timezoneStr: 'WITA (GMT+8)',
            sessionTitle: sessionTitle,
            schoolName: config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT',
          });
          return {
            ...photo,
            date: selectedDate,
            timestamp: `${selectedDate}T${photo.time}`,
            photoUrl: stampedUrl,
            rawPhotoUrl: source,
          };
        })
      );

      // Update Siang
      const updatedSiang = await Promise.all(
        siangPhotos.map(async (photo, idx) => {
          const source = photo.rawPhotoUrl || photo.photoUrl;
          const sessionTitle = `Dokumentasi Apel Siang #${idx + 1}`;
          const stampedUrl = await stampPhotoWithGpsMetadata(source, {
            latitude: photo.location?.latitude || currentGps.lat,
            longitude: photo.location?.longitude || currentGps.lng,
            desa: (photo.location as any)?.desa || currentGps.desa,
            kecamatan: (photo.location as any)?.kecamatan || currentGps.kecamatan,
            kabupaten: (photo.location as any)?.kabupaten || currentGps.kabupaten,
            provinsi: (photo.location as any)?.provinsi || currentGps.provinsi,
            addressFormatted: photo.location?.addressFormatted || currentGps.addressFormatted,
            dateStr: dateFormatted,
            timeStr: photo.time,
            timezoneStr: 'WITA (GMT+8)',
            sessionTitle: sessionTitle,
            schoolName: config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT',
          });
          return {
            ...photo,
            date: selectedDate,
            timestamp: `${selectedDate}T${photo.time}`,
            photoUrl: stampedUrl,
            rawPhotoUrl: source,
          };
        })
      );

      const updatedDoc: DailyApelDocumentation = {
        ...apelDocumentation,
        date: selectedDate,
        apelPagiPhotos: updatedPagi,
        apelPagi: updatedPagi[0] || null,
        apelSiangPhotos: updatedSiang,
        apelSiang: updatedSiang[0] || null,
      };

      onUpdateDocumentation(updatedDoc);
      setStatusMessage(`Semua foto apel (${updatedPagi.length + updatedSiang.length} foto) berhasil diselaraskan ke tanggal ${dateFormatted}!`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert('Gagal menerapkan tanggal ke foto: ' + (err.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStepDate = (days: number) => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const newDateStr = `${y}-${m}-${day}`;
      onSelectDate?.(newDateStr);
    } catch (e) {
      console.warn(e);
    }
  };

  // Calculate total slot count to render
  const pagiSlotCount = Math.max(3, pagiPhotos.length + 1);
  const siangSlotCount = Math.max(2, siangPhotos.length + 1);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Hidden file input for slot uploads */}
      <input
        ref={generalFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Header Banner Lampiran */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                  Halaman Lampiran: Dokumentasi Apel Pagi & Apel Siang
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Minimal 3 Pagi & 2 Siang
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Dilengkapi stempel otomatis di <strong className="text-slate-700">sudut kanan bawah foto</strong> (Latitude, Longitude, Desa, Kecamatan, Tanggal, Jam & WITA)
              </p>
            </div>
          </div>
        </div>

        {/* Live GPS Badge & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-mono text-slate-700 font-bold">
              {currentGps.lat.toFixed(4)}°, {currentGps.lng.toFixed(4)}°
            </span>
            <span className="text-slate-400 hidden lg:inline">• {currentGps.desa}, {currentGps.kecamatan}</span>
          </div>
          <button
            type="button"
            onClick={refreshGpsLocation}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Perbarui titik GPS sekarang"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Bar Pengaturan & Sinkronisasi Tanggal Dokumentasi */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-xs">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Calendar className="w-4 h-4" />
            </div>
            <span>Tanggal Dokumentasi Apel:</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => handleStepDate(-1)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer shadow-2xs"
              title="Hari Sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate?.(e.target.value)}
              className="text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-800 shadow-2xs cursor-pointer focus:bg-white"
            />
            <button
              type="button"
              onClick={() => handleStepDate(1)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer shadow-2xs"
              title="Hari Berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60">
            {formatDateIndo(selectedDate)}
          </span>
        </div>

        {(pagiPhotos.length > 0 || siangPhotos.length > 0) && (
          <button
            type="button"
            onClick={handleApplyDateToAllPhotos}
            disabled={isProcessing}
            className="text-xs font-extrabold px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 self-start md:self-auto disabled:opacity-50 shadow-2xs"
            title="Perbarui seluruh tanggal foto yang terlampir dengan tanggal terpilih dan cetak ulang stempel"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Terapkan Tanggal Ini ke Semua Foto Terlampir</span>
          </button>
        )}
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: APEL PAGI (MINIMAL 3 FOTO)
         ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              🌅
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Dokumentasi Apel Pagi (07:15 WITA)
                </h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center space-x-1 ${
                    pagiPhotos.length >= 3
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {pagiPhotos.length >= 3 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{pagiPhotos.length} / Min. 3 Foto (Lengkap)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>{pagiPhotos.length} / Min. 3 Foto Terlampir</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Wajib melampirkan minimal 3 foto sesi apel pagi (Barisan, Amanat Pembina, dan Doa Bersama) untuk berkas BKD.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => startCamera('apel_pagi', pagiPhotos.length)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Foto Apel Pagi</span>
            </button>
          </div>
        </div>

        {/* Grid Photos Slots */}
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: pagiSlotCount }).map((_, idx) => {
            const photo = pagiPhotos[idx];
            const slotTitle =
              idx === 0
                ? 'Foto #1: Barisan & Kesiapan'
                : idx === 1
                ? 'Foto #2: Amanat Pembina'
                : idx === 2
                ? 'Foto #3: Doa & Penghormatan'
                : `Foto #${idx + 1}: Dokumentasi Tambahan`;

            return (
              <div
                key={`pagi_slot_${idx}`}
                className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative group"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>{slotTitle}</span>
                  </span>
                  {photo ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      Terlampir
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                      {idx < 3 ? 'Wajib' : 'Opsional'}
                    </span>
                  )}
                </div>

                {/* Photo or Placeholder */}
                {photo ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-200 group/img">
                      <img
                        src={photo.photoUrl}
                        alt={`Apel Pagi #${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(photo)}
                          className="p-2 rounded-lg bg-white/90 text-slate-800 font-bold text-xs hover:bg-white transition-all shadow-md cursor-pointer"
                          title="Lihat Penuh"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={photo.photoUrl}
                          download={`Apel_Pagi_SMPN4_${photo.date || selectedDate}_foto_${idx + 1}.jpg`}
                          className="p-2 rounded-lg bg-white/90 text-slate-800 font-bold text-xs hover:bg-white transition-all shadow-md cursor-pointer"
                          title="Unduh Foto"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto('apel_pagi', idx)}
                          className="p-2 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all shadow-md cursor-pointer"
                          title="Hapus Foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Editing */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Keterangan Foto
                        </label>
                        <input
                          type="text"
                          value={photo.notes || ''}
                          onChange={(e) => handleUpdateField('apel_pagi', idx, 'notes', e.target.value)}
                          placeholder="Ringkasan kegiatan pada foto..."
                          className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                        />
                      </div>

                      {/* Baris Edit Tanggal & Jam Foto */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5 flex items-center space-x-1">
                            <Calendar className="w-2.5 h-2.5 text-indigo-600" />
                            <span>Edit Tanggal</span>
                          </label>
                          <input
                            type="date"
                            value={photo.date || selectedDate}
                            onChange={(e) => handleUpdateField('apel_pagi', idx, 'date', e.target.value)}
                            className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            Jam (WITA)
                          </label>
                          <input
                            type="text"
                            value={photo.time || ''}
                            onChange={(e) => handleUpdateField('apel_pagi', idx, 'time', e.target.value)}
                            className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-mono font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Pembina Apel
                        </label>
                        <input
                          type="text"
                          value={photo.leaderName || ''}
                          onChange={(e) => handleUpdateField('apel_pagi', idx, 'leaderName', e.target.value)}
                          className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleRestampPhoto('apel_pagi', idx, photo.date)}
                          disabled={isProcessing}
                          className="text-[10px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer flex items-center space-x-1"
                          title="Terapkan perubahan tanggal/jam ke stempel foto"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isProcessing ? 'animate-spin' : ''}`} />
                          <span>Perbarui Stempel (Terapkan Edit)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerFileUpload('apel_pagi', idx)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                        >
                          Ganti Foto
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white aspect-video text-center">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-2">
                      <Camera className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Foto Belum Diambil</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px]">
                      Gunakan kamera HP/laptop atau unggah gambar JPG/PNG.
                    </p>

                    <div className="flex items-center space-x-2 mt-3">
                      <button
                        type="button"
                        onClick={() => startCamera('apel_pagi', idx)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Kamera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerFileUpload('apel_pagi', idx)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-2xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Unggah</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: APEL SIANG (BUKAN APEL SORE) (MINIMAL 2 FOTO)
         ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              ☀️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Dokumentasi Apel Siang (14:00 WITA - Bukan Apel Sore)
                </h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center space-x-1 ${
                    siangPhotos.length >= 2
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {siangPhotos.length >= 2 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{siangPhotos.length} / Min. 2 Foto (Lengkap)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>{siangPhotos.length} / Min. 2 Foto Terlampir</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Wajib melampirkan minimal 2 foto sesi apel siang (Evaluasi Harian & Penutupan Apel) untuk berkas resmi BKD.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => startCamera('apel_siang', siangPhotos.length)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Foto Apel Siang</span>
            </button>
          </div>
        </div>

        {/* Grid Photos Slots */}
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: siangSlotCount }).map((_, idx) => {
            const photo = siangPhotos[idx];
            const slotTitle =
              idx === 0
                ? 'Foto #1: Evaluasi Kinerja Siang'
                : idx === 1
                ? 'Foto #2: Penutupan & Pembubaran Barisan'
                : `Foto #${idx + 1}: Dokumentasi Tambahan`;

            return (
              <div
                key={`siang_slot_${idx}`}
                className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative group"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>{slotTitle}</span>
                  </span>
                  {photo ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      Terlampir
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                      {idx < 2 ? 'Wajib' : 'Opsional'}
                    </span>
                  )}
                </div>

                {/* Photo or Placeholder */}
                {photo ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-200 group/img">
                      <img
                        src={photo.photoUrl}
                        alt={`Apel Siang #${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto(photo)}
                          className="p-2 rounded-lg bg-white/90 text-slate-800 font-bold text-xs hover:bg-white transition-all shadow-md cursor-pointer"
                          title="Lihat Penuh"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={photo.photoUrl}
                          download={`Apel_Siang_SMPN4_${photo.date || selectedDate}_foto_${idx + 1}.jpg`}
                          className="p-2 rounded-lg bg-white/90 text-slate-800 font-bold text-xs hover:bg-white transition-all shadow-md cursor-pointer"
                          title="Unduh Foto"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto('apel_siang', idx)}
                          className="p-2 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all shadow-md cursor-pointer"
                          title="Hapus Foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Editing */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Keterangan Foto
                        </label>
                        <input
                          type="text"
                          value={photo.notes || ''}
                          onChange={(e) => handleUpdateField('apel_siang', idx, 'notes', e.target.value)}
                          placeholder="Ringkasan evaluasi apel siang..."
                          className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                        />
                      </div>

                      {/* Baris Edit Tanggal & Jam Foto */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5 flex items-center space-x-1">
                            <Calendar className="w-2.5 h-2.5 text-blue-600" />
                            <span>Edit Tanggal</span>
                          </label>
                          <input
                            type="date"
                            value={photo.date || selectedDate}
                            onChange={(e) => handleUpdateField('apel_siang', idx, 'date', e.target.value)}
                            className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            Jam (WITA)
                          </label>
                          <input
                            type="text"
                            value={photo.time || ''}
                            onChange={(e) => handleUpdateField('apel_siang', idx, 'time', e.target.value)}
                            className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-mono font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Pembina / Pemimpin
                        </label>
                        <input
                          type="text"
                          value={photo.leaderName || ''}
                          onChange={(e) => handleUpdateField('apel_siang', idx, 'leaderName', e.target.value)}
                          className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleRestampPhoto('apel_siang', idx, photo.date)}
                          disabled={isProcessing}
                          className="text-[10px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer flex items-center space-x-1"
                          title="Terapkan perubahan tanggal/jam ke stempel foto"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isProcessing ? 'animate-spin' : ''}`} />
                          <span>Perbarui Stempel (Terapkan Edit)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerFileUpload('apel_siang', idx)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                        >
                          Ganti Foto
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white aspect-video text-center">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-2">
                      <Camera className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Foto Belum Diambil</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px]">
                      Gunakan kamera HP/laptop atau unggah gambar JPG/PNG.
                    </p>

                    <div className="flex items-center space-x-2 mt-3">
                      <button
                        type="button"
                        onClick={() => startCamera('apel_siang', idx)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Kamera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerFileUpload('apel_siang', idx)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-2xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Unggah</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Webcam Modal */}
      {isWebcamActive && activeCaptureTarget && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden w-full max-w-lg">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <h4 className="font-extrabold text-sm text-slate-900">
                  Ambil Foto {activeCaptureTarget.session === 'apel_pagi' ? 'Apel Pagi' : 'Apel Siang'} #{activeCaptureTarget.index + 1}
                </h4>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {cameraError && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-xs">Pemberitahuan Akses Kamera</h5>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {cameraError}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-amber-200/60 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        activeCaptureTarget &&
                        startCamera(activeCaptureTarget.session, activeCaptureTarget.index, facingMode, orientationMode, false)
                      }
                      className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Coba Lagi</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleFacingCamera}
                      className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer flex items-center space-x-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Ganti Kamera</span>
                    </button>
                    {!isSimulatedStream && (
                      <button
                        type="button"
                        onClick={() =>
                          activeCaptureTarget &&
                          startCamera(activeCaptureTarget.session, activeCaptureTarget.index, facingMode, orientationMode, true)
                        }
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Mode Kamera Virtual AI</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeCaptureTarget;
                        stopCamera();
                        if (target) {
                          triggerFileUpload(target.session, target.index);
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center space-x-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Unggah File</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <CameraOrientationToolbar
                  orientationMode={orientationMode}
                  effectiveOrientation={effectiveOrientation}
                  onSelectOrientationMode={handleOrientationModeChange}
                  facingMode={facingMode}
                  onToggleFacingMode={handleToggleFacingCamera}
                  streamResolution={streamResolution}
                  deviceType={deviceType}
                  compact={true}
                />

                <div
                  className={`relative rounded-2xl overflow-hidden bg-black flex items-center justify-center transition-all duration-300 mx-auto w-full ${
                    isLandscape ? 'aspect-video max-w-2xl' : 'aspect-[3/4] max-w-sm'
                  }`}
                >
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
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-slate-900/80 rounded-lg text-emerald-400 font-mono text-[10px] font-bold flex items-center space-x-1.5 backdrop-blur-xs border border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}</span>
                    {streamResolution && streamResolution.width > 0 && (
                      <span className="text-slate-300">({streamResolution.width}×{streamResolution.height})</span>
                    )}
                    {isSimulatedStream && (
                      <span className="ml-1 text-amber-300 font-bold">• AI VIRTUAL</span>
                    )}
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-slate-900/80 rounded-lg text-white font-mono text-[10px] flex items-center space-x-1 backdrop-blur-xs">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>
                      GPS: {currentGps.lat.toFixed(4)}°, {currentGps.lng.toFixed(4)}°
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Posisikan kamera ke barisan peserta apel. Lokasi & waktu otomatis distempel di kanan bawah.</span>
                {!cameraError && activeCaptureTarget && (
                  <button
                    type="button"
                    onClick={() =>
                      startCamera(activeCaptureTarget.session, activeCaptureTarget.index, facingMode, orientationMode, true)
                    }
                    className="text-indigo-600 hover:underline shrink-0 ml-2 font-bold cursor-pointer"
                  >
                    Simulasi Apel
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCaptureWebcam}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md flex items-center space-x-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{isProcessing ? 'Memproses Stempel...' : 'Ambil & Stempel GPS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl overflow-hidden max-w-4xl w-full border border-slate-800 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm">
                  {previewPhoto.session === 'apel_pagi' ? 'Dokumentasi Apel Pagi' : 'Dokumentasi Apel Siang'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  • {previewPhoto.date} {previewPhoto.time} WITA
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center bg-black/60 max-h-[75vh] overflow-auto">
              <img
                src={previewPhoto.photoUrl}
                alt="Full Preview Apel"
                className="max-h-[70vh] rounded-xl object-contain shadow-lg"
              />
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>{previewPhoto.location?.addressFormatted}</span>
              </div>
              <a
                href={previewPhoto.photoUrl}
                download={`Dokumentasi_${previewPhoto.session}_${previewPhoto.date}.jpg`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Foto Stempel</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
