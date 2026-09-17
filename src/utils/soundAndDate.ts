/**
 * Centralized Indonesian (id-ID) & Waktu Indonesia Tengah (WITA - Asia/Makassar)
 * formatting utilities for SMPN 4 Satu Atap Taliabu Barat, Kabupaten Pulau Taliabu.
 */

export const WITA_TIMEZONE = 'Asia/Makassar';

/**
 * Returns current Date object shifted/referenced in WITA (UTC+8)
 */
export const getWitaDate = (): Date => {
  return new Date();
};

/**
 * Returns current date string formatted as YYYY-MM-DD in WITA
 */
export const getWitaDateString = (dateObj: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: WITA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);
  } catch {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

/**
 * Returns current time string in WITA (HH:mm:ss)
 */
export const getWitaTimeString = (dateObj: Date = new Date(), withSeconds: boolean = true): string => {
  try {
    return dateObj.toLocaleTimeString('id-ID', {
      timeZone: WITA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false,
    });
  } catch {
    return dateObj.toTimeString().split(' ')[0];
  }
};

export const formatTimeIndo = (dateObj: Date | string): string => {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', {
    timeZone: WITA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const formatDateIndo = (dateStr: string | Date): string => {
  if (!dateStr) return '';
  let dateObj: Date;
  if (typeof dateStr === 'string') {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      dateObj = new Date(dateStr);
    }
  } else {
    dateObj = dateStr;
  }

  if (isNaN(dateObj.getTime())) return String(dateStr);

  return dateObj.toLocaleDateString('id-ID', {
    timeZone: WITA_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatDateTimeWita = (dateObj: Date | string = new Date()): string => {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (isNaN(d.getTime())) return String(dateObj);
  const dateFormatted = d.toLocaleDateString('id-ID', {
    timeZone: WITA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString('id-ID', {
    timeZone: WITA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${dateFormatted}, ${timeFormatted} WITA`;
};

/**
 * Format & convert Google Drive sharing URL or direct links to high-quality direct image URL.
 * Handles:
 * - drive.google.com/file/d/{ID}/view
 * - drive.google.com/open?id={ID}
 * - drive.google.com/uc?id={ID}
 * - docs.google.com/uc?export=view&id={ID}
 */
export const formatDriveUrl = (url?: string): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Check if it's a Google Drive link
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    // Extract file ID using regex patterns
    const matchD = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      return `https://lh3.googleusercontent.com/d/${matchD[1]}`;
    }

    const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
    }

    const matchFile = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFile && matchFile[1]) {
      return `https://lh3.googleusercontent.com/d/${matchFile[1]}`;
    }
  }

  return trimmed;
};

export const playBeepSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6 note
    
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // ignore if audio context blocked
  }
};

/**
 * Play a double-chime Firebase Cloud Messaging notification sound
 */
export const playFCMNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = audioCtx.currentTime;

    // Chime 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Chime 2 (Higher, melodic)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  } catch {
    // ignore
  }
};

export const playSuccessChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.55);
  } catch {
    // ignore
  }
};

/**
 * Downloads data as a clean, UTF-8 CSV with Excel BOM
 */
export const downloadCsv = (filename: string, csvContent: string) => {
  const bom = '\uFEFF'; // UTF-8 Byte Order Mark for Excel
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface HolidayCheckResult {
  isHoliday: boolean;
  eventTitle?: string;
  description?: string;
  dateStr?: string;
}

/**
 * Checks if a given YYYY-MM-DD date falls on a holiday or school break
 */
export const checkDateIsHoliday = (
  dateStr: string,
  events: { id: string; title: string; date: string; endDate?: string; type: string; isHoliday: boolean; description?: string }[] = []
): HolidayCheckResult => {
  if (!dateStr || !events || events.length === 0) return { isHoliday: false };

  const matched = events.find((evt) => {
    if (!evt.isHoliday && evt.type !== 'holiday') return false;
    if (evt.date === dateStr) return true;
    if (evt.endDate && dateStr >= evt.date && dateStr <= evt.endDate) return true;
    return false;
  });

  if (matched) {
    return {
      isHoliday: true,
      eventTitle: matched.title,
      description: matched.description || 'Libur Nasional / Libur Akademik Terdaftar',
      dateStr: matched.date,
    };
  }

  return { isHoliday: false };
};

/**
 * Calculates geodesic distance between two GPS coordinates in meters (Haversine formula)
 */
export const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};



