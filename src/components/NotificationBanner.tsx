import React, { useState, useEffect } from 'react';
import {
  Bell,
  Menu,
  X,
  ArrowRight,
  Shield,
  Download,
  Lock,
  LogOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ActiveTab, LeaveRequest, SchoolConfig, ToastNotification, UserRole } from '../types';

interface NotificationBannerProps {
  notifications?: ToastNotification[];
  onDismissToast?: (id: string) => void;
  onDismissAllToasts?: () => void;
  onReviewLeave?: (leaveId?: string) => void;
  onTriggerSimulation?: () => void;
  pendingLeaves?: LeaveRequest[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMobileMenu: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  config: SchoolConfig;
  userRole: UserRole;
  syncQueueCount?: number;
  isSyncingQueue?: boolean;
  onManualSync?: () => void;
  onOpenInstallModal?: () => void;
  onOpenIconModal?: () => void;
  onOpenOnboardingGuide?: () => void;
  onOpenSecurityModal?: (targetRole?: UserRole) => void;
  onLogout?: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notifications = [],
  onDismissToast = (_id?: string) => {},
  onDismissAllToasts,
  onReviewLeave = (_leaveId?: string) => {},
  pendingLeaves = [],
  setActiveTab,
  onOpenMobileMenu,
  isSidebarOpen = true,
  onToggleSidebar,
  config,
  userRole,
  onOpenInstallModal,
  onOpenSecurityModal,
  onLogout,
}) => {
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      setCurrentDateStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateDate();
    const interval = setInterval(updateDate, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss toast notifications after 4 seconds
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    const timers = notifications.map((toast) => {
      return setTimeout(() => {
        onDismissToast(toast.id);
      }, 4000);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [notifications, onDismissToast]);

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onDismissToast(id);
  };

  const handleDismissAll = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onDismissAllToasts) {
      onDismissAllToasts();
    } else {
      notifications.forEach((n) => onDismissToast(n.id));
    }
  };

  return (
    <>
      {/* Top Clean Minimalist Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 py-2.5 flex items-center justify-between">
        {/* Left: Sidebar Toggle & School Info */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar || onOpenMobileMenu}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle Menu"
            title={isSidebarOpen ? 'Sembunyikan Menu' : 'Tampilkan Menu'}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 text-sm tracking-tight truncate">
                {config.schoolName}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                Presensi Digital
              </span>
            </div>
            <p className="text-slate-500 text-xs hidden sm:block">
              {currentDateStr}
            </p>
          </div>
        </div>

        {/* Right: Minimalist Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Download & Install App Button */}
          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
              title="Unduh & Pasang Aplikasi di Semua Jenis HP & Laptop"
            >
              <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Download App</span>
              <span className="sm:hidden">Download</span>
            </button>
          )}

          {/* Pending Leaves Alert Pill (Only shown for admin or piket if pending exist) */}
          {pendingLeaves.length > 0 && (userRole === 'admin' || userRole === 'piket') && (
            <button
              onClick={() => setActiveTab('leaves')}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
              title="Ada permohonan izin yang menunggu ditinjau"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendingLeaves.length} Perizinan</span>
            </button>
          )}

          {/* User Role Badge: Admin can access security center, other roles are strictly locked */}
          {userRole === 'admin' ? (
            <button
              type="button"
              onClick={() => {
                if (setActiveTab) setActiveTab('security_center');
                else if (onOpenSecurityModal) onOpenSecurityModal('admin');
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
              title="Pusat Keamanan & Audit OWASP (Administrator)"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span className="capitalize font-bold">Admin</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" title="Sesi Terenkripsi" />
            </button>
          ) : (
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold select-none"
              title={`Role ${userRole === 'guru' ? 'Guru' : userRole === 'siswa' ? 'Siswa' : 'Piket'} Terkunci`}
            >
              <Lock className="w-3 h-3 text-indigo-600" />
              <span className="capitalize">
                {userRole === 'guru' ? 'Guru' : userRole === 'siswa' ? 'Siswa' : 'Piket'}
              </span>
            </div>
          )}

          {/* Dedicated Header Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
              title="Keluar dari sesi untuk beralih role"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* Floating Quiet Toast Notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
          {notifications.length > 1 && (
            <div className="flex justify-end pointer-events-auto">
              <button
                type="button"
                onClick={handleDismissAll}
                className="px-2.5 py-1 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-sm hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Tutup Semua
              </button>
            </div>
          )}

          <AnimatePresence>
            {notifications.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10, transition: { duration: 0.15 } }}
                className="pointer-events-auto bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-800 flex items-start space-x-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-100">{toast.title}</p>
                  <p className="text-slate-300 mt-0.5">{toast.message}</p>

                  {toast.leaveId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onReviewLeave(toast.leaveId);
                        handleDismiss(toast.id);
                      }}
                      className="mt-2 text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
                    >
                      <span>Tinjau</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDismiss(toast.id, e)}
                  className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                  aria-label="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
};

