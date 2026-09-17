// Google Workspace Client Integration (Drive, Sheets, Calendar, Gmail, Google Picker)

export interface GoogleSyncResult {
  success: boolean;
  message: string;
  link?: string;
}

// ----------------------------------------------------
// Google Picker API Integration
// ----------------------------------------------------
export interface PickedGoogleFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  description?: string;
  sizeBytes?: number;
  lastEditedUtc?: number;
}

export const loadGooglePickerScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if ((window as any).google?.picker) {
      resolve();
      return;
    }

    const onGapiLoad = () => {
      const gapi = (window as any).gapi;
      if (gapi && gapi.load) {
        gapi.load('picker', {
          callback: () => {
            resolve();
          },
          onerror: (err: any) => reject(err || new Error('Gagal memuat Google Picker API')),
        });
      } else {
        resolve();
      }
    };

    if ((window as any).gapi) {
      onGapiLoad();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = onGapiLoad;
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

export const openGooglePicker = async (
  accessToken: string,
  onPicked: (file: PickedGoogleFile) => void,
  viewType: 'all' | 'sheets' | 'docs' = 'all'
): Promise<void> => {
  await loadGooglePickerScript();

  const google = (window as any).google;
  if (!google || !google.picker) {
    throw new Error('Google Picker API tidak tersedia.');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  let view = new google.picker.DocsView(google.picker.ViewId.DOCS);
  if (viewType === 'sheets') {
    view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
    view.setMimeTypes('application/vnd.google-apps.spreadsheet,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else if (viewType === 'docs') {
    view = new google.picker.DocsView(google.picker.ViewId.DOCS);
  }

  const pickerBuilder = new google.picker.PickerBuilder()
    .addView(view)
    .addView(new google.picker.DocsUploadView())
    .setOAuthToken(accessToken)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        const file = data.docs && data.docs[0];
        if (file) {
          onPicked({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            url: file.url,
            description: file.description,
            sizeBytes: file.sizeBytes,
            lastEditedUtc: file.lastEditedUtc,
          });
        }
      }
    })
    .setOrigin(pickerOrigin);

  const picker = pickerBuilder.build();
  picker.setVisible(true);
};


// 1. Export Attendance to Google Sheets
export const exportToGoogleSheet = async (
  token: string,
  title: string,
  rows: (string | number)[][]
): Promise<GoogleSyncResult> => {
  try {
    // Create new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: title,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Gagal membuat Google Sheet');
    }

    const sheetData = await createRes.json();
    const spreadsheetId = sheetData.spreadsheetId;

    // Append rows
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.error?.message || 'Gagal menulis data ke Google Sheet');
    }

    return {
      success: true,
      message: `Berhasil mengekspor ${rows.length} baris ke Google Sheets!`,
      link: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat mengekspor ke Google Sheets',
    };
  }
};

// 2. Save document/report to Google Drive
export const saveReportToGoogleDrive = async (
  token: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<GoogleSyncResult> => {
  try {
    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', new Blob([content], { type: mimeType }));

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal mengunggah file ke Google Drive');
    }

    const driveData = await res.json();
    return {
      success: true,
      message: `File ${fileName} berhasil disimpan di Google Drive!`,
      link: `https://drive.google.com/file/d/${driveData.id}/view`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat menyimpan ke Google Drive',
    };
  }
};

// 2b. Save binary / Blob (PDF, JPEG) directly to Google Drive
export const saveBlobToGoogleDrive = async (
  token: string,
  fileName: string,
  blob: Blob,
  mimeType: string = 'application/pdf',
  folderId?: string
): Promise<GoogleSyncResult> => {
  try {
    const metadata: any = {
      name: fileName,
      mimeType: mimeType,
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', blob);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal mengunggah file ke Google Drive');
    }

    const driveData = await res.json();
    return {
      success: true,
      message: `Salinan berkas ${fileName} berhasil disimpan di Google Drive sekolah!`,
      link: `https://drive.google.com/file/d/${driveData.id}/view`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat menyimpan ke Google Drive',
    };
  }
};

// 3. Create Event in Google Calendar (e.g. GTK Dinas Luar, Kalender Akademik)
export const addEventToGoogleCalendar = async (
  token: string,
  summary: string,
  description: string,
  startDate: string,
  endDate: string,
  location?: string
): Promise<GoogleSyncResult> => {
  try {
    const eventBody = {
      summary,
      description,
      location: location || 'SMAN 1 Nusantara',
      start: {
        date: startDate,
      },
      end: {
        date: endDate,
      },
    };

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal menambahkan jadwal ke Google Calendar');
    }

    const data = await res.json();
    return {
      success: true,
      message: `Jadwal "${summary}" berhasil disinkronkan ke Google Calendar!`,
      link: data.htmlLink,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan sinkronisasi Google Calendar',
    };
  }
};

// 4. Send Official Email Notification via Gmail API
export const sendOfficialEmailNotification = async (
  token: string,
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<GoogleSyncResult> => {
  try {
    const emailLines = [
      `To: ${toEmail}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      bodyText,
    ];

    const rawMessage = btoa(unescape(encodeURIComponent(emailLines.join('\r\n'))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: rawMessage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal mengirim email notifikasi via Gmail');
    }

    return {
      success: true,
      message: `Surat pemberitahuan resmi berhasil dikirim ke ${toEmail} via Gmail!`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Gagal mengirim email via Gmail',
    };
  }
};

// ==========================================
// 5. IMPORT / SYNC FROM GOOGLE SHEETS
// ==========================================

import {
  Student,
  Teacher,
  SchoolClass,
  EmploymentStatus,
} from '../types';

export const extractSpreadsheetId = (input: string): string => {
  const trimmed = input.trim();
  // Match standard URL format: https://docs.google.com/spreadsheets/d/{ID}/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Otherwise assume it's directly the ID
  return trimmed;
};

// Parse Tab-separated or CSV text into 2D array
export const parseRawSheetText = (text: string): string[][] => {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    }
    // Simple CSV splitter handling basic commas
    return line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
  });
};

export const parseStudentsFromRows = (
  rows: string[][],
  existingClasses: SchoolClass[] = []
): { students: Student[]; newClasses: SchoolClass[] } => {
  if (!rows || rows.length < 2) return { students: [], newClasses: [] };

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const dataRows = rows.slice(1);

  // Find column indices
  const nameIdx = headers.findIndex((h) => h.includes('nama') || h.includes('name'));
  const nisnIdx = headers.findIndex((h) => h.includes('nisn') || h.includes('nis') || h.includes('induk'));
  const classIdx = headers.findIndex((h) => h.includes('kelas') || h.includes('rombel') || h.includes('class'));
  const genderIdx = headers.findIndex((h) => h.includes('gender') || h.includes('jk') || h.includes('kelamin'));
  const phoneIdx = headers.findIndex((h) => h.includes('hp') || h.includes('telepon') || h.includes('phone') || h.includes('ortu') || h.includes('wali'));
  const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('surel'));

  const parsedStudents: Student[] = [];
  const classMap = new Map<string, SchoolClass>();
  existingClasses.forEach((c) => classMap.set(c.name.toUpperCase(), c));

  dataRows.forEach((row, index) => {
    if (!row || row.length === 0) return;
    const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || '';
    if (!name || name.trim() === '') return;

    const nisn = (nisnIdx >= 0 ? row[nisnIdx] : row[1]) || `00${Date.now().toString().slice(-6)}${index}`;
    const className = (classIdx >= 0 ? row[classIdx] : row[2]) || 'X MIPA 1';
    const rawGender = (genderIdx >= 0 ? row[genderIdx] : row[3]) || 'L';
    const gender: 'L' | 'P' = rawGender.toUpperCase().startsWith('P') || rawGender.toUpperCase().startsWith('W') ? 'P' : 'L';
    const phone = (phoneIdx >= 0 ? row[phoneIdx] : row[4]) || '081234567890';
    const email = (emailIdx >= 0 ? row[emailIdx] : '') || `${nisn}@siswa.sman1.sch.id`;

    // Match or create classId
    let targetClass = classMap.get(className.toUpperCase());
    if (!targetClass) {
      const classId = `cls_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const grade = className.includes('12') || className.toUpperCase().includes('XII') ? '12' : className.includes('11') || className.toUpperCase().includes('XI') ? '11' : '10';
      targetClass = {
        id: classId,
        name: className,
        grade: grade as '10' | '11' | '12',
        major: className.toUpperCase().includes('IPS') ? 'IPS' : className.toUpperCase().includes('RPL') ? 'RPL' : 'MIPA',
        homeroomTeacher: 'Wali Kelas Terdaftar',
        totalStudents: 1,
      };
      classMap.set(className.toUpperCase(), targetClass);
    } else {
      targetClass.totalStudents += 1;
    }

    parsedStudents.push({
      id: `std_sync_${Date.now()}_${index}`,
      nisn: nisn.trim(),
      name: name.trim(),
      classId: targetClass.id,
      className: targetClass.name,
      gender: gender,
      avatar: `https://images.unsplash.com/photo-${gender === 'L' ? '1539571696357-5a69c17a67c6' : '1494790108377-be9c29b29330'}?auto=format&fit=crop&w=200&q=80`,
      email: email.trim(),
      parentPhone: phone.trim(),
    });
  });

  return {
    students: parsedStudents,
    newClasses: Array.from(classMap.values()),
  };
};

export const parseTeachersFromRows = (rows: string[][]): Teacher[] => {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const dataRows = rows.slice(1);

  const nameIdx = headers.findIndex((h) => h.includes('nama') || h.includes('name'));
  const nipIdx = headers.findIndex((h) => h.includes('nip') || h.includes('nuptk') || h.includes('id'));
  const statusIdx = headers.findIndex((h) => h.includes('status') || h.includes('kepegawaian') || h.includes('pegawai'));
  const subjectIdx = headers.findIndex((h) => h.includes('mapel') || h.includes('subject') || h.includes('mata') || h.includes('tugas'));
  const roleIdx = headers.findIndex((h) => h.includes('jabatan') || h.includes('role') || h.includes('posisi'));
  const genderIdx = headers.findIndex((h) => h.includes('gender') || h.includes('jk') || h.includes('kelamin'));
  const phoneIdx = headers.findIndex((h) => h.includes('hp') || h.includes('telepon') || h.includes('phone'));
  const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('surel'));

  const parsedTeachers: Teacher[] = [];

  dataRows.forEach((row, index) => {
    if (!row || row.length === 0) return;
    const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || '';
    if (!name || name.trim() === '') return;

    const nip = (nipIdx >= 0 ? row[nipIdx] : row[1]) || `19850101201001${1000 + index}`;
    const rawStatus = (statusIdx >= 0 ? row[statusIdx] : row[2]) || 'PNS';
    let status: EmploymentStatus = 'PNS';
    const stUpper = rawStatus.toUpperCase();
    if (stUpper.includes('PARUH') || stUpper.includes('PW')) {
      status = 'PPPK_PW';
    } else if (stUpper.includes('PPPK')) {
      status = 'PPPK';
    } else if (stUpper.includes('HONOR') || stUpper.includes('GTT') || stUpper.includes('PTT')) {
      status = 'HONORER';
    }

    const subject = (subjectIdx >= 0 ? row[subjectIdx] : row[3]) || 'Mata Pelajaran Umum';
    const role = (roleIdx >= 0 ? row[roleIdx] : row[4]) || 'Guru Mata Pelajaran';
    const rawGender = (genderIdx >= 0 ? row[genderIdx] : row[5]) || 'L';
    const gender: 'L' | 'P' = rawGender.toUpperCase().startsWith('P') || rawGender.toUpperCase().startsWith('W') ? 'P' : 'L';
    const phone = (phoneIdx >= 0 ? row[phoneIdx] : row[6]) || '081298765432';
    const email = (emailIdx >= 0 ? row[emailIdx] : '') || `${nip}@guru.sman1.sch.id`;

    parsedTeachers.push({
      id: `tch_sync_${Date.now()}_${index}`,
      nip: nip.trim(),
      name: name.trim(),
      employmentStatus: status,
      subject: subject.trim(),
      role: role.trim(),
      gender: gender,
      avatar: `https://images.unsplash.com/photo-${gender === 'L' ? '1472099645785-5658abf4ff4e' : '1573496359142-b8d87734a5a2'}?auto=format&fit=crop&w=200&q=80`,
      phone: phone.trim(),
      email: email.trim(),
    });
  });

  return parsedTeachers;
};

// Fetch Google Sheets directly using OAuth Token
export const fetchGoogleSheetRows = async (
  token: string,
  spreadsheetId: string,
  sheetName: string = 'Sheet1'
): Promise<string[][]> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(sheetName)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Gagal membaca data dari Google Sheets. Pastikan izin akses telah diberikan.');
  }

  const data = await res.json();
  return (data.values as string[][]) || [];
};

// Fetch public Google Sheet CSV (if no OAuth token or shared publicly)
export const fetchPublicGoogleSheetCSV = async (sheetUrlOrId: string): Promise<string[][]> => {
  const cleanId = extractSpreadsheetId(sheetUrlOrId);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`;

  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error('Gagal mengunduh spreadsheet publik. Pastikan link Google Sheet disetel "Siapa saja yang memiliki link dapat melihat".');
  }

  const csvText = await res.text();
  return parseRawSheetText(csvText);
};

