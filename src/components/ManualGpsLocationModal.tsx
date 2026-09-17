import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Building,
  Save,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { playBeepSound } from '../utils/soundAndDate';

interface ManualGpsLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLat: number;
  currentLng: number;
  currentRadius: number;
  schoolName: string;
  onSaveGpsLocation: (lat: number, lng: number, radius: number) => void;
}

const TALIABU_GPS_PRESETS = [
  {
    name: 'SMPN 4 Taliabu Barat (Gedung Utama)',
    desc: 'Pusat kantor Kepala Sekolah & Administrasi',
    lat: -1.821400,
    lng: 124.708100,
  },
  {
    name: 'Gerbang Utama & Pos Piket',
    desc: 'Pintu masuk dan pos pemeriksaan kehadiran',
    lat: -1.821150,
    lng: 124.707950,
  },
  {
    name: 'Ruang Guru & Tata Usaha',
    desc: 'Ruang kerja GTK dan server SIMPEG sekolah',
    lat: -1.821300,
    lng: 124.708250,
  },
  {
    name: 'Lapangan Upacara & Olahraga',
    desc: 'Area apel pagi dan senam bersama',
    lat: -1.821600,
    lng: 124.708300,
  },
  {
    name: 'Kantor BKD Kab. Pulau Taliabu',
    desc: 'Kantor Badan Kepegawaian Daerah Bobong',
    lat: -1.828500,
    lng: 124.712500,
  },
  {
    name: 'Dinas Pendidikan Kab. Pulau Taliabu',
    desc: 'Kantor Dinas Dikbud Bobong',
    lat: -1.824000,
    lng: 124.710000,
  },
];

export const ManualGpsLocationModal: React.FC<ManualGpsLocationModalProps> = ({
  isOpen,
  onClose,
  currentLat,
  currentLng,
  currentRadius,
  schoolName,
  onSaveGpsLocation,
}) => {
  const [latInput, setLatInput] = useState<string>(currentLat.toString());
  const [lngInput, setLngInput] = useState<string>(currentLng.toString());
  const [radiusInput, setRadiusInput] = useState<number>(currentRadius || 100);
  const [pasteInput, setPasteInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [nudgeMeters, setNudgeMeters] = useState<number>(5);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Sync inputs when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setLatInput(currentLat.toFixed(6));
      setLngInput(currentLng.toFixed(6));
      setRadiusInput(currentRadius || 100);
      setPasteInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, currentLat, currentLng, currentRadius]);

  // Leaflet Interactive Mini-Map inside Modal
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const latNum = parseFloat(latInput) || currentLat;
    const lngNum = parseFloat(lngInput) || currentLng;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latNum, lngNum],
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    const circle = L.circle([latNum, lngNum], {
      radius: radiusInput,
      color: '#4f46e5',
      fillColor: '#6366f1',
      fillOpacity: 0.18,
      weight: 2,
      dashArray: '5, 5',
    }).addTo(map);
    circleRef.current = circle;

    const schoolIcon = L.divIcon({
      className: 'school-manual-marker',
      html: `
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #312e81;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(0,0,0,0.35);
          border: 2.5px solid #ffffff;
          font-size: 18px;
          cursor: grab;
        ">
          🏫
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const marker = L.marker([latNum, lngNum], {
      icon: schoolIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      const newLat = Number(pos.lat.toFixed(6));
      const newLng = Number(pos.lng.toFixed(6));
      setLatInput(newLat.toString());
      setLngInput(newLng.toString());
      circle.setLatLng([newLat, newLng]);
      setSuccessMessage(`Titik koordinat digeser ke: ${newLat}, ${newLng}`);
      setErrorMessage(null);
    });

    map.on('click', (e) => {
      const newLat = Number(e.latlng.lat.toFixed(6));
      const newLng = Number(e.latlng.lng.toFixed(6));
      setLatInput(newLat.toString());
      setLngInput(newLng.toString());
      marker.setLatLng([newLat, newLng]);
      circle.setLatLng([newLat, newLng]);
      setSuccessMessage(`Titik koordinat disetel ke: ${newLat}, ${newLng}`);
      setErrorMessage(null);
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Update map marker and circle when text input or radius changes
  const updateMapPosition = (lat: number, lng: number, radius?: number) => {
    const r = radius !== undefined ? radius : radiusInput;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(r);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 17);
    }
  };

  // Nudge latitude/longitude by fine-tune meters
  const handleNudge = (direction: 'north' | 'south' | 'east' | 'west') => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) return;

    // Approximations in equatorial region (~111,000m per degree latitude)
    const latDelta = nudgeMeters / 111000;
    const lngDelta = nudgeMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    let newLat = lat;
    let newLng = lng;

    if (direction === 'north') newLat += latDelta;
    if (direction === 'south') newLat -= latDelta;
    if (direction === 'east') newLng += lngDelta;
    if (direction === 'west') newLng -= lngDelta;

    newLat = Number(newLat.toFixed(6));
    newLng = Number(newLng.toFixed(6));

    setLatInput(newLat.toString());
    setLngInput(newLng.toString());
    updateMapPosition(newLat, newLng);
    setSuccessMessage(`Digeser ${nudgeMeters}m ke arah ${direction.toUpperCase()}`);
    setErrorMessage(null);
  };

  // Handle parsing paste input (e.g. "-1.821400, 124.708100" or Google Maps link)
  const handleParsePasteInput = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const text = pasteInput.trim();
    if (!text) {
      setErrorMessage('Harap masukkan teks atau link koordinat yang ingin ditempel.');
      return;
    }

    // Match numbers like -1.8214, 124.7081 or @-1.8214,124.7081
    const match = text.match(/(-?\d+\.\d+)[\s,;]+(-?\d+\.\d+)/);
    if (match) {
      const parsedLat = parseFloat(match[1]);
      const parsedLng = parseFloat(match[2]);

      if (parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
        setLatInput(parsedLat.toFixed(6));
        setLngInput(parsedLng.toFixed(6));
        updateMapPosition(parsedLat, parsedLng);
        setSuccessMessage(`Koordinat berhasil diekstrak: ${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`);
        setPasteInput('');
        return;
      }
    }

    setErrorMessage('Format koordinat tidak valid. Contoh format yang diterima: -1.821400, 124.708100');
  };

  // Get live GPS from device
  const handleDetectDeviceGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Browser perangkat ini tidak mendukung sensor Geolocation.');
      return;
    }

    setIsDetectingGps(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatInput(lat.toString());
        setLngInput(lng.toString());
        updateMapPosition(lat, lng);
        setSuccessMessage(
          `Titik GPS perangkat terdeteksi: ${lat}, ${lng} (Akurasi: ±${Math.round(pos.coords.accuracy)}m)`
        );
      },
      (err) => {
        setIsDetectingGps(false);
        setErrorMessage(`Gagal mendeteksi GPS: ${err.message}. Pastikan izin lokasi diaktifkan.`);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Apply preset
  const handleApplyPreset = (preset: typeof TALIABU_GPS_PRESETS[0]) => {
    setLatInput(preset.lat.toFixed(6));
    setLngInput(preset.lng.toFixed(6));
    updateMapPosition(preset.lat, preset.lng);
    setSuccessMessage(`Preset diterapkan: ${preset.name}`);
    setErrorMessage(null);
  };

  // Save changes
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    const radius = Number(radiusInput);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMessage('Nilai Latitude harus berupa angka desimal antara -90.0 hingga +90.0.');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrorMessage('Nilai Longitude harus berupa angka desimal antara -180.0 hingga +180.0.');
      return;
    }

    if (isNaN(radius) || radius < 10 || radius > 5000) {
      setErrorMessage('Radius toleransi presensi harus antara 10 meter hingga 5000 meter.');
      return;
    }

    playBeepSound();
    onSaveGpsLocation(lat, lng, radius);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                <span>Atur Posisi Sekolah di GPS Secara Manual</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                  Geofencing
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {schoolName} • Tentukan titik pusat koordinat & toleransi jarak presensi siswa & GTK
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Status alerts */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Row: Use Device GPS & Paste Coordinate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Device GPS button */}
            <button
              type="button"
              onClick={handleDetectDeviceGps}
              disabled={isDetectingGps}
              className="p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
            >
              <Crosshair className={`w-4 h-4 ${isDetectingGps ? 'animate-spin' : ''}`} />
              <span>{isDetectingGps ? 'Mendeteksi GPS...' : 'Gunakan GPS Perangkat Saat Ini'}</span>
            </button>

            {/* 2. Quick Paste Box */}
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="Tempel: -1.8214, 124.7081"
                className="flex-1 text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={handleParsePasteInput}
                className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center space-x-1"
                title="Terapkan koordinat dari teks"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Tempel</span>
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Map Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Klik Peta atau Geser Pin 🏫 untuk Mengatur Posisi</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Radius: {radiusInput}m
              </span>
            </div>
            <div
              ref={mapContainerRef}
              className="h-56 w-full rounded-2xl border border-slate-200 overflow-hidden shadow-inner bg-slate-100"
            />
          </div>

          {/* Form Fields: Lat, Lng, Radius */}
          <form id="manualGpsForm" onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Latitude (Garis Lintang)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latInput}
                  onChange={(e) => {
                    setLatInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) updateMapPosition(val, parseFloat(lngInput) || currentLng);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Format: -1.821400</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Longitude (Garis Bujur)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lngInput}
                  onChange={(e) => {
                    setLngInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) updateMapPosition(parseFloat(latInput) || currentLat, val);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Format: 124.708100</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Radius Geofence (Meter)
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    required
                    value={radiusInput}
                    onChange={(e) => {
                      const r = Number(e.target.value);
                      setRadiusInput(r);
                      if (circleRef.current) circleRef.current.setRadius(r);
                    }}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-xs font-bold text-slate-500">m</span>
                </div>
                {/* Quick radius buttons */}
                <div className="flex items-center space-x-1 mt-1">
                  {[50, 100, 150, 200, 300].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setRadiusInput(r);
                        if (circleRef.current) circleRef.current.setRadius(r);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-colors cursor-pointer border ${
                        radiusInput === r
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Fine Tuning D-Pad (Nudge) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kalibrasi Geser Halus Titik Sekolah (Nudge)</span>
                </span>
                <div className="flex items-center space-x-1">
                  {[1, 5, 10, 25].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNudgeMeters(m)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                        nudgeMeters === m
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleNudge('north')}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Utara ({nudgeMeters}m)</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleNudge('west')}
                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Barat ({nudgeMeters}m)</span>
                  </button>
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-[10px] text-indigo-700">
                    GPS
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNudge('east')}
                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Timur ({nudgeMeters}m)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleNudge('south')}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Selatan ({nudgeMeters}m)</span>
                </button>
              </div>
            </div>

            {/* Presets Koordinat Resmi */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pilih Titik Lokasi Resmi (Preset Wilayah Bobong / Taliabu)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TALIABU_GPS_PRESETS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(item)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-left transition-all cursor-pointer group"
                  >
                    <div className="font-bold text-slate-800 text-xs group-hover:text-indigo-700 flex items-center space-x-1">
                      <span>{item.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                    <p className="text-[9.5px] font-mono text-indigo-600 mt-1">
                      {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            form="manualGpsForm"
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan & Terapkan Koordinat GPS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
