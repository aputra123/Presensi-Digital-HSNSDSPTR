import React, { useMemo } from 'react';
import {
  FileText,
  ArrowUpRight,
  UserCheck,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  AttendanceRecord,
  LeaveRequest,
  GtkServiceRequest,
  SchoolClass,
  Student,
  Teacher,
  SchoolConfig,
  ActiveTab,
  BiometricLog,
} from '../types';
import { exportAttendanceToPdf, exportAttendanceToXlsx } from '../utils/exportUtils';
import { formatDateIndo } from '../utils/soundAndDate';

interface DashboardStatsProps {
  records?: AttendanceRecord[];
  students?: Student[];
  teachers?: Teacher[];
  classes?: SchoolClass[];
  leaveRequests?: LeaveRequest[];
  leaves?: LeaveRequest[];
  gtkServices?: GtkServiceRequest[];
  biometricLogs?: BiometricLog[];
  config: SchoolConfig;
  setActiveTab?: (tab: ActiveTab) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenPrintModal?: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  records = [],
  students = [],
  teachers = [],
  classes = [],
  leaveRequests,
  leaves,
  gtkServices = [],
  config,
  setActiveTab,
  onNavigateTab,
}) => {
  const navigate = setActiveTab || onNavigateTab || (() => {});
  const allLeaves = leaveRequests || leaves || [];
  const safeRecords = records || [];
  const safeStudents = students || [];
  const safeTeachers = teachers || [];
  const safeClasses = classes || [];
  const safeGtkServices = gtkServices || [];

  const todayStr = new Date().toISOString().split('T')[0];

  // Expiring GTK perizinan documents check
  const expiringGtkRequests = useMemo(() => {
    const today = new Date(todayStr).getTime();
    return safeGtkServices
      .filter((req) => {
        const isApprovedOrActive =
          req.status === 'approved' ||
          req.status === 'approved_by_admin' ||
          req.status === 'approved_by_kepsek';
        if (!isApprovedOrActive) return false;

        const endDateMs = new Date(req.endDate).getTime();
        const diffDays = Math.ceil((endDateMs - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 5;
      })
      .map((req) => {
        const endDateMs = new Date(req.endDate).getTime();
        const diffDays = Math.ceil((endDateMs - today) / (1000 * 60 * 60 * 24));
        return {
          ...req,
          diffDays,
        };
      });
  }, [safeGtkServices, todayStr]);

  const todayRecords = safeRecords.filter((r) => r.date === todayStr);
  const studentRecords = todayRecords.filter((r) => r.personType === 'student');
  const teacherRecords = todayRecords.filter((r) => r.personType === 'teacher');

  const hadirCount = todayRecords.filter((r) => r.status === 'hadir').length;
  const terlambatCount = todayRecords.filter((r) => r.status === 'terlambat').length;
  const sakitCount = todayRecords.filter((r) => r.status === 'sakit').length;
  const izinCount = todayRecords.filter((r) => r.status === 'izin').length;

  const totalRegistered = safeStudents.length + safeTeachers.length;
  const totalPresentToday = hadirCount + terlambatCount;
  const attendanceRate = totalRegistered > 0 ? Math.round((totalPresentToday / totalRegistered) * 100) : 0;

  const pendingLeaves = allLeaves.filter((l) => l.status === 'pending');
  const pendingGtkCount = safeGtkServices.filter(
    (s) => s.status === 'pending' || s.status === 'returned'
  ).length;

  // Weekly attendance trend (Senin - Jumat)
  const weeklyAttendanceData = useMemo(() => {
    const schoolDays = [
      { dayIndex: 1, label: 'Senin' },
      { dayIndex: 2, label: 'Selasa' },
      { dayIndex: 3, label: 'Rabu' },
      { dayIndex: 4, label: 'Kamis' },
      { dayIndex: 5, label: 'Jumat' },
    ];

    const totalCap = Math.max(1, safeStudents.length + safeTeachers.length);

    return schoolDays.map((sd) => {
      const recordsForDay = safeRecords.filter((r) => {
        if (!r.date) return false;
        const parts = r.date.split('-').map(Number);
        if (parts.length < 3) return false;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.getDay() === sd.dayIndex;
      });

      const presentCount = recordsForDay.filter(
        (r) => r.status === 'hadir' || r.status === 'terlambat'
      ).length;

      const rate = Math.min(100, Math.round((presentCount / totalCap) * 100));

      return {
        day: sd.label,
        hadir: presentCount,
        persentase: rate,
      };
    });
  }, [safeRecords, safeStudents.length, safeTeachers.length]);

  // Recent 5 attendance records today
  const recentRecords = useMemo(() => {
    return [...todayRecords]
      .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
      .slice(0, 5);
  }, [todayRecords]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Minimalist Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Ringkasan Presensi Hari Ini
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDateIndo(todayStr)} • {config.schoolName}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => exportAttendanceToPdf(safeRecords, config, 'Laporan Presensi Harian')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Unduh PDF</span>
          </button>

          <button
            type="button"
            onClick={() => exportAttendanceToXlsx(safeRecords, config, 'Rekap Presensi')}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Subtle Proactive Notice if GTK Documents Expire Soon */}
      {expiringGtkRequests.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">
              <strong>{expiringGtkRequests.length} berkas izin/tugas GTK</strong> mendekati batas akhir dalam 5 hari ke depan.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('layanan_gtk')}
            className="text-indigo-600 hover:text-indigo-800 font-bold shrink-0 flex items-center space-x-1 cursor-pointer"
          >
            <span>Tinjau</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Prominent, Tight Metric Grid (4 Clean Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Attendance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Kehadiran Hari Ini</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {attendanceRate}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <strong className="text-slate-700">{totalPresentToday}</strong> dari {totalRegistered} personil hadir
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Tepat: <strong className="text-emerald-700">{hadirCount}</strong></span>
            <span>Terlambat: <strong className="text-amber-700">{terlambatCount}</strong></span>
            <span>Izin/Sakit: <strong className="text-indigo-700">{izinCount + sakitCount}</strong></span>
          </div>
        </div>

        {/* Card 2: Guru & ASN */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Guru & Pegawai GTK</span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {teacherRecords.length} <span className="text-base font-normal text-slate-400">/ {safeTeachers.length}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              PNS, PPPK & Tenaga PTT
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('asn_attendance_table')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 cursor-pointer"
            >
              <span>Tabel Absensi Guru ASN</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Siswa */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Kehadiran Siswa</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {studentRecords.length} <span className="text-base font-normal text-slate-400">/ {safeStudents.length}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {safeClasses.length} Rombongan Belajar
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('batch_class')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 cursor-pointer"
            >
              <span>Presensi Kelas Siswa</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Perizinan & Surat */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Izin & Berkas GTK</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {pendingLeaves.length + pendingGtkCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Menunggu verifikasi & tanda tangan
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('layanan_gtk')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 cursor-pointer"
            >
              <span>Verifikasi Berkas</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics & Recent Activity (Tighter 2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Weekly Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-slate-900">
                Tren Kehadiran Mingguan
              </h3>
              <p className="text-[11px] text-slate-500">
                Persentase presensi Senin s/d Jumat
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              Target 95%
            </span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Kehadiran']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                />
                <Area
                  type="monotone"
                  dataKey="persentase"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#attendanceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Attendance (1 col) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-slate-900">Presensi Terkini</h3>
              <button
                type="button"
                onClick={() => navigate('rekap')}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                Lihat Semua
              </button>
            </div>

            {recentRecords.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                Belum ada presensi tercatat hari ini
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentRecords.map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-800 truncate">
                        {r.personName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {r.personType === 'teacher' ? 'Guru/GTK' : (r.classOrSubject || 'Siswa')} • {r.time} WITA
                      </p>
                    </div>

                    <span
                      className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                        r.status === 'hadir'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.status === 'terlambat'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {r.status === 'hadir' ? 'Hadir' : r.status === 'terlambat' ? 'Terlambat' : r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('rekap')}
              className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer"
            >
              Buka Rekapitulasi Presensi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
