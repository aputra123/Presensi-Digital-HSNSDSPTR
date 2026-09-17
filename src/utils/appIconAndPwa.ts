/**
 * Utilities for managing Dynamic App Icons, PWA Manifest, and Universal Device Installation
 * across Android, iOS (iPhone/iPad), Windows, macOS, Linux, and Chromebook laptops.
 */

export interface PresetAppIcon {
  id: string;
  name: string;
  category: 'official' | 'regional' | 'school' | 'modern';
  description: string;
  url: string;
  accentColor: string;
}

export const PRESET_APP_ICONS: PresetAppIcon[] = [
  {
    id: 'kemendikbud',
    name: 'Kemendikbudristek RI',
    category: 'official',
    description: 'Logo Resmi Tut Wuri Handayani - Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_of_Ministry_of_Education_and_Culture_of_Indonesia.svg/240px-Logo_of_Ministry_of_Education_and_Culture_of_Indonesia.svg.png',
    accentColor: '#1e3a8a',
  },
  {
    id: 'taliabu_kab',
    name: 'Kabupaten Pulau Taliabu',
    category: 'regional',
    description: 'Lambang Daerah Resmi Pemerintah Kabupaten Pulau Taliabu, Maluku Utara',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Lambang_Kabupaten_Pulau_Taliabu.png/200px-Lambang_Kabupaten_Pulau_Taliabu.png',
    accentColor: '#059669',
  },
  {
    id: 'smpn4_taliabu',
    name: 'SMPN 4 Satu Atap Taliabu Barat',
    category: 'school',
    description: 'Emblem Institusi SMP Negeri 4 Satu Atap Taliabu Barat - Cerdas, Berkarakter & Berprestasi',
    url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=240&q=80',
    accentColor: '#4f46e5',
  },
  {
    id: 'kemenag',
    name: 'Kementerian Agama RI',
    category: 'official',
    description: 'Logo Ikhlas Beramal - Kementerian Agama Republik Indonesia',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Kementerian_Agama_RI.png/240px-Kementerian_Agama_RI.png',
    accentColor: '#047857',
  },
  {
    id: 'modern_crest',
    name: 'Modern Gold & Navy Shield',
    category: 'modern',
    description: 'Emblem Prestasi Akademik Digital Berkualitas Tinggi',
    url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=240&q=80',
    accentColor: '#d97706',
  },
  {
    id: 'garuda_ri',
    name: 'Garuda Pancasila',
    category: 'official',
    description: 'Lambang Negara Kesatuan Republik Indonesia - Bhinneka Tunggal Ika',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Coat_of_arms_of_Indonesia_Garuda_Pancasila.svg/240px-Coat_of_arms_of_Indonesia_Garuda_Pancasila.svg.png',
    accentColor: '#dc2626',
  },
];

/**
 * Dynamically updates the browser favicon, apple touch icon, and app title
 * in the DOM so that the browser tab, mobile home screen, and bookmark reflect
 * the selected school icon instantly.
 */
export const updateDocumentAppIcon = (iconUrl: string, appName?: string): void => {
  if (typeof document === 'undefined') return;

  try {
    // 1. Update or create favicon link
    let linkFavicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!linkFavicon) {
      linkFavicon = document.createElement('link');
      linkFavicon.rel = 'icon';
      document.head.appendChild(linkFavicon);
    }
    linkFavicon.href = iconUrl;

    // 2. Update or create Apple Touch Icon for iPhone / iPad Home Screen
    let linkApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    if (!linkApple) {
      linkApple = document.createElement('link');
      linkApple.rel = 'apple-touch-icon';
      document.head.appendChild(linkApple);
    }
    linkApple.href = iconUrl;

    // 3. Update title if provided
    if (appName) {
      document.title = appName;
    }
  } catch (err) {
    console.warn('Could not dynamically update document icon tags:', err);
  }
};

/**
 * Initializes the document app icon from localStorage or default fallback
 */
export const initAppIconFromStorage = (fallbackUrl?: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const savedIcon = localStorage.getItem('school_presensi_custom_app_icon');
    if (savedIcon) {
      updateDocumentAppIcon(savedIcon);
    } else if (fallbackUrl) {
      updateDocumentAppIcon(fallbackUrl);
    }
  } catch (err) {
    console.warn('Failed to read app icon from localStorage:', err);
    if (fallbackUrl) {
      updateDocumentAppIcon(fallbackUrl);
    }
  }
};

/**
 * Detects device platform for tailored app installation guidance
 */
export type DevicePlatform = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'chromeos' | 'other';

export interface DevicePlatformDetails {
  platform: DevicePlatform;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  browserName: string;
  osVersionName: string;
  displayName: string;
  hasTouchScreen: boolean;
  isStandalone: boolean;
}

export interface DeviceCompatibilityAudit {
  os: string;
  browser: string;
  isPwaSupported: boolean;
  isCameraSupported: boolean;
  isGeolocationSupported: boolean;
  isOfflineStorageSupported: boolean;
  isBackgroundSyncSupported: boolean;
  isWebShareSupported: boolean;
  screenDimensions: string;
  touchEnabled: boolean;
  isReadyForAllFeatures: boolean;
}

export const detectDevicePlatform = (): DevicePlatformDetails => {
  if (typeof navigator === 'undefined') {
    return {
      platform: 'other',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      browserName: 'Browser',
      osVersionName: 'Sistem Operasi Web',
      displayName: 'Perangkat Universal',
      hasTouchScreen: false,
      isStandalone: false,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  let platform: DevicePlatform = 'other';
  let isMobile = false;
  let isTablet = false;
  let isDesktop = false;
  let browserName = 'Browser Web Universal';
  let osVersionName = 'Sistem Operasi Standar';

  const hasTouchScreen =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // 1. Android Detection (Phones & Tablets)
  if (/android/.test(ua)) {
    platform = 'android';
    isTablet = /tablet|sm-t|gt-p/.test(ua) || (hasTouchScreen && window.innerWidth >= 600);
    isMobile = !isTablet;
    osVersionName = 'Android OS (Mobile / Tablet)';

    if (/samsungbrowser/.test(ua)) {
      browserName = 'Samsung Internet';
    } else if (/miuibrowser|xiaomi/.test(ua)) {
      browserName = 'Mi Browser / HyperOS';
    } else if (/opr\/|opera/.test(ua)) {
      browserName = 'Opera Mobile';
    } else if (/firefox/.test(ua)) {
      browserName = 'Firefox Android';
    } else if (/edg/.test(ua)) {
      browserName = 'Microsoft Edge Android';
    } else if (/chrome/.test(ua)) {
      browserName = 'Google Chrome Android';
    } else {
      browserName = 'Peramban Android';
    }
  }
  // 2. iOS Detection (iPhone, iPad, iPod)
  else if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    platform = 'ios';
    isTablet = /ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    isMobile = !isTablet;
    osVersionName = isTablet ? 'Apple iPadOS' : 'Apple iOS (iPhone)';

    if (/crios/.test(ua)) {
      browserName = 'Google Chrome iOS';
    } else if (/edgios/.test(ua)) {
      browserName = 'Microsoft Edge iOS';
    } else if (/fxios/.test(ua)) {
      browserName = 'Firefox iOS';
    } else if (/safari/.test(ua)) {
      browserName = 'Apple Safari iOS';
    } else {
      browserName = 'WebKit WebApp iOS';
    }
  }
  // 3. ChromeOS / Chromebook Detection
  else if (/cros/.test(ua)) {
    platform = 'chromeos';
    isDesktop = true;
    osVersionName = 'Google ChromeOS (Chromebook)';
    browserName = 'Google Chrome PWA';
  }
  // 4. Windows Detection (Windows 11, 10, 8, 7)
  else if (/windows/.test(ua)) {
    platform = 'windows';
    isDesktop = true;
    osVersionName = /windows nt 10\.0/.test(ua) ? 'Microsoft Windows 10/11' : 'Microsoft Windows';

    if (/edg/.test(ua)) {
      browserName = 'Microsoft Edge Windows';
    } else if (/chrome/.test(ua)) {
      browserName = 'Google Chrome Windows';
    } else if (/firefox/.test(ua)) {
      browserName = 'Mozilla Firefox Windows';
    } else if (/brave/.test(ua)) {
      browserName = 'Brave Browser Windows';
    } else {
      browserName = 'Browser Komputer Windows';
    }
  }
  // 5. macOS Detection (MacBook, iMac, Mac mini)
  else if (/macintosh|mac os x/.test(ua)) {
    platform = 'mac';
    isDesktop = true;
    osVersionName = 'Apple macOS (MacBook / iMac)';

    if (/chrome/.test(ua)) {
      browserName = 'Google Chrome macOS';
    } else if (/safari/.test(ua) && !/chrome/.test(ua)) {
      browserName = 'Apple Safari macOS';
    } else if (/firefox/.test(ua)) {
      browserName = 'Mozilla Firefox macOS';
    } else if (/edg/.test(ua)) {
      browserName = 'Microsoft Edge macOS';
    } else {
      browserName = 'Browser Mac';
    }
  }
  // 6. Linux Detection (Ubuntu, Debian, Fedora, Arch, Mint)
  else if (/linux/.test(ua)) {
    platform = 'linux';
    isDesktop = true;
    osVersionName = 'Linux OS (Ubuntu / Debian / Fedora / Arch)';

    if (/chrome/.test(ua)) {
      browserName = 'Google Chrome / Chromium Linux';
    } else if (/firefox/.test(ua)) {
      browserName = 'Mozilla Firefox Linux';
    } else {
      browserName = 'Browser Komputer Linux';
    }
  } else {
    isDesktop = !hasTouchScreen;
    isMobile = hasTouchScreen;
  }

  const displayNames: Record<DevicePlatform, string> = {
    android: 'HP / Tablet Android (Samsung, Xiaomi, Oppo, Vivo, Realme, dll)',
    ios: 'Apple iPhone / iPad (iOS & iPadOS)',
    windows: 'Laptop & Komputer Windows (10 / 11)',
    mac: 'MacBook & Komputer Mac (macOS)',
    linux: 'Laptop & Desktop Linux (Ubuntu, Debian, Fedora, Mint)',
    chromeos: 'Chromebook / Google ChromeOS',
    other: 'Semua Jenis HP & Laptop / Komputer',
  };

  const isStandalone = isAppRunningStandalone();

  return {
    platform,
    isMobile,
    isTablet,
    isDesktop,
    browserName,
    osVersionName,
    displayName: displayNames[platform] || 'Semua Jenis HP & Laptop',
    hasTouchScreen,
    isStandalone,
  };
};

/**
 * Automatically applies OS-specific CSS classes and polyfills to document.documentElement
 * (e.g., .os-ios, .os-android, .os-windows, .os-macos, .os-linux) for layout & camera compatibility
 */
export const applyDevicePlatformToDom = (): DevicePlatformDetails => {
  const details = detectDevicePlatform();
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    // Remove previous OS classes
    root.classList.remove('os-ios', 'os-android', 'os-windows', 'os-mac', 'os-linux', 'os-chromeos', 'os-other', 'os-mobile', 'os-desktop');
    root.classList.add(`os-${details.platform}`);
    if (details.isMobile || details.isTablet) {
      root.classList.add('os-mobile');
    } else {
      root.classList.add('os-desktop');
    }
  }
  return details;
};

/**
 * Runs a real-time hardware & API capability audit across any OS and browser
 */
export const getDeviceCompatibilityReport = (): DeviceCompatibilityAudit => {
  const details = detectDevicePlatform();
  const isPwaSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
  const isCameraSupported =
    typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const isGeolocationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const isOfflineStorageSupported = typeof window !== 'undefined' && 'localStorage' in window;
  const isBackgroundSyncSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'SyncManager' in (window as any);
  const isWebShareSupported = typeof navigator !== 'undefined' && !!(navigator as any).share;

  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  const screenDimensions = `${width} × ${height} px`;

  const isReadyForAllFeatures =
    isCameraSupported && isGeolocationSupported && isOfflineStorageSupported;

  return {
    os: details.osVersionName,
    browser: details.browserName,
    isPwaSupported,
    isCameraSupported,
    isGeolocationSupported,
    isOfflineStorageSupported,
    isBackgroundSyncSupported,
    isWebShareSupported,
    screenDimensions,
    touchEnabled: details.hasTouchScreen,
    isReadyForAllFeatures,
  };
};

/**
 * Detects whether the app is currently running in standalone PWA window mode
 */
export const isAppRunningStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

/**
 * Generates and triggers download for a Windows Internet Shortcut (.url)
 */
export const downloadDesktopLauncherShortcut = (
  schoolName: string,
  url: string = window.location.href
): void => {
  try {
    const cleanName = schoolName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const content = `[InternetShortcut]\nURL=${url}\nIconIndex=0\nHotKey=0\n[{000214A0-0000-0000-C000-000000000046}]\nProp3=19,2\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Presensi_${cleanName}.url`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to generate launcher shortcut:', err);
  }
};

/**
 * Generates and triggers download for a Windows Standalone App Batch Launcher (.bat)
 * Opens Chrome or Edge in native clean windowed app mode
 */
export const downloadWindowsBatchLauncher = (
  schoolName: string,
  url: string = window.location.href
): void => {
  try {
    const cleanName = schoolName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const batContent = `@echo off
title Membuka Aplikasi Presensi ${schoolName}
echo ===================================================
echo Membuka Aplikasi Presensi Digital Sekolah...
echo Kompatibel untuk Windows 10 dan Windows 11
echo ===================================================

REM 1. Coba buka dengan Microsoft Edge dalam mode App Window
start msedge.exe --app="${url}" 2>nul
if %errorlevel% equ 0 goto selesai

REM 2. Coba buka dengan Google Chrome dalam mode App Window
start chrome.exe --app="${url}" 2>nul
if %errorlevel% equ 0 goto selesai

REM 3. Fallback buka dengan peramban default
start "" "${url}"

:selesai
exit
`;
    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Buka_Presensi_${cleanName}_Windows.bat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to generate Windows batch launcher:', err);
  }
};

/**
 * Generates and triggers download for a Linux Desktop Entry Launcher (.desktop)
 * Compliant with FreeDesktop.org standards for Ubuntu, Debian, Fedora, Arch, Mint
 */
export const downloadLinuxDesktopLauncher = (
  schoolName: string,
  url: string = window.location.href
): void => {
  try {
    const cleanName = schoolName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=Presensi Digital ${schoolName}
Comment=Sistem Presensi Digital Terpadu Biometrik Wajah & GPS
Exec=xdg-open "${url}"
Icon=applications-education
Terminal=false
Categories=Education;Office;Utility;
StartupNotify=true
Actions=NewWindow;

[Desktop Action NewWindow]
Name=Buka Jendela Presensi
Exec=xdg-open "${url}"
`;
    const blob = new Blob([desktopContent], { type: 'application/x-desktop;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `presensi_${cleanName.toLowerCase()}.desktop`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to generate Linux desktop launcher:', err);
  }
};

/**
 * Generates and triggers download for a macOS Shell Command Launcher (.command)
 * Opens Google Chrome or Safari in clean application mode
 */
export const downloadMacOsCommandLauncher = (
  schoolName: string,
  url: string = window.location.href
): void => {
  try {
    const cleanName = schoolName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const commandContent = `#!/bin/bash
# Launcher Aplikasi Presensi Digital Sekolah untuk macOS
# Buka di Google Chrome mode app jika ada, atau buka di Safari
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="${url}"
else
  open "${url}"
fi
`;
    const blob = new Blob([commandContent], { type: 'text/x-shellscript;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Buka_Presensi_${cleanName}_macOS.command`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to generate macOS command launcher:', err);
  }
};

/**
 * Downloads an offline standalone HTML launcher file that can be kept in phone Downloads or computer desktop
 */
export const downloadOfflineLauncherHtml = (
  schoolName: string,
  url: string = window.location.href
): void => {
  try {
    const cleanName = schoolName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#4f46e5">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>Membuka Presensi Digital ${schoolName}...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; padding: 32px 24px; border-radius: 24px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); border: 1px solid #334155; }
    .icon-box { width: 64px; height: 64px; background: linear-gradient(135deg, #4f46e5, #3b82f6); border-radius: 18px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4); }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    p.sub { margin: 0 0 20px; color: #94a3b8; font-size: 13px; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; border-radius: 999px; font-size: 11px; font-weight: 700; margin-bottom: 20px; }
    .btn { display: block; width: 100%; padding: 14px 20px; background: linear-gradient(135deg, #4f46e5, #4338ca); color: white; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 10px 20px -5px rgba(79, 70, 229, 0.5); box-sizing: border-box; transition: transform 0.15s; }
    .btn:active { transform: scale(0.98); }
    .note { margin-top: 16px; font-size: 11px; color: #64748b; line-height: 1.4; }
  </style>
  <script>
    // Automatic immediate redirection
    setTimeout(function() {
      window.location.href = "${url}";
    }, 400);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon-box">🏫</div>
    <span class="badge">Universal Multi-OS Launcher</span>
    <h2>Presensi Sekolah Digital</h2>
    <p class="sub">${schoolName}</p>
    <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 24px;">Sedang mengalihkan ke aplikasi presensi resmi sekolah...</p>
    <a href="${url}" class="btn">Buka Presensi Sekarang</a>
    <p class="note">Simpan file ini di layar utama HP atau desktop laptop Anda untuk akses cepat kapan saja.</p>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Buka_Presensi_${cleanName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to generate HTML launcher:', err);
  }
};

