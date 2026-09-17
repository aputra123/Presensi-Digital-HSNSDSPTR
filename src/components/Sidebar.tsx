import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  Camera,
  Users2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Briefcase,
  CreditCard,
  CalendarDays,
  Settings,
  School,
  ShieldCheck,
  Award,
  ClipboardList,
  Building2,
  Menu,
  PenTool,
  HelpCircle,
  Shield,
  Download,
  Cpu,
  LogOut,
  Lock,
  Key,
  User,
  Cloud,
  Fingerprint,
  ScrollText,
} from 'lucide-react';
import { ActiveTab, SchoolConfig, UserRole } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  config: SchoolConfig;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  pendingLeavesCount: number;
  pendingGtkCount?: number;
  totalTodayCount: number;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onToggleSidebar?: () => void;
  onTriggerSimulation?: () => void;
  onOpenInstallModal?: () => void;
  onOpenIconModal?: () => void;
  onOpenOnboardingGuide?: () => void;
  isSidebarLocked?: boolean;
  onToggleSidebarLock?: () => void;
  autoHideOnSelect?: boolean;
  onToggleAutoHide?: () => void;
  onCloseSidebar?: () => void;
  onOpenSecurityModal?: (targetRole?: UserRole) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  config,
  userRole,
  setUserRole,
  pendingLeavesCount,
  pendingGtkCount = 0,
  isMobileOpen,
  setIsMobileOpen,
  onToggleSidebar,
  onOpenInstallModal,
  onOpenOnboardingGuide = () => {},
  autoHideOnSelect = false,
  onToggleAutoHide,
  onCloseSidebar,
  onOpenSecurityModal,
  onLogout,
}) => {
  const handleHideSidebar = () => {
    setIsMobileOpen(false);
    if (onCloseSidebar) {
      onCloseSidebar();
    }
  };

  const handleToggle = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else {
      setIsMobileOpen(!isMobileOpen);
    }
  };

  const menuGroups = [
    {
      groupTitle: 'Menu Utama',
      items: [
        {
          id: 'dashboard' as ActiveTab,
          label: 'Dashboard Ringkasan',
          icon: LayoutDashboard,
        },
        {
          id: 'asn_attendance_table' as ActiveTab,
          label: 'Absensi Guru ASN',
          icon: PenTool,
        },
        {
          id: 'layanan_gtk' as ActiveTab,
          label: 'Layanan & Izin GTK',
          icon: Award,
          badge: pendingGtkCount > 0 ? `${pendingGtkCount} perlu verifikasi` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800',
        },
        {
          id: 'leaves' as ActiveTab,
          label: 'Izin & Sakit Siswa',
          icon: FileText,
          badge: pendingLeavesCount > 0 ? `${pendingLeavesCount} baru` : undefined,
          badgeColor: 'bg-rose-100 text-rose-700',
        },
        {
          id: 'rekap' as ActiveTab,
          label: 'Rekapitulasi Presensi',
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      groupTitle: 'Metode Presensi',
      items: [
        {
          id: 'scan' as ActiveTab,
          label: 'Scanner QR Code',
          icon: QrCode,
        },
        {
          id: 'selfie' as ActiveTab,
          label: 'Kamera Selfie & GPS',
          icon: Camera,
        },
        {
          id: 'batch_class' as ActiveTab,
          label: 'Absensi Kelas (Rombel)',
          icon: Users2,
        },
      ],
    },
    {
      groupTitle: 'Data & Administrasi',
      items: [
        {
          id: 'teachers' as ActiveTab,
          label: 'Data Guru & Pegawai',
          icon: Briefcase,
        },
        {
          id: 'students' as ActiveTab,
          label: 'Data Siswa & Kelas',
          icon: GraduationCap,
        },
        {
          id: 'piket' as ActiveTab,
          label: 'Jadwal Guru Piket',
          icon: ClipboardList,
        },
        {
          id: 'calendar' as ActiveTab,
          label: 'Kalender Pendidikan',
          icon: CalendarDays,
        },
        {
          id: 'cards' as ActiveTab,
          label: 'Cetak Kartu QR',
          icon: CreditCard,
        },
        {
          id: 'accounts' as ActiveTab,
          label: 'Akun Guru, Piket & Siswa',
          icon: Key,
          badge: 'Admin Only',
          badgeColor: 'bg-indigo-100 text-indigo-700',
        },
      ],
    },
    {
      groupTitle: 'Pengaturan & Sistem',
      items: [
        {
          id: 'config' as ActiveTab,
          label: 'Pengaturan Sekolah',
          icon: Settings,
        },
        {
          id: 'service_integration' as ActiveTab,
          label: 'Integrasi BKD & Cloud',
          icon: Building2,
        },
        {
          id: 'workspace' as ActiveTab,
          label: 'Google Workspace Sync',
          icon: Cloud,
        },
        {
          id: 'security_center' as ActiveTab,
          label: 'Pusat Keamanan & Audit',
          icon: ShieldCheck,
          badge: '5 Pilar',
          badgeColor: 'bg-emerald-100 text-emerald-800',
        },
        {
          id: 'biometric_logs' as ActiveTab,
          label: 'Audit Biometrik Wajah',
          icon: Fingerprint,
        },
        {
          id: 'logs' as ActiveTab,
          label: 'Log Aktivitas Sekolah',
          icon: ScrollText,
        },
        {
          id: 'profile' as ActiveTab,
          label: 'Profil & Keamanan Akun',
          icon: User,
        },
        {
          id: 'hardware_diagnostic' as ActiveTab,
          label: 'Diagnostik Hardware & Kamera',
          icon: Cpu,
          badge: 'Live Audit',
          badgeColor: 'bg-indigo-100 text-indigo-700',
        },
      ],
    },
  ];

  // Role-Based Menu Mapping:
  // Role Guru dan Siswa: Hapus Menu Utama dan ganti dengan Metode Presensi!
  // Role Admin: Menampilkan semua menu lengkap
  const visibleMenuGroups = React.useMemo(() => {
    if (userRole === 'admin') {
      return menuGroups;
    }

    if (userRole === 'guru') {
      return [
        {
          groupTitle: 'Metode Presensi',
          items: [
            {
              id: 'selfie' as ActiveTab,
              label: 'Kamera Selfie & GPS',
              icon: Camera,
            },
            {
              id: 'batch_class' as ActiveTab,
              label: 'Absensi Kelas (Rombel)',
              icon: Users2,
            },
            {
              id: 'cards' as ActiveTab,
              label: 'Kartu Guru GTK & QR',
              icon: CreditCard,
            },
            {
              id: 'layanan_gtk' as ActiveTab,
              label: 'Layanan & Izin GTK',
              icon: Award,
              badge: pendingGtkCount > 0 ? `${pendingGtkCount} perlu verifikasi` : undefined,
              badgeColor: 'bg-amber-100 text-amber-800',
            },
            {
              id: 'profile' as ActiveTab,
              label: 'Profil Saya',
              icon: User,
            },
          ],
        },
      ];
    }

    if (userRole === 'siswa') {
      return [
        {
          groupTitle: 'Metode Presensi',
          items: [
            {
              id: 'selfie' as ActiveTab,
              label: 'Kamera Selfie & GPS',
              icon: Camera,
            },
            {
              id: 'cards' as ActiveTab,
              label: 'Kartu Pelajar & QR',
              icon: CreditCard,
            },
            {
              id: 'leaves' as ActiveTab,
              label: 'Pengajuan Izin / Sakit',
              icon: FileText,
            },
            {
              id: 'profile' as ActiveTab,
              label: 'Profil Saya',
              icon: User,
            },
          ],
        },
      ];
    }

    // Role Piket: Fokus pada operasional presensi piket
    return [
      {
        groupTitle: 'Metode Presensi',
        items: [
          {
            id: 'scan' as ActiveTab,
            label: 'Scanner QR Code',
            icon: QrCode,
          },
          {
            id: 'batch_class' as ActiveTab,
            label: 'Absensi Kelas (Rombel)',
            icon: Users2,
          },
          {
            id: 'selfie' as ActiveTab,
            label: 'Kamera Selfie & GPS',
            icon: Camera,
          },
          {
            id: 'piket' as ActiveTab,
            label: 'Jadwal Guru Piket',
            icon: ClipboardList,
          },
          {
            id: 'asn_attendance_table' as ActiveTab,
            label: 'Absensi Guru ASN',
            icon: PenTool,
          },
          {
            id: 'layanan_gtk' as ActiveTab,
            label: 'Layanan & Izin GTK',
            icon: Award,
          },
          {
            id: 'leaves' as ActiveTab,
            label: 'Izin & Sakit Siswa',
            icon: FileText,
            badge: pendingLeavesCount > 0 ? `${pendingLeavesCount} baru` : undefined,
            badgeColor: 'bg-rose-100 text-rose-700',
          },
          {
            id: 'profile' as ActiveTab,
            label: 'Profil Saya',
            icon: User,
          },
        ],
      },
    ];
  }, [userRole, menuGroups, pendingGtkCount, pendingLeavesCount]);

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    // Otomatis sembunyikan sidebar jika mode auto-hide aktif atau di layar mobile
    if (autoHideOnSelect || window.innerWidth < 1024) {
      handleHideSidebar();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={handleHideSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 h-screen max-h-screen z-50 w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col overflow-hidden transition-transform duration-200 ease-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Clean Header: Logo, School Name & 3-line Menu Toggle */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt="Logo Sekolah"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-0.5 border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <School className="w-4 h-4" strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-xs text-slate-900 truncate leading-tight">
                {config.schoolName}
              </h1>
              <p className="text-[10px] text-slate-400 truncate">
                Presensi Digital
              </p>
            </div>
          </div>

          {/* Ikon Garis 3 (Menu) untuk sembunyikan / munculkan sidebar */}
          <button
            type="button"
            onClick={handleToggle}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Sembunyikan Sidebar (Ikon Garis 3)"
            aria-label="Sembunyikan Sidebar"
          >
            <Menu className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Opsi Otomatis Sembunyikan Sidebar Saat Klik Menu */}
        {onToggleAutoHide && (
          <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 shrink-0">
            <span className="truncate">Sembunyikan otomatis saat klik menu</span>
            <button
              type="button"
              onClick={onToggleAutoHide}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold transition-colors cursor-pointer shrink-0 ml-1.5 ${
                autoHideOnSelect
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
              title="Aktifkan agar sidebar otomatis tersembunyi setelah memilih menu"
            >
              {autoHideOnSelect ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        )}

        {/* Clean Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3">
          {visibleMenuGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              <div className="px-2 py-0.5 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                {group.groupTitle}
              </div>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                          strokeWidth={1.5}
                        />
                        <span className="truncate text-xs">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Dedicated Download & Install App Item in Sidebar */}
          {onOpenInstallModal && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onOpenInstallModal();
                  if (autoHideOnSelect) handleHideSidebar();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-950 border border-indigo-200/80 shadow-2xs transition-all cursor-pointer group"
                title="Unduh & Pasang Aplikasi untuk Semua HP (Android, iPhone) & Laptop (Windows, Mac, Linux)"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold truncate text-slate-900">Download Aplikasi</p>
                    <p className="text-[10px] text-indigo-700 font-medium truncate">Semua HP & Laptop</p>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-200/80 text-indigo-900 shrink-0">
                  PWA
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Minimalist Footer: User Profile & Locked Role Status */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/75 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleNavClick('profile')}
              className="min-w-0 flex-1 text-left p-1 rounded-lg hover:bg-slate-100/90 transition-colors cursor-pointer group"
              title="Buka Profil Saya & Informasi Akun"
            >
              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                {userRole === 'admin'
                  ? (config.adminName || 'Admin Sekolah')
                  : userRole === 'guru'
                  ? 'Bpk/Ibu Guru'
                  : userRole === 'piket'
                  ? 'Petugas Guru Piket'
                  : 'Peserta Didik'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                  <Lock className="w-2.5 h-2.5 text-indigo-600" />
                  {userRole === 'admin'
                    ? 'Role Admin'
                    : userRole === 'guru'
                    ? 'Role Guru'
                    : userRole === 'piket'
                    ? 'Role Piket'
                    : 'Role Siswa'}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold group-hover:underline">
                  Profil &rarr;
                </span>
              </div>
            </button>

            {/* Logout button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="Keluar dari akun untuk beralih role"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-[11px] font-bold">Keluar</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-200/60">
            <span className="truncate">Role tidak dapat diubah saat aktif</span>
            {onOpenOnboardingGuide && (
              <button
                type="button"
                onClick={onOpenOnboardingGuide}
                className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <HelpCircle className="w-3 h-3" strokeWidth={1.5} />
                <span>Panduan</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
