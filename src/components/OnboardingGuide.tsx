import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  QrCode,
  Database,
  CloudCheck,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Smartphone,
  ShieldCheck,
  WifiOff,
  Bell,
  Download,
} from 'lucide-react';
import { ActiveTab, SchoolConfig } from '../types';

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  config: SchoolConfig;
}

export const ONBOARDING_STORAGE_KEY = 'school_presensi_onboarding_done_v1';

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  config,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset to step 0 when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const steps = [
    {
      id: 'welcome',
      title: 'Selamat Datang di Presensi Sekolah Digital',
      subtitle: `Sistem Cerdas Terintegrasi ${config.schoolName}`,
      icon: Sparkles,
      iconColor: 'from-indigo-500 to-violet-600',
      badge: 'Pengenalan Sistem',
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Platform presensi digital modern yang dirancang khusus untuk memenuhi kebutuhan administrasi
            sekolah di daerah 3T maupun perkotaan, dengan keandalan tinggi di wilayah Kabupaten Pulau Taliabu.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-indigo-950">100% Siap Offline</h4>
                <p className="text-[11px] text-indigo-800 leading-tight">
                  Presensi tetap berjalan lancar meski koneksi internet padam.
                </p>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-100 flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-emerald-950">Validasi Resmi GTK</h4>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  Verifikasi ganda Kepala Sekolah dan sinkronisasi standar BKD.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      targetTab: 'dashboard' as ActiveTab,
      actionLabel: 'Jelajahi Dashboard',
    },
    {
      id: 'attendance',
      title: 'Metode Presensi Siswa & Guru (Attendance)',
      subtitle: 'Tiga Pilihan Absensi Cepat, Akurat & Anti-Manipulasi',
      icon: QrCode,
      iconColor: 'from-blue-500 to-cyan-600',
      badge: 'Modul Utama Presensi',
      content: (
        <div className="space-y-3">
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Pilih metode absensi yang paling praktis untuk gerbang masuk sekolah atau kelas harian:
          </p>
          <div className="space-y-2">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                1
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800">QR Code Scanner Cepat:</span>
                <span className="text-slate-500 ml-1">
                  Scan kartu ID siswa/guru dalam waktu kurang dari 1 detik dengan feedback audio bip.
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold text-xs">
                2
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800">Selfie Presensi & Geofence GPS:</span>
                <span className="text-slate-500 ml-1">
                  Pengambilan foto langsung + verifikasi radius koordinat sekolah (anti pemalsuan lokasi).
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                3
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800">Presensi Kelas Kolektif (Batch):</span>
                <span className="text-slate-500 ml-1">
                  Guru piket atau wali kelas dapat menandai status hadir/sakit/izin seluruh kelas sekaligus.
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      targetTab: 'scanner' as ActiveTab,
      actionLabel: 'Coba Scanner QR',
    },
    {
      id: 'sync_status',
      title: 'Status Sinkronisasi & Antrian Offline (Sync Status)',
      subtitle: 'Penyimpanan Aman di Memori Lokal & Push Cloud Otomatis',
      icon: Database,
      iconColor: 'from-amber-500 to-orange-600',
      badge: 'Offline-First Engine',
      content: (
        <div className="space-y-3">
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Data absensi yang tercatat saat offline otomatis masuk ke <strong>Antrian Sinkronisasi (Sync Queue)</strong> di memori perangkat:
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-amber-900 font-bold">
              <CloudCheck className="w-4 h-4 text-amber-600" />
              <span>Sinkronisasi Otomatis Saat Sinyal Pulih</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Sistem akan memancarkan sinyal Heartbeat ke Cloud. Begitu perangkat tersambung internet, seluruh antrian
              akan terkirim otomatis ke Firebase & Google Sheets tanpa kehilangan data.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-mono font-bold text-[10px]">
                Indikator Header:
              </span>
              <span className="text-[11px] text-amber-700">
                Pemberitahuan muncul jika antrian offline melebihi 5 catatan.
              </span>
            </div>
          </div>
        </div>
      ),
      targetTab: 'service_integration' as ActiveTab,
      actionLabel: 'Buka Status Antrian',
    },
    {
      id: 'bkd_integration',
      title: 'Integrasi Layanan & BKD (Service Integration)',
      subtitle: 'Format Ekspor Resmi BKD Kab. Pulau Taliabu & Pengingat Jumat',
      icon: FileSpreadsheet,
      iconColor: 'from-emerald-500 to-teal-600',
      badge: 'Pelaporan Resmi GTK',
      content: (
        <div className="space-y-3">
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Kemudahan bagi Admin & Operator Sekolah dalam menyusun laporan kehadiran pegawai:
          </p>
          <div className="space-y-2">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start space-x-2.5">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-slate-800">Standar BKD Taliabu:</span>
                <p className="text-slate-500 text-[11px]">
                  Ekspor data kehadiran guru PNS/PPPK & Honorer dengan kolom NIP, Jam Masuk, Jam Pulang, dan Status BKD.
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start space-x-2.5">
              <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-slate-800">Pengingat Otomatis Jumat 14:00 WITA:</span>
                <p className="text-slate-500 text-[11px]">
                  Notifikasi otomatis akan mengingatkan admin setiap hari Jumat pukul 14:00 WITA agar tidak terlewat mengekspor laporan mingguan.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      targetTab: 'service_integration' as ActiveTab,
      actionLabel: 'Lihat Format BKD',
    },
    {
      id: 'pwa_and_ready',
      title: 'Siap Digunakan di HP & Laptop Anda!',
      subtitle: 'Aplikasi Web Progresif (PWA) & Kustomisasi Ikon Sekolah',
      icon: Smartphone,
      iconColor: 'from-indigo-600 to-rose-600',
      badge: 'Langkah Terakhir',
      content: (
        <div className="space-y-3">
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Anda dapat memasang aplikasi ini ke layar utama smartphone (Android/iPhone) atau laptop Windows/Mac tanpa perlu instalasi rumit melalui Play Store:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-indigo-900">
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pasang / Unduh App</span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Klik tombol "Unduh Aplikasi" di bilah atas untuk panduan pasang satu klik.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Ganti Ikon & Logo</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Sesuaikan logo resmi SMPN 4 Taliabu Barat langsung dari perangkat Anda.
              </p>
            </div>
          </div>
        </div>
      ),
      targetTab: 'dashboard' as ActiveTab,
      actionLabel: 'Selesai & Buka Dashboard',
    },
  ];

  const current = steps[currentStep];
  const IconComponent = current.icon;

  const handleFinish = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Failed saving onboarding state:', e);
    }
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleActionJump = () => {
    if (onNavigateTab && current.targetTab) {
      onNavigateTab(current.targetTab);
    }
    if (currentStep === steps.length - 1) {
      handleFinish();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header Bar */}
          <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${current.iconColor} text-white flex items-center justify-center shadow-md shrink-0`}
              >
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {current.badge} • Langkah {currentStep + 1} dari {steps.length}
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight mt-0.5">
                  {current.title}
                </h3>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Lewati Panduan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Indicator Bar */}
          <div className="w-full bg-slate-100 h-1.5 flex">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`flex-1 h-full transition-all duration-300 ${
                  idx <= currentStep ? 'bg-indigo-600' : 'bg-transparent'
                }`}
                title={`Loncat ke langkah ${idx + 1}`}
              />
            ))}
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <h4 className="font-bold text-xs sm:text-sm text-slate-700">{current.subtitle}</h4>
            {current.content}
          </div>

          {/* Footer Controls */}
          <div className="p-4 sm:p-6 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Step Pills & Skip */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={handleFinish}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Lewati Panduan
              </button>

              <div className="flex items-center space-x-1.5">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentStep ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
              )}

              {current.actionLabel && currentStep < steps.length - 1 && (
                <button
                  type="button"
                  onClick={handleActionJump}
                  className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer hidden md:flex items-center space-x-1"
                >
                  <span>{current.actionLabel}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
              >
                <span>{currentStep === steps.length - 1 ? 'Mulai Sekarang' : 'Selanjutnya'}</span>
                {currentStep === steps.length - 1 ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
