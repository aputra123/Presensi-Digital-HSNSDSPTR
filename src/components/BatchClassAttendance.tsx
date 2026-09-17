import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  Save,
  CalendarOff,
  Lock,
  Unlock,
  QrCode,
  Camera,
  CameraOff,
  RefreshCw,
  Zap,
  Search,
  Check,
  AlertCircle,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  SchoolClass,
  SchoolConfig,
  Student,
  AcademicEvent,
} from '../types';
import { formatTimeIndo, playBeepSound, checkDateIsHoliday } from '../utils/soundAndDate';

interface BatchClassAttendanceProps {
  todayDate: string;
  classes?: SchoolClass[];
  students?: Student[];
  config: SchoolConfig;
  events?: AcademicEvent[];
  existingRecords?: AttendanceRecord[];
  onSaveBatchAttendance: (newRecords: AttendanceRecord[]) => void;
}

interface StudentAttendanceRow {
  student: Student;
  status: AttendanceStatus;
  note: string;
  scannedAt?: string;
}

export const BatchClassAttendance: React.FC<BatchClassAttendanceProps> = ({
  todayDate,
  classes = [],
  students = [],
  config,
  events = [],
  existingRecords = [],
  onSaveBatchAttendance,
}) => {
  const safeClasses = classes || [];
  const safeStudents = students || [];

  const holidayInfo = checkDateIsHoliday(todayDate, events);
  const [overrideHoliday, setOverrideHoliday] = useState(false);
  const isBlockedByHoliday = holidayInfo.isHoliday && !overrideHoliday;

  const [selectedClassId, setSelectedClassId] = useState<string>(safeClasses[0]?.id || '');
  const [attendanceMode, setAttendanceMode] = useState<'manual' | 'qr_scanner'>('manual');
  const [rows, setRows] = useState<StudentAttendanceRow[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // QR Scanner specific states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [qrSearchQuery, setQrSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{
    student: Student;
    time: string;
    status: AttendanceStatus;
  } | null>(null);
  const [scannerNotice, setScannerNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeScanIntervalRef = useRef<number | null>(null);

  const selectedClass = safeClasses.find((c) => c.id === selectedClassId);
  const classStudents = safeStudents.filter((s) => s.classId === selectedClassId);

  // Auto-select first class if none selected or current is invalid
  useEffect(() => {
    if (safeClasses.length > 0) {
      if (!selectedClassId || !safeClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(safeClasses[0].id);
      }
    }
  }, [safeClasses, selectedClassId]);

  // Initialize row data when class changes or records change
  useEffect(() => {
    const initialRows: StudentAttendanceRow[] = classStudents.map((std) => {
      const existing = existingRecords.find(
        (r) => r.date === todayDate && r.personId === std.id && r.type === 'masuk'
      );
      return {
        student: std,
        status: existing ? existing.status : 'hadir',
        note: existing ? existing.note || '' : '',
        scannedAt: existing ? existing.time : undefined,
      };
    });
    setRows(initialRows);
  }, [selectedClassId, todayDate, existingRecords]);

  // Clean up camera stream when component unmounts or mode switches
  const stopCameraStream = useCallback(() => {
    if (barcodeScanIntervalRef.current) {
      window.clearInterval(barcodeScanIntervalRef.current);
      barcodeScanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Handle camera start
  const startCamera = async (targetFacing: 'user' | 'environment' = facingMode) => {
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Video play error:', e));
      }
      setIsCameraActive(true);

      // If browser supports BarcodeDetector, initiate scanning loop
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
          });

          barcodeScanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const rawValue = barcodes[0].rawValue;
                  if (rawValue) {
                    processQrCodeScan(rawValue);
                  }
                }
              } catch {
                // Ignore per-frame detection hiccups
              }
            }
          }, 600);
        } catch (e) {
          console.info('BarcodeDetector initialized without full formats support:', e);
        }
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setIsCameraActive(false);
      setScannerNotice({
        type: 'info',
        message: 'Kamera fisik tidak dapat diakses. Anda tetap dapat menggunakan input NISN atau Scanner Barcode USB.',
      });
    }
  };

  // Toggle camera active state
  const handleToggleCamera = () => {
    if (isCameraActive) {
      stopCameraStream();
      setIsCameraActive(false);
    } else {
      startCamera(facingMode);
    }
  };

  const handleToggleFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (isCameraActive) {
      startCamera(nextFacing);
    }
  };

  // Process student scan from QR Code, Barcode Gun, or manual tap
  const processQrCodeScan = (scannedString: string) => {
    if (isBlockedByHoliday) {
      setScannerNotice({
        type: 'error',
        message: 'Perekaman presensi terkunci karena hari libur kalender pendidikan.',
      });
      return;
    }

    const cleanInput = scannedString.trim();
    if (!cleanInput) return;

    // Support patterns: "STD-1234567890", "1234567890", or student name
    const targetNisn = cleanInput.replace(/^STD-/i, '');

    // Look for matching student in the selected class first
    let matchedStudent = classStudents.find(
      (s) =>
        s.nisn === targetNisn ||
        s.nisn === cleanInput ||
        s.name.toLowerCase() === cleanInput.toLowerCase()
    );

    // If not found in current class, check other classes
    if (!matchedStudent) {
      const anyMatch = safeStudents.find(
        (s) =>
          s.nisn === targetNisn ||
          s.nisn === cleanInput ||
          s.name.toLowerCase() === cleanInput.toLowerCase()
      );
      if (anyMatch) {
        setScannerNotice({
          type: 'info',
          message: `Siswa "${anyMatch.name}" terdaftar di kelas lain (${anyMatch.className}). Silakan pilih kelas ${anyMatch.className} jika ingin mencatat rombelnya.`,
        });
        return;
      }
    }

    if (!matchedStudent) {
      setScannerNotice({
        type: 'error',
        message: `Siswa dengan NISN / QR "${cleanInput}" tidak ditemukan di kelas ${selectedClass?.name || ''}.`,
      });
      return;
    }

    const now = new Date();
    const timeStr = formatTimeIndo(now);

    // Update row state
    setRows((prev) =>
      prev.map((r) =>
        r.student.id === matchedStudent!.id
          ? {
              ...r,
              status: 'hadir',
              scannedAt: timeStr,
              note: r.note || 'Presensi QR Code Siswa (Rombel)',
            }
          : r
      )
    );

    // Create & persist individual attendance record immediately
    const singleRecord: AttendanceRecord = {
      id: `rec_qr_${matchedStudent.id}_${todayDate}_${Date.now().toString(36)}`,
      personId: matchedStudent.id,
      personType: 'student',
      personName: matchedStudent.name,
      identifier: matchedStudent.nisn,
      classOrSubject: matchedStudent.className,
      date: todayDate,
      time: timeStr,
      type: 'masuk',
      status: 'hadir',
      method: 'qrcode',
      note: 'Presensi QR Code Siswa (Rombel Kelas)',
      photoUrl: matchedStudent.avatar,
      location: {
        lat: config?.schoolLat ?? -1.8214,
        lng: config?.schoolLng ?? 124.7081,
        address: `Ruang Kelas ${matchedStudent.className}`,
        inRadius: true,
        distanceMeter: 5,
      },
    };

    onSaveBatchAttendance([singleRecord]);
    playBeepSound();

    setLastScanned({
      student: matchedStudent,
      time: timeStr,
      status: 'hadir',
    });

    setScannerNotice({
      type: 'success',
      message: `Presensi Berhasil: ${matchedStudent.name} (${matchedStudent.nisn}) tercatat HADIR pukul ${timeStr}.`,
    });

    setBarcodeInput('');
  };

  const handleBarcodeFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processQrCodeScan(barcodeInput);
  };

  const handleSetAllStatus = (newStatus: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        status: newStatus,
      }))
    );
  };

  const handleUpdateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, status } : r))
    );
  };

  const handleUpdateStudentNote = (studentId: string, note: string) => {
    setRows((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, note } : r))
    );
  };

  const handleSaveClassAttendance = () => {
    const now = new Date();
    const timeStr = formatTimeIndo(now);

    const newRecords: AttendanceRecord[] = rows.map((r) => {
      let finalNote = r.note;
      if (!finalNote) {
        if (r.status === 'hadir') finalNote = 'Presensi Rombel (Wali Kelas)';
        if (r.status === 'terlambat') finalNote = 'Terlambat Masuk Jam Pertama';
        if (r.status === 'sakit') finalNote = 'Keterangan Sakit';
        if (r.status === 'izin') finalNote = 'Izin Urusan Keluarga';
        if (r.status === 'alpa') finalNote = 'Tanpa Keterangan (Alpa)';
      }

      return {
        id: `rec_batch_${r.student.id}_${todayDate}`,
        personId: r.student.id,
        personType: 'student',
        personName: r.student.name,
        identifier: r.student.nisn,
        classOrSubject: r.student.className,
        date: todayDate,
        time: r.scannedAt || timeStr,
        type: 'masuk',
        status: r.status,
        method: r.scannedAt ? 'qrcode' : 'manual',
        note: finalNote,
        photoUrl: r.student.avatar,
        location: {
          lat: config?.schoolLat ?? -1.8214,
          lng: config?.schoolLng ?? 124.7081,
          address: `Ruang Kelas ${r.student.className}`,
          inRadius: true,
          distanceMeter: 10,
        },
      };
    });

    playBeepSound();
    onSaveBatchAttendance(newRecords);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  // Stats for this class
  const hadirCount = rows.filter((r) => r.status === 'hadir').length;
  const terlambatCount = rows.filter((r) => r.status === 'terlambat').length;
  const sakitCount = rows.filter((r) => r.status === 'sakit').length;
  const izinCount = rows.filter((r) => r.status === 'izin').length;
  const alpaCount = rows.filter((r) => r.status === 'alpa').length;

  const filteredQrStudents = rows.filter((r) => {
    return (
      r.student.name.toLowerCase().includes(qrSearchQuery.toLowerCase()) ||
      r.student.nisn.includes(qrSearchQuery)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header Bento */}
      <div className="p-6 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-lg text-slate-900">
              Absensi Rombongan Belajar (Kelas)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mendukung absensi manual daftar hadir rombel dan pemindaian cepat QR Code siswa
          </p>
        </div>

        {/* Class Selector Dropdown */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Pilih Kelas:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="text-xs font-bold px-4 py-2 bg-slate-100 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 cursor-pointer"
          >
            {safeClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.major})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Selection Tabs (Manual vs QR Scanner Siswa) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              setIsCameraActive(false);
              setAttendanceMode('manual');
            }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              attendanceMode === 'manual'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mode Input Manual (Tabel Rombel)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttendanceMode('qr_scanner');
              startCamera(facingMode);
            }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              attendanceMode === 'qr_scanner'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Mode Scan QR Code Siswa</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 px-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sinkronisasi Otomatis Terhubung</span>
        </div>
      </div>

      {/* Holiday Notification Banner */}
      {holidayInfo.isHoliday && (
        <div className="p-4 rounded-[2rem] bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
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
                  ? 'Perekaman absensi rombel dinonaktifkan otomatis sesuai kalender resmi.'
                  : 'Mode Override Aktif: Pengisian absensi diizinkan oleh Guru / Admin.'}
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

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Absensi untuk kelas {selectedClass?.name} berhasil disimpan ke sistem!</span>
        </div>
      )}

      {/* Class Meta & Quick Statistics */}
      <div className="p-5 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-base">
            {selectedClass?.grade || 'KLS'}
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              Kelas {selectedClass?.name}
            </h3>
            <p className="text-xs text-slate-500">
              Wali Kelas: <strong>{selectedClass?.homeroomTeacher || '-'}</strong> • Total {classStudents.length} Siswa
            </p>
          </div>
        </div>

        {/* Quick Summary Chips */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full lg:w-auto">
          <div className="p-2.5 sm:px-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-center">
            <span className="text-[9px] font-bold text-emerald-700 uppercase block">Hadir</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-900">{hadirCount}</span>
          </div>
          <div className="p-2.5 sm:px-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-center">
            <span className="text-[9px] font-bold text-amber-700 uppercase block">Terlambat</span>
            <span className="text-base sm:text-lg font-extrabold text-amber-900">{terlambatCount}</span>
          </div>
          <div className="p-2.5 sm:px-3 rounded-2xl bg-blue-50 border border-blue-200/80 text-center">
            <span className="text-[9px] font-bold text-blue-700 uppercase block">Sakit</span>
            <span className="text-base sm:text-lg font-extrabold text-blue-900">{sakitCount}</span>
          </div>
          <div className="p-2.5 sm:px-3 rounded-2xl bg-purple-50 border border-purple-200/80 text-center">
            <span className="text-[9px] font-bold text-purple-700 uppercase block">Izin</span>
            <span className="text-base sm:text-lg font-extrabold text-purple-900">{izinCount}</span>
          </div>
          <div className="p-2.5 sm:px-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-center">
            <span className="text-[9px] font-bold text-rose-700 uppercase block">Alpa</span>
            <span className="text-base sm:text-lg font-extrabold text-rose-900">{alpaCount}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: SCANNER QR CODE SISWA */}
      {/* ========================================================================= */}
      {attendanceMode === 'qr_scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Camera Viewfinder & Barcode Scanner Form */}
          <div className="lg:col-span-5 space-y-4">
            {/* Live Camera Box */}
            <div className="p-4 rounded-[2.5rem] bg-slate-900 text-white shadow-lg space-y-3">
              <div className="flex items-center justify-between px-2 pt-1">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live QR Camera
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleToggleFacing}
                    title="Ganti Kamera Depan/Belakang"
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                      isCameraActive
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isCameraActive ? (
                      <>
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Matikan</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>Nyalakan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Viewfinder Window */}
              <div className="relative aspect-video sm:aspect-square rounded-2xl bg-black overflow-hidden flex items-center justify-center border border-white/10">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
                />

                {!isCameraActive && (
                  <div className="p-6 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      Kamera sedang nonaktif. Tekan tombol Nyalakan atau gunakan scanner barcode gun di bawah.
                    </p>
                  </div>
                )}

                {/* Reticle / Aim Overlay when active */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-indigo-400/80 rounded-3xl relative flex items-center justify-center">
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />

                      {/* Scanning Line Animation */}
                      <div className="w-full h-0.5 bg-indigo-400/80 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
                    </div>
                    <span className="mt-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-white font-medium">
                      Arahkan QR Code Kartu Pelajar Siswa ke dalam kotak
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Barcode Scanner Gun / Manual Input Field */}
            <form
              onSubmit={handleBarcodeFormSubmit}
              className="p-5 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Scanner Barcode Gun / Input Manual NISN</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Auto-Focus Ready</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan kartu atau ketik NISN / Nama Siswa..."
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={isBlockedByHoliday || !barcodeInput.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-2xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  Scan Hadir
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Mendukung alat scanner 2D barcode USB / Bluetooth, webcam, dan kamera HP siswa.
              </p>
            </form>

            {/* Scanner Feedback Notification Box */}
            {scannerNotice && (
              <div
                className={`p-4 rounded-2xl text-xs font-bold flex items-start space-x-2.5 ${
                  scannerNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : scannerNotice.type === 'error'
                    ? 'bg-rose-50 text-rose-900 border border-rose-200'
                    : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                }`}
              >
                {scannerNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : scannerNotice.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span>{scannerNotice.message}</span>
                </div>
              </div>
            )}

            {/* Last Scanned Card Card */}
            {lastScanned && (
              <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-xs flex items-center space-x-3.5">
                <img
                  src={lastScanned.student.avatar}
                  alt={lastScanned.student.name}
                  className="w-12 h-14 rounded-xl object-cover border-2 border-emerald-200 shadow-xs shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase">
                      TERVERIFIKASI HADIR
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold">
                      {lastScanned.time}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm truncate mt-1">
                    {lastScanned.student.name}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    NISN: <span className="font-mono font-bold text-slate-700">{lastScanned.student.nisn}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Realtime Student Checklist for the Class */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Daftar Siswa Kelas {selectedClass?.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Klik tombol <strong>Tandai Hadir</strong> untuk verifikasi instan jika siswa tidak membawa kartu
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={qrSearchQuery}
                    onChange={(e) => setQrSearchQuery(e.target.value)}
                    placeholder="Cari siswa..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Scrollable Students Cards */}
              <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {filteredQrStudents.map((row, idx) => {
                  const isHadir = row.status === 'hadir';
                  return (
                    <div
                      key={row.student.id}
                      className="pt-2 flex items-center justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-2xl transition-all"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="text-[11px] font-mono text-slate-400 w-5 text-center">
                          {idx + 1}
                        </span>
                        <img
                          src={row.student.avatar}
                          alt={row.student.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-slate-900 truncate">
                            {row.student.name}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                            <span className="font-mono">NISN: {row.student.nisn}</span>
                            <span>•</span>
                            <span>{row.student.gender}</span>
                            {row.scannedAt && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-emerald-600 font-bold">
                                  Scan {row.scannedAt}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {isHadir ? (
                          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-extrabold shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Hadir</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => processQrCodeScan(row.student.nisn)}
                            disabled={isBlockedByHoliday}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Tandai Hadir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick Save */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {hadirCount} dari {classStudents.length} siswa telah hadir
                </span>

                <button
                  type="button"
                  onClick={handleSaveClassAttendance}
                  disabled={isBlockedByHoliday}
                  className="px-4 py-2 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Semua Absensi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: INPUT MANUAL & TABEL CHECKLIST LENGKAP */}
      {/* ========================================================================= */}
      {attendanceMode === 'manual' && (
        <div className="space-y-4">
          {/* Quick Bulk Marking Actions */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-bold">Aksi Cepat 1-Klik:</span>
              <button
                type="button"
                onClick={() => handleSetAllStatus('hadir')}
                disabled={isBlockedByHoliday}
                className="px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
              >
                Semua Hadir (H)
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStatus('alpa')}
                disabled={isBlockedByHoliday}
                className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
              >
                Reset Alpa (A)
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Gunakan tombol singkatan status: <strong>H</strong> (Hadir), <strong>T</strong> (Terlambat), <strong>S</strong> (Sakit), <strong>I</strong> (Izin), <strong>A</strong> (Alpa)
            </div>
          </div>

          {/* Interactive Students Table */}
          <div className="rounded-[2.5rem] bg-white border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center w-12">No</th>
                    <th className="py-3.5 px-4">Nama Siswa & NISN</th>
                    <th className="py-3.5 px-4 text-center">L/P</th>
                    <th className="py-3.5 px-4 text-center min-w-[280px]">Status Kehadiran</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Catatan / Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((row, idx) => {
                    const std = row.student;
                    return (
                      <tr key={std.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={std.avatar}
                              alt={std.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{std.name}</p>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                                <span>NISN: {std.nisn}</span>
                                {row.scannedAt && (
                                  <span className="text-emerald-600 font-bold font-mono">
                                    • QR {row.scannedAt}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {std.gender}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center space-x-1">
                            {/* Hadir */}
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(std.id, 'hadir')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                row.status === 'hadir'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                              title="Hadir"
                            >
                              H
                            </button>

                            {/* Terlambat */}
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(std.id, 'terlambat')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                row.status === 'terlambat'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                              }`}
                              title="Terlambat"
                            >
                              T
                            </button>

                            {/* Sakit */}
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(std.id, 'sakit')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                row.status === 'sakit'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                              title="Sakit"
                            >
                              S
                            </button>

                            {/* Izin */}
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(std.id, 'izin')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                row.status === 'izin'
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700'
                              }`}
                              title="Izin"
                            >
                              I
                            </button>

                            {/* Alpa */}
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(std.id, 'alpa')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                row.status === 'alpa'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                              title="Alpa"
                            >
                              A
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => handleUpdateStudentNote(std.id, e.target.value)}
                            placeholder="Tambahkan catatan..."
                            className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Submit Button */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Perubahan akan dicatat ke log presensi rombel tanggal <strong>{todayDate}</strong>
              </p>

              <button
                onClick={handleSaveClassAttendance}
                disabled={isBlockedByHoliday}
                className="px-6 py-2.5 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-full shadow-md flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Absensi Kelas {selectedClass?.name}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
