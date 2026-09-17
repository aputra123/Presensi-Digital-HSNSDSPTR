import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  PenTool,
  Printer,
  Download,
  Calendar,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Edit3,
  Trash2,
  Smartphone,
  Laptop,
  X,
  HelpCircle,
  ChevronDown,
  CloudUpload,
  History,
  FileText,
  Camera,
  ExternalLink,
  RotateCcw,
  SlidersHorizontal,
  Send,
  ScanFace,
  MapPin,
  Wifi,
  WifiOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Zap,
} from 'lucide-react';
import {
  Teacher,
  SchoolConfig,
  AttendanceRecord,
  GtkServiceRequest,
  LeaveRequest,
  AsnAttendanceRow,
  AsnAttendanceKeterangan,
  SignatureAuditLog,
  DailyApelDocumentation,
  ApelPhotoRecord,
  ActivityLog,
} from '../types';
import { formatDateIndo, downloadCsv } from '../utils/soundAndDate';
import { DEFAULT_ASN_TEACHERS } from '../data/schoolData';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { ApelDocumentationSection } from './ApelDocumentationSection';
import { SignatureAuditLogsModal } from './SignatureAuditLogsModal';
import { exportAsnSignedAttendanceManualPdf, calculateWorkDuration } from '../utils/exportUtils';
import { BkdDispatchModal } from './BkdDispatchModal';
import { BiometricFaceRecognitionModal } from './BiometricFaceRecognitionModal';
import { saveBlobToGoogleDrive } from '../lib/googleWorkspace';
import { getCachedAccessToken, signInWithGoogleWorkspace } from '../lib/firebase';
import { enqueueAsnTableSync, enqueueApelDocumentationSync } from '../utils/syncQueue';

interface AsnAttendanceTableTabProps {
  teachers?: Teacher[];
  config: SchoolConfig;
  records?: AttendanceRecord[];
  gtkServices?: GtkServiceRequest[];
  leaves?: LeaveRequest[];
  todayDate?: string;
  onAddTeachers?: (newTeachers: Teacher[]) => void;
  onRecordAttendance?: (record: AttendanceRecord) => void;
  onAddActivityLog?: (log: ActivityLog) => void;
}

export const AsnAttendanceTableTab: React.FC<AsnAttendanceTableTabProps> = ({
  teachers = [],
  config,
  records = [],
  gtkServices = [],
  leaves = [],
  todayDate = new Date().toISOString().split('T')[0],
  onAddTeachers,
  onRecordAttendance,
  onAddActivityLog,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [filterAsnOnly, setFilterAsnOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKeterangan, setFilterKeterangan] = useState<string>('ALL');

  // Pagination state for high performance table rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [jumpPageInput, setJumpPageInput] = useState<string>('1');

  // Progressive Chunked Loading State (for thousands of attendance rows)
  const [isLoadingChunk, setIsLoadingChunk] = useState<boolean>(false);
  const [chunkProgress, setChunkProgress] = useState<{ loaded: number; total: number } | null>(null);
  const abortLoadRef = useRef<boolean>(false);

  // Table Column Sorting
  const [sortField, setSortField] = useState<'no' | 'name' | 'nip' | 'date' | 'status' | 'duration' | 'keterangan'>('no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Advanced Filter States (NIP, Rentang Tanggal Khusus, Status Kehadiran)
  const [filterNip, setFilterNip] = useState<string>('');
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'range'>('single');
  const [rangeStartDate, setRangeStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [rangeEndDate, setRangeEndDate] = useState<string>(todayDate);

  // Network Online/Offline Status
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Active signature modal target
  const [activeSignTarget, setActiveSignTarget] = useState<{
    teacherId: string;
    teacherName: string;
    nip: string;
    sessionType: 'masuk' | 'pulang';
    existingSignature?: string | null;
    targetDate?: string;
  } | null>(null);

  // Print Preview Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isBkdDispatchModalOpen, setIsBkdDispatchModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sub Tab: 'table' (Tabel Presensi & Tanda Tangan) | 'apel_doc' (Lampiran Foto Apel Pagi & Siang)
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'apel_doc'>('table');

  // Audit Logs State & Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SignatureAuditLog[]>(() => {
    try {
      const raw = localStorage.getItem('asn_signature_audit_logs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Apel Documentation State (Daily)
  const [apelDocumentation, setApelDocumentation] = useState<DailyApelDocumentation>(() => {
    try {
      const raw = localStorage.getItem(`apel_doc_${todayDate}`);
      return raw ? JSON.parse(raw) : { date: todayDate, apelPagi: null, apelSiang: null };
    } catch {
      return { date: todayDate, apelPagi: null, apelSiang: null };
    }
  });

  // Google Drive Saving State
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);

  // Rows state for selected date
  const [tableRows, setTableRows] = useState<AsnAttendanceRow[]>([]);

  // Show toast helper
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Safe teachers roster: use props teachers, or fallback to DEFAULT_ASN_TEACHERS
  const effectiveTeachers = useMemo(() => {
    if (teachers && teachers.length > 0) {
      return teachers;
    }
    return DEFAULT_ASN_TEACHERS;
  }, [teachers]);

  // Storage key for this specific date
  const storageKey = `asn_attendance_table_${selectedDate}`;

  // Sync Apel Documentation when selectedDate changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`apel_doc_${selectedDate}`);
      if (raw) {
        setApelDocumentation(JSON.parse(raw));
      } else {
        setApelDocumentation({ date: selectedDate, apelPagi: null, apelSiang: null });
      }
    } catch {
      setApelDocumentation({ date: selectedDate, apelPagi: null, apelSiang: null });
    }
  }, [selectedDate]);

  const handleUpdateApelDocumentation = (updated: DailyApelDocumentation) => {
    setApelDocumentation(updated);
    try {
      localStorage.setItem(`apel_doc_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save apel doc:', e);
    }
    // Enqueue for offline sync and background transmission to Cloud Firestore
    enqueueApelDocumentationSync(selectedDate, updated);
  };

  // Biometric Face Recognition Modal State & Handlers
  const [isFaceModalOpen, setIsFaceModalOpen] = useState<boolean>(false);
  const [faceModalTeacherId, setFaceModalTeacherId] = useState<string | null>(null);
  const [faceModalSession, setFaceModalSession] = useState<'masuk' | 'pulang'>('masuk');

  const handleOpenFaceRecognition = (teacherId?: string, session: 'masuk' | 'pulang' = 'masuk') => {
    setFaceModalTeacherId(teacherId || null);
    setFaceModalSession(session);
    setIsFaceModalOpen(true);
  };

  const handleFaceRecognitionSuccess = (result: {
    teacher: Teacher;
    session: 'masuk' | 'pulang';
    photoUrl: string;
    matchScore: number;
    signatureStamp: string;
    timestamp: string;
  }) => {
    const { teacher, session, photoUrl, matchScore, signatureStamp, timestamp } = result;

    // Update table rows with biometric verified badge and timestamp
    const updatedRows = tableRows.map((r) => {
      if (r.teacherId === teacher.id) {
        if (session === 'masuk') {
          const newInTime = timestamp;
          const duration = calculateWorkDuration(newInTime, r.checkOutTime);
          return {
            ...r,
            checkInTime: newInTime,
            checkInSignature: signatureStamp,
            checkInDevice: 'Kamera Pengenalan Wajah AI',
            checkInSignedAt: new Date().toISOString(),
            keterangan: 'hadir' as AsnAttendanceKeterangan,
            totalWorkDuration: duration,
          };
        } else {
          const newOutTime = timestamp;
          const duration = calculateWorkDuration(r.checkInTime, newOutTime);
          return {
            ...r,
            checkOutTime: newOutTime,
            checkOutSignature: signatureStamp,
            checkOutDevice: 'Kamera Pengenalan Wajah AI',
            checkOutSignedAt: new Date().toISOString(),
            keterangan: 'hadir' as AsnAttendanceKeterangan,
            totalWorkDuration: duration,
          };
        }
      }
      return r;
    });

    updateRowsAndSave(updatedRows);

    // Save Attendance Record if handler exists
    if (onRecordAttendance) {
      const newRec: AttendanceRecord = {
        id: `rec_face_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        personId: teacher.id,
        personType: 'teacher',
        personName: teacher.name,
        identifier: teacher.nip || teacher.id,
        classOrSubject: teacher.subject || 'GTK ASN',
        date: selectedDate,
        time: timestamp,
        type: session,
        status: 'hadir',
        method: 'face_recognition',
        photoUrl: photoUrl,
        location: {
          lat: config?.schoolLat || -1.8412,
          lng: config?.schoolLng || 124.482,
          latitude: config?.schoolLat || -1.8412,
          longitude: config?.schoolLng || 124.482,
          address: config?.address || 'Desa Pancoran, Kec. Taliabu Barat',
          inRadius: true,
          distanceMeter: 0,
        },
        note: `Presensi Pengenalan Wajah Biometrik AI Sah (Skor Kecocokan ${matchScore}%)`,
      };
      onRecordAttendance(newRec);
    }

    // Add Audit Trail Log for cryptographic traceability
    const newAuditEntry: SignatureAuditLog = {
      id: `audit_sig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      date: selectedDate,
      time: `${timestamp} WITA`,
      teacherId: teacher.id,
      teacherName: teacher.name,
      nip: teacher.nip,
      sessionType: session,
      actionType: 'created',
      newSignatureUrl: signatureStamp,
      deviceType: 'Kamera Pengenalan Wajah AI',
      reason: `Verifikasi Pengenalan Wajah Biometrik AI (Skor Kecocokan ${matchScore}%)`,
      actorName: teacher.name,
      actorRole: 'Guru / Pegawai ASN',
      isValidatedByAdmin: true,
      validatedBy: config.adminName || 'Admin SIMPEG BKD',
      validatedAt: new Date().toISOString(),
    };

    const nextLogs = [newAuditEntry, ...auditLogs];
    setAuditLogs(nextLogs);
    try {
      localStorage.setItem('asn_signature_audit_logs', JSON.stringify(nextLogs.slice(0, 300)));
    } catch (e) {
      console.warn(e);
    }

    triggerToast(`Presensi Wajah Biometrik ${teacher.name} (${session === 'masuk' ? 'Pagi' : 'Siang'}) Terverifikasi Sah!`);
  };

  // Helper to generate realistic stamped sample documentation for Apel Pagi & Apel Siang
  const handleGenerateSampleApel = (session: 'apel_pagi' | 'apel_siang') => {
    const isPagi = session === 'apel_pagi';
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gradient background simulating school yard morning/afternoon light
    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, isPagi ? '#1e3a8a' : '#1e293b');
    grad.addColorStop(0.5, isPagi ? '#0284c7' : '#334155');
    grad.addColorStop(1, isPagi ? '#059669' : '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    // Decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(400, 300, 220, 0, Math.PI * 2);
    ctx.fill();

    // Center header and school text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 23px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isPagi
        ? 'DOKUMENTASI APEL PAGI GURU & GTK ASN'
        : 'DOKUMENTASI APEL SIANG (BUKAN APEL SORE) ASN',
      400,
      230
    );

    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT', 400, 268);

    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`Pelaksanaan: ${isPagi ? '07:15:00 WITA' : '14:00:00 WITA'} • ${formatDateIndo(selectedDate)}`, 400, 304);
    ctx.fillText(`Pembina / Pemimpin Apel: ${config.principalName || 'Kepala Sekolah / Guru Piket'}`, 400, 330);
    ctx.fillText(`Jumlah Peserta Apel: ${tableRows.length || 10} Orang Pegawai ASN`, 400, 355);

    // Bottom-Right Corner GPS Stamp Watermark
    const stampW = 350;
    const stampH = 92;
    const sx = 800 - stampW - 20;
    const sy = 600 - stampH - 20;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(sx, sy, stampW, stampH, 10);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(isPagi ? 'DOKUMENTASI APEL PAGI ASN' : 'DOKUMENTASI APEL SIANG ASN', sx + 14, sy + 22);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`WAKTU: ${isPagi ? '07:15:22' : '14:00:18'} WITA (GMT+8)`, sx + 14, sy + 39);
    ctx.fillText(`GPS: Lat -1.8412°, Lng 124.4820° (Akurasi 8m)`, sx + 14, sy + 56);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText('Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu', sx + 14, sy + 75);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const newRecord: ApelPhotoRecord = {
      id: `apel_${session}_${Date.now()}`,
      session,
      photoUrl: dataUrl,
      timestamp: `${selectedDate}T${isPagi ? '07:15:00' : '14:00:00'}`,
      date: selectedDate,
      time: isPagi ? '07:15:00' : '14:00:00',
      timezone: 'WITA (GMT+8)',
      location: {
        latitude: config?.schoolLat || -1.8412,
        longitude: config?.schoolLng || 124.482,
        desa: 'Desa Pancoran',
        kecamatan: 'Kec. Taliabu Barat',
        kabupaten: 'Kab. Pulau Taliabu',
        provinsi: 'Maluku Utara',
        addressFormatted: config?.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara',
        accuracyMeters: 8,
      },
      leaderName: config?.principalName || 'Kepala Sekolah',
      totalParticipants: tableRows.length || 10,
    };

    const updatedDoc: DailyApelDocumentation = {
      ...apelDocumentation,
      ...(isPagi ? { apelPagi: newRecord } : { apelSiang: newRecord }),
    };

    handleUpdateApelDocumentation(updatedDoc);
    triggerToast(`Dokumentasi ${isPagi ? 'Apel Pagi' : 'Apel Siang'} berhasil dimuat & tersinkronisasi!`);
  };

  // Verify Audit Log entry
  const handleVerifyAuditLog = (logId: string, verifierName: string) => {
    const updated = auditLogs.map((l) =>
      l.id === logId
        ? {
            ...l,
            isValidatedByAdmin: true,
            validatedBy: verifierName,
            validatedAt: new Date().toISOString(),
          }
        : l
    );
    setAuditLogs(updated);
    try {
      localStorage.setItem('asn_signature_audit_logs', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    triggerToast('Keabsahan tanda tangan berhasil diverifikasi oleh Admin!');
  };

  // Clear Audit Logs
  const handleClearAuditLogs = () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan seluruh log riwayat audit tanda tangan?')) {
      setAuditLogs([]);
      try {
        localStorage.removeItem('asn_signature_audit_logs');
      } catch (e) {
        console.warn(e);
      }
      triggerToast('Seluruh log audit riwayat tanda tangan telah dikosongkan.');
    }
  };

  // Helper: List all dates within a range (max 90 days)
  const getDateListInRange = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (start > end) return [startStr];
      const curr = new Date(start);
      let count = 0;
      while (curr <= end && count < 90) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
        count++;
      }
    } catch {
      return [startStr];
    }
    return dates.length > 0 ? dates : [startStr];
  };

  // Memoized O(1) Lookup Maps for blazingly fast lookups across thousands of records
  const recordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      map.set(`${r.personId}_${r.date}_${r.type}`, r);
    }
    return map;
  }, [records]);

  const gtkServicesByTeacher = useMemo(() => {
    const map = new Map<string, GtkServiceRequest[]>();
    for (let i = 0; i < gtkServices.length; i++) {
      const s = gtkServices[i];
      if (s.status === 'approved') {
        const arr = map.get(s.teacherId);
        if (arr) arr.push(s);
        else map.set(s.teacherId, [s]);
      }
    }
    return map;
  }, [gtkServices]);

  const leavesByTeacher = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      if (l.status === 'approved') {
        const arr = map.get(l.personId);
        if (arr) arr.push(l);
        else map.set(l.personId, [l]);
      }
    }
    return map;
  }, [leaves]);

  // Helper: Load or generate rows for a given date using O(1) map indexes
  const loadOrGenerateRowsForDate = (dateStr: string): AsnAttendanceRow[] => {
    try {
      const saved = localStorage.getItem(`asn_attendance_table_${dateStr}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: AsnAttendanceRow) => ({
            ...r,
            date: dateStr,
            totalWorkDuration: r.totalWorkDuration || calculateWorkDuration(r.checkInTime, r.checkOutTime),
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to load saved ASN attendance table for date:', dateStr, e);
    }

    return effectiveTeachers.map((teacher) => {
      const checkInRecord = recordsMap.get(`${teacher.id}_${dateStr}_masuk`);
      const checkOutRecord = recordsMap.get(`${teacher.id}_${dateStr}_pulang`);

      const teacherServices = gtkServicesByTeacher.get(teacher.id);
      const teacherService = teacherServices
        ? teacherServices.find((s) => dateStr >= s.startDate && dateStr <= s.endDate)
        : undefined;

      const teacherLeaves = leavesByTeacher.get(teacher.id);
      const teacherLeave = teacherLeaves
        ? teacherLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate)
        : undefined;

      let initialKeterangan: AsnAttendanceKeterangan = 'hadir';
      let initialNote = '';

      if (teacherService) {
        if (teacherService.category === 'surat_tugas') {
          initialKeterangan = 'dinas_luar';
          initialNote = teacherService.purpose || 'Surat Tugas Dinas Luar';
        } else if (teacherService.category === 'izin_cuti') {
          initialKeterangan = 'cuti';
          initialNote = teacherService.purpose || 'Cuti Resmi GTK';
        }
      } else if (teacherLeave) {
        if (teacherLeave.type === 'sakit') {
          initialKeterangan = 'sakit';
          initialNote = teacherLeave.reason || 'Surat Dokter / Sakit';
        } else if (teacherLeave.type === 'izin') {
          initialKeterangan = 'izin';
          initialNote = teacherLeave.reason || 'Izin Keperluan';
        }
      } else if (!checkInRecord && !checkOutRecord && dateStr < todayDate) {
        initialKeterangan = 'tanpa_keterangan';
      }

      let rank = 'Penata Muda / III/a';
      if (teacher.role.includes('Pembina')) rank = 'Pembina Tk. I, IV/b';
      else if (teacher.role.includes('Penata Tk. I')) rank = 'Penata Tk. I, III/d';
      else if (teacher.role.includes('Penata')) rank = 'Penata, III/c';
      else if (teacher.employmentStatus === 'PPPK') rank = 'PPPK Golongan IX';
      else if (teacher.employmentStatus === 'PPPK_PW') rank = 'PPPK Paruh Waktu';

      const checkInTime = checkInRecord ? `${checkInRecord.time} WITA` : (initialKeterangan === 'hadir' ? '07:15 WITA' : null);
      const checkOutTime = checkOutRecord ? `${checkOutRecord.time} WITA` : (initialKeterangan === 'hadir' ? '14:30 WITA' : null);
      const totalWorkDuration = calculateWorkDuration(checkInTime, checkOutTime);

      return {
        date: dateStr,
        teacherId: teacher.id,
        name: teacher.name,
        nip: teacher.nip,
        nuptk: teacher.nuptk || '',
        employmentStatus: teacher.employmentStatus,
        rankOrGrade: rank,
        roleOrSubject: teacher.role ? `${teacher.role} (${teacher.subject})` : teacher.subject,
        gender: teacher.gender,
        phone: teacher.phone,
        avatar: teacher.avatar,
        checkInSignature: checkInRecord?.signatureDataUrl || null,
        checkInTime: checkInTime,
        checkInDevice: checkInRecord ? 'system' : null,
        checkInSignedAt: checkInRecord ? `${dateStr} ${checkInRecord.time}` : null,
        checkOutSignature: checkOutRecord?.signatureDataUrl || null,
        checkOutTime: checkOutTime,
        checkOutDevice: checkOutRecord ? 'system' : null,
        checkOutSignedAt: checkOutRecord ? `${dateStr} ${checkOutRecord.time}` : null,
        totalWorkDuration: totalWorkDuration,
        keterangan: initialKeterangan,
        notes: initialNote,
      };
    });
  };

  // Build / Load table rows progressively in chunks to keep main thread stable with thousands of rows
  const generateTableData = (forceRefresh = false) => {
    if (dateFilterMode === 'single') {
      abortLoadRef.current = true;
      setIsLoadingChunk(false);
      setChunkProgress(null);

      if (!forceRefresh) {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTableRows(
                parsed.map((r: AsnAttendanceRow) => ({
                  ...r,
                  date: selectedDate,
                  totalWorkDuration: r.totalWorkDuration || calculateWorkDuration(r.checkInTime, r.checkOutTime),
                }))
              );
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to load saved ASN attendance table:', e);
        }
      }

      const rows = loadOrGenerateRowsForDate(selectedDate);
      setTableRows(rows);
      try {
        localStorage.setItem(storageKey, JSON.stringify(rows));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    } else {
      // Range mode: Progressive Chunked Loading
      abortLoadRef.current = true; // Signal abort to any running background chunk generator
      const dates = getDateListInRange(rangeStartDate, rangeEndDate);
      const totalDates = dates.length;
      const teachersCount = effectiveTeachers.length;
      const estimatedTotal = totalDates * teachersCount;

      if (totalDates <= 3) {
        const allRows: AsnAttendanceRow[] = [];
        dates.forEach((d) => {
          allRows.push(...loadOrGenerateRowsForDate(d));
        });
        setTableRows(allRows);
        setIsLoadingChunk(false);
        setChunkProgress(null);
        return;
      }

      // Large Range: Generate first 3 dates immediately so first page renders instantaneously!
      abortLoadRef.current = false;
      setIsLoadingChunk(true);

      const initialBatchDates = dates.slice(0, 3);
      const initialRows: AsnAttendanceRow[] = [];
      initialBatchDates.forEach((d) => {
        initialRows.push(...loadOrGenerateRowsForDate(d));
      });
      setTableRows(initialRows);
      setChunkProgress({ loaded: initialRows.length, total: estimatedTotal });

      // Process subsequent date chunks non-blockingly
      let currentIdx = 3;
      const CHUNK_SIZE = 5;

      const processNextChunk = () => {
        if (abortLoadRef.current) {
          setIsLoadingChunk(false);
          setChunkProgress(null);
          return;
        }

        if (currentIdx >= totalDates) {
          setIsLoadingChunk(false);
          setChunkProgress(null);
          return;
        }

        const nextBatchDates = dates.slice(currentIdx, currentIdx + CHUNK_SIZE);
        currentIdx += CHUNK_SIZE;

        const nextBatchRows: AsnAttendanceRow[] = [];
        nextBatchDates.forEach((d) => {
          nextBatchRows.push(...loadOrGenerateRowsForDate(d));
        });

        setTableRows((prev) => {
          const merged = [...prev, ...nextBatchRows];
          setChunkProgress({ loaded: merged.length, total: estimatedTotal });
          return merged;
        });

        if (currentIdx < totalDates) {
          setTimeout(processNextChunk, 16);
        } else {
          setIsLoadingChunk(false);
          setChunkProgress(null);
        }
      };

      setTimeout(processNextChunk, 16);
    }
  };

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortLoadRef.current = true;
    };
  }, []);

  // Load when selectedDate, mode, or range changes
  useEffect(() => {
    generateTableData();
  }, [selectedDate, dateFilterMode, rangeStartDate, rangeEndDate, effectiveTeachers.length]);

  // Save changes to localStorage
  const updateRowsAndSave = (updated: AsnAttendanceRow[]) => {
    const withDurations = updated.map((r) => ({
      ...r,
      totalWorkDuration: r.totalWorkDuration || calculateWorkDuration(r.checkInTime, r.checkOutTime),
    }));
    setTableRows(withDurations);
    try {
      localStorage.setItem(storageKey, JSON.stringify(withDurations));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    // Enqueue ASN table for offline sync & background cloud persistence
    enqueueAsnTableSync(selectedDate, withDurations);
  };

  // Handle signature save from modal
  const handleSaveSignature = (
    signatureDataUrl: string,
    deviceType: string,
    timeStr: string,
    revisionReason?: string
  ) => {
    if (!activeSignTarget) return;

    const { teacherId, sessionType, existingSignature } = activeSignTarget;
    const targetDate = activeSignTarget.targetDate || selectedDate;
    const nowIso = new Date().toISOString();
    const isRevision = !!existingSignature;

    const updated = tableRows.map((row) => {
      const isTargetRow =
        row.teacherId === teacherId &&
        (dateFilterMode === 'range' ? row.date === targetDate : true);

      if (isTargetRow) {
        if (sessionType === 'masuk') {
          const inTime = row.checkInTime || timeStr;
          return {
            ...row,
            checkInSignature: signatureDataUrl,
            checkInTime: inTime,
            checkInDevice: deviceType,
            checkInSignedAt: nowIso,
            totalWorkDuration: calculateWorkDuration(inTime, row.checkOutTime),
            keterangan: row.keterangan === 'tanpa_keterangan' ? 'hadir' : row.keterangan,
          };
        } else {
          const outTime = row.checkOutTime || timeStr;
          return {
            ...row,
            checkOutSignature: signatureDataUrl,
            checkOutTime: outTime,
            checkOutDevice: deviceType,
            checkOutSignedAt: nowIso,
            totalWorkDuration: calculateWorkDuration(row.checkInTime, outTime),
            keterangan: row.keterangan === 'tanpa_keterangan' ? 'hadir' : row.keterangan,
          };
        }
      }
      return row;
    });

    updateRowsAndSave(updated);

    // Save Attendance Record if handler exists
    if (onRecordAttendance) {
      const cleanTime = timeStr.replace(/[^0-9:]/g, '') || (sessionType === 'masuk' ? '07:15' : '14:30');
      const rec: AttendanceRecord = {
        id: `rec_sig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        personId: teacherId,
        personType: 'teacher',
        personName: activeSignTarget.teacherName,
        identifier: activeSignTarget.nip || teacherId,
        classOrSubject: 'GTK ASN',
        date: targetDate,
        time: cleanTime,
        type: sessionType,
        status: 'hadir',
        method: 'digital_signature',
        signatureDataUrl: signatureDataUrl,
        location: {
          lat: config?.schoolLat || -1.8412,
          lng: config?.schoolLng || 124.482,
          latitude: config?.schoolLat || -1.8412,
          longitude: config?.schoolLng || 124.482,
          address: config?.address || 'Desa Pancoran, Kec. Taliabu Barat',
          inRadius: true,
          distanceMeter: 0,
        },
        note: `Tanda Tangan Digital Sah (${deviceType})`,
      };
      onRecordAttendance(rec);
    }

    // Record Audit Trail Log
    const newAuditEntry: SignatureAuditLog = {
      id: `audit_sig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: nowIso,
      date: selectedDate,
      time: timeStr,
      teacherId,
      teacherName: activeSignTarget.teacherName,
      nip: activeSignTarget.nip,
      sessionType,
      actionType: isRevision ? 'updated' : 'created',
      previousSignatureUrl: existingSignature || null,
      newSignatureUrl: signatureDataUrl,
      deviceType,
      reason:
        revisionReason ||
        (isRevision ? 'Pembaruan / revisi goresan tanda tangan' : 'Tanda tangan digital baru'),
      actorName: config.adminName || 'Admin SIMPEG / Guru',
      actorRole: 'Guru / Verifikator',
      isValidatedByAdmin: true,
      validatedBy: config.adminName || 'Admin SIMPEG BKD',
      validatedAt: nowIso,
    };

    const nextLogs = [newAuditEntry, ...auditLogs];
    setAuditLogs(nextLogs);
    try {
      localStorage.setItem('asn_signature_audit_logs', JSON.stringify(nextLogs.slice(0, 300)));
    } catch (e) {
      console.warn('Audit log save error:', e);
    }

    // Catat ke ActivityLog global sistem
    const cleanTimeDisplay = timeStr.replace(/[^0-9:]/g, '') || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newActivityLog: ActivityLog = {
      id: `act_sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: isRevision ? 'Revisi Tanda Tangan ASN' : 'Tanda Tangan Presensi ASN',
      actor: {
        name: activeSignTarget.teacherName,
        role: 'GTK ASN / PNS / PPPK',
      },
      category: 'attendance',
      time: cleanTimeDisplay,
      timestamp: `${targetDate} ${cleanTimeDisplay}`,
      date: targetDate,
      description: `ASN ${activeSignTarget.teacherName} (NIP: ${activeSignTarget.nip || '-'}) telah ${isRevision ? 'memperbarui tanda tangan' : 'membubuhkan tanda tangan digital presensi sah'} (${sessionType === 'masuk' ? 'Masuk Pagi' : 'Pulang Sore'}) via ${deviceType}.`,
      status: 'success',
    };

    if (onAddActivityLog) {
      onAddActivityLog(newActivityLog);
    }

    try {
      const stored = localStorage.getItem('school_presensi_activity_logs');
      const parsed: ActivityLog[] = stored ? JSON.parse(stored) : [];
      localStorage.setItem('school_presensi_activity_logs', JSON.stringify([newActivityLog, ...parsed].slice(0, 500)));
    } catch (e) {
      console.warn('Failed to persist activity log:', e);
    }

    triggerToast(
      isRevision
        ? `Revisi tanda tangan absen ${sessionType} berhasil disimpan dan dicatat di log audit!`
        : `Tanda tangan absen ${sessionType === 'masuk' ? 'masuk' : 'pulang'} berhasil disimpan!`
    );
  };

  // Clear a specific signature
  const handleRemoveSignature = (
    teacherId: string,
    sessionType: 'masuk' | 'pulang'
  ) => {
    const targetRow = tableRows.find((r) => r.teacherId === teacherId);
    const prevSig = sessionType === 'masuk' ? targetRow?.checkInSignature : targetRow?.checkOutSignature;

    const updated = tableRows.map((row) => {
      if (row.teacherId === teacherId) {
        if (sessionType === 'masuk') {
          return {
            ...row,
            checkInSignature: null,
            checkInDevice: null,
            checkInSignedAt: null,
          };
        } else {
          return {
            ...row,
            checkOutSignature: null,
            checkOutDevice: null,
            checkOutSignedAt: null,
          };
        }
      }
      return row;
    });
    updateRowsAndSave(updated);

    // Record Audit Trail Log for removal
    if (targetRow) {
      const newAuditEntry: SignatureAuditLog = {
        id: `audit_sig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        date: selectedDate,
        time: `${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`,
        teacherId,
        teacherName: targetRow.name,
        nip: targetRow.nip,
        sessionType,
        actionType: 'removed',
        previousSignatureUrl: prevSig || null,
        newSignatureUrl: null,
        deviceType: 'Admin Dashboard',
        reason: 'Penghapusan / pembatalan tanda tangan oleh Admin Presensi',
        actorName: config.adminName || 'Admin Presensi',
        actorRole: 'Admin',
        isValidatedByAdmin: true,
        validatedBy: config.adminName || 'Admin SIMPEG BKD',
        validatedAt: new Date().toISOString(),
      };

      const nextLogs = [newAuditEntry, ...auditLogs];
      setAuditLogs(nextLogs);
      try {
        localStorage.setItem('asn_signature_audit_logs', JSON.stringify(nextLogs.slice(0, 300)));
      } catch (e) {
        console.warn(e);
      }
    }

    triggerToast(`Tanda tangan absen ${sessionType} dibatalkan & dicatat di audit log.`);
  };

  // Export PDF Signed Manual Sheet with embedded signatures and Page 2 Apel Annex
  const handleExportPdfSignedManual = async () => {
    try {
      triggerToast('Menghasilkan berkas PDF Presensi Resmi ber-TTD Digital...');
      await exportAsnSignedAttendanceManualPdf(
        tableRows,
        config,
        selectedDate,
        apelDocumentation,
        false
      );
      triggerToast('Berkas PDF Presensi Manual ASN berhasil diunduh!');
    } catch (err: any) {
      alert('Gagal mengekspor PDF: ' + (err.message || 'Kesalahan sistem'));
    }
  };

  // Save copy of signed attendance & signatures directly to Google Drive
  const handleSaveToGoogleDrive = async () => {
    setIsSavingToDrive(true);
    try {
      let token = getCachedAccessToken();
      if (!token) {
        try {
          const authRes = await signInWithGoogleWorkspace();
          token = authRes.token;
        } catch (authErr) {
          alert(
            'Silakan sambungkan akun Google Workspace terlebih dahulu di tab Google Workspace untuk menyimpan langsung ke Google Drive sekolah.'
          );
          setIsSavingToDrive(false);
          return;
        }
      }

      triggerToast('Membuat dokumen PDF berstempel dan mengirim ke Google Drive...');
      const pdfDoc = await exportAsnSignedAttendanceManualPdf(
        tableRows,
        config,
        selectedDate,
        apelDocumentation,
        true
      );
      const pdfBlob = pdfDoc.output('blob');
      const safeSchool = config.schoolName ? config.schoolName.replace(/[^a-zA-Z0-9]/g, '_') : 'SMPN4_TB';
      const fileName = `Presensi_ASN_${safeSchool}_${selectedDate}.pdf`;

      const res = await saveBlobToGoogleDrive(
        token,
        fileName,
        pdfBlob,
        'application/pdf',
        config.googleDriveFolderId
      );

      if (res.success) {
        triggerToast('Salinan presensi & tanda tangan berhasil disimpan di Google Drive sekolah!');
        if (res.link) {
          window.open(res.link, '_blank');
        }
      } else {
        alert('Google Drive Response: ' + res.message);
      }
    } catch (err: any) {
      alert('Gagal menyimpan ke Google Drive: ' + (err.message || 'Koneksi error'));
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Change Keterangan (hadir, izin, sakit, cuti, dinas_luar, tanpa_keterangan)
  const handleChangeKeterangan = (
    teacherId: string,
    keterangan: AsnAttendanceKeterangan
  ) => {
    const updated = tableRows.map((row) => {
      if (row.teacherId === teacherId) {
        return {
          ...row,
          keterangan,
        };
      }
      return row;
    });
    updateRowsAndSave(updated);
  };

  // Quick action: Set all unmarked as Hadir
  const handleSetAllHadir = () => {
    const updated = tableRows.map((row) => ({
      ...row,
      keterangan: 'hadir' as AsnAttendanceKeterangan,
      checkInTime: row.checkInTime || `${config.checkInStart || '06:45'} WITA`,
      checkOutTime: row.checkOutTime || `${config.checkOutStart || '14:00'} WITA`,
    }));
    updateRowsAndSave(updated);
    triggerToast('Semua guru GTK disetel berstatus Hadir.');
  };

  // Sync existing database teachers if empty
  const handleImportDefaultTeachers = () => {
    if (onAddTeachers) {
      onAddTeachers(DEFAULT_ASN_TEACHERS);
      triggerToast('Daftar resmi 10 Guru ASN SMPN 4 Taliabu Barat berhasil dimuat ke database!');
    }
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return tableRows.filter((row) => {
      // ASN only filter
      if (filterAsnOnly) {
        const isAsn =
          row.employmentStatus === 'PNS' ||
          row.employmentStatus === 'PPPK' ||
          row.employmentStatus === 'PPPK_PW';
        if (!isAsn) return false;
      }

      // NIP filter (Filter Spesifik NIP)
      if (filterNip.trim()) {
        const qNip = filterNip.trim().toLowerCase();
        if (!row.nip.toLowerCase().includes(qNip)) {
          return false;
        }
      }

      // Status Kehadiran filter (hadir / izin / sakit / alfa / cuti / dinas_luar)
      if (filterKeterangan !== 'ALL') {
        if (filterKeterangan === 'alfa') {
          const isAlfa =
            row.keterangan === 'tanpa_keterangan' ||
            (row.keterangan as any) === 'alfa';
          if (!isAlfa) return false;
        } else if (row.keterangan !== filterKeterangan) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.name.toLowerCase().includes(q);
        const matchNip = row.nip.includes(q);
        const matchRole = row.roleOrSubject.toLowerCase().includes(q);
        if (!matchName && !matchNip && !matchRole) return false;
      }

      return true;
    });
  }, [tableRows, filterAsnOnly, filterNip, filterKeterangan, searchQuery]);

  // Column Sorting Handler
  const handleSort = (field: 'no' | 'name' | 'nip' | 'date' | 'status' | 'duration' | 'keterangan') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sort rows based on sortField & sortDirection
  const sortedRows = useMemo(() => {
    if (sortField === 'no') return filteredRows;
    return [...filteredRows].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'id');
      } else if (sortField === 'nip') {
        comparison = (a.nip || '').localeCompare(b.nip || '');
      } else if (sortField === 'date') {
        comparison = (a.date || '').localeCompare(b.date || '');
      } else if (sortField === 'status') {
        comparison = (a.employmentStatus || '').localeCompare(b.employmentStatus || '');
      } else if (sortField === 'duration') {
        comparison = (a.totalWorkDuration || '').localeCompare(b.totalWorkDuration || '');
      } else if (sortField === 'keterangan') {
        comparison = (a.keterangan || '').localeCompare(b.keterangan || '');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortField, sortDirection]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterAsnOnly, filterNip, filterKeterangan, searchQuery, selectedDate, dateFilterMode, rangeStartDate, rangeEndDate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  // Keep currentPage valid if totalPages shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  const handleApplyJump = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pageNum = parseInt(jumpPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setJumpPageInput(String(currentPage));
    }
  };

  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (currentPage > 3) {
      pages.push('ellipsis-start');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('ellipsis-end');
    }
    pages.push(totalPages);
    return pages;
  };

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // High-Performance Single-Pass Statistics for thousands of rows
  const stats = useMemo(() => {
    let signedCheckIn = 0;
    let signedCheckOut = 0;
    let bothSigned = 0;
    let countHadir = 0;
    let countIzin = 0;
    let countSakit = 0;
    let countCuti = 0;
    let countDinasLuar = 0;
    let countTanpaKet = 0;

    for (let i = 0; i < filteredRows.length; i++) {
      const r = filteredRows[i];
      const hasIn = !!r.checkInSignature;
      const hasOut = !!r.checkOutSignature;
      if (hasIn) signedCheckIn++;
      if (hasOut) signedCheckOut++;
      if (hasIn && hasOut) bothSigned++;

      switch (r.keterangan) {
        case 'hadir':
          countHadir++;
          break;
        case 'izin':
          countIzin++;
          break;
        case 'sakit':
          countSakit++;
          break;
        case 'cuti':
          countCuti++;
          break;
        case 'dinas_luar':
          countDinasLuar++;
          break;
        case 'tanpa_keterangan':
        default:
          countTanpaKet++;
          break;
      }
    }

    return {
      total: filteredRows.length,
      signedCheckIn,
      signedCheckOut,
      bothSigned,
      countHadir,
      countIzin,
      countSakit,
      countCuti,
      countDinasLuar,
      countTanpaKet,
    };
  }, [filteredRows]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'No',
      'Nama Guru / GTK',
      'NIP',
      'Status Kepegawaian',
      'Pangkat / Golongan',
      'Jabatan / Mata Pelajaran',
      'Jam Absen Masuk',
      'Status TTD Masuk',
      'Jam Absen Pulang',
      'Status TTD Pulang',
      'Keterangan Kehadiran',
      'Catatan Tambahan',
      'Tanggal Presensi',
    ];

    const rows = filteredRows.map((r, idx) => [
      idx + 1,
      `"${r.name.replace(/"/g, '""')}"`,
      `'${r.nip}`,
      `"${r.employmentStatus}"`,
      `"${r.rankOrGrade || '-'}"`,
      `"${r.roleOrSubject.replace(/"/g, '""')}"`,
      `"${r.checkInTime || '-'}"`,
      r.checkInSignature ? 'SUDAH BERTANDA TANGAN' : 'BELUM TTD',
      `"${r.checkOutTime || '-'}"`,
      r.checkOutSignature ? 'SUDAH BERTANDA TANGAN' : 'BELUM TTD',
      r.keterangan.toUpperCase().replace('_', ' '),
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.date || selectedDate,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const filename =
      dateFilterMode === 'range'
        ? `Tabel_Absensi_Guru_ASN_${rangeStartDate}_sd_${rangeEndDate}_SMPN4TaliabuBarat.csv`
        : `Tabel_Absensi_Guru_ASN_${selectedDate}_SMPN4TaliabuBarat.csv`;
    downloadCsv(filename, csvContent);
    triggerToast('Tabel absensi ASN berhasil diekspor ke format CSV/Excel.');
  };

  // Helper Badge for Keterangan
  const renderKeteranganBadge = (
    keterangan: AsnAttendanceKeterangan,
    teacherId: string
  ) => {
    const getBadgeStyle = () => {
      switch (keterangan) {
        case 'hadir':
          return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        case 'izin':
          return 'bg-indigo-100 text-indigo-800 border-indigo-300';
        case 'sakit':
          return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'cuti':
          return 'bg-purple-100 text-purple-800 border-purple-300';
        case 'dinas_luar':
          return 'bg-cyan-100 text-cyan-800 border-cyan-300';
        case 'tanpa_keterangan':
        default:
          return 'bg-rose-100 text-rose-800 border-rose-300';
      }
    };

    return (
      <div className="relative inline-block w-full">
        <select
          value={keterangan}
          onChange={(e) =>
            handleChangeKeterangan(
              teacherId,
              e.target.value as AsnAttendanceKeterangan
            )
          }
          className={`w-full text-xs font-extrabold px-3 py-1.5 rounded-xl border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 pr-7 ${getBadgeStyle()}`}
        >
          <option value="hadir">✓ Hadir</option>
          <option value="izin">📋 Izin</option>
          <option value="sakit">🩺 Sakit</option>
          <option value="cuti">🏖️ Cuti</option>
          <option value="dinas_luar">🏢 Dinas Luar</option>
          <option value="tanpa_keterangan">✕ Tanpa Keterangan</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[140] p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Tabel Absensi Otomatis Guru ASN
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Dual Signature Masuk & Pulang
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {config.schoolName || 'SMPN 4 Satu Atap Taliabu Barat'} • Format Resmi Tanda Tangan Touchpad / Mouse Laptop & Layar Sentuh HP
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {(!teachers || teachers.length === 0) && (
            <button
              type="button"
              onClick={handleImportDefaultTeachers}
              className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Users className="w-4 h-4 text-purple-600" />
              <span>Muat Roster 10 Guru ASN</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => generateTableData(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Sinkronkan ulang data kehadiran masuk & pulang dari sistem"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Sinkron</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Unduh format spreadsheet CSV / Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdfSignedManual}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Unduh Berkas PDF Presensi Manual ASN Berstempel & TTD Digital Resmi"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>Ekspor PDF Resmi</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToGoogleDrive}
            disabled={isSavingToDrive}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
            title="Simpan salinan presensi & tanda tangan guru langsung ke Google Drive sekolah"
          >
            <CloudUpload className={`w-4 h-4 text-amber-600 ${isSavingToDrive ? 'animate-bounce' : ''}`} />
            <span>{isSavingToDrive ? 'Menyimpan ke Drive...' : 'Simpan ke G-Drive'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenFaceRecognition()}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-emerald-700/20"
            title="Buka Scanner Pengenalan Wajah Biometrik ASN (Masuk / Pulang)"
          >
            <ScanFace className="w-4 h-4 text-emerald-200" />
            <span>Presensi Wajah Biometrik</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBkdDispatchModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-emerald-700/20"
            title="Kirim tabel absensi beserta lampiran dokumentasi apel ke WA BKD, Google Drive BKD, dan Email BKD"
          >
            <Send className="w-4 h-4 text-emerald-200" />
            <span>Kirim ke BKD (WA/Drive/Email)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-slate-900/20"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Format / Dialog PDF</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar: Tabel Absensi vs Halaman Lampiran Apel GPS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('table')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'table'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Tabel Presensi & Tanda Tangan ASN</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'table'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {stats.signedCheckIn}/{stats.total} TTD
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('apel_doc')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === 'apel_doc'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Halaman Lampiran: Dokumentasi Apel Pagi & Siang (GPS)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                apelDocumentation.apelPagi || apelDocumentation.apelSiang
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {apelDocumentation.apelPagi && apelDocumentation.apelSiang
                ? '2 Foto Sah'
                : apelDocumentation.apelPagi || apelDocumentation.apelSiang
                ? '1 Foto Sah'
                : 'Belum Ada Foto'}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Cloud Synchronization Status Indicator */}
          {isOnline ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              title="Koneksi internet aktif. Data presensi, tabel ASN, dan dokumentasi apel otomatis tersinkronisasi ke Firebase Firestore."
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Online • Cloud Sync Aktif</span>
              <span className="sm:hidden">Online</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300"
              title="Koneksi terputus. Mode offline aktif: Tanda tangan, tabel presensi, dan foto apel disimpan lokal & otomatis terkirim begitu terhubung internet."
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span className="hidden sm:inline">Offline Siap • Auto-Kirim Saat Online</span>
              <span className="sm:hidden">Offline Siap</span>
            </div>
          )}

          {/* Audit Log Quick View */}
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border border-slate-200"
            title="Buka Log Riwayat dan Verifikasi Keabsahan Tanda Tangan Guru ASN"
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>Log Audit TTD Guru</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* RENDER VIEW BERDASARKAN SUB-TAB */}
      {activeSubTab === 'apel_doc' ? (
        <ApelDocumentationSection
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          config={config}
          apelDocumentation={apelDocumentation}
          onUpdateDocumentation={handleUpdateApelDocumentation}
          totalTeachersCount={tableRows.length}
          onAddActivityLog={onAddActivityLog}
        />
      ) : (
        <>
          {/* Date Bar & Advanced Filters */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            {/* Header of Filter with Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">
                    Filter & Rentang Data Presensi ASN
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Saring data berdasarkan NIP, rentang tanggal khusus, dan status kehadiran
                  </p>
                </div>
              </div>

              {/* Mode Selector: Tanggal Tunggal vs Rentang Tanggal Khusus */}
              <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setDateFilterMode('single')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    dateFilterMode === 'single'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tanggal Tunggal
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('range')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    dateFilterMode === 'range'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rentang Tanggal Khusus
                </button>
              </div>
            </div>

            {/* Row 1: Date Controls based on mode */}
            {dateFilterMode === 'single' ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                  <Calendar className="w-4 h-4 text-indigo-600 ml-2 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    Pilih Tanggal:
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-xs font-bold px-2 py-1 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayDate)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg whitespace-nowrap cursor-pointer transition-colors"
                  >
                    Hari Ini
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  Menampilkan lembar presensi resmi untuk tanggal <strong className="text-slate-800">{formatDateIndo(selectedDate)}</strong>
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">Rentang:</span>
                  <input
                    type="date"
                    value={rangeStartDate}
                    max={rangeEndDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                    className="text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 font-bold">s/d</span>
                  <input
                    type="date"
                    value={rangeEndDate}
                    min={rangeStartDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                    className="text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 cursor-pointer"
                  />
                </div>

                {/* Range Presets */}
                <div className="flex items-center space-x-1.5 ml-auto">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Preset:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 6);
                      setRangeStartDate(d.toISOString().split('T')[0]);
                      setRangeEndDate(todayDate);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 13);
                      setRangeStartDate(d.toISOString().split('T')[0]);
                      setRangeEndDate(todayDate);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    14 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const firstDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                      setRangeStartDate(firstDay);
                      setRangeEndDate(todayDate);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>
            )}

            {/* Row 2: Search, NIP Filter, Status Filter & ASN Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Filter NIP Spesifik */}
              <div className="md:col-span-3 relative">
                <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter NIP (cth: 1982...)"
                  value={filterNip}
                  onChange={(e) => setFilterNip(e.target.value)}
                  className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
                {filterNip && (
                  <button
                    type="button"
                    onClick={() => setFilterNip('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search Box */}
              <div className="md:col-span-3 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama guru / mapel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Kehadiran Selector (Hadir/Izin/Sakit/Alfa/Cuti/Dinas Luar) */}
              <div className="md:col-span-3">
                <select
                  value={filterKeterangan}
                  onChange={(e) => setFilterKeterangan(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="ALL">Semua Status Kehadiran</option>
                  <option value="hadir">✓ Hadir</option>
                  <option value="izin">📋 Izin</option>
                  <option value="sakit">🩺 Sakit</option>
                  <option value="alfa">✕ Alfa / Tanpa Keterangan</option>
                  <option value="cuti">🏖️ Cuti Resmi GTK</option>
                  <option value="dinas_luar">🏢 Dinas Luar / Surat Tugas</option>
                </select>
              </div>

              {/* ASN Checkbox */}
              <div className="md:col-span-3 flex items-center justify-end">
                <label className="w-full flex items-center justify-center space-x-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 px-3 py-2 rounded-2xl border border-slate-200 select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={filterAsnOnly}
                    onChange={(e) => setFilterAsnOnly(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    Hanya ASN (PNS & PPPK)
                  </span>
                </label>
              </div>
            </div>

            {/* Active Filters Bar & Reset */}
            {(filterNip.trim() || filterKeterangan !== 'ALL' || searchQuery.trim() || !filterAsnOnly || dateFilterMode === 'range') && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mr-1">
                    Filter Aktif:
                  </span>
                  {dateFilterMode === 'range' && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-medium">
                      <span>Rentang: {rangeStartDate} s/d {rangeEndDate}</span>
                      <button
                        type="button"
                        onClick={() => setDateFilterMode('single')}
                        className="text-indigo-500 hover:text-indigo-800 ml-1 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {filterNip && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                      <span>NIP: {filterNip}</span>
                      <button
                        type="button"
                        onClick={() => setFilterNip('')}
                        className="text-blue-500 hover:text-blue-800 ml-1 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {filterKeterangan !== 'ALL' && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                      <span>Status: {filterKeterangan.toUpperCase().replace('_', ' ')}</span>
                      <button
                        type="button"
                        onClick={() => setFilterKeterangan('ALL')}
                        className="text-amber-500 hover:text-amber-800 ml-1 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                      <span>Cari: "{searchQuery}"</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-slate-500 hover:text-slate-800 ml-1 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {!filterAsnOnly && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-medium">
                      <span>Semua GTK (Termasuk Non-ASN)</span>
                      <button
                        type="button"
                        onClick={() => setFilterAsnOnly(true)}
                        className="text-purple-500 hover:text-purple-800 ml-1 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 ml-auto">
                  <span className="text-[11px] font-bold text-slate-600">
                    Ditemukan <span className="text-indigo-600 font-mono">{filteredRows.length}</span> data
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterNip('');
                      setFilterKeterangan('ALL');
                      setSearchQuery('');
                      setFilterAsnOnly(true);
                      setDateFilterMode('single');
                      setSelectedDate(todayDate);
                    }}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Filter</span>
                  </button>
                </div>
              </div>
            )}

        {/* Statistics Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              {stats.total}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-indigo-900">Total Guru</p>
              <p className="text-[10px] text-indigo-600">Terdaftar dalam tabel</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              {stats.bothSigned}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-emerald-900">TTD Lengkap</p>
              <p className="text-[10px] text-emerald-600">Masuk & Pulang</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
              {stats.signedCheckIn}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-teal-900">TTD Masuk</p>
              <p className="text-[10px] text-teal-600">{stats.signedCheckIn}/{stats.total} Guru</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              {stats.signedCheckOut}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-blue-900">TTD Pulang</p>
              <p className="text-[10px] text-blue-600">{stats.signedCheckOut}/{stats.total} Guru</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-50/70 border border-cyan-100 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold text-xs">
              {stats.countDinasLuar}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-cyan-900">Dinas Luar</p>
              <p className="text-[10px] text-cyan-600">Surat Tugas Resmi</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
              {stats.countTanpaKet}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-rose-900">Tanpa Keterangan</p>
              <p className="text-[10px] text-rose-600">Belum konfirmasi</p>
            </div>
          </div>
        </div>

        {/* Quick Helper Notice */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong className="text-slate-800">Petunjuk:</strong> Klik tombol{' '}
              <span className="text-indigo-600 font-bold">"Tanda Tangan"</span> pada kolom Masuk atau Pulang untuk membuka kanvas tanda tangan digital. Kompatibel penuh dengan Touchpad/Mouse Laptop & Layar Sentuh HP.
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSetAllHadir}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
            >
              Setel Semua Hadir
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Pagination & Progressive Load Status Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              Tabel Presensi Guru ASN
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
              {filteredRows.length.toLocaleString('id-ID')} Data
            </span>
            {isLoadingChunk && chunkProgress && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium animate-pulse border border-amber-200">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Memuat bertahap: {chunkProgress.loaded} / {chunkProgress.total} baris...
              </span>
            )}
            {!isLoadingChunk && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium border border-emerald-200">
                <Zap className="w-3 h-3 text-emerald-600" />
                Performa Stabil & Cepat ({pageSize} baris/hal)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Top Pagination Controls */}
            <div className="flex items-center gap-1 text-slate-600 text-xs">
              <span className="hidden sm:inline text-slate-500 text-[11px]">Halaman:</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 sm:px-2 sm:py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-800 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 sm:px-2 sm:py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-slate-500 text-[11px] hidden sm:inline">Per hal:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium text-xs cursor-pointer focus:outline-indigo-500"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1020px]">
            {/* Table Header: Structured Exactly as Requested with Sorting Support */}
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-extrabold uppercase tracking-wider">
                <th
                  rowSpan={2}
                  onClick={() => handleSort('no')}
                  className="py-3.5 px-3 text-center border-r border-slate-800 w-12 cursor-pointer hover:bg-slate-800 transition-colors select-none"
                  title="Klik untuk urutkan No."
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No.</span>
                    {sortField === 'no' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-50" />
                    )}
                  </div>
                </th>
                {dateFilterMode === 'range' && (
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('date')}
                    className="py-3.5 px-3 text-center border-r border-slate-800 w-28 bg-indigo-950 text-indigo-200 cursor-pointer hover:bg-indigo-900 transition-colors select-none"
                    title="Klik untuk urutkan Tanggal"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Tanggal</span>
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-indigo-400 opacity-50" />
                      )}
                    </div>
                  </th>
                )}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-4 border-r border-slate-800 min-w-[240px] cursor-pointer hover:bg-slate-800 transition-colors select-none"
                  title="Klik untuk urutkan Nama Guru"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Nama Guru & Pegawai / NIP</span>
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-50" />
                    )}
                  </div>
                </th>
                <th rowSpan={2} className="py-3.5 px-3 border-r border-slate-800 min-w-[170px]">
                  Pangkat / Golongan / Jabatan
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('status')}
                  className="py-3.5 px-3 text-center border-r border-slate-800 w-24 cursor-pointer hover:bg-slate-800 transition-colors select-none"
                  title="Klik untuk urutkan Status ASN"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status ASN</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-50" />
                    )}
                  </div>
                </th>
                {/* Kolom Tanda Tangan Terbagi Menjadi 2 Kolom: Masuk & Pulang */}
                <th
                  colSpan={2}
                  className="py-2.5 px-3 text-center border-r border-slate-800 bg-indigo-950/80 tracking-widest text-[11px]"
                >
                  TANDA TANGAN KEHADIRAN
                </th>
                {/* Kolom Durasi Kerja Total */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('duration')}
                  className="py-3.5 px-3 text-center border-r border-slate-800 min-w-[125px] bg-slate-900 text-emerald-300 cursor-pointer hover:bg-slate-800 transition-colors select-none"
                  title="Klik untuk urutkan Durasi Kerja"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>DURASI KERJA</span>
                    {sortField === 'duration' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-50" />
                    )}
                  </div>
                </th>
                {/* Kolom Terakhir: Keterangan */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('keterangan')}
                  className="py-3.5 px-4 text-center border-r border-slate-800 min-w-[190px] cursor-pointer hover:bg-slate-800 transition-colors select-none"
                  title="Klik untuk urutkan Keterangan"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>KETERANGAN</span>
                    {sortField === 'keterangan' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-50" />
                    )}
                  </div>
                </th>
                <th rowSpan={2} className="py-3.5 px-3 text-center w-24">
                  Aksi
                </th>
              </tr>
              <tr className="bg-slate-800 text-slate-200 text-[11px] font-bold">
                {/* Sub-kolom Tanda Tangan Absen Masuk */}
                <th className="py-2 px-3 text-center border-r border-slate-700 min-w-[180px] bg-slate-800/90 text-emerald-300">
                  1. Tanda Tangan Absen Masuk
                </th>
                {/* Sub-kolom Tanda Tangan Absen Pulang */}
                <th className="py-2 px-3 text-center border-r border-slate-700 min-w-[180px] bg-slate-800/90 text-indigo-300">
                  2. Tanda Tangan Absen Pulang
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={dateFilterMode === 'range' ? 10 : 9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-600">Tidak ada data guru yang cocok dengan filter</p>
                      <p className="text-[11px]">
                        Coba bersihkan kata kunci pencarian, ubah filter NIP/Status, atau aktifkan filter Semua GTK.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => (
                  <tr
                    key={dateFilterMode === 'range' ? `${row.teacherId}-${row.date || index}` : row.teacherId}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* No */}
                    <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-100">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>

                    {/* Tanggal (Only in Range Mode) */}
                    {dateFilterMode === 'range' && (
                      <td className="py-3 px-3 text-center border-r border-slate-100 whitespace-nowrap bg-indigo-50/20">
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 font-mono text-[11px] font-bold shadow-2xs">
                          {row.date ? formatDateIndo(row.date) : selectedDate}
                        </span>
                      </td>
                    )}

                    {/* Nama & NIP */}
                    <td className="py-3 px-4 border-r border-slate-100">
                      <div className="flex items-center space-x-3">
                        <img
                          src={
                            row.avatar ||
                            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80'
                          }
                          alt={row.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 truncate">
                            {row.name}
                          </p>
                          <p className="text-[10.5px] font-mono text-slate-500 mt-0.5">
                            NIP. {row.nip || '-'}
                          </p>
                          {row.nuptk && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              NUPTK: {row.nuptk}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Pangkat & Mapel */}
                    <td className="py-3 px-3 border-r border-slate-100">
                      <span className="font-bold text-slate-800 block">
                        {row.rankOrGrade || 'Guru Ahli'}
                      </span>
                      <span className="text-[10.5px] text-indigo-600 font-medium block truncate max-w-[180px]">
                        {row.roleOrSubject}
                      </span>
                    </td>

                    {/* Status ASN */}
                    <td className="py-3 px-3 text-center border-r border-slate-100">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          row.employmentStatus === 'PNS'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : row.employmentStatus === 'PPPK'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : row.employmentStatus === 'PPPK_PW'
                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {row.employmentStatus}
                      </span>
                    </td>

                    {/* SUB-KOLOM 1: Tanda Tangan Absen Masuk */}
                    <td className="py-2.5 px-3 border-r border-slate-100 bg-emerald-50/20">
                      {row.checkInSignature ? (
                        <div className="flex flex-col items-center space-y-1">
                          <div className="relative group/sig p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs w-full max-w-[140px] flex items-center justify-center">
                            <img
                              src={row.checkInSignature}
                              alt="TTD Masuk"
                              className="h-10 w-auto max-w-full object-contain"
                            />
                            {/* Overlay edit/delete */}
                            <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover/sig:opacity-100 transition-opacity flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveSignTarget({
                                    teacherId: row.teacherId,
                                    teacherName: row.name,
                                    nip: row.nip,
                                    sessionType: 'masuk',
                                    existingSignature: row.checkInSignature,
                                    targetDate: row.date,
                                  })
                                }
                                className="p-1 rounded-md bg-white text-indigo-600 hover:bg-indigo-50"
                                title="Ubah TTD Masuk"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveSignature(row.teacherId, 'masuk')
                                }
                                className="p-1 rounded-md bg-white text-rose-600 hover:bg-rose-50"
                                title="Hapus TTD"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 text-[10px] text-emerald-700 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>{row.checkInTime || '06:45 WITA'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSignTarget({
                                teacherId: row.teacherId,
                                teacherName: row.name,
                                nip: row.nip,
                                sessionType: 'masuk',
                                targetDate: row.date,
                              })
                            }
                            className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-[10.5px] flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs group-hover:scale-[1.02]"
                            title="Buka kanvas tanda tangan absen masuk (Mouse/Touchpad/Layar HP)"
                          >
                            <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                            <span>TTD Masuk</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFaceRecognition(row.teacherId, 'masuk')}
                            className="w-full py-1 px-2 bg-emerald-100/80 hover:bg-emerald-200 text-emerald-900 rounded-lg font-bold text-[10px] flex items-center justify-center space-x-1 transition-all cursor-pointer"
                            title="Presensi wajah biometrik ASN"
                          >
                            <ScanFace className="w-3 h-3 text-emerald-700" />
                            <span>Scan Wajah</span>
                          </button>
                          {row.checkInTime && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Waktu: {row.checkInTime}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* SUB-KOLOM 2: Tanda Tangan Absen Pulang */}
                    <td className="py-2.5 px-3 border-r border-slate-100 bg-indigo-50/20">
                      {row.checkOutSignature ? (
                        <div className="flex flex-col items-center space-y-1">
                          <div className="relative group/sig p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs w-full max-w-[140px] flex items-center justify-center">
                            <img
                              src={row.checkOutSignature}
                              alt="TTD Pulang"
                              className="h-10 w-auto max-w-full object-contain"
                            />
                            {/* Overlay edit/delete */}
                            <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover/sig:opacity-100 transition-opacity flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveSignTarget({
                                    teacherId: row.teacherId,
                                    teacherName: row.name,
                                    nip: row.nip,
                                    sessionType: 'pulang',
                                    existingSignature: row.checkOutSignature,
                                    targetDate: row.date,
                                  })
                                }
                                className="p-1 rounded-md bg-white text-indigo-600 hover:bg-indigo-50"
                                title="Ubah TTD Pulang"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveSignature(row.teacherId, 'pulang')
                                }
                                className="p-1 rounded-md bg-white text-rose-600 hover:bg-rose-50"
                                title="Hapus TTD"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 text-[10px] text-indigo-700 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>{row.checkOutTime || '14:15 WITA'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSignTarget({
                                teacherId: row.teacherId,
                                teacherName: row.name,
                                nip: row.nip,
                                sessionType: 'pulang',
                                targetDate: row.date,
                              })
                            }
                            className="w-full py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl font-bold text-[10.5px] flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs group-hover:scale-[1.02]"
                            title="Buka kanvas tanda tangan absen pulang (Mouse/Touchpad/Layar HP)"
                          >
                            <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                            <span>TTD Pulang</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFaceRecognition(row.teacherId, 'pulang')}
                            className="w-full py-1 px-2 bg-indigo-100/80 hover:bg-indigo-200 text-indigo-900 rounded-lg font-bold text-[10px] flex items-center justify-center space-x-1 transition-all cursor-pointer"
                            title="Presensi wajah biometrik ASN"
                          >
                            <ScanFace className="w-3 h-3 text-indigo-700" />
                            <span>Scan Wajah</span>
                          </button>
                          {row.checkOutTime && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Waktu: {row.checkOutTime}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* KOLOM: DURASI KERJA TOTAL */}
                    <td className="py-2.5 px-3 text-center border-r border-slate-100 bg-slate-50/40 whitespace-nowrap">
                      {row.totalWorkDuration && row.totalWorkDuration !== '-' ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <Clock className="w-3 h-3 mr-1 text-emerald-500 shrink-0" />
                            {row.totalWorkDuration}
                          </span>
                          <span className="text-[9.5px] text-slate-400 mt-0.5 font-medium">
                            Scan Masuk ↔ Pulang
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* KOLOM TERAKHIR: KETERANGAN (Izin, Sakit, Cuti, Dinas Luar, Tanpa Keterangan) */}
                    <td className="py-3 px-4 border-r border-slate-100 min-w-[190px]">
                      <div className="space-y-1.5">
                        {renderKeteranganBadge(row.keterangan, row.teacherId)}
                        {/* Note input if not hadir */}
                        {row.keterangan !== 'hadir' && (
                          <input
                            type="text"
                            placeholder="Catatan / No. Surat..."
                            value={row.notes || ''}
                            onChange={(e) => {
                              const updated = tableRows.map((r) =>
                                r.teacherId === row.teacherId
                                  ? { ...r, notes: e.target.value }
                                  : r
                              );
                              updateRowsAndSave(updated);
                            }}
                            className="w-full text-[10px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none"
                          />
                        )}
                      </div>
                    </td>

                    {/* Aksi Baris */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenFaceRecognition(row.teacherId, row.checkInSignature ? 'pulang' : 'masuk')}
                          className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 transition-colors"
                          title="Presensi Wajah Biometrik AI"
                        >
                          <ScanFace className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Quick toggle sign both
                            setActiveSignTarget({
                              teacherId: row.teacherId,
                              teacherName: row.name,
                              nip: row.nip,
                              sessionType: row.checkInSignature ? 'pulang' : 'masuk',
                              existingSignature: row.checkInSignature ? row.checkOutSignature : row.checkInSignature,
                              targetDate: row.date,
                            });
                          }}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                          title="Buka Tanda Tangan"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary & Advanced Responsive Pagination inside table card */}
        <div className="p-4 bg-slate-50/90 border-t border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-center lg:text-left">
            <span>
              Menampilkan{' '}
              <strong className="text-slate-900 font-mono">
                {filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </strong>
              -
              <strong className="text-slate-900 font-mono">
                {Math.min(currentPage * pageSize, filteredRows.length)}
              </strong>{' '}
              dari <strong className="text-indigo-700 font-mono">{filteredRows.length.toLocaleString('id-ID')}</strong> entri
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              ✓ {stats.signedCheckIn} TTD Masuk
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-indigo-700 font-bold flex items-center gap-1">
              ✓ {stats.signedCheckOut} TTD Pulang
            </span>
          </div>

          {/* Pagination Controls */}
          {filteredRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px] whitespace-nowrap">Baris/hal:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer shadow-2xs focus:ring-1 focus:ring-indigo-500 text-xs"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              {/* Jump to Page Form */}
              <form onSubmit={handleApplyJump} className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px] whitespace-nowrap">Lompat:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPageInput}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onBlur={handleApplyJump}
                  className="w-12 px-1.5 py-1 text-center bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs shadow-2xs focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-bold cursor-pointer"
                >
                  Ke
                </button>
              </form>

              {/* Page Navigation Buttons */}
              <div className="flex items-center gap-1">
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer transition-colors shadow-2xs"
                  title="Halaman Pertama (1)"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer transition-colors shadow-2xs"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Numbered Page Buttons Window */}
                <div className="hidden sm:flex items-center gap-1">
                  {getPageNumbers().map((p, idx) => {
                    if (typeof p === 'string') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-mono">
                          …
                        </span>
                      );
                    }
                    const isActive = p === currentPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-7 h-7 px-2 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs scale-105'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Current Page Indicator */}
                <span className="sm:hidden px-2 py-1 font-bold text-slate-800 font-mono text-xs">
                  {currentPage}/{totalPages}
                </span>

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer transition-colors shadow-2xs"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium cursor-pointer transition-colors shadow-2xs"
                  title={`Halaman Terakhir (${totalPages})`}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <Laptop className="w-3.5 h-3.5 text-indigo-500" />
            <span>Laptop</span>
            <span>•</span>
            <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
            <span>HP / Tablet</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          LAMPIRAN DOKUMENTASI APEL HARIAN DI BAWAH TABEL ABSENSI
          (APEL PAGI & APEL SIANG - BUKAN APEL SORE) DIJADIKAN 1 BERKAS RESMI
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Lampiran Dokumentasi Apel Harian ASN (Apel Pagi & Apel Siang)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                  Bukan Apel Sore
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  1 File Terpadu dengan Tabel Presensi & TTD
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bukti sah kehadiran ASN berupa foto apel berstempel GPS koordinat presisi dan waktu WITA. Lampiran ini otomatis menjadi bukti fisik di bawah tabel absensi yang dikirim ke BKD Kab. Pulau Taliabu.
              </p>
            </div>
          </div>

          {/* Quick Actions for Apel */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleGenerateSampleApel('apel_pagi');
                handleGenerateSampleApel('apel_siang');
              }}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Muat sampel foto apel berstempel GPS otomatis untuk Apel Pagi dan Apel Siang"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Muat Sampel Foto Apel</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('apel_doc')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Buka studio kamera & unggah berkas penuh"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>Kelola Kamera / Upload Penuh</span>
            </button>
          </div>
        </div>

        {/* 2 Kolom Dokumentasi Apel: Apel Pagi & Apel Siang */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CARD APEL PAGI */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  🌅
                </span>
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                    1. Dokumentasi Apel Pagi (07:15 WITA)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pelaksanaan pagi sebelum jam belajar mengajar
                  </p>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  apelDocumentation.apelPagi
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {apelDocumentation.apelPagi ? '✓ Foto Sah Terverifikasi' : 'Belum Terunggah'}
              </span>
            </div>

            {/* Display Photo or Empty state */}
            {apelDocumentation.apelPagi?.photoUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-950 aspect-4/3 flex items-center justify-center group shadow-xs">
                  <img
                    src={apelDocumentation.apelPagi.photoUrl}
                    alt="Foto Apel Pagi"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{apelDocumentation.apelPagi.time || '07:15'} WITA</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pembina Apel:</span>
                    <strong className="text-slate-800">
                      {apelDocumentation.apelPagi.leaderName || config.principalName || 'Kepala Sekolah'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Jumlah Peserta ASN:</span>
                    <strong className="text-slate-800">
                      {apelDocumentation.apelPagi.totalParticipants || tableRows.length} Orang
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Titik Koordinat:</span>
                    <span className="font-mono text-indigo-700 font-bold">
                      Lat {apelDocumentation.apelPagi.location?.latitude || config?.schoolLat || -1.8412}°, Lng {apelDocumentation.apelPagi.location?.longitude || config?.schoolLng || 124.482}°
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex items-start space-x-1 text-[10.5px]">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-slate-700 line-clamp-1">
                      {apelDocumentation.apelPagi.location?.addressFormatted || config?.address || 'Desa Pancoran, Kec. Taliabu Barat'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateSampleApel('apel_pagi')}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Perbarui Sampel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...apelDocumentation, apelPagi: null };
                      handleUpdateApelDocumentation(updated);
                      triggerToast('Foto Apel Pagi berhasil dihapus');
                    }}
                    className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-800">
                    Foto Apel Pagi Belum Dilampirkan
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                    Lampirkan foto apel pagi bersama guru-guru ASN sebelum berkas dikirim ke BKD.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('apel_doc')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Buka Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateSampleApel('apel_pagi')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Buat Sampel</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CARD APEL SIANG (BUKAN APEL SORE) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  ☀️
                </span>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      2. Dokumentasi Apel Siang (14:00 WITA)
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800">
                      Bukan Apel Sore
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pelaksanaan apel siang saat jam pulang kantor/sekolah
                  </p>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  apelDocumentation.apelSiang
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {apelDocumentation.apelSiang ? '✓ Foto Sah Terverifikasi' : 'Belum Terunggah'}
              </span>
            </div>

            {/* Display Photo or Empty state */}
            {apelDocumentation.apelSiang?.photoUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-950 aspect-4/3 flex items-center justify-center group shadow-xs">
                  <img
                    src={apelDocumentation.apelSiang.photoUrl}
                    alt="Foto Apel Siang"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    <span>{apelDocumentation.apelSiang.time || '14:00'} WITA</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pembina Apel:</span>
                    <strong className="text-slate-800">
                      {apelDocumentation.apelSiang.leaderName || config.principalName || 'Kepala Sekolah'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Jumlah Peserta ASN:</span>
                    <strong className="text-slate-800">
                      {apelDocumentation.apelSiang.totalParticipants || tableRows.length} Orang
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Titik Koordinat:</span>
                    <span className="font-mono text-indigo-700 font-bold">
                      Lat {apelDocumentation.apelSiang.location?.latitude || config?.schoolLat || -1.8412}°, Lng {apelDocumentation.apelSiang.location?.longitude || config?.schoolLng || 124.482}°
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex items-start space-x-1 text-[10.5px]">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-slate-700 line-clamp-1">
                      {apelDocumentation.apelSiang.location?.addressFormatted || config?.address || 'Desa Pancoran, Kec. Taliabu Barat'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateSampleApel('apel_siang')}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Perbarui Sampel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...apelDocumentation, apelSiang: null };
                      handleUpdateApelDocumentation(updated);
                      triggerToast('Foto Apel Siang berhasil dihapus');
                    }}
                    className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-800">
                    Foto Apel Siang Belum Dilampirkan
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                    Lampirkan foto apel siang (bukan apel sore) saat jam pulang dinas ASN.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('apel_doc')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Buka Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateSampleApel('apel_siang')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Buat Sampel</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unified Dispatch & Export Bar at Bottom */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div>
            <h4 className="text-xs font-extrabold flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Pengiriman Bukti Presensi ASN Terpadu (1 File Utuh)</span>
            </h4>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Tabel presensi, tanda tangan digital, dan lampiran foto apel pagi/siang otomatis digabung menjadi 1 berkas pengiriman resmi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenFaceRecognition()}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
              title="Buka pengenalan wajah biometrik ASN"
            >
              <ScanFace className="w-4 h-4 text-emerald-200" />
              <span>Presensi Wajah</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdfSignedManual}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
              title="Unduh 1 file PDF lengkap berisi tabel, TTD, dan lampiran foto apel"
            >
              <FileText className="w-4 h-4 text-rose-200" />
              <span>Unduh 1 PDF Resmi</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Cetak 1 berkas terpadu"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Cetak 1 Berkas Terpadu</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBkdDispatchModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
              title="Kirim bukti presensi dan apel ke BKD Taliabu via WhatsApp, G-Drive & Email"
            >
              <Send className="w-4 h-4 text-slate-900" />
              <span>Kirim ke BKD (WA/Drive)</span>
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Modal Tanda Tangan Digital */}
      {activeSignTarget && (
        <DigitalSignatureModal
          isOpen={!!activeSignTarget}
          onClose={() => setActiveSignTarget(null)}
          teacherName={activeSignTarget.teacherName}
          nip={activeSignTarget.nip}
          sessionType={activeSignTarget.sessionType}
          dateStr={formatDateIndo(selectedDate)}
          existingSignature={activeSignTarget.existingSignature}
          onSaveSignature={handleSaveSignature}
        />
      )}

      {/* Modal Log Audit Riwayat Perubahan Tanda Tangan */}
      <SignatureAuditLogsModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
        onVerifyLog={handleVerifyAuditLog}
        onClearLogs={handleClearAuditLogs}
        adminName={config.adminName || 'Admin SIMPEG BKD'}
      />

      {/* MODAL PRINT PREVIEW RESMI (KOP SURAT PEMDA PULAU TALIABU) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Modal Print Header Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Pratinjau Format Cetak Dokumen Absensi Guru ASN
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Dokumen Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-white print:p-0">
              <div className="border border-slate-300 p-6 sm:p-8 rounded-xl shadow-xs print:border-none print:p-0 print:shadow-none">
                {/* KOP SURAT RESMI */}
                <div className="border-b-4 border-double border-slate-900 pb-3 mb-5 text-center">
                  <h4 className="text-xs sm:text-sm font-bold tracking-widest text-slate-700 uppercase">
                    Pemerintah Kabupaten Pulau Taliabu
                  </h4>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase">
                    Dinas Pendidikan dan Kebudayaan
                  </h3>
                  <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight mt-0.5">
                    {config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT'}
                  </h2>
                  <p className="text-[10.5px] text-slate-600 mt-1">
                    {config.address || 'Desa Pancoran, Kec. Taliabu Barat, Kab. Pulau Taliabu, Maluku Utara'} • NPSN: {config.npsn || '69904123'}
                  </p>
                </div>

                {/* Judul Dokumen */}
                <div className="text-center mb-5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase underline decoration-2">
                    DAFTAR HADIR / ABSENSI GURU & GTK ASN
                  </h3>
                  <p className="text-xs text-slate-700 font-semibold mt-1">
                    Hari / Tanggal: {formatDateIndo(selectedDate)}
                  </p>
                </div>

                {/* Printable Table */}
                <table className="w-full border-collapse border border-slate-800 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-black">
                      <th rowSpan={2} className="border border-slate-800 p-2 text-center w-8">
                        No.
                      </th>
                      <th rowSpan={2} className="border border-slate-800 p-2 text-left">
                        Nama Lengkap & NIP
                      </th>
                      <th rowSpan={2} className="border border-slate-800 p-2 text-left">
                        Pangkat / Gol. / Mapel
                      </th>
                      <th rowSpan={2} className="border border-slate-800 p-2 text-center w-16">
                        Status
                      </th>
                      <th colSpan={2} className="border border-slate-800 p-1.5 text-center">
                        TANDA TANGAN KEHADIRAN
                      </th>
                      <th rowSpan={2} className="border border-slate-800 p-2 text-center w-36">
                        KETERANGAN
                      </th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-900 font-bold text-[10px]">
                      <th className="border border-slate-800 p-1 text-center w-32">
                        Absen Masuk
                      </th>
                      <th className="border border-slate-800 p-1 text-center w-32">
                        Absen Pulang
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => (
                      <tr key={r.teacherId} className="border-b border-slate-800">
                        <td className="border border-slate-800 p-2 text-center font-bold">
                          {i + 1}
                        </td>
                        <td className="border border-slate-800 p-2 font-bold text-slate-950">
                          {r.name}
                          <div className="text-[9.5px] font-mono font-normal text-slate-600">
                            NIP. {r.nip}
                          </div>
                        </td>
                        <td className="border border-slate-800 p-2">
                          <div className="font-semibold">{r.rankOrGrade}</div>
                          <div className="text-[10px] text-slate-600">{r.roleOrSubject}</div>
                        </td>
                        <td className="border border-slate-800 p-2 text-center font-bold">
                          {r.employmentStatus}
                        </td>
                        {/* TTD Masuk */}
                        <td className="border border-slate-800 p-1 text-center">
                          {r.checkInSignature ? (
                            <div className="flex flex-col items-center">
                              <img
                                src={r.checkInSignature}
                                alt="TTD"
                                className="h-8 w-auto max-w-full object-contain"
                              />
                              <span className="text-[8.5px] text-slate-500 mt-0.5">
                                {r.checkInTime || '06:45'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9.5px] text-slate-400 italic">
                              Belum TTD
                            </span>
                          )}
                        </td>
                        {/* TTD Pulang */}
                        <td className="border border-slate-800 p-1 text-center">
                          {r.checkOutSignature ? (
                            <div className="flex flex-col items-center">
                              <img
                                src={r.checkOutSignature}
                                alt="TTD"
                                className="h-8 w-auto max-w-full object-contain"
                              />
                              <span className="text-[8.5px] text-slate-500 mt-0.5">
                                {r.checkOutTime || '14:15'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9.5px] text-slate-400 italic">
                              Belum TTD
                            </span>
                          )}
                        </td>
                        {/* Keterangan */}
                        <td className="border border-slate-800 p-2 text-center font-bold">
                          <span
                            className={
                              r.keterangan === 'hadir'
                                ? 'text-emerald-700'
                                : r.keterangan === 'dinas_luar'
                                ? 'text-cyan-700'
                                : r.keterangan === 'cuti'
                                ? 'text-purple-700'
                                : r.keterangan === 'sakit'
                                ? 'text-amber-700'
                                : r.keterangan === 'izin'
                                ? 'text-indigo-700'
                                : 'text-rose-700'
                            }
                          >
                            {r.keterangan.toUpperCase().replace('_', ' ')}
                          </span>
                          {r.notes && (
                            <div className="text-[9px] font-normal text-slate-500 italic mt-0.5">
                              {r.notes}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Kolom Tanda Tangan Pengesahan Kepala Sekolah */}
                <div className="mt-8 pt-4 flex justify-between items-start text-xs">
                  <div>
                    <p className="font-bold text-slate-800">Keterangan Ringkasan:</p>
                    <p className="text-[10.5px] text-slate-600 mt-1">
                      • Hadir: {stats.countHadir} | Izin: {stats.countIzin} | Sakit: {stats.countSakit}
                    </p>
                    <p className="text-[10.5px] text-slate-600">
                      • Cuti: {stats.countCuti} | Dinas Luar: {stats.countDinasLuar} | Tanpa Keterangan: {stats.countTanpaKet}
                    </p>
                  </div>

                  <div className="text-center min-w-[220px]">
                    <p className="text-slate-700">
                      Bobong, {formatDateIndo(selectedDate)}
                    </p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      Mengetahui,
                    </p>
                    <p className="font-bold text-slate-900">
                      Kepala SMP Negeri 4 Satu Atap Taliabu Barat
                    </p>
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-[10px] text-slate-400 italic">
                        (Tanda Tangan & Cap Sekolah)
                      </span>
                    </div>
                    <p className="font-black text-slate-950 underline text-xs">
                      {config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.'}
                    </p>
                    <p className="text-[10px] font-mono text-slate-700">
                      NIP. {config.principalNip || '197305141999031004'}
                    </p>
                  </div>
                </div>

                {/* =========================================================================
                    LAMPIRAN DOKUMENTASI APEL HARIAN ASN (PAGI & SIANG - BUKAN APEL SORE)
                    DI BAWAH TABEL ABSENSI (1 FILE TERPADU DENGAN TABEL & TTD)
                   ========================================================================= */}
                <div className="mt-10 pt-6 border-t-2 border-dashed border-slate-400">
                  <div className="text-center mb-6">
                    <h4 className="font-black text-sm uppercase tracking-wider text-slate-900">
                      LAMPIRAN BUKTI DOKUMENTASI APEL HARIAN PEGAWAI / GTK ASN
                    </h4>
                    <p className="font-extrabold text-xs text-indigo-950 uppercase mt-0.5">
                      (DOKUMENTASI APEL PAGI & APEL SIANG - BUKAN APEL SORE)
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Lampiran Pengiriman Bukti Presensi Harian ASN Terpadu • {config.schoolName || 'SMP Negeri 4 Satu Atap Taliabu Barat'} • Tanggal: {formatDateIndo(selectedDate)}
                    </p>
                  </div>

                  {/* Grid 2 Kolom Foto Apel Pagi & Apel Siang */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Box Apel Pagi */}
                    <div className="border border-slate-400 rounded-xl p-3 flex flex-col bg-slate-50/50">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300 text-xs">
                        <span className="font-bold text-slate-900">1. DOKUMENTASI APEL PAGI (07:15 WITA)</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {apelDocumentation.apelPagi ? '✓ Terverifikasi GPS' : 'Belum Ada Foto'}
                        </span>
                      </div>
                      {apelDocumentation.apelPagi?.photoUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-black aspect-4/3 flex items-center justify-center">
                          <img
                            src={apelDocumentation.apelPagi.photoUrl}
                            alt="Dokumentasi Apel Pagi"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white aspect-4/3 flex flex-col items-center justify-center p-4 text-center text-slate-400">
                          <Camera className="w-8 h-8 mb-1 opacity-50" />
                          <span className="text-xs font-semibold">Foto Apel Pagi Belum Dilampirkan</span>
                        </div>
                      )}
                      <div className="mt-2.5 text-[10px] text-slate-700 space-y-0.5">
                        <p><strong>Waktu Apel:</strong> {apelDocumentation.apelPagi?.time || '07:15'} WITA</p>
                        <p><strong>Pembina Apel:</strong> {apelDocumentation.apelPagi?.leaderName || config.principalName || 'Kepala Sekolah'}</p>
                        <p><strong>Jumlah Peserta:</strong> {apelDocumentation.apelPagi?.totalParticipants || stats.countHadir} Orang Pegawai ASN</p>
                        <p><strong>Titik Koordinat:</strong> Lat {apelDocumentation.apelPagi?.location?.latitude || config?.schoolLat || -1.8412}°, Lng {apelDocumentation.apelPagi?.location?.longitude || config?.schoolLng || 124.482}°</p>
                        <p className="truncate"><strong>Lokasi GPS:</strong> {apelDocumentation.apelPagi?.location?.addressFormatted || config?.address || 'Desa Pancoran, Taliabu Barat'}</p>
                      </div>
                    </div>

                    {/* Box Apel Siang */}
                    <div className="border border-slate-400 rounded-xl p-3 flex flex-col bg-slate-50/50">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300 text-xs">
                        <span className="font-bold text-slate-900">2. DOKUMENTASI APEL SIANG (14:00 WITA)</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                          {apelDocumentation.apelSiang ? '✓ Terverifikasi GPS' : 'Belum Ada Foto'}
                        </span>
                      </div>
                      {apelDocumentation.apelSiang?.photoUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-black aspect-4/3 flex items-center justify-center">
                          <img
                            src={apelDocumentation.apelSiang.photoUrl}
                            alt="Dokumentasi Apel Siang"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white aspect-4/3 flex flex-col items-center justify-center p-4 text-center text-slate-400">
                          <Camera className="w-8 h-8 mb-1 opacity-50" />
                          <span className="text-xs font-semibold">Foto Apel Siang Belum Dilampirkan</span>
                        </div>
                      )}
                      <div className="mt-2.5 text-[10px] text-slate-700 space-y-0.5">
                        <p><strong>Waktu Apel:</strong> {apelDocumentation.apelSiang?.time || '14:00'} WITA (Bukan Sore)</p>
                        <p><strong>Pembina Apel:</strong> {apelDocumentation.apelSiang?.leaderName || config?.principalName || 'Kepala Sekolah'}</p>
                        <p><strong>Jumlah Peserta:</strong> {apelDocumentation.apelSiang?.totalParticipants || stats.countHadir} Orang Pegawai ASN</p>
                        <p><strong>Titik Koordinat:</strong> Lat {apelDocumentation.apelSiang?.location?.latitude || config?.schoolLat || -1.8412}°, Lng {apelDocumentation.apelSiang?.location?.longitude || config?.schoolLng || 124.482}°</p>
                        <p className="truncate"><strong>Lokasi GPS:</strong> {apelDocumentation.apelSiang?.location?.addressFormatted || config?.address || 'Desa Pancoran, Taliabu Barat'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[10.5px] text-slate-500 italic">
                    Dokumen ini merupakan satu kesatuan berkas lampiran absensi resmi yang diverifikasi dengan stempel waktu WITA dan titik koordinat GPS Kabupaten Pulau Taliabu.
                  </div>
                </div>
              </div>
            </div>

            {/* Print Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup Pratinjau
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan ke PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Kirim ke BKD Taliabu (WhatsApp, Drive, Email) */}
      <BkdDispatchModal
        isOpen={isBkdDispatchModalOpen}
        onClose={() => setIsBkdDispatchModalOpen(false)}
        tableRows={filteredRows}
        config={config}
        selectedDate={selectedDate}
        apelDocumentation={apelDocumentation}
        stats={{
          ...stats,
          countIzinSakit: (stats.countIzin || 0) + (stats.countSakit || 0),
        }}
      />

      {/* Modal Pengenalan Wajah Biometrik ASN */}
      <BiometricFaceRecognitionModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        teachers={teachers}
        config={config}
        selectedDate={selectedDate}
        initialTeacherId={faceModalTeacherId || undefined}
        initialSession={faceModalSession}
        onSuccess={handleFaceRecognitionSuccess}
      />
    </div>
  );
};
