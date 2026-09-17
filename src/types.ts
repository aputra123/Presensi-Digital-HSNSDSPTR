export type UserRole = 'admin' | 'guru' | 'piket' | 'siswa';

export interface UserAccount {
  id: string;
  username: string; // unik, huruf kecil/angka/titik/strip, e.g. "guru.budi", "piket1", "0081234567"
  name: string; // nama lengkap tampilan
  role: UserRole; // 'admin' | 'guru' | 'piket' | 'siswa'
  passwordHash: string; // SHA-256 hash
  salt: string;
  rawPasswordHint?: string; // Petunjuk sandi untuk cetak kartu/slip akun oleh admin
  personId?: string; // Terhubung ke Teacher.id atau Student.id
  identifier?: string; // NIP/NUPTK untuk guru, NISN untuk siswa
  classOrSubject?: string; // Rombel / Mapel
  email?: string; // Email terdaftar untuk verifikasi dan reset kata sandi
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword?: boolean;
}

export interface AdminAccount {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isDefault?: boolean;
  mustChangePassword?: boolean;
}

export interface AuthClaims {
  sub: string;
  role: UserRole;
  accountId?: string;
  username?: string;
  personId?: string;
  personName?: string;
  identifier?: string;
  classOrSubject?: string;
  permissions: string[];
  canAccessAdminViews: boolean;
  canManageConfig: boolean;
  canManagePersonnel: boolean;
  canApproveLeaves: boolean;
  canDeleteRecords: boolean;
  canExportBkd: boolean;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface TokenSession {
  token: string;
  claims: AuthClaims;
  displayName: string;
  account?: UserAccount;
}

export type EmploymentStatus = 'PNS' | 'PPPK' | 'PPPK_PW' | 'HONORER' | 'GTT_PTT';

export type AttendanceStatus = 'hadir' | 'terlambat' | 'sakit' | 'izin' | 'alpa';

export type AttendanceType = 'masuk' | 'pulang';

export type AttendanceMethod = 'qrcode' | 'selfie_gps' | 'manual' | 'rfid' | 'webauthn_biometric' | 'face_recognition' | 'digital_signature';

export interface Student {
  id: string;
  nisn: string;
  nik?: string;
  name: string;
  classId: string;
  className: string;
  gender: 'L' | 'P';
  avatar: string;
  email: string;
  parentPhone: string;
  address?: string;
}

export interface Teacher {
  id: string;
  nip: string;
  nuptk?: string;
  name: string;
  employmentStatus: EmploymentStatus;
  subject: string;
  role: string;
  gender: 'L' | 'P';
  avatar: string;
  phone: string;
  email: string;
  department?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: '7' | '8' | '9' | '10' | '11' | '12' | string;
  major?: string;
  homeroomTeacher?: string;
  homeroomTeacherId?: string;
  totalStudents?: number;
  roomName?: string;
  academicYear?: string;
}

export interface AttendanceLocation {
  lat: number;
  lng: number;
  address: string;
  inRadius: boolean;
  distanceMeter: number;
  latitude?: number;
  longitude?: number;
}

export interface AttendanceRecord {
  id: string;
  personId: string;
  personType: 'student' | 'teacher';
  personName: string;
  identifier: string; // NISN or NIP
  classOrSubject: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  type: AttendanceType;
  status: AttendanceStatus;
  method: AttendanceMethod;
  note?: string;
  photoUrl?: string;
  signatureDataUrl?: string;
  location?: AttendanceLocation;
  employmentStatus?: EmploymentStatus;
}

export interface LeaveRequest {
  id: string;
  personId: string;
  personType: 'student' | 'teacher';
  personName: string;
  classOrSubject: string;
  type: 'sakit' | 'izin' | 'dispensasi';
  startDate: string;
  endDate: string;
  reason: string;
  documentName?: string;
  documentUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  createdAt: string;
  reviewNote?: string;
  approvedBy?: string;
  approvedAt?: string;
  returnedBy?: string;
  rejectedBy?: string;
  returnReason?: string;
}

// Layanan & Perizinan Khusus Guru / GTK dengan Persetujuan Ganda (Kepala Sekolah & Admin)
export type GtkServiceCategory = 
  | 'izin_cuti'            // Cuti Sakit / Cuti Tahunan / Alasan Penting
  | 'surat_tugas'          // Surat Tugas Dinas Luar / MGMP / Workshop / Bimtek
  | 'rekomendasi_akademik' // Rekomendasi PPG / Beasiswa / Studi Lanjut
  | 'tukar_jadwal'         // Dispensasi / Tukar Jadwal Piket & Jam Mengajar
  | 'keterangan_aktif';    // Surat Keterangan Aktif Mengajar

export interface GtkApprovalDetail {
  approvedBy: string; // Nama Pejabat / Admin
  role: 'kepala_sekolah' | 'admin';
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  timestamp?: string;
  signatureStamp?: string; // Tanda Tangan / Stempel Digital
  note?: string;
}

export interface GtkServiceRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  nip: string;
  employmentStatus: EmploymentStatus;
  category: GtkServiceCategory;
  title: string;
  purpose: string;
  startDate: string;
  endDate: string;
  destinationOrLocation?: string; // Lokasi tugas dinas / instansi tujuan
  attachmentName?: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved_by_kepsek' | 'approved_by_admin' | 'approved' | 'rejected' | 'returned';
  kepsekApproval: GtkApprovalDetail;
  adminApproval: GtkApprovalDetail;
  createdAt: string;
  officialLetterNumber?: string; // e.g. "421.3/088/SMAN1-DISDIK/2026"
  returnReason?: string;
  rejectionReason?: string;
  returnedBy?: string;
  rejectedBy?: string;
}

export interface AcademicEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  type: 'holiday' | 'academic' | 'exam' | 'meeting' | 'ceremony';
  description: string;
  isHoliday: boolean;
  color?: string;
}

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'leave_request' | 'attendance' | 'system' | 'gtk_service' | ToastSeverity;
  severity?: ToastSeverity;
  duration?: number; // duration in milliseconds before auto-dismiss (default: 4000)
  timestamp: string;
  leaveId?: string;
  serviceId?: string;
  read: boolean;
}

export type BrandColor = 'indigo' | 'blue' | 'emerald' | 'teal' | 'violet' | 'amber' | 'rose' | 'slate';

export interface SchoolConfig {
  schoolName: string;
  npsn: string;
  logoUrl?: string; // Logo Sekolah Custom / Presets
  appIconUrl?: string; // Icon Aplikasi Cross-OS (Android, iOS, macOS, Windows PWA/Web)
  address: string;
  academicYear: string;
  semester: string;
  checkInStart: string; // e.g. "06:15"
  checkInDeadline: string; // e.g. "07:15"
  checkOutStart: string; // e.g. "14:30"
  schoolLat: number;
  schoolLng: number;
  maxRadiusMeters: number;
  geofenceRadius?: number; // Alias for maxRadiusMeters
  bkdEmail?: string;
  bkdWhatsApp?: string;
  bkdWhatsAppNumber?: string; // Nomor WA BKD Khusus ASN
  bkdGoogleDriveLink?: string; // Link Google Drive BKD Khusus ASN
  principalName?: string;
  principalNip?: string;
  adminName?: string;
  brandColor?: BrandColor;
  weeklyAttendanceGoal?: number; // e.g. 95%
  isEmergencyLockdown?: boolean; // When true, manual attendance input is suspended
  autoSendDaily15Wita?: boolean; // Kirim otomatis setiap hari jam 15:00 WITA
  autoSendSaturdayWeekly15Wita?: boolean; // Kirim otomatis setiap Sabtu jam 15:00 WITA
  autoSendMonthly3031?: boolean; // Kirim otomatis setiap tanggal 30 & 31 akhir bulan
  autoSendSemester?: boolean; // Kirim otomatis setiap 1 semester
  autoSendAnnual?: boolean; // Kirim otomatis setiap akhir tahun
  enableFaceRecognitionMode?: boolean; // Toggle Real-time Facial Feature Detection on Webcam (Face Recognition Mode)
  biometricLivenessThreshold?: number; // Biometric Liveness Threshold (0.0 to 1.0)
  googleMapId?: string; // Google Maps Map ID for Advanced Markers & Cloud styling (defaults to DEMO_MAP_ID)
  gtkLetterNumberFormat?: string; // Format penomoran otomatis surat layanan GTK e.g. "421.3/{NO}/SMPN4-TB/DISDIK/{BULAN_ROMAWI}/{TAHUN}"
  gtkLetterNumberCounter?: number; // Nomor urut surat GTK berjalan
  gtkClassificationCode?: string; // Kode klasifikasi instansi e.g. "421.3"
  googleDriveFolderId?: string; // ID / Nama folder Google Drive sekolah untuk arsip presensi
  googleDriveFolderName?: string; // Nama folder Google Drive arsip
}

export type BiometricSeverity = 'info' | 'warning' | 'error';

export interface BiometricLog {
  id: string;
  recordId?: string;
  timestamp: string;
  date: string;
  time: string;
  personId: string;
  personName: string;
  personType: 'student' | 'teacher';
  identifier?: string;
  type: AttendanceType;
  status: 'success' | 'failed';
  severity?: BiometricSeverity;
  method: 'face_scan' | 'webauthn_fingerprint';
  matchScore: number;
  livenessScore?: number;
  anomalyFlags?: string[];
  cameraFacing: 'user' | 'environment';
  photoUrl?: string;
  ipAddress?: string;
  deviceInfo?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
    distanceMeter?: number;
    inRadius?: boolean;
  };
  notes?: string;
}

export interface TeacherPiketDuty {
  id: string;
  dayOfWeek?: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | string;
  day?: string;
  date?: string;
  teacherId: string;
  teacherName: string;
  nip?: string;
  role?: string;
  shift?: string;
  location?: string;
  status?: 'scheduled' | 'active' | 'completed';
  notes?: string;
  note?: string;
}

export type ActivityLogCategory =
  | 'attendance'
  | 'gtk_service'
  | 'leave'
  | 'master_data'
  | 'config'
  | 'workspace'
  | 'auth'
  | 'biometric'
  | 'security'
  | 'system';

export interface CameraDebugMetadata {
  browserName: string;
  browserVersion: string;
  userAgent: string;
  screenResolution: string; // e.g. "1920x1080 (DPR 2)"
  viewportSize: string; // e.g. "390x844"
  os: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  permissionStatus?: string; // 'granted' | 'denied' | 'prompt' | 'unknown'
  cameraFacingMode?: string;
  blackScreenDetected?: boolean;
  attemptNumber?: number;
  hardwareDevicesCount?: number;
  mediaDevicesAvailable?: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  category: ActivityLogCategory;
  actor: {
    name: string;
    role: string;
    email?: string;
  };
  action: string;
  description: string;
  targetId?: string;
  targetName?: string;
  status: 'success' | 'warning' | 'info' | 'error';
  deviceInfo?: string;
  prevValue?: Record<string, any> | string; // Nilai sebelum perubahan untuk audit trail akurat
  newValue?: Record<string, any> | string; // Nilai sesudah perubahan
  changedFields?: string[]; // Daftar field yang mengalami modifikasi
  debugMetadata?: CameraDebugMetadata | Record<string, any>;
}

export interface AppBackupData {
  id: string;
  timestamp: string;
  createdDate: string;
  createdTime: string;
  source: string;
  totalRecords: number;
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalLeaves: number;
  totalGtkServices: number;
  records: AttendanceRecord[];
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  leaves: LeaveRequest[];
  gtkServices: GtkServiceRequest[];
  events: AcademicEvent[];
  config: SchoolConfig;
  piketDuties?: TeacherPiketDuty[];
  biometricLogs?: BiometricLog[];
  activityLogs?: ActivityLog[];
}

export interface BackupSummary {
  id: string;
  timestamp: string;
  createdDate: string;
  totalRecords: number;
  totalStudents: number;
  totalTeachers: number;
  totalGtkServices: number;
  source: string;
}

export interface GoogleSheetsImportResult {
  success: boolean;
  message: string;
  importedStudentsCount?: number;
  importedTeachersCount?: number;
  students?: Student[];
  teachers?: Teacher[];
  details?: string;
}

export interface SyncQueueItem {
  id: string;
  record: AttendanceRecord;
  queuedAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastAttempt?: string;
  error?: string;
}

export interface BkdScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'daily_15wita' | 'saturday_weekly_15wita' | 'monthly_30_31' | 'semester' | 'annual';
  time: string; // e.g. "15:00"
  targetEmail: string;
  targetWhatsApp?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  driveFolderUrl?: string;
  includeTeachersOnly: boolean;
  autoValidateSimpeg: boolean;
  autoSendDaily15Wita?: boolean;
  autoSendSaturdayWeekly15Wita?: boolean;
  autoSendMonthly3031?: boolean;
  autoSendSemester?: boolean;
  autoSendAnnual?: boolean;
  lastDispatchTime?: string;
  nextDispatchTime?: string;
}

export interface BkdDispatchLog {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  recordsCount: number;
  targetEmail: string;
  targetWhatsApp?: string;
  driveDestination: string;
  status: 'success' | 'failed' | 'pending';
  fileHash: string;
  summary: string;
  dispatchType?: 'manual' | 'auto_daily_15wita' | 'auto_saturday_weekly_15wita' | 'auto_monthly_3031' | 'auto_semester' | 'auto_annual';
}

export interface HeartbeatState {
  isOnline: boolean;
  latencyMs: number;
  lastCheckTime: string;
  cloudStatus: 'connected' | 'syncing' | 'delayed' | 'offline';
  pendingQueueCount: number;
  syncedCount: number;
}

export type AsnAttendanceKeterangan =
  | 'hadir'
  | 'izin'
  | 'sakit'
  | 'cuti'
  | 'dinas_luar'
  | 'tanpa_keterangan';

export interface AsnAttendanceRow {
  date?: string; // Optional date for date range view (YYYY-MM-DD)
  teacherId: string;
  name: string;
  nip: string;
  nuptk?: string;
  employmentStatus: EmploymentStatus;
  rankOrGrade?: string; // Pangkat / Golongan Ruang, e.g. "Penata Muda / III/a"
  roleOrSubject: string;
  gender: 'L' | 'P';
  phone?: string;
  avatar?: string;
  // Kolom Tanda Tangan Absen Masuk
  checkInSignature?: string | null;
  checkInTime?: string | null;
  checkInDevice?: string | null;
  checkInSignedAt?: string | null;
  // Kolom Tanda Tangan Absen Pulang
  checkOutSignature?: string | null;
  checkOutTime?: string | null;
  checkOutDevice?: string | null;
  checkOutSignedAt?: string | null;
  // Kolom Durasi Kerja Total
  totalWorkDuration?: string | null;
  // Kolom Terakhir: Keterangan
  keterangan: AsnAttendanceKeterangan;
  notes?: string;
}

export interface SignatureAuditLog {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss WITA
  teacherId: string;
  teacherName: string;
  nip: string;
  sessionType: 'masuk' | 'pulang';
  actionType: 'created' | 'updated' | 'removed';
  previousSignatureUrl?: string | null;
  newSignatureUrl?: string | null;
  previousSignedAt?: string | null;
  newSignedAt?: string | null;
  deviceType: string;
  reason: string;
  actorName: string;
  actorRole: string;
  ipOrDeviceInfo?: string;
  isValidatedByAdmin?: boolean;
  validatedAt?: string;
  validatedBy?: string;
}

export interface ApelPhotoRecord {
  id: string;
  session: 'apel_pagi' | 'apel_siang';
  photoUrl: string; // Stamped photo data URL with GPS watermark on bottom-right corner
  rawPhotoUrl?: string; // Optional raw image
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timezone: string; // e.g. "WITA (GMT+8)"
  location: {
    latitude: number;
    longitude: number;
    desa?: string;
    kecamatan?: string;
    kabupaten?: string;
    provinsi?: string;
    addressFormatted: string;
    accuracyMeters?: number;
  };
  leaderName?: string; // Pemimpin / Pembina Apel
  totalParticipants?: number; // Jumlah GTK / Siswa yang hadir
  notes?: string;
}

export interface DailyApelDocumentation {
  date: string;
  apelPagi?: ApelPhotoRecord | null;
  apelSiang?: ApelPhotoRecord | null;
  apelPagiPhotos?: ApelPhotoRecord[]; // Multi-foto Apel Pagi (minimal 3 foto)
  apelSiangPhotos?: ApelPhotoRecord[]; // Multi-foto Apel Siang (minimal 2 foto)
}

export type ActiveTab =
  | 'dashboard'
  | 'scan'
  | 'selfie'
  | 'asn_attendance_table'
  | 'batch_class'
  | 'rekap'
  | 'service_integration'
  | 'layanan_gtk'
  | 'leaves'
  | 'teachers'
  | 'students'
  | 'accounts'
  | 'cards'
  | 'calendar'
  | 'piket'
  | 'biometric_logs'
  | 'workspace'
  | 'logs'
  | 'config'
  | 'security_center'
  | 'hardware_diagnostic'
  | 'profile';
