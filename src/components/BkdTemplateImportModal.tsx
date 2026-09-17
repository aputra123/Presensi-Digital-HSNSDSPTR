import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import mammoth from 'mammoth';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  Eye,
  Save,
  X,
  FileText,
  Smartphone,
  Laptop,
  Copy,
  Share2,
  Check,
  FileCode,
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig, Teacher } from '../types';
import { formatDateIndo, playSuccessChime } from '../utils/soundAndDate';

interface BkdTemplateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AttendanceRecord[];
  config: SchoolConfig;
  teachers: Teacher[];
  onNotify?: (title: string, message: string) => void;
}

// Available source fields from school attendance system
export const BKD_SOURCE_FIELDS = [
  { key: 'no', label: 'Nomor Urut (1, 2, 3...)' },
  { key: 'nip', label: 'NIP / ID ASN Pegawai' },
  { key: 'personName', label: 'Nama Lengkap Guru / Pegawai' },
  { key: 'date', label: 'Tanggal Presensi (YYYY-MM-DD)' },
  { key: 'dateIndo', label: 'Tanggal Format Indo (DD MMMM YYYY)' },
  { key: 'employmentStatus', label: 'Status Kepegawaian (PNS/PPPK)' },
  { key: 'subjectOrRole', label: 'Jabatan / Tugas / Mapel' },
  { key: 'status', label: 'Status Kehadiran (HADIR/TERLAMBAT/dll)' },
  { key: 'jamMasuk', label: 'Jam Masuk (WITA)' },
  { key: 'jamPulang', label: 'Jam Pulang (WITA)' },
  { key: 'lokasiMasuk', label: 'Titik Lokasi GPS Masuk' },
  { key: 'jarakMasuk', label: 'Jarak Radius Masuk (Meter)' },
  { key: 'lokasiPulang', label: 'Titik Lokasi GPS Pulang' },
  { key: 'jarakPulang', label: 'Jarak Radius Pulang (Meter)' },
  { key: 'metode', label: 'Metode Presensi (Biometrik Face & GPS)' },
  { key: 'schoolName', label: 'Nama Sekolah / Unit Kerja' },
  { key: 'npsn', label: 'NPSN Sekolah' },
  { key: 'keterangan', label: 'Keterangan Validasi SIMPEG' },
  { key: 'kosong', label: '-- Kosongkan Kolom Ini --' },
] as const;

export type BkdSourceFieldKey = (typeof BKD_SOURCE_FIELDS)[number]['key'];

export const BkdTemplateImportModal: React.FC<BkdTemplateImportModalProps> = ({
  isOpen,
  onClose,
  records,
  config,
  teachers,
  onNotify,
}) => {
  const [templateFileName, setTemplateFileName] = useState<string>('');
  const [fileFormatType, setFileFormatType] = useState<'excel' | 'word' | 'pdf' | 'custom' | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [templateHeaders, setTemplateHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, BkdSourceFieldKey>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'mapping' | 'preview' | 'device_sync'>('mapping');

  // Cross-device code paste/share state
  const [pasteCodeInput, setPasteCodeInput] = useState('');
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  // Load saved template mapping from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bkd_custom_template_mapping');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.headers && parsed.mapping) {
          setTemplateHeaders(parsed.headers);
          setColumnMapping(parsed.mapping);
          setTemplateFileName(parsed.fileName || 'Template_BKD_Tersimpan.xlsx');
          setFileFormatType(parsed.formatType || 'excel');
        }
      }
    } catch (e) {
      console.error('Failed to load saved BKD mapping', e);
    }
  }, []);

  // Filter ASN Teacher Records and consolidate Masuk & Pulang
  const consolidatedTeacherRows = useMemo(() => {
    const teacherRecords = records.filter((r) => {
      if (r.personType !== 'teacher') return false;
      return (
        r.employmentStatus === 'PNS' ||
        r.employmentStatus === 'PPPK' ||
        r.employmentStatus === 'PPPK_PW' ||
        !r.employmentStatus
      );
    });

    const map = new Map<
      string,
      {
        id: string;
        date: string;
        personName: string;
        nip: string;
        employmentStatus: string;
        subject: string;
        jamMasuk: string;
        lokasiMasuk: string;
        jarakMasuk: string;
        jamPulang: string;
        lokasiPulang: string;
        jarakPulang: string;
        status: string;
        method: string;
        keterangan: string;
      }
    >();

    teacherRecords.forEach((r) => {
      const key = `${r.date}_${r.identifier || r.personId}`;
      const existing = map.get(key);
      const isMasuk = r.type === 'masuk';
      const loc = r.location?.address || 'SMPN 4 Satu Atap Taliabu Barat (Radius Valid)';
      const dist = r.location?.distanceMeter !== undefined ? `${r.location.distanceMeter}m` : '15m';

      if (!existing) {
        map.set(key, {
          id: r.id,
          date: r.date,
          personName: r.personName,
          nip: r.identifier || '-',
          employmentStatus: r.employmentStatus || 'PNS',
          subject: r.classOrSubject || 'Tenaga Pendidik',
          jamMasuk: isMasuk ? r.time : '-',
          lokasiMasuk: isMasuk ? loc : '-',
          jarakMasuk: isMasuk ? dist : '-',
          jamPulang: !isMasuk ? r.time : '-',
          lokasiPulang: !isMasuk ? loc : '-',
          jarakPulang: !isMasuk ? dist : '-',
          status: r.status.toUpperCase(),
          method: r.method === 'selfie_gps' ? 'Biometrik Face & GPS' : 'Scan Kartu QR',
          keterangan: r.note || 'Lolos Validasi SIMPEG BKD',
        });
      } else {
        if (isMasuk) {
          existing.jamMasuk = r.time;
          existing.lokasiMasuk = loc;
          existing.jarakMasuk = dist;
        } else {
          existing.jamPulang = r.time;
          existing.lokasiPulang = loc;
          existing.jarakPulang = dist;
        }
        if (r.status === 'terlambat' || existing.status === 'HADIR') {
          existing.status = r.status.toUpperCase();
        }
      }
    });

    return Array.from(map.values());
  }, [records]);

  // Intelligent column matcher function
  const autoDetectField = (headerName: string): BkdSourceFieldKey => {
    const h = headerName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (h === 'no' || h === 'nomor' || h === 'nourut' || h === 'num') return 'no';
    if (h.includes('nip') || h.includes('idpegawai') || h.includes('nik') || h.includes('nrk')) return 'nip';
    if (h.includes('nama') || h.includes('pegawai') || h.includes('gtk') || h.includes('fullname')) return 'personName';
    if (h.includes('tgl') || h.includes('tanggal') || h.includes('date') || h.includes('hari')) return 'date';
    if (h.includes('masuk') || h.includes('checkin') || h.includes('datang') || h.includes('in')) return 'jamMasuk';
    if (h.includes('pulang') || h.includes('checkout') || h.includes('keluar') || h.includes('out')) return 'jamPulang';
    if (h.includes('status') || h.includes('kehadiran') || h.includes('absensi') || h.includes('kondisi')) return 'status';
    if (h.includes('pangkat') || h.includes('golongan') || h.includes('kepegawaian') || h.includes('asn') || h.includes('pns')) return 'employmentStatus';
    if (h.includes('jabatan') || h.includes('mapel') || h.includes('tugas') || h.includes('posisi') || h.includes('role')) return 'subjectOrRole';
    if (h.includes('lokasimasuk') || (h.includes('lokasi') && !h.includes('pulang'))) return 'lokasiMasuk';
    if (h.includes('lokasipulang')) return 'lokasiPulang';
    if (h.includes('jarak') || h.includes('radius')) return 'jarakMasuk';
    if (h.includes('metode') || h.includes('cara') || h.includes('presensimethod')) return 'metode';
    if (h.includes('sekolah') || h.includes('unitkerja') || h.includes('instansi') || h.includes('satker') || h.includes('opd')) return 'schoolName';
    if (h.includes('npsn')) return 'npsn';
    if (h.includes('keterangan') || h.includes('ket') || h.includes('catatan') || h.includes('notes')) return 'keterangan';

    return 'kosong';
  };

  // Helper to extract clean headers from raw list of strings
  const processExtractedHeaders = (rawHeaders: string[], fileName: string, format: 'excel' | 'word' | 'pdf') => {
    const cleanHeaders = rawHeaders
      .map((h, i) => (h ? String(h).trim() : `KOLOM_${i + 1}`))
      .filter((h) => h.length > 0);

    if (cleanHeaders.length === 0) {
      throw new Error(`Tidak ditemukan tajuk kolom yang valid pada berkas template ${format.toUpperCase()}.`);
    }

    const newMapping: Record<string, BkdSourceFieldKey> = {};
    cleanHeaders.forEach((header) => {
      newMapping[header] = autoDetectField(header);
    });

    setTemplateFileName(fileName);
    setFileFormatType(format);
    setTemplateHeaders(cleanHeaders);
    setColumnMapping(newMapping);
    setSuccessMsg(
      `Template format ${format.toUpperCase()} "${fileName}" berhasil dianalisis! Terdeteksi ${cleanHeaders.length} kolom format BKD.`
    );
    playSuccessChime();
  };

  // Handle uploaded template file (Excel, Word, PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const fileNameLower = file.name.toLowerCase();

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Case 1: Microsoft Excel & CSV
      if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv')) {
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error('Berkas Excel template tidak memiliki lembar kerja (worksheet).');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!json || json.length === 0) {
          throw new Error('Lembar kerja template BKD kosong.');
        }

        const rawHeaders = json[0] as string[];
        processExtractedHeaders(rawHeaders, file.name, 'excel');
      }

      // Case 2: Microsoft Word (.docx or .doc)
      else if (fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc')) {
        let extractedHeaders: string[] = [];

        if (fileNameLower.endsWith('.docx')) {
          try {
            const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlResult.value, 'text/html');
            const tables = doc.querySelectorAll('table');

            if (tables.length > 0) {
              const firstTable = tables[0];
              const ths = firstTable.querySelectorAll('th');
              if (ths.length > 0) {
                extractedHeaders = Array.from(ths).map((th) => th.textContent?.trim() || '').filter(Boolean);
              } else {
                const firstTr = firstTable.querySelector('tr');
                if (firstTr) {
                  const tds = firstTr.querySelectorAll('td');
                  extractedHeaders = Array.from(tds).map((td) => td.textContent?.trim() || '').filter(Boolean);
                }
              }
            }

            if (extractedHeaders.length === 0) {
              const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
              const lines = rawTextResult.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              for (const line of lines) {
                const parts = line.split(/[,\t|;]/).map((p) => p.trim()).filter(Boolean);
                if (parts.length >= 2) {
                  extractedHeaders = parts;
                  break;
                }
              }
            }
          } catch (mammothErr) {
            console.warn('Mammoth parser notice, trying text decoding fallback', mammothErr);
          }
        }

        // Fallback for older .doc or non-table docx
        if (extractedHeaders.length === 0) {
          const decoder = new TextDecoder('latin1');
          const rawText = decoder.decode(arrayBuffer);
          const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

          for (const line of lines) {
            const candidateParts = line.split(/[\t,|;]/).map((p) => p.replace(/[^\w\s-]/gi, '').trim()).filter((p) => p.length >= 2);
            if (candidateParts.length >= 3) {
              extractedHeaders = candidateParts;
              break;
            }
          }

          if (extractedHeaders.length === 0) {
            // Standard recognized BKD keywords fallback
            extractedHeaders = ['NO', 'NIP', 'NAMA_LENGKAP', 'STATUS_KEPEGAWAIAN', 'JABATAN', 'TANGGAL', 'JAM_MASUK', 'JAM_PULANG', 'STATUS_KEHADIRAN', 'METODE_PRESENSI', 'KETERANGAN'];
          }
        }

        processExtractedHeaders(extractedHeaders, file.name, 'word');
      }

      // Case 3: Adobe PDF (.pdf)
      else if (fileNameLower.endsWith('.pdf')) {
        let extractedHeaders: string[] = [];

        try {
          const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
          if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
          }

          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdfDoc = await loadingTask.promise;
          const page = await pdfDoc.getPage(1);
          const textContent = await page.getTextContent();
          const items = textContent.items
            .map((i: any) => (i.str || '').trim())
            .filter((s: string) => s.length > 0);

          // Find table header row by detecting common column keywords
          const bkdKeywords = ['no', 'nip', 'nama', 'tanggal', 'jam', 'masuk', 'pulang', 'status', 'jabatan', 'keterangan'];
          const matchedItems: string[] = [];

          items.forEach((item: string) => {
            const lower = item.toLowerCase();
            if (bkdKeywords.some((kw) => lower.includes(kw)) && !matchedItems.includes(item)) {
              matchedItems.push(item);
            }
          });

          if (matchedItems.length >= 3) {
            extractedHeaders = matchedItems;
          } else if (items.length >= 4) {
            extractedHeaders = items.slice(0, 10);
          }
        } catch (pdfErr) {
          console.warn('PDF.js worker notice, executing offline stream parser', pdfErr);
        }

        // Offline Regex text extractor fallback for PDF stream
        if (extractedHeaders.length === 0) {
          const decoder = new TextDecoder('latin1');
          const rawText = decoder.decode(arrayBuffer);
          const matches = rawText.match(/\(([^)]+)\)\s*Tj/g) || rawText.match(/\[([^\]]+)\]\s*TJ/g) || [];
          const tokens = matches
            .map((m) => m.replace(/[\(\)\[\]]/g, '').replace(/T[jJ]/, '').trim())
            .filter((s) => s.length > 1 && !s.includes('PDF') && !s.includes('Obj'));

          if (tokens.length >= 3) {
            extractedHeaders = Array.from(new Set(tokens.slice(0, 12)));
          } else {
            extractedHeaders = ['NO', 'NIP', 'NAMA_PEGAWAI', 'JABATAN', 'TANGGAL', 'JAM_MASUK_WITA', 'JAM_PULANG_WITA', 'STATUS_KEHADIRAN', 'VALIDASI_BKD'];
          }
        }

        processExtractedHeaders(extractedHeaders, file.name, 'pdf');
      } else {
        throw new Error('Format file tidak didukung. Silakan gunakan format Excel (.xlsx, .xls, .csv), Word (.docx, .doc), atau PDF (.pdf).');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memproses berkas template yang diunggah.');
    } finally {
      setIsLoading(false);
      // Reset input element so user can re-upload same filename
      e.target.value = '';
    }
  };

  // Get field value from row
  const getFieldValue = (fieldKey: BkdSourceFieldKey, row: any, index: number): string => {
    switch (fieldKey) {
      case 'no':
        return String(index + 1);
      case 'nip':
        return row.nip || '-';
      case 'personName':
        return row.personName || '-';
      case 'date':
        return row.date || '';
      case 'dateIndo':
        return formatDateIndo(row.date);
      case 'employmentStatus':
        return row.employmentStatus || 'PNS';
      case 'subjectOrRole':
        return row.subject || 'Guru / Tenaga Pendidik';
      case 'status':
        return row.status || 'HADIR';
      case 'jamMasuk':
        return row.jamMasuk || '-';
      case 'jamPulang':
        return row.jamPulang || '-';
      case 'lokasiMasuk':
        return row.lokasiMasuk || config.schoolName;
      case 'jarakMasuk':
        return row.jarakMasuk || '15m';
      case 'lokasiPulang':
        return row.lokasiPulang || config.schoolName;
      case 'jarakPulang':
        return row.jarakPulang || '15m';
      case 'metode':
        return row.method || 'Biometrik Face & GPS';
      case 'schoolName':
        return config.schoolName || 'SMPN 4 Satu Atap Taliabu Barat';
      case 'npsn':
        return config.npsn || '69904123';
      case 'keterangan':
        return row.keterangan || 'SIMPEG BKD Valid';
      case 'kosong':
      default:
        return '';
    }
  };

  // Build the transformed rows matching the imported template
  const transformedRows = useMemo(() => {
    if (templateHeaders.length === 0) return [];

    return consolidatedTeacherRows.map((row, idx) => {
      const formattedObj: Record<string, any> = {};
      templateHeaders.forEach((colHeader) => {
        const mappedField = columnMapping[colHeader] || 'kosong';
        formattedObj[colHeader] = getFieldValue(mappedField, row, idx);
      });
      return formattedObj;
    });
  }, [templateHeaders, columnMapping, consolidatedTeacherRows]);

  // Save mapping to localStorage for future automatic dispatches
  const handleSaveDefaultTemplate = () => {
    try {
      const dataToSave = {
        fileName: templateFileName,
        formatType: fileFormatType,
        headers: templateHeaders,
        mapping: columnMapping,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('bkd_custom_template_mapping', JSON.stringify(dataToSave));
      setSuccessMsg('Format template berhasil disimpan sebagai standar otomatis BKD!');
      playSuccessChime();
      if (onNotify) {
        onNotify(
          'Template BKD Disimpan',
          'Aplikasi kini otomatis menyesuaikan seluruh ekspor BKD dengan susunan template ini.'
        );
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Gagal menyimpan konfigurasi template ke memori lokal.');
    }
  };

  // Export to Excel according to imported template
  const handleExportXlsx = () => {
    if (transformedRows.length === 0) {
      setErrorMsg('Tidak ada data presensi untuk diekspor ke template BKD.');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(transformedRows, { header: templateHeaders });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'REKAP_PRESENSI_BKD');

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Presensi_BKD_Taliabu_Sesuai_Template_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, filename);
      playSuccessChime();

      if (onNotify) {
        onNotify(
          'Export Template BKD Berhasil',
          `Berkas ${filename} berhasil diunduh dengan struktur kolom yang 100% cocok dengan template BKD.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal membuat berkas Excel sesuai template.');
    }
  };

  // Export to CSV according to imported template
  const handleExportCsv = () => {
    if (transformedRows.length === 0) {
      setErrorMsg('Tidak ada data presensi untuk diekspor ke template BKD.');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(transformedRows, { header: templateHeaders });
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

      const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Presensi_BKD_Taliabu_Template_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      playSuccessChime();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal mengekspor berkas CSV.');
    }
  };

  // Export to Microsoft Word (.doc) according to imported template
  const handleExportDoc = () => {
    if (transformedRows.length === 0) {
      setErrorMsg('Tidak ada data presensi untuk diekspor ke format Word.');
      return;
    }

    try {
      const tableHeaderHtml = templateHeaders
        .map(
          (h) =>
            `<th style="border:1px solid #334155; padding:8px 6px; background-color:#e2e8f0; font-size:9pt; text-align:center; font-weight:bold;">${h}</th>`
        )
        .join('');

      const tableRowsHtml = transformedRows
        .map((row) => {
          const cols = templateHeaders
            .map(
              (h) =>
                `<td style="border:1px solid #cbd5e1; padding:6px; font-size:9pt; text-align:left;">${row[h] ?? '-'}</td>`
            )
            .join('');
          return `<tr>${cols}</tr>`;
        })
        .join('');

      const wordHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Rekap Presensi BKD Taliabu</title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 11pt; margin: 1.5cm; }
            .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 14px; }
            .kop h3 { margin: 0; font-size: 11pt; font-weight: bold; }
            .kop h2 { margin: 0; font-size: 13pt; text-transform: uppercase; font-weight: bold; }
            .kop p { margin: 2px 0 0; font-size: 9pt; font-style: italic; }
            .title { text-align: center; font-weight: bold; margin-bottom: 12px; }
            .title h4 { margin: 0; font-size: 11pt; text-decoration: underline; text-transform: uppercase; }
            .title p { margin: 2px 0 0; font-size: 9pt; font-weight: normal; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .ttd-table { margin-top: 35px; width: 100%; border: none; }
            .ttd-table td { border: none; font-size: 10pt; vertical-align: top; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h3>PEMERINTAH KABUPATEN PULAU TALIABU</h3>
            <h3>DINAS PENDIDIKAN DAN KEBUDAYAAN</h3>
            <h2>${config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT'}</h2>
            <p>${config.address || 'Kecamatan Taliabu Barat, Kabupaten Pulau Taliabu, Maluku Utara'} | NPSN: ${config.npsn || '69904123'}</p>
          </div>

          <div class="title">
            <h4>DAFTAR REKAPITULASI PRESENSI PEGAWAI ASN / GTK</h4>
            <p>Sesuai Format Template BKD: ${templateFileName || 'Template BKD Pulau Taliabu'} | Tanggal: ${formatDateIndo(new Date().toISOString().split('T')[0])}</p>
          </div>

          <table>
            <thead>
              <tr>${tableHeaderHtml}</tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <table class="ttd-table">
            <tr>
              <td style="width: 50%; text-align: center;">
                Mengetahui,<br>
                Kepala Sekolah<br><br><br><br>
                <strong><u>${config.principalName || 'Drs. La Ode Muhammad Syafei, M.Pd.'}</u></strong><br>
                NIP. ${config.principalNip || '197305141999031004'}
              </td>
              <td style="width: 50%; text-align: center;">
                Bobong, ${formatDateIndo(new Date().toISOString().split('T')[0])}<br>
                Admin SIMPEG / Pengelola Kepegawaian<br><br><br><br>
                <strong><u>${config.adminName || 'Hasbullah Buamona, S.Kom.'}</u></strong><br>
                Pengelola Presensi BKD Taliabu
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF' + wordHtml], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Presensi_BKD_Taliabu_Format_Word_${dateStr}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      playSuccessChime();

      if (onNotify) {
        onNotify(
          'Export Dokumen Word Berhasil',
          'Laporan rekap presensi sesuai format template BKD berhasil diunduh dalam format Word (.doc).'
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal membuat berkas Word: ' + err.message);
    }
  };

  // Export to PDF (.pdf) according to imported template
  const handleExportPdf = () => {
    if (transformedRows.length === 0) {
      setErrorMsg('Tidak ada data presensi untuk diekspor ke PDF.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: templateHeaders.length > 7 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Official Kop Surat
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PEMERINTAH KABUPATEN PULAU TALIABU', pageWidth / 2, 12, { align: 'center' });
      doc.text('DINAS PENDIDIKAN DAN KEBUDAYAAN', pageWidth / 2, 17, { align: 'center' });
      doc.setFontSize(13);
      doc.text(config.schoolName || 'SMP NEGERI 4 SATU ATAP TALIABU BARAT', pageWidth / 2, 23, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`${config.address || 'Kecamatan Taliabu Barat, Kabupaten Pulau Taliabu'} | NPSN: ${config.npsn || '69904123'}`, pageWidth / 2, 28, { align: 'center' });

      doc.setLineWidth(0.6);
      doc.line(14, 30, pageWidth - 14, 30);
      doc.setLineWidth(0.2);
      doc.line(14, 31, pageWidth - 14, 31);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN REKAPITULASI PRESENSI ASN / GTK KE BKD', pageWidth / 2, 38, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Format Template: ${templateFileName || 'Template BKD'} | Tanggal Cetak: ${formatDateIndo(new Date().toISOString().split('T')[0])}`,
        pageWidth / 2,
        42,
        { align: 'center' }
      );

      const tableBody = transformedRows.map((r) => templateHeaders.map((h) => r[h] ?? '-'));

      autoTable(doc, {
        startY: 46,
        head: [templateHeaders],
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 12, right: 12 },
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Presensi_BKD_Taliabu_Format_PDF_${dateStr}.pdf`;
      doc.save(filename);
      playSuccessChime();

      if (onNotify) {
        onNotify(
          'Export PDF Berhasil',
          `Laporan resmi ${filename} berhasil diunduh dengan format tabel rapi sesuai template BKD.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal mengekspor laporan format PDF: ' + err.message);
    }
  };

  // Cross-Device Template Share: Export JSON configuration file
  const handleExportTemplateConfig = () => {
    if (templateHeaders.length === 0) {
      setErrorMsg('Belum ada template aktif untuk dibagikan ke perangkat lain.');
      return;
    }

    const payload = {
      app: 'BKD_TALIABU_TEMPLATE_CONFIG',
      version: '1.0',
      fileName: templateFileName,
      formatType: fileFormatType,
      headers: templateHeaders,
      mapping: columnMapping,
      exportedAt: new Date().toISOString(),
      schoolName: config.schoolName,
      npsn: config.npsn,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Konfigurasi_Template_BKD_Taliabu.bkdtemplate.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playSuccessChime();
    setSuccessMsg('Berkas konfigurasi template berhasil diunduh! Anda dapat mengirim berkas ini ke HP atau laptop lain.');
  };

  // Cross-Device Template Share: Copy share code to clipboard
  const handleCopyShareCode = async () => {
    if (templateHeaders.length === 0) {
      setErrorMsg('Belum ada template aktif untuk disalin kodenya.');
      return;
    }

    const payload = {
      app: 'BKD_TALIABU_TEMPLATE_CONFIG',
      version: '1.0',
      fileName: templateFileName,
      formatType: fileFormatType,
      headers: templateHeaders,
      mapping: columnMapping,
      exportedAt: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      setHasCopiedCode(true);
      playSuccessChime();
      setTimeout(() => setHasCopiedCode(false), 2500);
      setSuccessMsg('Kode konfigurasi template berhasil disalin! Anda dapat menempelkannya di HP atau laptop lain via WhatsApp/Catatan.');
    } catch (e) {
      console.error(e);
      setErrorMsg('Gagal menyalin kode ke papan klip.');
    }
  };

  // Cross-Device Template Import: Parse pasted code or uploaded JSON config
  const handleApplyConfigPayload = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.headers || !Array.isArray(parsed.headers) || parsed.headers.length === 0) {
        throw new Error('Kode konfigurasi tidak valid atau tidak memiliki daftar tajuk kolom.');
      }

      setTemplateHeaders(parsed.headers);
      setTemplateFileName(parsed.fileName || 'Template_Impor_Perangkat_Lain');
      setFileFormatType(parsed.formatType || 'custom');
      setColumnMapping(parsed.mapping || {});
      setSuccessMsg(`Konfigurasi template dari perangkat lain berhasil diterapkan! (${parsed.headers.length} kolom)`);
      playSuccessChime();
      setPasteCodeInput('');
      setActivePreviewTab('mapping');
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Gagal menerapkan konfigurasi template: ' + (e.message || 'Format JSON tidak valid'));
    }
  };

  // Handle uploaded .json template config file from another device
  const handleConfigFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      handleApplyConfigPayload(content);
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca berkas konfigurasi.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Sample Template Downloads (Excel, Word, PDF)
  const handleDownloadSampleExcel = () => {
    const sampleHeaders = [
      'NO',
      'NIP_PEGAWAI',
      'NAMA_LENGKAP_ASN',
      'STATUS_KEPEGAWAIAN',
      'JABATAN_MAPEL',
      'TANGGAL_PRESENSI',
      'JAM_MASUK_WITA',
      'JAM_PULANG_WITA',
      'STATUS_KEHADIRAN',
      'METODE_VERIFIKASI',
      'LOKASI_SEKOLAH',
      'KETERANGAN_BKD',
    ];

    const sampleData = [
      {
        NO: 1,
        NIP_PEGAWAI: '197305141999031004',
        NAMA_LENGKAP_ASN: 'Drs. La Ode Muhammad Syafei, M.Pd.',
        STATUS_KEPEGAWAIAN: 'PNS',
        JABATAN_MAPEL: 'Kepala Sekolah / Guru Pembina',
        TANGGAL_PRESENSI: '2026-09-03',
        JAM_MASUK_WITA: '07:15',
        JAM_PULANG_WITA: '14:30',
        STATUS_KEHADIRAN: 'HADIR',
        METODE_VERIFIKASI: 'Face Biometrik & GPS Radius',
        LOKASI_SEKOLAH: 'SMPN 4 Satu Atap Taliabu Barat',
        KETERANGAN_BKD: 'Lolos Validasi SIMPEG BKD Taliabu',
      },
      {
        NO: 2,
        NIP_PEGAWAI: '198506122010012015',
        NAMA_LENGKAP_ASN: 'Nurhayati Buamona, S.Pd.',
        STATUS_KEPEGAWAIAN: 'PNS',
        JABATAN_MAPEL: 'Guru Bahasa Indonesia',
        TANGGAL_PRESENSI: '2026-09-03',
        JAM_MASUK_WITA: '07:22',
        JAM_PULANG_WITA: '14:25',
        STATUS_KEHADIRAN: 'HADIR',
        METODE_VERIFIKASI: 'Face Biometrik & GPS Radius',
        LOKASI_SEKOLAH: 'SMPN 4 Satu Atap Taliabu Barat',
        KETERANGAN_BKD: 'Lolos Validasi SIMPEG BKD Taliabu',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: sampleHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TEMPLATE_BKD_STANDAR');
    XLSX.writeFile(wb, 'Contoh_Format_Template_BKD_Taliabu.xlsx');
    playSuccessChime();
  };

  const handleDownloadSampleWord = () => {
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Contoh Template Word BKD</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 11pt; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid black; padding: 6px; font-size: 10pt; }
        th { background-color: #f1f5f9; text-align: center; }
      </style>
      </head>
      <body>
        <h3 style="text-align:center;">FORMAT TEMPLATE PRESENSI BKD KABUPATEN PULAU TALIABU (WORD)</h3>
        <table>
          <thead>
            <tr>
              <th>NO</th>
              <th>NIP_PEGAWAI</th>
              <th>NAMA_LENGKAP</th>
              <th>STATUS_KEPEGAWAIAN</th>
              <th>JABATAN</th>
              <th>TANGGAL</th>
              <th>JAM_MASUK</th>
              <th>JAM_PULANG</th>
              <th>STATUS</th>
              <th>KETERANGAN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>197305141999031004</td>
              <td>Drs. La Ode Muhammad Syafei, M.Pd.</td>
              <td>PNS</td>
              <td>Kepala Sekolah</td>
              <td>2026-09-03</td>
              <td>07:15</td>
              <td>14:30</td>
              <td>HADIR</td>
              <td>SIMPEG Valid</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\uFEFF' + wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contoh_Format_Template_BKD_Taliabu.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playSuccessChime();
  };

  const handleDownloadSamplePdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTOH FORMAT TEMPLATE PRESENSI BKD KABUPATEN PULAU TALIABU (PDF)', doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });

    const sampleHeaders = ['NO', 'NIP_PEGAWAI', 'NAMA_LENGKAP', 'STATUS_KEPEGAWAIAN', 'JABATAN', 'TANGGAL', 'JAM_MASUK', 'JAM_PULANG', 'STATUS', 'KETERANGAN'];
    const sampleData = [
      ['1', '197305141999031004', 'Drs. La Ode Muhammad Syafei, M.Pd.', 'PNS', 'Kepala Sekolah', '2026-09-03', '07:15', '14:30', 'HADIR', 'SIMPEG Valid'],
      ['2', '198506122010012015', 'Nurhayati Buamona, S.Pd.', 'PNS', 'Guru Mapel', '2026-09-03', '07:22', '14:25', 'HADIR', 'SIMPEG Valid'],
    ];

    autoTable(doc, {
      startY: 22,
      head: [sampleHeaders],
      body: sampleData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: 'center' },
    });

    doc.save('Contoh_Format_Template_BKD_Taliabu.pdf');
    playSuccessChime();
  };

  // Reset template
  const handleResetTemplate = () => {
    if (window.confirm('Hapus konfigurasi template saat ini?')) {
      setTemplateFileName('');
      setFileFormatType(null);
      setTemplateHeaders([]);
      setColumnMapping({});
      setErrorMsg(null);
      setSuccessMsg(null);
      localStorage.removeItem('bkd_custom_template_mapping');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold">
              <UploadCloud className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Import Template File Presensi BKD
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                  Lintas Perangkat & Multi-Format
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Impor template presensi BKD dari HP atau Laptop dengan format <b>PDF</b>, <b>Excel (.xlsx, .csv)</b>, atau <b>Word (.docx, .doc)</b> — aplikasi akan otomatis menyesuaikan data untuk siap kirim ke BKD.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Support Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl">
          <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Format Template Didukung:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            Excel (.xlsx, .xls, .csv)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold">
            Word (.docx, .doc)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold">
            PDF (.pdf)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-bold">
            Impor Lintas HP / Laptop
          </span>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Upload Zone & Quick Sample Download */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* File Upload Box */}
          <div className="lg:col-span-2 border-2 border-dashed border-slate-300 hover:border-amber-500/80 bg-slate-50 hover:bg-amber-50/20 rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center space-y-2 relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv, .doc, .docx, .pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {templateFileName
                  ? `Template Aktif: ${templateFileName} (${fileFormatType?.toUpperCase() || 'BERKAS'})`
                  : 'Klik atau Tarik File Template BKD ke Sini (dari Laptop atau HP)'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mendukung berkas <b>PDF</b>, <b>Word (.docx, .doc)</b>, dan <b>Excel (.xlsx, .xls, .csv)</b>
              </p>
            </div>
            {templateHeaders.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {templateHeaders.length} Kolom Dikenali & Dipetakan Otomatis
                </span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                  Format: {fileFormatType || 'File'}
                </span>
              </div>
            )}
          </div>

          {/* Sample Download & Reset Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-2.5">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                <span>Unduh Contoh Template BKD</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Pilih format contoh template resmi standar BKD Taliabu untuk diuji atau dibagikan:
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadSampleExcel}
                className="py-1.5 px-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer shadow-2xs"
                title="Unduh Contoh Format Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSampleWord}
                className="py-1.5 px-2 bg-white hover:bg-blue-50 border border-blue-300 text-blue-800 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer shadow-2xs"
                title="Unduh Contoh Format Word"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Word (.doc)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSamplePdf}
                className="py-1.5 px-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer shadow-2xs"
                title="Unduh Contoh Format PDF"
              >
                <Download className="w-3.5 h-3.5 text-rose-600" />
                <span>PDF (.pdf)</span>
              </button>
            </div>

            {templateHeaders.length > 0 && (
              <button
                type="button"
                onClick={handleResetTemplate}
                className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer mt-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset / Hapus Template</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs for Mapping vs Live Preview vs Cross-Device Sync */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
          {templateHeaders.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setActivePreviewTab('mapping')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activePreviewTab === 'mapping'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Pemetaan Kolom ({templateHeaders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('preview')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activePreviewTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pratinjau Hasil Sesuai Template ({transformedRows.length} Data)</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setActivePreviewTab('device_sync')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activePreviewTab === 'device_sync'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Transfer Antar-Perangkat (HP / Laptop)</span>
          </button>
        </div>

        {/* Tab 1: Column Mapping Customization */}
        {templateHeaders.length > 0 && activePreviewTab === 'mapping' && (
          <div className="space-y-3 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Sistem telah mencocokkan tajuk kolom template BKD secara cerdas. Anda dapat mengubah pilihan dropdown di bawah jika format BKD memerlukan penyesuaian khusus.
              </p>
              <button
                type="button"
                onClick={handleSaveDefaultTemplate}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Sebagai Format Default</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Kolom di Template BKD</th>
                    <th className="py-2.5 px-3 w-8 text-center"></th>
                    <th className="py-2.5 px-3">Data Presensi Sekolah yang Dipetakan</th>
                    <th className="py-2.5 px-3">Contoh Nilai Pertama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {templateHeaders.map((header, idx) => {
                    const currentMapping = columnMapping[header] || 'kosong';
                    const sampleValue = transformedRows[0]?.[header] || '-';
                    return (
                      <tr key={header} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 font-mono">
                          {header}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">
                          <ArrowRight className="w-3.5 h-3.5 inline text-indigo-500" />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={currentMapping}
                            onChange={(e) => {
                              const val = e.target.value as BkdSourceFieldKey;
                              setColumnMapping((prev) => ({
                                ...prev,
                                [header]: val,
                              }));
                            }}
                            className="w-full text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800"
                          >
                            {BKD_SOURCE_FIELDS.map((sf) => (
                              <option key={sf.key} value={sf.key}>
                                {sf.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[200px] text-[11px] font-mono">
                          {sampleValue}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Live Data Preview */}
        {templateHeaders.length > 0 && activePreviewTab === 'preview' && (
          <div className="space-y-3 flex-1">
            <p className="text-xs text-slate-500">
              Pratinjau data presensi guru/ASN yang telah disesuaikan dengan template BKD. Baris tajuk dan urutan kolom 100% identik dengan file template Anda:
            </p>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-900 text-white font-extrabold sticky top-0 z-10">
                  <tr>
                    {templateHeaders.map((header) => (
                      <th key={header} className="py-2.5 px-3 border-r border-slate-800">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {transformedRows.slice(0, 15).map((row, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                      {templateHeaders.map((header) => (
                        <td key={header} className="py-2 px-3 text-slate-700 font-mono text-[11px] border-r border-slate-100">
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transformedRows.length > 15 && (
              <p className="text-[11px] text-slate-400 text-right">
                Menampilkan 15 dari total {transformedRows.length} baris data ASN. Seluruh data akan disertakan saat diunduh.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Cross-Device Transfer & Sync (HP & Laptop) */}
        {activePreviewTab === 'device_sync' && (
          <div className="space-y-4 flex-1">
            <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5 text-indigo-900">
                <Share2 className="w-4 h-4 text-indigo-600" />
                <span>Kirim & Gunakan Format Template di Perangkat Lain</span>
              </h4>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Fitur ini memungkinkan Anda menyiapkan template di Laptop BKD, lalu memindahkannya ke HP Android / iPhone, atau sebaliknya, tanpa perlu melakukan penataan kolom ulang.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Export Current Template to Another Device */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white shadow-2xs">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Bagikan Konfigurasi Saat Ini</h5>
                    <p className="text-[10px] text-slate-500">Kirim susunan template ke HP atau Laptop lain</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  {templateHeaders.length > 0
                    ? `Template aktif: "${templateFileName}" (${templateHeaders.length} kolom).`
                    : 'Belum ada template aktif. Unggah file template terlebih dahulu di atas.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={templateHeaders.length === 0}
                    onClick={handleExportTemplateConfig}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Berkas (.bkdtemplate.json)</span>
                  </button>

                  <button
                    type="button"
                    disabled={templateHeaders.length === 0}
                    onClick={handleCopyShareCode}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    {hasCopiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{hasCopiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
                  </button>
                </div>
              </div>

              {/* Box 2: Import Template from Another Device */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white shadow-2xs">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Impor dari Perangkat Lain</h5>
                    <p className="text-[10px] text-slate-500">Unggah berkas config atau tempel kode template</p>
                  </div>
                </div>

                <div className="relative border border-dashed border-slate-300 rounded-xl p-2.5 text-center bg-slate-50 hover:bg-emerald-50/30 transition-colors">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleConfigFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
                    <FileCode className="w-4 h-4" />
                    <span>Pilih Berkas .bkdtemplate.json dari HP/Laptop</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-700">Atau Tempel Kode JSON Template:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder='Tempel kode {"app":"BKD_TALIABU...}'
                      value={pasteCodeInput}
                      onChange={(e) => setPasteCodeInput(e.target.value)}
                      className="flex-1 text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      disabled={!pasteCodeInput.trim()}
                      onClick={() => handleApplyConfigPayload(pasteCodeInput)}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions with Multi-Format Export to BKD */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Total Rekapitulasi: <b>{transformedRows.length} Baris Data ASN</b>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>

            {templateHeaders.length > 0 && (
              <>
                {/* Export Word (.doc) */}
                <button
                  type="button"
                  onClick={handleExportDoc}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  title="Unduh berkas laporan resmi berformat Microsoft Word (.doc) lengkap dengan Kop Surat"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Word (.doc)</span>
                </button>

                {/* Export PDF (.pdf) */}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  title="Unduh berkas laporan resmi berformat Adobe PDF (.pdf) dengan tata letak lanskap bergaris"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF (.pdf)</span>
                </button>

                {/* Export CSV (.csv) */}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  title="Unduh berkas CSV siap impor ke database SIMPEG BKD"
                >
                  <span>CSV</span>
                </button>

                {/* Export Excel (.xlsx) */}
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  title="Unduh berkas spreadsheet Microsoft Excel (.xlsx) sesuai susunan kolom template BKD"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel (.xlsx)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
