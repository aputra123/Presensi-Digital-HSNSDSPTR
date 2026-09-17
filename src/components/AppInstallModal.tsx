import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  Share2,
  PlusSquare,
  Sparkles,
  ShieldCheck,
  X,
  Apple,
  Zap,
  QrCode as QrCodeIcon,
  Copy,
  Check,
  Globe,
  FileCode,
  Terminal,
  Activity,
  Monitor,
  Camera,
  MapPin,
  Database,
  Wifi,
  ChevronRight,
} from 'lucide-react';
import QRCode from 'qrcode';
import { SchoolConfig } from '../types';
import {
  detectDevicePlatform,
  downloadDesktopLauncherShortcut,
  downloadOfflineLauncherHtml,
  downloadWindowsBatchLauncher,
  downloadLinuxDesktopLauncher,
  downloadMacOsCommandLauncher,
  getDeviceCompatibilityReport,
  isAppRunningStandalone,
} from '../utils/appIconAndPwa';
import confetti from 'canvas-confetti';

interface AppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SchoolConfig;
  onOpenIconModal?: () => void;
}

export const AppInstallModal: React.FC<AppInstallModalProps> = ({
  isOpen,
  onClose,
  config,
  onOpenIconModal,
}) => {
  const [deviceInfo, setDeviceInfo] = useState(detectDevicePlatform());
  const [activeTab, setActiveTab] = useState<
    'auto' | 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'diag' | 'qr'
  >('auto');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [diagReport, setDiagReport] = useState(getDeviceCompatibilityReport());

  useEffect(() => {
    const info = detectDevicePlatform();
    setDeviceInfo(info);
    setIsInstalled(isAppRunningStandalone());
    setDiagReport(getDeviceCompatibilityReport());

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Generate QR Code for Mobile Scanning
    try {
      QRCode.toDataURL(window.location.href, {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff',
        },
      }).then((url) => setQrCodeDataUrl(url));
    } catch (err) {
      console.warn('Failed to generate install QR code:', err);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          confetti({ particleCount: 70, spread: 80 });
        }
        setInstallPrompt(null);
      } catch (err) {
        console.warn('Prompt install error:', err);
      }
    } else {
      // Direct desktop or offline launcher download depending on platform
      if (deviceInfo.platform === 'windows') {
        downloadWindowsBatchLauncher(config.schoolName);
      } else if (deviceInfo.platform === 'mac') {
        downloadMacOsCommandLauncher(config.schoolName);
      } else if (deviceInfo.platform === 'linux') {
        downloadLinuxDesktopLauncher(config.schoolName);
      } else {
        downloadOfflineLauncherHtml(config.schoolName);
      }
      confetti({ particleCount: 40, spread: 60 });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
            title="Tutup Jendela"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shrink-0 border border-white/20">
              <Download className="w-6 h-6" />
            </div>

            <div className="min-w-0 pr-6">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" />
                <span>
                  {isInstalled
                    ? 'Aplikasi Mandiri Aktif (Standalone PWA)'
                    : '100% Kompatibel Semua OS HP & Laptop'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight mt-1 text-white truncate">
                Operasional & Pemasangan Multi-OS
              </h3>
              <p className="text-xs text-slate-300 truncate">
                Bisa dijalankan di Android, iPhone/iPad, Windows 10/11, macOS, Linux, dan Chromebook.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="p-2 sm:p-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-1 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('auto')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'auto'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            ⚡ Deteksi ({deviceInfo.platform.toUpperCase()})
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'android'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            📱 HP Android
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'ios'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🍎 iPhone / iPad
          </button>
          <button
            onClick={() => setActiveTab('windows')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'windows'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            💻 Laptop Windows
          </button>
          <button
            onClick={() => setActiveTab('mac')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'mac'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🍏 Mac / MacBook
          </button>
          <button
            onClick={() => setActiveTab('linux')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'linux'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🐧 Linux / ChromeOS
          </button>
          <button
            onClick={() => setActiveTab('diag')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'diag'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🩺 Uji Perangkat
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-2 px-3 rounded-xl font-bold transition-all text-center cursor-pointer shrink-0 ${
              activeTab === 'qr'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            📷 Scan QR HP
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[68vh] overflow-y-auto text-xs text-slate-700">
          {/* Quick Universal Install Call to Action */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start space-x-2">
                <span className="font-extrabold text-slate-900 text-sm">
                  {isInstalled ? 'Aplikasi Sudah Terpasang' : 'Pasang ke Perangkat Anda'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-200">
                  {deviceInfo.browserName}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-snug">
                Terbuka dalam jendela mandiri layaknya aplikasi native tanpa toolbar browser, kamera instan, dan presensi offline di Pulau Taliabu.
              </p>
            </div>

            <button
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-md shadow-indigo-950/20 cursor-pointer shrink-0 transition-all group"
            >
              <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>{installPrompt ? 'Pasang Langsung' : 'Download File Launcher'}</span>
            </button>
          </div>

          {/* Quick App Icon Customizer Shortcut */}
          {onOpenIconModal && (
            <div className="p-3.5 bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-slate-900 text-xs">
                      Ganti / Kustomisasi Ikon Aplikasi di HP & Laptop
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[9px] font-bold">
                      Semua OS
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Admin atau pihak sekolah dapat memilih logo resmi (Tut Wuri, Pemda Taliabu, atau logo kustom) agar tampil rapi di home screen HP & taskbar laptop.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenIconModal();
                }}
                className="w-full sm:w-auto px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shrink-0 transition-all whitespace-nowrap"
              >
                <span>Ganti Ikon Sekarang</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Universal Downloads Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => downloadDesktopLauncherShortcut(config.schoolName)}
              className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between transition-all cursor-pointer text-left shadow-2xs group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs truncate">Pintasan Windows (.url)</p>
                  <p className="text-[10px] text-slate-500 truncate">Desktop & Taskbar Windows</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 ml-1" />
            </button>

            <button
              type="button"
              onClick={() => downloadWindowsBatchLauncher(config.schoolName)}
              className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between transition-all cursor-pointer text-left shadow-2xs group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs truncate">App Launcher (.bat)</p>
                  <p className="text-[10px] text-slate-500 truncate">Mode Jendela Mandiri PC</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-1" />
            </button>

            <button
              type="button"
              onClick={() => downloadOfflineLauncherHtml(config.schoolName)}
              className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between transition-all cursor-pointer text-left shadow-2xs group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs truncate">Offline Web (.html)</p>
                  <p className="text-[10px] text-slate-500 truncate">Semua HP & Laptop</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-1" />
            </button>
          </div>

          {/* TAB: AUTO-DETECTED */}
          {activeTab === 'auto' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Perangkat Terdeteksi: {deviceInfo.displayName}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Sistem Siap Digunakan
                </span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Aplikasi telah dioptimalkan secara dinamis untuk peramban <strong>{deviceInfo.browserName}</strong> pada sistem operasi <strong>{deviceInfo.osVersionName}</strong>. Fitur kamera biometrik, pembaca QR kartu siswa, geofencing GPS, dan sinkronisasi antrean offline dapat beroperasi lancar.
              </p>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center space-x-2 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dukungan Layar Sentuh / Mouse: {deviceInfo.hasTouchScreen ? 'Layar Sentuh (Touchscreen)' : 'Keyboard & Mouse'}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Status Aplikasi: {isInstalled ? 'Berjalan Mandiri (PWA)' : 'Berjalan di Peramban Web'}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Panduan HP Android (Samsung, Xiaomi, Oppo, Vivo, Realme, Infinix, Tecno, Poco):</span>
              </div>
              <ol className="space-y-2.5 pl-5 list-decimal text-slate-700 leading-relaxed font-medium">
                <li>
                  Buka peramban <strong>Google Chrome</strong> atau <strong>Samsung Internet</strong> pada HP Anda.
                </li>
                <li>
                  Tekan menu titik tiga (<strong>⋮</strong>) di sudut kanan atas layar peramban.
                </li>
                <li>
                  Pilih menu <strong>"Pasang Aplikasi" (Install app)</strong> atau <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong>.
                </li>
                <li>
                  Tekan <strong>Pasang / Tambah</strong>. Ikon resmi aplikasi akan tersimpan di laci aplikasi HP Anda dan siap digunakan selamanya tanpa batas kuota.
                </li>
              </ol>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px]">
                💡 <strong>Tips Khusus Android:</strong> Anda dapat mengizinkan akses Kamera dan Lokasi (GPS) satu kali dengan memilih "Saat aplikasi digunakan (While using the app)" agar presensi wajah berjalan seketika.
              </div>
            </div>
          )}

          {/* TAB: IOS / IPHONE */}
          {activeTab === 'ios' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Apple className="w-4 h-4 text-slate-900" />
                <span>Panduan iPhone & iPad (Apple iOS / iPadOS Safari & Chrome):</span>
              </div>
              <ol className="space-y-2.5 pl-5 list-decimal text-slate-700 leading-relaxed font-medium">
                <li>
                  Buka aplikasi ini melalui browser resmi <strong>Safari</strong> pada iPhone atau iPad Anda.
                </li>
                <li>
                  Ketuk tombol <strong>Bagikan / Share</strong> (<Share2 className="w-3.5 h-3.5 inline text-blue-600" /> di bilah bawah Safari pada iPhone, atau kanan atas pada iPad).
                </li>
                <li>
                  Gulir ke bawah menu dan ketuk <strong>"Tambah ke Layar Utama" (Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-slate-800" />)</strong>.
                </li>
                <li>
                  Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon aplikasi akan tersimpan di beranda iPhone Anda dan terbuka layar penuh tanpa bar URL Safari.
                </li>
              </ol>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px]">
                🍎 <strong>Pengguna Chrome di iPhone:</strong> Ketuk tombol Bagikan di sebelah bilah alamat URL, lalu pilih "Tambahkan ke Layar Utama".
              </div>
            </div>
          )}

          {/* TAB: WINDOWS */}
          {activeTab === 'windows' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Monitor className="w-4 h-4 text-blue-600" />
                <span>Panduan Komputer / Laptop Windows (Windows 11 & Windows 10):</span>
              </div>
              <ol className="space-y-2 pl-5 list-decimal text-slate-700 leading-relaxed font-medium">
                <li>
                  Gunakan browser <strong>Microsoft Edge</strong> atau <strong>Google Chrome</strong> di laptop Anda.
                </li>
                <li>
                  Klik ikon <strong>Pasang Aplikasi</strong> (<Download className="w-3.5 h-3.5 inline text-indigo-600" />) di ujung kanan Bilah Alamat URL browser.
                </li>
                <li>
                  Pilih <strong>Pasang (Install)</strong>. Centang opsi <em>"Sematkan ke taskbar"</em> dan <em>"Buat pintasan desktop"</em>.
                </li>
                <li>
                  Aplikasi akan terbuka otomatis dalam jendela mandiri layaknya software desktop Windows.
                </li>
              </ol>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => downloadDesktopLauncherShortcut(config.schoolName)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File Pintasan Windows (.url)</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadWindowsBatchLauncher(config.schoolName)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer text-[11px]"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Unduh Script Launcher (.bat)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: MACOS */}
          {activeTab === 'mac' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Apple className="w-4 h-4 text-slate-900" />
                <span>Panduan Apple Mac (MacBook Air/Pro, iMac, Mac mini - macOS):</span>
              </div>
              <ol className="space-y-2 pl-5 list-decimal text-slate-700 leading-relaxed font-medium">
                <li>
                  <strong>Safari macOS Sonoma 14+:</strong> Buka menu <em>File</em> di bilah atas Safari, lalu pilih <strong>"Add to Dock" (Tambahkan ke Dock)</strong>. Aplikasi akan menjadi native app di Launchpad.
                </li>
                <li>
                  <strong>Google Chrome / Edge macOS:</strong> Klik ikon Pasang di bilah alamat URL atau buka menu Chrome (⋮) → Simpan & Bagikan → Pasang Presensi Sekolah.
                </li>
                <li>
                  Aplikasi dapat dibuka langsung dari Dock tanpa perlu membuka jendela browser terlebih dahulu.
                </li>
              </ol>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => downloadMacOsCommandLauncher(config.schoolName)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Script Launcher macOS (.command)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: LINUX / CHROMEBOOK */}
          {activeTab === 'linux' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Laptop className="w-4 h-4 text-amber-600" />
                <span>Panduan Linux (Ubuntu, Debian, Fedora, Arch, Mint) & Chromebook (ChromeOS):</span>
              </div>
              <ol className="space-y-2 pl-5 list-decimal text-slate-700 leading-relaxed font-medium">
                <li>
                  <strong>Chromebook (ChromeOS):</strong> Buka di Chrome, klik Pasang di bilah alamat, lalu sematkan ikon aplikasi ke Rak Bawah (Shelf).
                </li>
                <li>
                  <strong>Linux (Ubuntu/Debian/Fedora/Mint):</strong> Klik ikon Pasang pada Google Chrome / Chromium / Brave, atau unduh file <code>.desktop</code> di bawah ini.
                </li>
                <li>
                  Letakkan file <code>.desktop</code> di folder <code>~/.local/share/applications/</code> agar muncul di menu aplikasi sistem operasi Anda.
                </li>
              </ol>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => downloadLinuxDesktopLauncher(config.schoolName)}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File Desktop Entry Linux (.desktop)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: HARDWARE & OS COMPATIBILITY DIAGNOSTIC */}
          {activeTab === 'diag' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Hasil Audit Kompatibilitas Sistem & Sensor</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDiagReport(getDeviceCompatibilityReport())}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Segarkan Audit
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-slate-800">Sensor Kamera & Biometrik</span>
                  </div>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${diagReport.isCameraSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {diagReport.isCameraSupported ? 'Didukung (Aktif)' : 'Mode AI Virtual'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <span className="font-medium text-slate-800">Sensor Geolocation / GPS</span>
                  </div>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${diagReport.isGeolocationSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {diagReport.isGeolocationSupported ? 'Didukung (Aktif)' : 'Fallback WiFi/IP'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-slate-800">PWA & Offline Service Worker</span>
                  </div>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${diagReport.isPwaSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                    {diagReport.isPwaSupported ? 'Tersedia (Aktif)' : 'Tidak Didukung'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-slate-800">Penyimpanan Lokal (Cache Data)</span>
                  </div>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${diagReport.isOfflineStorageSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {diagReport.isOfflineStorageSupported ? 'Siap Digunakan' : 'Terbatas'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-slate-700 text-[11px] space-y-1">
                <p><strong>Resolusi Tampilan Perangkat:</strong> {diagReport.screenDimensions}</p>
                <p><strong>Sistem Operasi / Peramban:</strong> {diagReport.os} — {diagReport.browser}</p>
                <p className="text-emerald-700 font-bold">
                  ✓ Perangkat Anda telah memenuhi seluruh kriteria fungsional untuk menjalankan Presensi Digital secara optimal.
                </p>
              </div>
            </div>
          )}

          {/* TAB: QR CODE */}
          {activeTab === 'qr' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
              <div className="font-bold text-slate-900 text-sm flex items-center justify-center space-x-2">
                <QrCodeIcon className="w-4 h-4 text-indigo-600" />
                <span>Pindai QR Code untuk Membuka & Pasang di HP</span>
              </div>
              <p className="text-slate-600 text-xs">
                Arahkan kamera HP (Android atau iPhone) ke kode QR di bawah ini untuk membuka aplikasi secara langsung:
              </p>

              {qrCodeDataUrl ? (
                <div className="flex justify-center p-2">
                  <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200 inline-block">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code Akses Aplikasi"
                      className="w-44 h-44 rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div className="w-44 h-44 mx-auto bg-slate-200 rounded-xl flex items-center justify-center animate-pulse">
                  <span>Memuat QR...</span>
                </div>
              )}
            </div>
          )}

          {/* Link Sharing Utility */}
          <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-slate-600 min-w-0 w-full sm:w-auto">
              <Globe className="w-4 h-4 shrink-0 text-slate-500" />
              <span className="truncate text-[11px] font-mono select-all">
                {window.location.href}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full sm:w-auto px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl font-bold flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 transition-colors text-[11px]"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin Tautan</span>
                </>
              )}
            </button>
          </div>

          {/* Offline & Feature Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">Offline Siap</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">Kamera Cepat</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">GPS Akurat</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">Hemat Kuota</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Sistem Presensi Digital Terpadu © {new Date().getFullYear()}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
