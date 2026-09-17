import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig } from '../types';

interface AttendanceRecordMapProps {
  record: AttendanceRecord;
  schoolConfig?: SchoolConfig;
  height?: string;
  className?: string;
}

export const AttendanceRecordMap: React.FC<AttendanceRecordMapProps> = ({
  record,
  schoolConfig,
  height = '240px',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const recLat = record.location?.lat;
  const recLng = record.location?.lng;
  const hasValidCoords =
    typeof recLat === 'number' &&
    !isNaN(recLat) &&
    typeof recLng === 'number' &&
    !isNaN(recLng);

  const schoolLat = schoolConfig?.schoolLat || -1.8214;
  const schoolLng = schoolConfig?.schoolLng || 124.7081;
  const schoolName = schoolConfig?.schoolName || 'SMPN 4 Taliabu Barat';
  const geofenceRadius = schoolConfig?.geofenceRadius || schoolConfig?.maxRadiusMeters || 150;

  useEffect(() => {
    if (!mapContainerRef.current || !hasValidCoords || recLat === undefined || recLng === undefined) {
      return;
    }

    // If map already exists, remove it before re-initializing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Initialize Map centered on Attendance Record Location
      const map = L.map(mapContainerRef.current, {
        center: [recLat, recLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // 2. Base Tile Layer (CartoDB Positron for clean visual clarity)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // 3. School Geofence Circle
      const schoolCircle = L.circle([schoolLat, schoolLng], {
        radius: geofenceRadius,
        color: '#4f46e5',
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '4, 6',
      }).addTo(map);

      schoolCircle.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 4px;">
          <strong style="color: #312e81;">🏫 ${schoolName}</strong><br/>
          <span style="color: #475569;">Radius Geofence: ${geofenceRadius}m</span>
        </div>
      `);

      // 4. School Center Marker
      const schoolIcon = L.divIcon({
        className: 'custom-school-icon',
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background: #4338ca;
            color: #ffffff;
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          ">🏫</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([schoolLat, schoolLng], { icon: schoolIcon })
        .addTo(map)
        .bindPopup(`<strong>🏫 ${schoolName}</strong>`);

      // 5. Attendance Location Marker
      const inRadius = record.location?.inRadius ?? true;
      const markerColor = inRadius ? '#10b981' : '#f43f5e';
      const personSymbol = record.personType === 'teacher' ? '👨‍🏫' : '🎓';

      const userIcon = L.divIcon({
        className: 'custom-user-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="
              width: 32px;
              height: 32px;
              background: ${markerColor};
              color: #ffffff;
              border: 2.5px solid #ffffff;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              animation: bounce 1.5s infinite;
            ">${personSymbol}</div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid ${markerColor};
              margin-top: -2px;
            "></div>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -36],
      });

      const userMarker = L.marker([recLat, recLng], { icon: userIcon }).addTo(map);

      userMarker
        .bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.4; min-width: 170px;">
          <strong style="color: #0f172a; font-size: 12px;">${record.personName}</strong><br/>
          <span style="color: #64748b;">${record.identifier} • Sesi ${record.type.toUpperCase()}</span><br/>
          <div style="margin-top: 4px; padding: 3px 6px; background: ${inRadius ? '#ecfdf5' : '#fff1f2'}; color: ${inRadius ? '#065f46' : '#9f1239'}; border-radius: 6px; font-weight: bold;">
            ${inRadius ? '✓ Dalam Radius Sekolah' : '✕ Diluar Radius Sekolah'} (${record.location?.distanceMeter || 0}m)
          </div>
          <span style="color: #475569; font-size: 10px; display: block; margin-top: 4px;">
            ${record.location?.address || 'Lokasi Terverifikasi'}
          </span>
        </div>
      `)
        .openPopup();

      // 6. Connect line between user & school
      const lineCoords: [number, number][] = [
        [schoolLat, schoolLng],
        [recLat, recLng],
      ];
      L.polyline(lineCoords, {
        color: inRadius ? '#10b981' : '#f43f5e',
        weight: 2,
        dashArray: '5, 5',
        opacity: 0.7,
      }).addTo(map);

      // Fit bounds nicely with gentle padding
      const group = L.featureGroup([
        L.marker([schoolLat, schoolLng]),
        L.marker([recLat, recLng]),
        schoolCircle,
      ]);
      map.fitBounds(group.getBounds().pad(0.2));

      // Trigger size recalculation after animation/render
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
    } catch (err) {
      console.warn('[AttendanceRecordMap] Leaflet initialization warning:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [recLat, recLng, schoolLat, schoolLng, geofenceRadius, record, schoolName]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleRecenter = () => {
    if (mapInstanceRef.current && hasValidCoords && recLat !== undefined && recLng !== undefined) {
      mapInstanceRef.current.setView([recLat, recLng], 17);
    }
  };

  const googleMapsUrl = hasValidCoords
    ? `https://www.google.com/maps?q=${recLat},${recLng}`
    : '#';

  if (!hasValidCoords) {
    return (
      <div className={`rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-4 text-center text-slate-500 text-xs flex flex-col items-center justify-center ${className}`} style={{ height }}>
        <MapPin className="w-6 h-6 text-slate-400 mb-1" />
        <span className="font-semibold text-slate-700 dark:text-slate-300">Koordinat GPS Tidak Tersedia</span>
        <span className="text-[11px] text-slate-400">Presensi direkam tanpa metadata koordinat geolokasi satelit.</span>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs bg-slate-950 ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl h-auto' : ''
      } ${className}`}
      style={{ height: isFullscreen ? 'calc(100vh - 2rem)' : height }}
    >
      {/* Map Target DOM element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Floating Control Buttons */}
      <div className="absolute top-2 right-2 z-10 flex flex-col space-y-1">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-7 h-7 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-md flex items-center justify-center text-xs font-bold cursor-pointer transition-transform active:scale-95"
          title="Perbesar Peta"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-7 h-7 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-md flex items-center justify-center text-xs font-bold cursor-pointer transition-transform active:scale-95"
          title="Perkecil Peta"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          className="w-7 h-7 bg-white/95 hover:bg-white text-indigo-600 rounded-lg shadow-md flex items-center justify-center text-xs font-bold cursor-pointer transition-transform active:scale-95"
          title="Pusatkan pada Lokasi Presensi"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
          }}
          className="w-7 h-7 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-md flex items-center justify-center text-xs font-bold cursor-pointer transition-transform active:scale-95"
          title={isFullscreen ? 'Kecilkan' : 'Perbesar Penuh'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Top-Left Status Overlay */}
      <div className="absolute top-2 left-2 z-10 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/80 text-white text-[11px] shadow-md">
        {record.location?.inRadius ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        )}
        <span className="font-bold">
          {record.location?.inRadius ? 'Valid Dalam Radius' : 'Diluar Radius'}{' '}
          <span className="text-slate-400 font-mono text-[10px]">
            ({record.location?.distanceMeter || 0}m)
          </span>
        </span>
      </div>

      {/* Bottom Info Bar with Coordinates & External Google Maps link */}
      <div className="absolute bottom-2 left-2 right-2 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-white text-[10px] flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2 truncate font-mono text-slate-300">
          <span>Lat: {recLat?.toFixed(6)}</span>
          <span>•</span>
          <span>Lng: {recLng?.toFixed(6)}</span>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-indigo-300 hover:text-indigo-200 font-bold ml-2 shrink-0 underline"
          title="Buka titik koordinat di Google Maps"
        >
          <span>Google Maps</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
};
