import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { SchoolConfig } from '../types';
import { isWithinGeofence, SCHOOL_PRESET_LOCATIONS } from '../utils/geoUtils';

interface LiveSelfieLeafletMapProps {
  config: SchoolConfig;
  userLat: number;
  userLng: number;
  userName?: string;
  userAvatar?: string;
  isTeacher?: boolean;
  onLocationChange: (loc: {
    lat: number;
    lng: number;
    address: string;
    inRadius: boolean;
    distanceMeter: number;
  }) => void;
  height?: string;
}

export const LiveSelfieLeafletMap: React.FC<LiveSelfieLeafletMapProps> = ({
  config,
  userLat,
  userLng,
  userName = 'Pengguna',
  userAvatar,
  isTeacher = true,
  onLocationChange,
  height = '280px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<string>('preset_0');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const schoolLat = config?.schoolLat ?? -1.8214;
  const schoolLng = config?.schoolLng ?? 124.7081;
  const schoolName = config?.schoolName || 'SMPN 4 Taliabu Barat';
  const maxRadiusMeters = config?.maxRadiusMeters ?? config?.geofenceRadius ?? 100;

  const { inRadius, distanceMeter } = isWithinGeofence(
    userLat,
    userLng,
    schoolLat,
    schoolLng,
    maxRadiusMeters
  );

  // Initialize Map
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

    // Tile Layer: CartoDB Voyager / OpenStreetMap for clean high contrast
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    // 1. School Geofence Circle
    const schoolCircle = L.circle([schoolLat, schoolLng], {
      radius: maxRadiusMeters,
      color: '#4f46e5',
      fillColor: inRadius ? '#10b981' : '#6366f1',
      fillOpacity: 0.15,
      weight: 2.5,
      dashArray: '6, 6',
    }).addTo(map);
    circleRef.current = schoolCircle;

    schoolCircle.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 4px; min-width: 170px;">
        <strong style="color: #312e81; font-size: 12px;">🏫 ${schoolName}</strong><br/>
        <span style="color: #4338ca; font-weight: 700;">Radius Geofence: ${maxRadiusMeters} Meter</span><br/>
        <span style="color: #64748b; font-size: 10px;">Titik Pusat Koordinat Resmi Sekolah</span>
      </div>
    `);

    // 2. School Center Marker
    const schoolIcon = L.divIcon({
      className: 'live-school-center-icon',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 12px;
          background: #312e81;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid #ffffff;
          font-size: 14px;
        ">
          🏫
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([schoolLat, schoolLng], { icon: schoolIcon })
      .addTo(map)
      .bindPopup(`<strong>${schoolName}</strong><br/>Koordinat: ${schoolLat.toFixed(5)}, ${schoolLng.toFixed(5)}`);

    // 3. User Live Marker
    const markerBorderColor = inRadius ? '#10b981' : '#ef4444';
    const userIcon = L.divIcon({
      className: 'live-user-location-icon',
      html: `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid ${markerBorderColor};
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">
          ${
            userAvatar
              ? `<img src="${userAvatar}" style="width:100%;height:100%;object-fit:cover;" />`
              : `<div style="font-size:16px;">${isTeacher ? '👨‍🏫' : '🎓'}</div>`
          }
        </div>
        <div style="
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${markerBorderColor};
          border: 2px solid #ffffff;
          box-shadow: 0 0 6px ${markerBorderColor};
        "></div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const userMarker = L.marker([userLat, userLng], {
      icon: userIcon,
      draggable: true,
    }).addTo(map);

    userMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 4px;">
        <strong style="color: #0f172a;">📍 Lokasi Anda: ${userName}</strong><br/>
        <span style="color: ${inRadius ? '#059669' : '#dc2626'}; font-weight: 700;">
          ${inRadius ? '✓ Dalam Radius' : '✕ Di Luar Radius'} (${distanceMeter}m)
        </span>
      </div>
    `);

    userMarkerRef.current = userMarker;

    // 4. Connecting line between school center and user location
    const line = L.polyline(
      [
        [schoolLat, schoolLng],
        [userLat, userLng],
      ],
      {
        color: inRadius ? '#10b981' : '#f43f5e',
        weight: 2,
        dashArray: '4, 4',
        opacity: 0.8,
      }
    ).addTo(map);
    lineRef.current = line;

    // Allow user to drag marker or click map to reposition
    userMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      const calc = isWithinGeofence(pos.lat, pos.lng, schoolLat, schoolLng, maxRadiusMeters);
      onLocationChange({
        lat: pos.lat,
        lng: pos.lng,
        address: `Koordinat GPS (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}) - ${
          calc.inRadius ? 'Dalam Radius Sekolah' : 'Di Luar Radius Sekolah'
        }`,
        inRadius: calc.inRadius,
        distanceMeter: calc.distanceMeter,
      });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const pos = e.latlng;
      const calc = isWithinGeofence(pos.lat, pos.lng, schoolLat, schoolLng, maxRadiusMeters);
      onLocationChange({
        lat: pos.lat,
        lng: pos.lng,
        address: `Pin Peta (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}) - ${
          calc.inRadius ? 'Dalam Radius Sekolah' : 'Di Luar Radius Sekolah'
        }`,
        inRadius: calc.inRadius,
        distanceMeter: calc.distanceMeter,
      });
    });

    mapInstanceRef.current = map;

    // Fit bounds to show both school and user
    const bounds = L.latLngBounds([
      [schoolLat, schoolLng],
      [userLat, userLng],
    ]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });

    // Handle container resize
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
  }, [schoolLat, schoolLng, maxRadiusMeters]);

  // Update user marker position and line when props change
  useEffect(() => {
    if (!userMarkerRef.current || !lineRef.current || !circleRef.current) return;

    userMarkerRef.current.setLatLng([userLat, userLng]);
    lineRef.current.setLatLngs([
      [schoolLat, schoolLng],
      [userLat, userLng],
    ]);

    const markerBorderColor = inRadius ? '#10b981' : '#ef4444';
    lineRef.current.setStyle({
      color: markerBorderColor,
    });

    circleRef.current.setStyle({
      fillColor: inRadius ? '#10b981' : '#6366f1',
    });

    // Update marker icon border
    const userIcon = L.divIcon({
      className: 'live-user-location-icon',
      html: `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid ${markerBorderColor};
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">
          ${
            userAvatar
              ? `<img src="${userAvatar}" style="width:100%;height:100%;object-fit:cover;" />`
              : `<div style="font-size:16px;">${isTeacher ? '👨‍🏫' : '🎓'}</div>`
          }
        </div>
        <div style="
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${markerBorderColor};
          border: 2px solid #ffffff;
          box-shadow: 0 0 6px ${markerBorderColor};
        "></div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    userMarkerRef.current.setIcon(userIcon);
  }, [userLat, userLng, inRadius, distanceMeter, userAvatar, isTeacher, schoolLat, schoolLng]);

  // Use Real Browser Geolocation
  const handleGetLiveBrowserGps = () => {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung deteksi Geolocation GPS.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsAccuracy(Math.round(pos.coords.accuracy || 10));

        const calc = isWithinGeofence(lat, lng, schoolLat, schoolLng, maxRadiusMeters);
        onLocationChange({
          lat,
          lng,
          address: `GPS Asli Browser (${lat.toFixed(5)}, ${lng.toFixed(5)}) - Akurasi ±${Math.round(
            pos.coords.accuracy || 10
          )}m`,
          inRadius: calc.inRadius,
          distanceMeter: calc.distanceMeter,
        });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 18);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        alert(
          'Tidak dapat mengakses GPS browser (izin ditolak atau timeout). Anda dapat memilih titik lokasi preset atau menggeser pin di peta.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Select Preset location
  const handleSelectPreset = (index: number) => {
    setActivePreset(`preset_${index}`);
    const preset = SCHOOL_PRESET_LOCATIONS[index];
    if (!preset) return;

    const lat = schoolLat + preset.latOffset;
    const lng = schoolLng + preset.lngOffset;
    const calc = isWithinGeofence(lat, lng, schoolLat, schoolLng, maxRadiusMeters);

    onLocationChange({
      lat,
      lng,
      address: preset.mockAddress,
      inRadius: calc.inRadius,
      distanceMeter: calc.distanceMeter,
    });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 18, { animate: true });
    }
  };

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex flex-col ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl h-[calc(100vh-2rem)]' : ''
      }`}
      style={{ height: isFullscreen ? 'auto' : height }}
    >
      {/* Top Overlay Badge Bar */}
      <div className="absolute top-2 left-2 right-2 z-[400] flex items-center justify-between pointer-events-none gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/80 shadow-md flex items-center space-x-1.5 pointer-events-auto">
          <MapPin className={`w-3.5 h-3.5 ${inRadius ? 'text-emerald-400' : 'text-rose-400'} shrink-0`} />
          <span className="text-[10.5px] font-extrabold text-white">
            {distanceMeter}m ke Sekolah
          </span>
          <span
            className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md ${
              inRadius
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {inRadius ? '✓ DALAM RADIUS' : '✕ DI LUAR RADIUS'}
          </span>
        </div>

        <div className="flex items-center space-x-1 pointer-events-auto">
          <button
            type="button"
            onClick={handleGetLiveBrowserGps}
            disabled={isLocating}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10.5px] font-bold shadow-md flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
            title="Deteksi Lokasi GPS Asli Perangkat"
          >
            <Crosshair className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Mendeteksi GPS...' : 'GPS Saya'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 shadow-md transition-all cursor-pointer"
            title={isFullscreen ? 'Kecilkan Peta' : 'Perbesar Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map DOM Element */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0" />

      {/* Bottom Preset & Coordinates Bar */}
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-2 z-[400] flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
        {/* Preset Locations Dropdown / Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-full pb-0.5">
          <span className="text-slate-400 font-bold shrink-0">Titik Uji:</span>
          {SCHOOL_PRESET_LOCATIONS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(idx)}
              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activePreset === `preset_${idx}`
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {p.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Live Lat/Lng & Geofence Radius Info */}
        <div className="flex items-center space-x-2 text-slate-400 font-mono text-[9.5px]">
          <span>
            Lat: {userLat.toFixed(5)}, Lng: {userLng.toFixed(5)}
          </span>
          <span className="text-indigo-400 font-sans font-bold">
            (Maks {maxRadiusMeters}m)
          </span>
        </div>
      </div>
    </div>
  );
};
