import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Navigation,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Crosshair,
  Edit3,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Building,
  Check,
} from 'lucide-react';
import { calculateDistanceMeters, playBeepSound } from '../utils/soundAndDate';

interface SchoolGeofenceConfigMapProps {
  schoolLat: number;
  schoolLng: number;
  maxRadiusMeters: number;
  schoolName: string;
  onUpdateCoordinates: (lat: number, lng: number) => void;
  onUpdateRadius: (radius: number) => void;
}

export const SchoolGeofenceConfigMap: React.FC<SchoolGeofenceConfigMapProps> = ({
  schoolLat,
  schoolLng,
  maxRadiusMeters,
  schoolName,
  onUpdateCoordinates,
  onUpdateRadius,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const testMarkerRef = useRef<L.Marker | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    lat: number;
    lng: number;
    distance: number;
    inRadius: boolean;
  } | null>(null);

  // Manual GPS Configuration Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualLat, setManualLat] = useState<string>(schoolLat.toString());
  const [manualLng, setManualLng] = useState<string>(schoolLng.toString());
  const [rawPasteInput, setRawPasteInput] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [nudgeMeters, setNudgeMeters] = useState<number>(5);

  // Sync state when props change
  useEffect(() => {
    setManualLat(schoolLat.toString());
    setManualLng(schoolLng.toString());
  }, [schoolLat, schoolLng]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [schoolLat, schoolLng],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    // Clean, high quality Voyager Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    // Geofence Circle Overlay
    const circle = L.circle([schoolLat, schoolLng], {
      radius: maxRadiusMeters,
      color: '#4f46e5',
      fillColor: '#6366f1',
      fillOpacity: 0.15,
      weight: 2.5,
      dashArray: '6, 6',
    }).addTo(map);
    geofenceCircleRef.current = circle;

    // Draggable School Center Pin
    const schoolIcon = L.divIcon({
      className: 'school-config-center-marker',
      html: `
        <div style="
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: linear-gradient(135deg, #312e81, #4f46e5);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(79, 70, 229, 0.5);
          border: 3px solid #ffffff;
          font-size: 20px;
          cursor: grab;
        ">
          🏫
          <div style="
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid #4f46e5;
          "></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
    });

    const marker = L.marker([schoolLat, schoolLng], {
      icon: schoolIcon,
      draggable: true,
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 190px;">
        <div style="font-weight: 800; font-size: 13px; color: #1e1b4b;">🏫 ${schoolName}</div>
        <div style="font-size: 11px; color: #4f46e5; font-weight: 700; margin-top: 2px;">
          Pusat Geofence: ${maxRadiusMeters}m
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          💡 Geser marker ini atau klik peta untuk memindahkan titik pusat sekolah.
        </div>
      </div>
    `);

    marker.on('dragend', (e) => {
      const target = e.target as L.Marker;
      const pos = target.getLatLng();
      onUpdateCoordinates(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
    });

    // Map Click to Test or Move
    map.on('click', (e) => {
      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;
      const dist = Math.round(calculateDistanceMeters(schoolLat, schoolLng, clickLat, clickLng));
      const inRadius = dist <= maxRadiusMeters;

      setTestResult({
        lat: Number(clickLat.toFixed(6)),
        lng: Number(clickLng.toFixed(6)),
        distance: dist,
        inRadius,
      });

      // Show temporary test pin
      if (testMarkerRef.current) {
        testMarkerRef.current.remove();
      }

      const testIcon = L.divIcon({
        className: 'test-point-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${inRadius ? '#10b981' : '#ef4444'};
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: 800;
          ">
            ${inRadius ? '✓' : '✕'}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const newTestMarker = L.marker([clickLat, clickLng], { icon: testIcon }).addTo(map);
      newTestMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 170px;">
          <div style="font-weight: 800; font-size: 12px; color: ${inRadius ? '#059669' : '#dc2626'};">
            ${inRadius ? '✓ DALAM RADIUS (VALID)' : '✕ DI LUAR RADIUS (INVALID)'}
          </div>
          <div style="font-size: 11px; color: #334155; margin-top: 2px;">
            Jarak: <b>${dist} meter</b> dari pusat sekolah
          </div>
          <div style="font-size: 9.5px; color: #64748b; font-family: monospace; margin-top: 2px;">
            ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}
          </div>
        </div>
      `).openPopup();
      testMarkerRef.current = newTestMarker;
    });

    centerMarkerRef.current = marker;
    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Center Marker & Geofence Circle when props change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([schoolLat, schoolLng]);
    }

    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setLatLng([schoolLat, schoolLng]);
      geofenceCircleRef.current.setRadius(maxRadiusMeters);
    }

    mapInstanceRef.current.panTo([schoolLat, schoolLng]);
  }, [schoolLat, schoolLng, maxRadiusMeters]);

  // Manual GPS Adjustments
  const handleParsePaste = (text: string) => {
    setManualError(null);
    setManualSuccess(null);
    setRawPasteInput(text);

    if (!text.trim()) return;

    // Support formats like:
    // "-1.821400, 124.708100" or "-1.8214 124.7081"
    // "https://www.google.com/maps?q=-1.8214,124.7081"
    // "https://maps.google.com/@-1.821400,124.708100,17z"
    const coordRegex = /(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/;
    const match = text.match(coordRegex);

    if (match) {
      const parsedLat = parseFloat(match[1]);
      const parsedLng = parseFloat(match[2]);

      if (parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
        setManualLat(parsedLat.toFixed(6));
        setManualLng(parsedLng.toFixed(6));
        setManualSuccess(`Berhasil mengekstrak koordinat: Lat ${parsedLat.toFixed(6)}, Lng ${parsedLng.toFixed(6)}`);
        return;
      }
    }

    setManualError('Format koordinat tidak dikenali. Contoh yang didukung: -1.821400, 124.708100 atau link Google Maps.');
  };

  const handleApplyPreset = (presetName: string, lat: number, lng: number) => {
    setManualLat(lat.toFixed(6));
    setManualLng(lng.toFixed(6));
    setManualSuccess(`Preset dipilih: ${presetName}`);
    setManualError(null);
  };

  const handleNudge = (direction: 'north' | 'south' | 'east' | 'west') => {
    const currentLat = parseFloat(manualLat) || schoolLat;
    const currentLng = parseFloat(manualLng) || schoolLng;
    const deltaDeg = (nudgeMeters / 111320);

    let newLat = currentLat;
    let newLng = currentLng;

    if (direction === 'north') newLat += deltaDeg;
    if (direction === 'south') newLat -= deltaDeg;
    if (direction === 'east') newLng += deltaDeg;
    if (direction === 'west') newLng -= deltaDeg;

    setManualLat(newLat.toFixed(6));
    setManualLng(newLng.toFixed(6));
    setManualSuccess(`Digeser ${nudgeMeters}m ke arah ${direction === 'north' ? 'Utara' : direction === 'south' ? 'Selatan' : direction === 'east' ? 'Timur' : 'Barat'}`);
  };

  const handleSaveManualCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const parsedLat = parseFloat(manualLat);
    const parsedLng = parseFloat(manualLng);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setManualError('Latitude harus berupa angka valid antara -90 dan 90.');
      return;
    }

    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setManualError('Longitude harus berupa angka valid antara -180 dan 180.');
      return;
    }

    playBeepSound();
    onUpdateCoordinates(Number(parsedLat.toFixed(6)), Number(parsedLng.toFixed(6)));
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([parsedLat, parsedLng], 18);
    }
    setIsManualModalOpen(false);
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung oleh browser Anda.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingGps(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        onUpdateCoordinates(lat, lng);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 18);
        }
      },
      (error) => {
        setIsDetectingGps(false);
        setGpsError(`Gagal mengambil lokasi GPS (${error.message}). Pastikan izin lokasi aktif.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePresetRadius = (r: number) => {
    onUpdateRadius(r);
  };

  return (
    <div className="bg-slate-50/80 rounded-3xl border border-slate-200 p-4 lg:p-5 space-y-4">
      {/* Top Header & Instructions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
              <span>Peta Interaktif Radius Geofencing Sekolah</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                Live Leaflet
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              Geser marker 🏫 atau klik peta untuk menyesuaikan koordinat & visualisasi radius presensi diizinkan (inRadius).
            </p>
          </div>
        </div>

        {/* GPS Control Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setManualLat(schoolLat.toFixed(6));
              setManualLng(schoolLng.toFixed(6));
              setManualError(null);
              setManualSuccess(null);
              setIsManualModalOpen(true);
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <span>Atur Posisi GPS Manual</span>
          </button>

          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={isDetectingGps}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <Crosshair className={`w-4 h-4 ${isDetectingGps ? 'animate-spin' : ''}`} />
            <span>{isDetectingGps ? 'Mendeteksi GPS...' : 'Gunakan GPS Perangkat Saya'}</span>
          </button>
        </div>
      </div>

      {gpsError && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Interactive Map Visualizer Container */}
      <div
        className={`relative bg-slate-200 rounded-2xl overflow-hidden border border-slate-300 shadow-inner ${
          isFullscreen ? 'fixed inset-4 z-50 shadow-2xl h-[calc(100vh-2rem)]' : 'h-[360px]'
        }`}
      >
        {/* Top Info Banner Overlay */}
        <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-slate-700/80 shadow-md text-white text-xs flex items-center space-x-2 pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
            <span className="font-extrabold">Radius Izin Presensi: {maxRadiusMeters} Meter</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-mono text-[11px]">
              {schoolLat.toFixed(5)}, {schoolLng.toFixed(5)}
            </span>
          </div>
        </div>

        {/* Top Right Fullscreen toggle */}
        <div className="absolute top-3 right-3 z-[400]">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-white/90 hover:bg-white text-slate-700 rounded-xl border border-slate-200 shadow-md transition-all cursor-pointer"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Bottom Test Result Tooltip Overlay */}
        {testResult && (
          <div className="absolute bottom-3 left-3 right-3 z-[400] flex justify-center pointer-events-none">
            <div
              className={`px-4 py-2 rounded-2xl backdrop-blur-md shadow-lg border text-xs font-bold flex items-center space-x-2 pointer-events-auto ${
                testResult.inRadius
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                  : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
              }`}
            >
              {testResult.inRadius ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                Titik Uji: Jarak <b>{testResult.distance} Meter</b> ({testResult.inRadius ? '✓ Dalam Radius Sekolah' : '✕ Di Luar Radius Geofence'})
              </span>
            </div>
          </div>
        )}

        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>

      {/* Geofence Radius Slider & Preset Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Radius Slider */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>Atur Radius Geofence (Meter)</span>
            </label>
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-lg font-mono">
              {maxRadiusMeters} M
            </span>
          </div>

          <input
            type="range"
            min="20"
            max="500"
            step="5"
            value={maxRadiusMeters}
            onChange={(e) => onUpdateRadius(Number(e.target.value))}
            className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-mono">
            <span>20m (Ketat)</span>
            <span>100m (Standar)</span>
            <span>250m (Sedang)</span>
            <span>500m (Luas)</span>
          </div>
        </div>

        {/* Radius Presets & Live Verification Note */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2">
          <div>
            <label className="text-xs font-extrabold text-slate-800 block mb-1.5">
              Preset Cepat Radius Sekolah
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[50, 100, 150, 250].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handlePresetRadius(r)}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    maxRadiusMeters === r
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {r}m
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-tight">
            💡 <b>Tips:</b> Klik sembarang titik di dalam/luar area peta di atas untuk menguji apakah lokasi tersebut akan terverifikasi <i>Valid (Dalam Radius)</i> saat siswa/GTK melakukan presensi GPS.
          </p>
        </div>
      </div>

      {/* MODAL: ATUR POSISI SEKOLAH DI GPS SECARA MANUAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Atur Posisi Sekolah di GPS Secara Manual
                  </h3>
                  <p className="text-xs text-slate-500">
                    {schoolName} • Koordinat Presisi Pusat Geofencing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Paste from Google Maps / WhatsApp */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
              <label className="text-xs font-bold text-indigo-950 flex items-center space-x-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tempel Koordinat Langsung (Dari Google Maps / Link / Teks)</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Contoh: -1.821400, 124.708100 atau link Google Maps..."
                  value={rawPasteInput}
                  onChange={(e) => handleParsePaste(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleParsePaste(rawPasteInput)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Ekstrak
                </button>
              </div>
            </div>

            {/* Notification alert if any */}
            {manualError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}
            {manualSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{manualSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveManualCoordinates} className="space-y-4 text-xs">
              {/* Manual Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Latitude (Garis Lintang Desimal)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={manualLat}
                    onChange={(e) => {
                      setManualLat(e.target.value);
                      setManualError(null);
                    }}
                    placeholder="-1.821400"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Rentang: -90.0 s/d +90.0
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Longitude (Garis Bujur Desimal)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={manualLng}
                    onChange={(e) => {
                      setManualLng(e.target.value);
                      setManualError(null);
                    }}
                    placeholder="124.708100"
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Rentang: -180.0 s/d +180.0
                  </span>
                </div>
              </div>

              {/* Fine Tuning D-Pad (Nudge Direction) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Kalibrasi Geser Halus (Fine-Tuning Presisi)</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    {[1, 5, 10, 25].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNudgeMeters(m)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
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
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-[10px] text-indigo-700">
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

              {/* Presets of School Facilities */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Pilih dari Titik Bangunan Sekolah (Preset Koordinat)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('Gedung Utama / Kantor Kepsek', -1.821400, 124.708100)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-left transition-all cursor-pointer group"
                  >
                    <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-700 flex items-center space-x-1">
                      <Building className="w-3 h-3 text-indigo-600" />
                      <span>Gedung Utama / Kantor</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      -1.821400, 124.708100
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('Gerbang Masuk & Pos Piket', -1.821150, 124.707950)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-left transition-all cursor-pointer group"
                  >
                    <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-700 flex items-center space-x-1">
                      <Building className="w-3 h-3 text-indigo-600" />
                      <span>Gerbang Masuk & Pos Piket</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      -1.821150, 124.707950
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('Lapangan Upacara & Olahraga', -1.821600, 124.708300)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-left transition-all cursor-pointer group"
                  >
                    <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-700 flex items-center space-x-1">
                      <Building className="w-3 h-3 text-indigo-600" />
                      <span>Lapangan Upacara & Senam</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      -1.821600, 124.708300
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('Ruang Guru & Tata Usaha', -1.821300, 124.708250)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-left transition-all cursor-pointer group"
                  >
                    <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-700 flex items-center space-x-1">
                      <Building className="w-3 h-3 text-indigo-600" />
                      <span>Ruang Guru & Tata Usaha</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      -1.821300, 124.708250
                    </p>
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan & Terapkan Titik GPS</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
