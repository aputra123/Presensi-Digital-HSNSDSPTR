import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Compass,
} from 'lucide-react';
import { BiometricLog, SchoolConfig } from '../types';

interface BiometricLocationMapProps {
  log: BiometricLog;
  schoolConfig?: SchoolConfig;
  height?: string;
  className?: string;
  showTitle?: boolean;
}

export const BiometricLocationMap: React.FC<BiometricLocationMapProps> = ({
  log,
  schoolConfig,
  height = '260px',
  className = '',
  showTitle = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tileMode, setTileMode] = useState<'streets' | 'satellite'>('streets');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const logLat = log.location?.lat;
  const logLng = log.location?.lng;
  const hasValidCoords =
    typeof logLat === 'number' &&
    !isNaN(logLat) &&
    typeof logLng === 'number' &&
    !isNaN(logLng);

  // Default fallback center to SMAN 1 Taliabu Barat if not configured
  const schoolLat = schoolConfig?.schoolLat ?? -1.86235;
  const schoolLng = schoolConfig?.schoolLng ?? 124.78912;
  const schoolName = schoolConfig?.schoolName || 'SMA Negeri 1 Taliabu Barat';
  const geofenceRadius = schoolConfig?.geofenceRadius || schoolConfig?.maxRadiusMeters || 150;

  const isFailed = log.status === 'failed' || log.severity === 'error' || log.location?.inRadius === false;
  const inRadius = log.location?.inRadius ?? true;
  const distanceMeters = log.location?.distanceMeter ?? (hasValidCoords ? Math.round(
    L.latLng(logLat!, logLng!).distanceTo(L.latLng(schoolLat, schoolLng))
  ) : 0);

  useEffect(() => {
    if (!mapContainerRef.current || !hasValidCoords || logLat === undefined || logLng === undefined) {
      return;
    }

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Initialize Map
      const map = L.map(mapContainerRef.current, {
        center: [logLat, logLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });
      mapInstanceRef.current = map;

      // 2. Add Tile Layer
      const tileUrl =
        tileMode === 'streets'
          ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // 3. School Geofence Circle & Center Marker
      L.circle([schoolLat, schoolLng], {
        radius: geofenceRadius,
        color: '#4f46e5',
        weight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        dashArray: '4, 4',
      }).addTo(map);

      const schoolIcon = L.divIcon({
        className: 'custom-school-marker',
        html: `
          <div style="
            background-color: #4338ca;
            color: white;
            padding: 5px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
              <path d="M10 6h4"/>
              <path d="M10 10h4"/>
              <path d="M10 14h4"/>
              <path d="M10 18h4"/>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const schoolMarker = L.marker([schoolLat, schoolLng], { icon: schoolIcon }).addTo(map);
      schoolMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4; padding: 2px;">
          <strong style="color: #1e1b4b; font-size: 12px;">🏫 ${schoolName}</strong><br/>
          <span style="color: #475569;">Pusat Geofence Presensi Biometrik</span><br/>
          <span style="color: #4338ca; font-weight: bold;">Radius Aman: ${geofenceRadius} Meter</span>
        </div>
      `);

      // 4. User Biometric Attempt Location Marker
      const attemptMarkerColor = isFailed ? '#e11d48' : '#059669';
      const attemptIcon = L.divIcon({
        className: 'custom-attempt-marker',
        html: `
          <div style="
            background-color: ${attemptMarkerColor};
            color: white;
            padding: 6px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            animation: ${isFailed ? 'pulse 1.5s infinite' : 'none'};
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 30],
      });

      const attemptMarker = L.marker([logLat, logLng], { icon: attemptIcon }).addTo(map);
      attemptMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4; padding: 3px; min-width: 170px;">
          <strong style="color: ${isFailed ? '#9f1239' : '#065f46'}; font-size: 12px;">
            ${isFailed ? '⚠️ Koordinat Percobaan Gagal' : '✓ Koordinat Otentikasi Lolos'}
          </strong><br/>
          <strong>Personil:</strong> ${log.personName}<br/>
          <strong>Waktu:</strong> ${log.time || log.timestamp} WITA<br/>
          <strong>Akurasi AI:</strong> ${log.matchScore}%<br/>
          <strong>Jarak:</strong> ${distanceMeters} meter dari sekolah<br/>
          <span style="color: ${inRadius ? '#059669' : '#dc2626'}; font-weight: bold;">
            ${inRadius ? '• Dalam Geofence Sekolah' : '• Di Luar Radius Sekolah (Anomali)'}
          </span>
        </div>
      `).openPopup();

      // 5. Connecting Line between School & Attempt Location
      L.polyline(
        [
          [schoolLat, schoolLng],
          [logLat, logLng],
        ],
        {
          color: isFailed ? '#f43f5e' : '#10b981',
          weight: 2.5,
          dashArray: '5, 8',
          opacity: 0.85,
        }
      ).addTo(map);

      // Fit bounds to show both school and attempt
      const bounds = L.latLngBounds([
        [schoolLat, schoolLng],
        [logLat, logLng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } catch (err) {
      console.error('Error rendering Leaflet Biometric Map:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasValidCoords, logLat, logLng, schoolLat, schoolLng, geofenceRadius, isFailed, inRadius, tileMode]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current && hasValidCoords && logLat !== undefined && logLng !== undefined) {
      const bounds = L.latLngBounds([
        [schoolLat, schoolLng],
        [logLat, logLng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  };

  if (!hasValidCoords) {
    return (
      <div
        id="biometric-map-no-coords"
        className={`p-6 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-2 ${className}`}
      >
        <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-xs font-bold text-slate-700">Data Koordinat GPS Tidak Tersedia</p>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          Percobaan otentikasi biometrik ini tidak menyertakan payload koordinat latitude/longitude perangkat.
        </p>
      </div>
    );
  }

  return (
    <div
      id="biometric-location-map-wrapper"
      className={`relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl bg-white flex flex-col' : ''
      } ${className}`}
    >
      {/* Map Header Controls Bar */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between z-10 text-xs shrink-0">
        <div className="flex items-center space-x-2">
          <MapPin className={`w-4 h-4 ${isFailed ? 'text-rose-400' : 'text-emerald-400'}`} />
          <span className="font-extrabold tracking-tight">
            Visualisasi Lokasi GPS & Anti-Spoofing Geofence
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              inRadius ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {inRadius ? 'Dalam Radius' : 'Di Luar Radius'} ({distanceMeters}m)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-colors flex items-center space-x-1 cursor-pointer ${
              tileMode === 'satellite'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Ganti Tampilan Peta (Street / Satelit)"
          >
            <Layers className="w-3 h-3" />
            <span>{tileMode === 'satellite' ? 'Satelit' : 'Jalan'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Pusatkan Ulang Peta"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title={isFullscreen ? 'Kecilkan Peta' : 'Perbesar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map Stage */}
      <div
        ref={mapContainerRef}
        className="w-full relative z-0"
        style={{ height: isFullscreen ? 'calc(100% - 75px)' : height, minHeight: '220px' }}
      />

      {/* On-Map Floating Zoom Controls */}
      <div className="absolute right-3 bottom-3 z-10 flex flex-col space-y-1.5">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Map Legend Overlay at Bottom Left */}
      <div className="absolute left-3 bottom-3 z-10 bg-slate-900/85 backdrop-blur-md text-white px-3 py-2 rounded-2xl text-[10px] space-y-1 border border-slate-700 shadow-md">
        <div className="flex items-center space-x-2 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white"></span>
          <span>Pusat SMAN 1 Taliabu (Radius {geofenceRadius}m)</span>
        </div>
        <div className="flex items-center space-x-2 font-semibold">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isFailed ? 'bg-rose-500' : 'bg-emerald-500'} border border-white`}
          ></span>
          <span>
            {isFailed ? 'Titik Gagal / Ditolak' : 'Titik Sukses Valid'} ({logLat?.toFixed(5)}, {logLng?.toFixed(5)})
          </span>
        </div>
      </div>
    </div>
  );
};
