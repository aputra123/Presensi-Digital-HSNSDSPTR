import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Camera,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import { SchoolConfig } from '../types';
import { PRESET_APP_ICONS, updateDocumentAppIcon } from '../utils/appIconAndPwa';
import { playBeepSound } from '../utils/soundAndDate';
import confetti from 'canvas-confetti';

interface AppIconCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SchoolConfig;
  onSaveConfig?: (updatedConfig: SchoolConfig) => void;
  onSaveIcon?: (newIconUrl: string) => void;
  onNotify?: (title: string, message: string) => void;
}

export const AppIconCustomizerModal: React.FC<AppIconCustomizerModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onSaveIcon,
  onNotify,
}) => {
  const [selectedIconUrl, setSelectedIconUrl] = useState<string>(
    config.appIconUrl || config.logoUrl || PRESET_APP_ICONS[2].url
  );
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [activePresetCategory, setActivePresetCategory] = useState<'all' | 'official' | 'regional' | 'school' | 'modern'>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle image upload from Phone Gallery or Laptop file system
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 4MB for high resolution logo)
    if (file.size > 4 * 1024 * 1024) {
      alert('Ukuran file maksimal 4MB. Silakan pilih gambar yang lebih kecil.');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setSelectedIconUrl(base64Url);
      setIsProcessingFile(false);
      playBeepSound();
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      alert('Gagal membaca berkas gambar.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyIcon = () => {
    const finalUrl = customUrlInput.trim() || selectedIconUrl;
    const updatedConfig: SchoolConfig = {
      ...config,
      logoUrl: finalUrl,
      appIconUrl: finalUrl,
    };

    // Update in state & storage
    if (onSaveConfig) {
      onSaveConfig(updatedConfig);
    }
    if (onSaveIcon) {
      onSaveIcon(finalUrl);
    }

    // Dynamically update document favicon, apple touch icon, and tab title
    updateDocumentAppIcon(finalUrl, config.schoolName);

    if (onNotify) {
      onNotify(
        'Ikon Aplikasi Diperbarui',
        'Ikon aplikasi resmi sekolah berhasil disimpan dan diterapkan di semua halaman & perangkat.'
      );
    }

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    playBeepSound();
    onClose();
  };

  const filteredPresets = PRESET_APP_ICONS.filter((p) => {
    if (activePresetCategory === 'all') return true;
    return p.category === activePresetCategory;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <ImageIcon className="w-6 h-6" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                <Sparkles className="w-3 h-3" />
                <span>Kustomisasi Identitas Digital</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">
                Ganti Ikon Aplikasi Sekolah
              </h3>
              <p className="text-xs text-slate-300">
                Ubah logo aplikasi dari HP (Kamera / Galeri) atau Laptop (Unggah Gambar / Preset Resmi).
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          {/* Top Live Preview Container: Phone, Laptop & Card Mockup */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/90 space-y-3">
            <span className="font-bold text-slate-900 text-xs block">
              Pratinjau Tampilan Ikon di Berbagai Perangkat:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Phone App Icon Preview */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center space-x-3 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 p-1.5 border border-slate-200 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                  <img
                    src={selectedIconUrl}
                    alt="Phone Icon Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-xs block truncate">
                    Layar Utama HP
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Presensi Digital
                  </span>
                </div>
              </div>

              {/* Laptop Browser Tab Preview */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center space-x-3 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 p-2 border border-slate-800 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                  <img
                    src={selectedIconUrl}
                    alt="Laptop Tab Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-xs block truncate">
                    Tab Browser Laptop
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block truncate">
                    Favicon & Header
                  </span>
                </div>
              </div>

              {/* ID Card / Kop Document Preview */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center space-x-3 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 p-1.5 border border-indigo-100 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                  <img
                    src={selectedIconUrl}
                    alt="Card Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-xs block truncate">
                    Kop Surat & ID Card
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Ekspor BKD & A4
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Upload from Phone Camera / Laptop File System */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 text-xs block">
              1. Unggah Gambar Logo Baru dari Perangkat:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Laptop & Phone File Picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="p-4 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center space-y-2 cursor-pointer text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-indigo-900 text-xs block">
                    Pilih File dari Laptop / Galeri HP
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Mendukung format PNG, JPG, WebP, SVG (Maks. 4MB)
                  </span>
                </div>
              </button>

              {/* Camera for Phone */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingFile}
                className="p-4 rounded-2xl border-2 border-dashed border-emerald-200 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center space-y-2 cursor-pointer text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-emerald-900 text-xs block">
                    Ambil Foto Logo dengan Kamera HP
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Potret lambang fisik dari dokumen atau plang sekolah
                  </span>
                </div>
              </button>
            </div>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageFileChange}
            />
          </div>

          {/* Section 2: Preset Official Emblems */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs block">
                2. Atau Pilih dari Koleksi Preset Lambang Resmi:
              </span>

              {/* Category Filter */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setActivePresetCategory('all')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    activePresetCategory === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setActivePresetCategory('official')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    activePresetCategory === 'official' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Nasional
                </button>
                <button
                  type="button"
                  onClick={() => setActivePresetCategory('regional')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    activePresetCategory === 'regional' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Taliabu
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredPresets.map((preset) => {
                const isSelected = selectedIconUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedIconUrl(preset.url);
                      setCustomUrlInput('');
                      playBeepSound();
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-50 p-1 border border-slate-200 flex items-center justify-center shrink-0">
                      <img
                        src={preset.url}
                        alt={preset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {preset.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-1" />}
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Direct Web Image URL Input */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="font-bold text-slate-700 text-xs">
              3. Atau Tempel Tautan / URL Gambar Logo Online:
            </label>
            <input
              type="url"
              placeholder="https://example.com/logo-smpn4-taliabu.png"
              value={customUrlInput}
              onChange={(e) => {
                setCustomUrlInput(e.target.value);
                if (e.target.value.trim()) {
                  setSelectedIconUrl(e.target.value.trim());
                }
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setSelectedIconUrl(PRESET_APP_ICONS[2].url);
              setCustomUrlInput('');
            }}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs flex items-center space-x-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Default</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyIcon}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-950/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Terapkan Ikon Baru</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
