import React, { useState, useEffect } from 'react';
import {
  School,
  QrCode,
  Camera,
  Users,
  FileSpreadsheet,
  FileText,
  CreditCard,
  Settings,
  Clock,
  LayoutDashboard,
  Award,
  Cloud,
} from 'lucide-react';
import { ActiveTab, SchoolConfig, UserRole } from '../types';
import { formatTimeIndo, formatDateIndo } from '../utils/soundAndDate';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  config: SchoolConfig;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  totalTodayCount: number;
  pendingLeavesCount: number;
  pendingGtkCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  config,
  userRole,
  setUserRole,
  totalTodayCount,
  pendingLeavesCount,
  pendingGtkCount = 0,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getAttendanceSessionStatus = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const currentMins = hours * 60 + minutes;

    const [startH, startM] = (config.checkInStart || '06:15').split(':').map(Number);
    const [deadlineH, deadlineM] = (config.checkInDeadline || '07:15').split(':').map(Number);
    const [outH, outM] = (config.checkOutStart || '14:30').split(':').map(Number);

    const startMins = startH * 60 + startM;
    const deadlineMins = deadlineH * 60 + deadlineM;
    const outMins = outH * 60 + outM;

    if (currentMins < startMins) {
      return {
        label: 'Belum Dibuka',
        desc: `Buka ${config.checkInStart} WIB`,
        color: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    } else if (currentMins <= deadlineMins) {
      return {
        label: 'Presensi Masuk Tepat Waktu',
        desc: `Batas ${config.checkInDeadline} WIB`,
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    } else if (currentMins < outMins) {
      return {
        label: 'Toleransi / Terlambat',
        desc: `Jam KBM Berlangsung`,
        color: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    } else {
      return {
        label: 'Presensi Pulang Aktif',
        desc: `Mulai ${config.checkOutStart} WIB`,
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    }
  };

  const session = getAttendanceSessionStatus();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan' as ActiveTab, label: 'Scan QR Presensi', icon: QrCode, badge: 'Live' },
    { id: 'selfie' as ActiveTab, label: 'Selfie & GPS', icon: Camera },
    { id: 'batch_class' as ActiveTab, label: 'Absensi Rombel', icon: Users },
    { id: 'rekap' as ActiveTab, label: 'Rekapitulasi', icon: FileSpreadsheet },
    {
      id: 'layanan_gtk' as ActiveTab,
      label: 'Layanan & Izin GTK',
      icon: Award,
      badge: pendingGtkCount > 0 ? String(pendingGtkCount) : undefined,
    },
    {
      id: 'leaves' as ActiveTab,
      label: 'Izin Siswa',
      icon: FileText,
      badge: pendingLeavesCount > 0 ? String(pendingLeavesCount) : undefined,
    },
    { id: 'cards' as ActiveTab, label: 'Kartu QR', icon: CreditCard },
    { id: 'workspace' as ActiveTab, label: 'Cloud & Workspace', icon: Cloud },
    { id: 'config' as ActiveTab, label: 'Pengaturan & Logo', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col md:flex-row items-center justify-between gap-2.5 border-b border-slate-100">
        {/* School branding with Logo */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-2.5">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt="Logo Sekolah"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-contain bg-slate-50 p-1 border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <School className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                  {config.schoolName}
                </h1>
                <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  NPSN {config.npsn}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Tahun Ajaran {config.academicYear} • Semester {config.semester}
              </p>
            </div>
          </div>

          {/* Mobile clock */}
          <div className="md:hidden text-right">
            <span className="text-xs font-mono font-bold text-slate-800">
              {formatTimeIndo(currentTime)}
            </span>
          </div>
        </div>

        {/* Live clock & 2-Role Switcher */}
        <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
          {/* Live Indonesian Clock */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs text-slate-700">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-medium text-slate-500">
              {formatDateIndo(currentTime.toISOString().split('T')[0])}
            </span>
            <span className="font-bold text-slate-900 font-mono">
              {formatTimeIndo(currentTime)} WIB
            </span>
          </div>

          {/* Session Status Pill */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${session.color}`}
          >
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{session.label}</span>
          </div>

          {/* 3-Role Switcher (Admin, Guru, Piket) */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-full border border-slate-200 text-xs">
            <button
              onClick={() => setUserRole('admin')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                userRole === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin / Kepsek
            </button>
            <button
              onClick={() => setUserRole('guru')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                userRole === 'guru'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Guru
            </button>
            <button
              onClick={() => setUserRole('piket')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                userRole === 'piket'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Piket
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none">
          {(userRole === 'admin'
            ? navItems
            : navItems.filter((item) =>
                ['dashboard', 'scan', 'selfie', 'batch_class', 'rekap', 'layanan_gtk', 'leaves'].includes(
                  item.id
                )
              )
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-indigo-500 text-white'
                        : item.badge === 'Live'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
