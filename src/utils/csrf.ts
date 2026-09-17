/**
 * Modul Proteksi CSRF (Cross-Site Request Forgery)
 * Mengelola perolehan token terenkripsi yang disimpan dalam HTTP-only cookie oleh server
 * dan diverifikasi melalui header X-CSRF-Token pada setiap operasi pengubah status data
 * (seperti pembaruan log biometrik, sinkronisasi database, dan perizinan).
 */

import { emitRateLimitViolation } from './rateLimiter';
import { getActiveTokenSessionSync } from './auth';

const CSRF_SESSION_KEY = 'school_presensi_csrf_val';
let currentClientCsrfToken: string | null = null;
let isInitializingCsrf = false;

/**
 * Hasilkan token cadangan kriptografis lokal jika jaringan server belum siap
 */
export function generateLocalCryptoToken(): string {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint8Array(32);
      window.crypto.getRandomValues(buffer);
      return Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback
  }
  return 'csrf_loc_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Inisialisasi token CSRF dari server backend
 * Server akan menyematkan HTTP-only cookie `csrf_token` dan mengembalikan token untuk header request
 */
export async function initializeServerCsrf(): Promise<string> {
  if (currentClientCsrfToken) return currentClientCsrfToken;

  if (isInitializingCsrf) {
    // Tunggu sesaat jika inisialisasi sedang berjalan
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (currentClientCsrfToken) return currentClientCsrfToken;
  }

  isInitializingCsrf = true;

  try {
    const res = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include', // Penting: izinkan penerimaan HTTP-Only cookie dari server
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        currentClientCsrfToken = data.csrfToken;
        try {
          sessionStorage.setItem(CSRF_SESSION_KEY, data.csrfToken);
        } catch {
          // In-memory fallback
        }
        isInitializingCsrf = false;
        return data.csrfToken;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat token CSRF dari server backend, menggunakan fallback token:', err);
  }

  // Fallback lokal jika server belum merespon
  if (!currentClientCsrfToken) {
    try {
      const cached = sessionStorage.getItem(CSRF_SESSION_KEY);
      if (cached) {
        currentClientCsrfToken = cached;
        isInitializingCsrf = false;
        return cached;
      }
    } catch {
      // Ignore
    }
    const local = generateLocalCryptoToken();
    currentClientCsrfToken = local;
    try {
      sessionStorage.setItem(CSRF_SESSION_KEY, local);
    } catch {
      // Ignore
    }
  }

  isInitializingCsrf = false;
  return currentClientCsrfToken;
}

/**
 * Ambil token CSRF aktif untuk disematkan pada Header X-CSRF-Token
 */
export function getCSRFToken(): string {
  if (currentClientCsrfToken) return currentClientCsrfToken;
  try {
    const cached = sessionStorage.getItem(CSRF_SESSION_KEY);
    if (cached) {
      currentClientCsrfToken = cached;
      return cached;
    }
  } catch {
    // Ignore
  }
  const token = generateLocalCryptoToken();
  currentClientCsrfToken = token;
  return token;
}

/**
 * Memverifikasi integritas asal permintaan (Same-Origin Verification)
 */
export function isSameOriginRequest(): boolean {
  if (typeof window === 'undefined') return true;
  const currentOrigin = window.location.origin;
  const referer = document.referrer;
  if (!referer) return true;
  try {
    const refererOrigin = new URL(referer).origin;
    return refererOrigin === currentOrigin;
  } catch {
    return false;
  }
}

/**
 * Wrapper Fetch Aman yang secara otomatis menyisipkan token CSRF pada header,
 * menyematkan token otorisasi Bearer dari sesi aktif pengguna,
 * menyertakan HTTP-only cookies, dan memantau respons pembatasan laju (Rate Limit 429).
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  const token = await initializeServerCsrf();

  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');

  // Automatically attach active session Bearer token if not explicitly provided
  if (!headers.has('Authorization')) {
    const activeSession = getActiveTokenSessionSync();
    if (activeSession && activeSession.token) {
      headers.set('Authorization', `Bearer ${activeSession.token}`);
    }
  }

  if (isStateChanging) {
    headers.set('X-CSRF-Token', token);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Selalu sertakan HTTP-only cookies
  });

  // Catch Rate Limiter (HTTP 429) & log suspicious activity event
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30;
    emitRateLimitViolation({
      keyPrefix: url.replace('/api/', '').split('?')[0],
      identifier: 'active_session_client',
      retryAfterSeconds: retryAfterSec,
      message: `Permintaan ke endpoint [${url}] diblokir oleh Server Rate Limiter karena melampaui ambang batas keamanan. Coba lagi dalam ${retryAfterSec} detik.`,
      source: 'server',
      endpoint: url,
    });
  }

  return response;
}

/**
 * Mengambil log aktivitas mencurigakan dari server untuk dashboard pemantauan admin
 */
export async function fetchServerSuspiciousActivities(): Promise<{ success: boolean; activities: any[] }> {
  try {
    const res = await secureFetch('/api/security/suspicious-activities', {
      method: 'GET',
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, activities: data.activities || [] };
    }
  } catch (err) {
    console.warn('Gagal memuat log aktivitas mencurigakan dari server:', err);
  }
  return { success: false, activities: [] };
}

/**
 * Panggilan aman untuk pembaruan log biometrik dengan proteksi CSRF
 */
export async function sendBiometricLogUpdate(payload: Record<string, unknown>): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await secureFetch('/api/biometric-logs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP error ${res.status}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengirim log biometrik' };
  }
}

/**
 * Panggilan aman untuk sinkronisasi database dengan proteksi CSRF
 */
export async function sendDatabaseSync(payload: Record<string, unknown>): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await secureFetch('/api/sync/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP error ${res.status}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal sinkronisasi database' };
  }
}
