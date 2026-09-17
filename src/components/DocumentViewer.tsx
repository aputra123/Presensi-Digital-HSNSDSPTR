import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle,
} from 'lucide-react';
import { LeaveRequest, GtkServiceRequest } from '../types';

export interface DocumentItem {
  id: string;
  title: string;
  type: 'pdf' | 'image';
  url?: string;
  dataUrl?: string;
  fileName: string;
  uploaderName: string;
  uploaderRole: string;
  date: string;
  status?: string;
  category?: string;
}

interface DocumentViewerProps {
  documents: DocumentItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (docId: string) => void;
  onReject?: (docId: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documents,
  initialIndex = 0,
  isOpen,
  onClose,
  onApprove,
  onReject,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!isOpen || documents.length === 0) return null;

  const currentDoc = documents[currentIndex] || documents[0];
  const isPdf =
    currentDoc.type === 'pdf' ||
    currentDoc.fileName?.toLowerCase().endsWith('.pdf') ||
    currentDoc.url?.toLowerCase().includes('.pdf');

  const handlePrev = () => {
    setIsLoaded(false);
    setZoomLevel(100);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : documents.length - 1));
  };

  const handleNext = () => {
    setIsLoaded(false);
    setZoomLevel(100);
    setCurrentIndex((prev) => (prev < documents.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    if (!currentDoc) return;
    const downloadUrl = currentDoc.dataUrl || currentDoc.url;
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = currentDoc.fileName || 'dokumen_lampiran';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] max-h-[850px] flex flex-col overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100 truncate">
                  {currentDoc.title || currentDoc.fileName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {isPdf ? 'PDF Dokumen' : 'Gambar / Foto'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Pengaju: <span className="text-slate-200 font-semibold">{currentDoc.uploaderName}</span> ({currentDoc.uploaderRole}) • Tanggal: {currentDoc.date}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Gallery counter */}
            <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
              {currentIndex + 1} dari {documents.length}
            </span>

            <button
              onClick={handleDownload}
              title="Unduh Dokumen"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer border border-slate-700"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors cursor-pointer border border-rose-500/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden bg-slate-950 relative">
          {/* Main Document Viewer Canvas */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto relative">
            {/* Zoom Controls for Images */}
            {!isPdf && (
              <div className="absolute top-4 right-4 z-10 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700 text-white text-xs shadow-lg">
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(50, prev - 25))}
                  className="p-1 hover:text-indigo-400 cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] px-1">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(250, prev + 25))}
                  className="p-1 hover:text-indigo-400 cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="p-1 hover:text-indigo-400 cursor-pointer ml-1"
                  title="Reset Zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Navigation Arrows */}
            {documents.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white shadow-xl backdrop-blur-sm transition-all border border-slate-700 cursor-pointer"
                  title="Dokumen Sebelumnya"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white shadow-xl backdrop-blur-sm transition-all border border-slate-700 cursor-pointer"
                  title="Dokumen Selanjutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Document Render (Lazy Loaded) */}
            <div className="max-w-full max-h-full flex items-center justify-center">
              {isPdf ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center max-w-md bg-slate-900 rounded-3xl border border-slate-800 text-slate-200">
                  <div className="w-20 h-20 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h4 className="font-extrabold text-base text-white mb-1">
                    {currentDoc.fileName || 'Dokumen Surat Resmi.pdf'}
                  </h4>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Dokumen lampiran PDF terverifikasi resmi untuk permohonan izin/layanan GTK.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={currentDoc.dataUrl || currentDoc.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Buka di Tab Baru</span>
                    </a>
                    <button
                      onClick={handleDownload}
                      className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-2 transition-all border border-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh File PDF</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-auto max-h-[60vh] max-w-[90%] rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center">
                  <img
                    src={currentDoc.dataUrl || currentDoc.url}
                    alt={currentDoc.title || 'Dokumen Lampiran'}
                    loading="lazy"
                    onLoad={() => setIsLoaded(true)}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                    className="max-h-[55vh] object-contain transition-transform duration-200 rounded-xl"
                  />
                  {!isLoaded && (
                    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center text-slate-400 text-xs">
                      Memuat Gambar...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right/Bottom Thumbnail Strip */}
          {documents.length > 1 && (
            <div className="w-64 bg-slate-900 border-l border-slate-800 p-4 hidden md:flex flex-col gap-3 overflow-y-auto shrink-0">
              <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Daftar Lampiran ({documents.length})
              </h5>
              <div className="space-y-2.5">
                {documents.map((doc, idx) => {
                  const isDocPdf = doc.type === 'pdf' || doc.fileName?.toLowerCase().endsWith('.pdf');
                  const isSelected = idx === currentIndex;
                  return (
                    <button
                      key={doc.id || idx}
                      onClick={() => {
                        setIsLoaded(false);
                        setZoomLevel(100);
                        setCurrentIndex(idx);
                      }}
                      className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-start space-x-3 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-500 text-white ring-2 ring-indigo-500/40'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isDocPdf ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {isDocPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      </div>
                      <div className="truncate min-w-0">
                        <p className="text-xs font-bold truncate">{doc.title || doc.fileName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{doc.uploaderName}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">{currentDoc.fileName}</span>
            <span>• Status Dokumen:</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                currentDoc.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-700'
                  : currentDoc.status === 'rejected'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {currentDoc.status || 'Menunggu Verifikasi'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onReject && (
              <button
                onClick={() => onReject(currentDoc.id)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold transition-all cursor-pointer shadow-xs"
              >
                Tolak Pengajuan
              </button>
            )}
            {onApprove && (
              <button
                onClick={() => onApprove(currentDoc.id)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Setujui Permohonan</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-all cursor-pointer"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
