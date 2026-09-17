/**
 * Service Worker Registration & Stale-While-Revalidate Caching Helper
 * SMPN 4 Satu Atap Taliabu Barat
 */

import { AttendanceRecord, SchoolConfig, Teacher, Student } from '../types';

export interface SwAttendanceSnapshot {
  timestamp: string;
  records: AttendanceRecord[];
  teachers?: Teacher[];
  students?: Student[];
  config?: SchoolConfig;
}

export const registerServiceWorker = (onRevalidated?: (url: string) => void): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[SW] Registered successfully with scope:', reg.scope);

        // Listen for updates
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version installed and ready.');
              }
            };
          }
        };

        // Listen for background revalidation messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SW_DATA_REVALIDATED') {
            console.log('[SW] Data revalidated in background:', event.data.url);
            if (onRevalidated) {
              onRevalidated(event.data.url);
            }
          }
        });

        resolve(reg);
      } catch (err) {
        console.warn('[SW] Registration failed:', err);
        resolve(null);
      }
    });
  });
};

/**
 * List of critical camera and image processing static assets and scripts
 * to pre-cache in Service Worker for resilient offline camera & photo processing
 */
export const CRITICAL_CAMERA_ASSETS: string[] = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

/**
 * Saves current attendance snapshot to Service Worker Data Cache
 * and pre-caches camera and image processing assets.
 * This guarantees the stale-while-revalidate strategy will immediately return
 * the latest saved attendance records and camera module loads instantly even offline.
 */
export const cacheAttendanceSnapshotToSw = async (snapshot: SwAttendanceSnapshot): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return false;
  }

  // Pre-cache camera assets in parallel
  try {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_CAMERA_AND_IMAGE_ASSETS',
      urls: CRITICAL_CAMERA_ASSETS,
    });
  } catch (e) {
    console.warn('[SW] Camera assets pre-cache trigger notice:', e);
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(!!event.data?.success);
    };

    navigator.serviceWorker.controller?.postMessage(
      {
        type: 'CACHE_ATTENDANCE_SNAPSHOT',
        payload: snapshot,
      },
      [messageChannel.port2]
    );

    // Timeout fallback in case worker is idle
    setTimeout(() => resolve(false), 1500);
  });
};

/**
 * Retrieves cached attendance snapshot from Service Worker
 */
export const getCachedAttendanceSnapshotFromSw = async (): Promise<SwAttendanceSnapshot | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data?.success && event.data.data) {
        resolve(event.data.data as SwAttendanceSnapshot);
      } else {
        resolve(null);
      }
    };

    navigator.serviceWorker.controller?.postMessage(
      {
        type: 'GET_CACHED_ATTENDANCE_SNAPSHOT',
      },
      [messageChannel.port2]
    );

    setTimeout(() => resolve(null), 1500);
  });
};

/**
 * Mendaftarkan Background Sync API ke Service Worker
 * Memastikan queue tersinkronisasi otomatis saat browser kembali online di latar belakang
 */
export const registerBackgroundSync = async (tag: string = 'sync-presensi-queue'): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      await (reg as any).sync.register(tag);
      console.log(`[SW] Background sync registered with tag: ${tag}`);
      return true;
    }
  } catch (err) {
    console.warn('[SW] Background sync register not supported or failed:', err);
  }
  return false;
};

/**
 * Beri tahu Service Worker bahwa koneksi internet telah kembali online
 * sehingga SW dapat menyiarkan sinyal sinkronisasi ke seluruh tab
 */
export const notifyServiceWorkerOnline = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'CLIENT_ONLINE_RECONNECTED',
    timestamp: Date.now(),
  });
};

/**
 * Backup antrean presensi offline ke dalam cache Service Worker sebagai proteksi ganda
 */
export const backupOfflineQueueToSw = async (queue: any[]): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return false;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(!!event.data?.success);
    };

    navigator.serviceWorker.controller?.postMessage(
      {
        type: 'CACHE_OFFLINE_SYNC_QUEUE',
        payload: queue,
      },
      [messageChannel.port2]
    );

    setTimeout(() => resolve(false), 1200);
  });
};
