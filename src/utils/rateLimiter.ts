/**
 * Modul Rate Limiting & Anti-Brute Force Protection menggunakan Sliding Window Algorithm
 * Melindungi endpoint dan aksi sensitif (auth, leave requests, GTK services, scan presensi, sync)
 * dari serangan brute-force, credential stuffing, dan spamming.
 */

export interface SlidingWindowResult {
  allowed: boolean;
  remaining: number;
  remainingAttempts: number;
  totalInWindow: number;
  retryAfterSeconds: number;
  lockoutSeconds: number;
  message?: string;
  isSuspicious?: boolean;
}

export interface SuspiciousRateLimitEvent {
  id: string;
  keyPrefix: string;
  identifier: string;
  timestamp: string;
  retryAfterSeconds: number;
  message: string;
  source: 'client' | 'server';
  endpoint?: string;
}

type RateLimitViolationListener = (event: SuspiciousRateLimitEvent) => void;
const violationListeners: Set<RateLimitViolationListener> = new Set();
const recentViolationsHistory: SuspiciousRateLimitEvent[] = [];

/**
 * Register a listener to capture suspicious rate limit violations for ActivityLog
 */
export function onRateLimitViolation(listener: RateLimitViolationListener): () => void {
  violationListeners.add(listener);
  return () => {
    violationListeners.delete(listener);
  };
}

/**
 * Emit a rate limit violation event to all subscribers and record in history
 */
export function emitRateLimitViolation(eventData: Omit<SuspiciousRateLimitEvent, 'id' | 'timestamp'>): void {
  const event: SuspiciousRateLimitEvent = {
    id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...eventData,
  };

  recentViolationsHistory.unshift(event);
  if (recentViolationsHistory.length > 100) {
    recentViolationsHistory.pop();
  }

  violationListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.warn('Error in rate limit violation listener:', e);
    }
  });
}

export function getRecentRateLimitViolations(): SuspiciousRateLimitEvent[] {
  return [...recentViolationsHistory];
}

export class SlidingWindowRateLimiter {
  private keyPrefix: string;
  private maxRequests: number;
  private windowMs: number;
  private lockoutDurationMs: number;
  private windowLogs: Map<string, number[]>;
  private lockoutUntil: Map<string, number>;

  constructor(options: {
    keyPrefix: string;
    maxRequests: number;
    windowMs: number;
    lockoutDurationMs?: number;
  }) {
    this.keyPrefix = options.keyPrefix;
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.lockoutDurationMs = options.lockoutDurationMs || options.windowMs;
    this.windowLogs = new Map();
    this.lockoutUntil = new Map();
  }

  private getKey(identifier: string): string {
    return `${this.keyPrefix}:${identifier}`;
  }

  /**
   * Cek status sliding window tanpa menambah count
   */
  public check(identifier: string): SlidingWindowResult {
    const key = this.getKey(identifier);
    const now = Date.now();

    // Periksa apakah sedang dalam periode lockout
    const lockedUntil = this.lockoutUntil.get(key);
    if (lockedUntil && lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      const msg = `Terlalu banyak permintaan (Sliding Window). Coba lagi dalam ${remainingSeconds} detik.`;
      return {
        allowed: false,
        remaining: 0,
        remainingAttempts: 0,
        totalInWindow: this.maxRequests,
        retryAfterSeconds: remainingSeconds,
        lockoutSeconds: remainingSeconds,
        message: msg,
        isSuspicious: true,
      };
    }

    // Bersihkan log timestamp di luar jendela sliding aktif
    const windowStart = now - this.windowMs;
    const timestamps = (this.windowLogs.get(key) || []).filter((t) => t > windowStart);
    this.windowLogs.set(key, timestamps);

    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0];
      const retryAfter = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      const msg = `Batas frekuensi permintaan terlampaui. Harap tunggu ${retryAfter} detik.`;
      return {
        allowed: false,
        remaining: 0,
        remainingAttempts: 0,
        totalInWindow: timestamps.length,
        retryAfterSeconds: retryAfter,
        lockoutSeconds: retryAfter,
        message: msg,
        isSuspicious: true,
      };
    }

    const remaining = this.maxRequests - timestamps.length;
    return {
      allowed: true,
      remaining,
      remainingAttempts: remaining,
      totalInWindow: timestamps.length,
      retryAfterSeconds: 0,
      lockoutSeconds: 0,
      isSuspicious: false,
    };
  }

  /**
   * Rekam request ke dalam sliding window
   */
  public record(identifier: string): SlidingWindowResult {
    const key = this.getKey(identifier);
    const now = Date.now();

    // Cek lockout
    const lockedUntil = this.lockoutUntil.get(key);
    if (lockedUntil && lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      const msg = `Akses dibatasi sementara karena aktivitas tidak wajar. Coba lagi dalam ${remainingSeconds} detik.`;

      emitRateLimitViolation({
        keyPrefix: this.keyPrefix,
        identifier,
        retryAfterSeconds: remainingSeconds,
        message: msg,
        source: 'client',
      });

      return {
        allowed: false,
        remaining: 0,
        remainingAttempts: 0,
        totalInWindow: this.maxRequests,
        retryAfterSeconds: remainingSeconds,
        lockoutSeconds: remainingSeconds,
        message: msg,
        isSuspicious: true,
      };
    }

    // Bersihkan timestamp kadaluwarsa
    const windowStart = now - this.windowMs;
    let timestamps = (this.windowLogs.get(key) || []).filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      // Masuk mode lockout
      const lockTime = now + this.lockoutDurationMs;
      this.lockoutUntil.set(key, lockTime);
      const retryAfter = Math.ceil(this.lockoutDurationMs / 1000);
      const msg = `Batas ambang permintaan terlampaui pada modul [${this.keyPrefix}]. Operasi dikunci selama ${retryAfter} detik.`;

      emitRateLimitViolation({
        keyPrefix: this.keyPrefix,
        identifier,
        retryAfterSeconds: retryAfter,
        message: msg,
        source: 'client',
      });

      return {
        allowed: false,
        remaining: 0,
        remainingAttempts: 0,
        totalInWindow: timestamps.length,
        retryAfterSeconds: retryAfter,
        lockoutSeconds: retryAfter,
        message: msg,
        isSuspicious: true,
      };
    }

    // Tambahkan timestamp saat ini ke sliding window log
    timestamps.push(now);
    this.windowLogs.set(key, timestamps);

    const remaining = Math.max(0, this.maxRequests - timestamps.length);
    return {
      allowed: true,
      remaining,
      remainingAttempts: remaining,
      totalInWindow: timestamps.length,
      retryAfterSeconds: 0,
      lockoutSeconds: 0,
      isSuspicious: false,
    };
  }

  /**
   * Reset sliding window log (contoh: saat berhasil otentikasi)
   */
  public reset(identifier: string): void {
    const key = this.getKey(identifier);
    this.windowLogs.delete(key);
    this.lockoutUntil.delete(key);
  }
}

// 1. Sliding Window Rate Limiter untuk Autentikasi (Maks 5 percobaan per 5 menit)
export const authRateLimiter = new SlidingWindowRateLimiter({
  keyPrefix: 'auth_attempt',
  maxRequests: 5,
  windowMs: 5 * 60 * 1000,
  lockoutDurationMs: 60 * 1000,
});

// 2. Sliding Window Rate Limiter untuk Pengajuan Dispensasi/Izin (Maks 8 pengajuan per 3 menit)
export const leaveRequestSlidingLimiter = new SlidingWindowRateLimiter({
  keyPrefix: 'leave_submit',
  maxRequests: 8,
  windowMs: 3 * 60 * 1000,
  lockoutDurationMs: 30 * 1000,
});
export const leaveRequestLimiter = leaveRequestSlidingLimiter;

// 3. Sliding Window Rate Limiter untuk Layanan GTK & Surat Tugas (Maks 8 pengajuan per 3 menit)
export const gtkServiceSlidingLimiter = new SlidingWindowRateLimiter({
  keyPrefix: 'gtk_service',
  maxRequests: 8,
  windowMs: 3 * 60 * 1000,
  lockoutDurationMs: 30 * 1000,
});
export const gtkServiceLimiter = gtkServiceSlidingLimiter;

// 4. Sliding Window Rate Limiter untuk Pemindaian Presensi / QR (Maks 20 scan per 30 detik)
export const attendanceScanLimiter = new SlidingWindowRateLimiter({
  keyPrefix: 'scan_attendance',
  maxRequests: 20,
  windowMs: 30 * 1000,
  lockoutDurationMs: 5 * 1000,
});

// 5. Sliding Window Rate Limiter untuk Sinkronisasi Cloud Database (Maks 25 sync per 60 detik)
export const syncCloudLimiter = new SlidingWindowRateLimiter({
  keyPrefix: 'sync_cloud',
  maxRequests: 25,
  windowMs: 60 * 1000,
  lockoutDurationMs: 15 * 1000,
});
