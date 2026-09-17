/**
 * Browser Web Push & Desktop Notification Utility
 * SMPN 4 Satu Atap Taliabu Barat
 * 
 * Provides real-time browser push notifications for teachers and staff
 * when GTK service requests or leaves are approved or rejected by the Principal / Admin.
 */

export interface GtkPushNotificationPayload {
  teacherName: string;
  serviceTitle: string;
  status: 'approved' | 'rejected' | 'returned' | 'approved_by_kepsek' | 'approved_by_admin';
  reviewerName?: string;
  note?: string;
  letterNumber?: string;
}

export interface StoredNotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'approved' | 'rejected' | 'info';
  teacherName: string;
  read: boolean;
}

const STORAGE_KEY = 'smpn4_gtk_browser_notifications';

/**
 * Check if the browser supports Desktop / Web Push Notifications
 */
export const isBrowserNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Get current browser notification permission status
 */
export const getBrowserNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Request notification permission from the user
 */
export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return Notification.permission;
  }
};

/**
 * Store a notification event in local storage for in-app history
 */
export const saveInAppNotification = (item: Omit<StoredNotificationItem, 'id' | 'timestamp' | 'read'>): StoredNotificationItem => {
  const newItem: StoredNotificationItem = {
    ...item,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
    read: false,
  };

  try {
    const existingStr = localStorage.getItem(STORAGE_KEY);
    const list: StoredNotificationItem[] = existingStr ? JSON.parse(existingStr) : [];
    const updated = [newItem, ...list].slice(0, 30); // keep last 30
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save in-app notification:', err);
  }

  return newItem;
};

/**
 * Retrieve saved notification history
 */
export const getStoredNotifications = (): StoredNotificationItem[] => {
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY);
    return existingStr ? JSON.parse(existingStr) : [];
  } catch {
    return [];
  }
};

/**
 * Clear stored notification history
 */
export const clearStoredNotifications = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear notifications:', err);
  }
};

/**
 * Trigger native browser desktop notification and in-app alert
 */
export const notifyGtkStatusChange = async (payload: GtkPushNotificationPayload): Promise<{
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  message: string;
}> => {
  const { teacherName, serviceTitle, status, reviewerName, note, letterNumber } = payload;

  let title = '';
  let body = '';
  let type: 'approved' | 'rejected' | 'info' = 'info';

  if (status === 'approved' || status === 'approved_by_kepsek') {
    type = 'approved';
    title = `✅ Pengajuan GTK Disetujui: ${serviceTitle}`;
    body = `Yth. ${teacherName}, pengajuan layanan Anda telah DISETUJUI oleh ${reviewerName || 'Kepala Sekolah'}.${
      note ? ` Catatan: "${note}"` : ''
    }${letterNumber ? ` No Surat: ${letterNumber}` : ''}`;
  } else if (status === 'rejected') {
    type = 'rejected';
    title = `⚠️ Pengajuan GTK Ditolak: ${serviceTitle}`;
    body = `Yth. ${teacherName}, pengajuan layanan Anda DITOLAK oleh ${reviewerName || 'Kepala Sekolah'}.${
      note ? ` Alasan: "${note}"` : ''
    }`;
  } else if (status === 'returned') {
    type = 'info';
    title = `↩️ Berkas GTK Dikembalikan (Revisi): ${serviceTitle}`;
    body = `Yth. ${teacherName}, berkas pengajuan layanan Anda DIKEMBALIKAN oleh ${reviewerName || 'Kepala Sekolah'} untuk dilengkapi/diperbaiki.${
      note ? ` Catatan: "${note}"` : ''
    }`;
  } else {
    title = `📋 Status Layanan GTK Diperbarui: ${serviceTitle}`;
    body = `Yth. ${teacherName}, terdapat pembaruan status pada pengajuan layanan Anda.`;
  }

  // Always store in in-app notification list
  saveInAppNotification({
    title,
    message: body,
    type,
    teacherName,
  });

  const permission = getBrowserNotificationPermission();

  if (permission === 'granted') {
    try {
      // Try service worker notification first for background push capability
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `gtk-service-${Date.now()}`,
            data: { url: window.location.href },
          });
          return { success: true, permission, message: 'Notifikasi push browser terkirim.' };
        }
      }

      // Fallback to standard Window Notification API
      const notif = new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag: `gtk-service-${Date.now()}`,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return { success: true, permission, message: 'Notifikasi desktop browser terkirim.' };
    } catch (err: any) {
      console.warn('Native notification error:', err);
      return { success: false, permission, message: 'Gagal mengirim notifikasi native: ' + err.message };
    }
  }

  return {
    success: false,
    permission,
    message: 'Izin notifikasi browser belum diberikan. Notifikasi tersimpan di riwayat aplikasi.',
  };
};
