import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Compass,
  Layers,
  Maximize2,
  Minimize2,
  UserCheck,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Crosshair,
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig, Teacher } from '../types';
import { GoogleMapsAttendanceView } from './GoogleMapsAttendanceView';

interface TeacherAttendanceMapProps {
  records?: AttendanceRecord[];
  config?: SchoolConfig;
  schoolLat?: number;
  schoolLng?: number;
  schoolName?: string;
  geofenceRadius?: number;
  teachers?: Teacher[];
  selectedDate?: string;
  height?: string;
  interactive?: boolean;
  showControls?: boolean;
  compactMode?: boolean;
  title?: string;
  subtitle?: string;
}

export const TeacherAttendanceMap: React.FC<TeacherAttendanceMapProps> = ({
  records = [],
  config,
  schoolLat: propSchoolLat,
  schoolLng: propSchoolLng,
  schoolName: propSchoolName,
  geofenceRadius: propGeofenceRadius,
  teachers = [],
  selectedDate,
  height = '420px',
  interactive = true,
  showControls = true,
  compactMode = false,
  title = 'Peta Sebaran Lokasi Presensi GTK',
  subtitle = 'Visualisasi koordinat GPS dan kepatuhan radius sekolah secara real-time',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<'all' | 'masuk' | 'pulang'>('all');
  const [selectedRadiusFilter, setSelectedRadiusFilter] = useState<'all' | 'in_radius' | 'out_radius'>('all');
  const [selectedTeacherId] = useState<string>('all');
  const [mapEngine, setMapEngine] = useState<'leaflet' | 'google'>('google');

  // School coordinates fallback (e.g. Pulau Taliabu default if missing)
  const schoolLat = propSchoolLat ?? config?.schoolLat ?? -1.8214;
  const schoolLng = propSchoolLng ?? config?.schoolLng ?? 124.7081;
  const schoolName = propSchoolName ?? config?.schoolName ?? 'SMPN 4 Taliabu Barat';
  const schoolNpsn = config?.npsn ?? '69901234';
  const maxRadiusMeters = propGeofenceRadius ?? config?.maxRadiusMeters ?? config?.geofenceRadius ?? 150;

  // Filter valid records for teachers with GPS location
  const teacherRecordsWithLocation = useMemo(() => {
    return records.filter((r) => {
      // Must be teacher or have location
      const isTeacher = r.personType === 'teacher' || (!r.personType && r.employmentStatus);
      if (!isTeacher) return false;

      // Date match if selectedDate provided
      if (selectedDate && r.date !== selectedDate) return false;

      // Session type filter
      if (selectedSessionFilter !== 'all' && r.type !== selectedSessionFilter) return false;

      // Teacher filter
      if (selectedTeacherId !== 'all' && r.personId !== selectedTeacherId && r.identifier !== selectedTeacherId) {
        return false;
      }

      // Radius filter
      if (selectedRadiusFilter === 'in_radius' && r.location && !r.location.inRadius) return false;
      if (selectedRadiusFilter === 'out_radius' && r.location && r.location.inRadius) return false;

      // Has coordinates
      const lat = r.location?.lat;
      const lng = r.location?.lng;
      return typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
    });
  }, [records, selectedDate, selectedSessionFilter, selectedRadiusFilter, selectedTeacherId]);

  // Count stats
  const totalGeoCount = teacherRecordsWithLocation.length;
  const insideRadiusCount = teacherRecordsWithLocation.filter((r) => r.location?.inRadius).length;
  const outsideRadiusCount = totalGeoCount - insideRadiusCount;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if any
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

    // Add Tile Layer (OpenStreetMap with high-resolution styling)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Create markers layer
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Invalidate size on resize
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
  }, [schoolLat, schoolLng]);

  // Update Markers & Geofence Radius
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Draw School Geofence Circle
    const schoolCircle = L.circle([schoolLat, schoolLng], {
      radius: maxRadiusMeters,
      color: '#4f46e5',
      fillColor: '#6366f1',
      fillOpacity: 0.16,
      weight: 2.5,
      dashArray: '5, 5',
    });

    schoolCircle.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
        <div style="font-weight: 800; font-size: 13px; color: #1e1b4b;">${schoolName}</div>
        <div style="font-size: 11px; color: #4338ca; font-weight: 600; margin-top: 2px;">Radius Geofence: ${maxRadiusMeters} Meter</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Pusat Validasi Presensi Resmi BKD & SIMPEG</div>
      </div>
    `);
    markersLayer.addLayer(schoolCircle);

    // 2. School Center Pin Marker
    const schoolIcon = L.divIcon({
      className: 'custom-school-marker',
      html: `
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: linear-gradient(135deg, #312e81, #4f46e5);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45);
          border: 2.5px solid #ffffff;
          cursor: pointer;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"></path>
            <path d="M18 10h4l-2-6H4L2 10h4"></path>
            <path d="M6 22V10h12v12"></path>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const schoolMarker = L.marker([schoolLat, schoolLng], { icon: schoolIcon });
    schoolMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 6px; min-width: 200px;">
        <div style="font-size: 10px; font-weight: 800; color: #4f46e5; text-transform: uppercase;">TITIK PUSAT SEKOLAH</div>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-top: 2px;">${schoolName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">NPSN: ${schoolNpsn}</div>
        <div style="font-size: 10px; color: #0284c7; margin-top: 4px; font-family: monospace;">Lat: ${schoolLat.toFixed(5)}, Lng: ${schoolLng.toFixed(5)}</div>
      </div>
    `);
    markersLayer.addLayer(schoolMarker);

    // 3. Add Teacher Attendance Markers
    const bounds = L.latLngBounds([[schoolLat, schoolLng]]);

    teacherRecordsWithLocation.forEach((record) => {
      const lat = record.location!.lat;
      const lng = record.location!.lng;
      const inRadius = record.location!.inRadius;
      const distance = record.location!.distanceMeter || 0;

      // Color scheme based on status and radius
      const isLate = record.status === 'terlambat';
      const isPulang = record.type === 'pulang';
      const markerColor = !inRadius ? '#f43f5e' : isLate ? '#f59e0b' : isPulang ? '#0ea5e9' : '#10b981';
      const borderPulse = !inRadius ? 'animation: pulse 1.5s infinite;' : '';

      // Teacher avatar or initial
      const photo = record.photoUrl;
      const teacherObj = teachers.find((t) => t.id === record.personId || t.nip === record.identifier);
      const avatarUrl = photo || teacherObj?.avatar;

      const teacherIcon = L.divIcon({
        className: 'custom-teacher-marker',
        html: `
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #ffffff;
            border: 2.5px solid ${markerColor};
            box-shadow: 0 4px 10px rgba(0,0,0,0.22);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            cursor: pointer;
            ${borderPulse}
          ">
            ${
              avatarUrl
                ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="GTK" />`
                : `<div style="font-size: 11px; font-weight: 800; color: ${markerColor};">${record.personName.slice(0, 2).toUpperCase()}</div>`
            }
            <div style="
              position: absolute;
              bottom: 0px;
              right: 0px;
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${markerColor};
              border: 1.5px solid white;
            "></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([lat, lng], { icon: teacherIcon });

      const statusBadge = inRadius
        ? `<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 700;">✓ VALID (${distance}m)</span>`
        : `<span style="background: #ffe4e6; color: #9f1239; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 700;">⚠️ LUAR RADIUS (${distance}m)</span>`;

      const sessionBadge = record.type === 'masuk'
        ? `<span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 700;">PRESENSI MASUK</span>`
        : `<span style="background: #e0f2fe; color: #075985; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 700;">PRESENSI PULANG</span>`;

      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 6px; min-width: 220px; max-width: 260px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 4px;">
            ${sessionBadge}
            ${statusBadge}
          </div>
          <div style="font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.3;">${record.personName}</div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 1px;">NIP: ${record.identifier} • ${record.employmentStatus || 'ASN/GTK'}</div>
          
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #334155;">
            <div>🕒 <b>Waktu:</b> ${record.time} WITA (${record.date})</div>
            <div>📍 <b>Koordinat:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
            <div>🏢 <b>Status Presensi:</b> ${record.status.toUpperCase()}</div>
            <div style="margin-top: 4px; font-size: 9px; color: #059669; font-weight: 600;">🔒 Tervalidasi Geofence & Biometrik WebAuthn</div>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setActiveRecord(record);
      });

      markersLayer.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    // Auto-fit if we have records
    if (teacherRecordsWithLocation.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    } else {
      map.setView([schoolLat, schoolLng], 17);
    }
  }, [teacherRecordsWithLocation, schoolLat, schoolLng, maxRadiusMeters, config, teachers]);

  const handleCenterSchool = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([schoolLat, schoolLng], 17, { animate: true });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  if (mapEngine === 'google') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setMapEngine('leaflet')}
              className="px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer text-slate-600 hover:text-slate-900"
            >
              OSM Map
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('google')}
              className="px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer bg-indigo-600 text-white shadow-2xs"
            >
              Google Maps
            </button>
          </div>
        </div>
        <GoogleMapsAttendanceView
          records={records}
          config={config}
          mapId={config?.googleMapId}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
          schoolName={schoolName}
          geofenceRadius={maxRadiusMeters}
          teachers={teachers}
          selectedDate={selectedDate}
          height={height}
          showControls={showControls}
          title={title}
          subtitle={subtitle}
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl bg-white border border-slate-200/90 shadow-xs overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 shadow-2xl border-2 border-indigo-600 bg-white max-h-[calc(100vh-2rem)]'
          : 'relative'
      }`}
    >
      {/* Header & Filter Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-slate-900 truncate tracking-tight">{title}</h3>
            <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Quick Filter Controls */}
        {showControls && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Map Engine Switcher */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMapEngine('leaflet')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  (mapEngine as string) === 'leaflet' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                OSM Map
              </button>
              <button
                type="button"
                onClick={() => setMapEngine('google')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  (mapEngine as string) === 'google' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Google Maps
              </button>
            </div>

            {/* Session Type Filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedSessionFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('masuk')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedSessionFilter === 'masuk'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('pulang')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedSessionFilter === 'pulang'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pulang
              </button>
            </div>

            {/* Radius Filter */}
            <select
              value={selectedRadiusFilter}
              onChange={(e) => setSelectedRadiusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Radius ({totalGeoCount})</option>
              <option value="in_radius">✓ Dalam Radius ({insideRadiusCount})</option>
              <option value="out_radius">⚠️ Luar Radius ({outsideRadiusCount})</option>
            </select>

            {/* Center to School Button */}
            <button
              type="button"
              onClick={handleCenterSchool}
              className="p-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl cursor-pointer shadow-2xs transition-transform active:scale-95"
              title="Pusatkan Peta ke Titik Sekolah"
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl cursor-pointer shadow-2xs transition-transform active:scale-95"
              title={isFullscreen ? 'Kecilkan Peta' : 'Layar Penuh Peta'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Map Body & Live Overlay */}
      <div className="relative flex-1 min-h-[300px]" style={{ height: isFullscreen ? 'calc(100vh - 12rem)' : height }}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Map Legend Overlay (Floating at Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200/90 shadow-md text-[11px] space-y-1 max-w-xs pointer-events-auto">
          <div className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider flex items-center space-x-1.5 pb-1 border-b border-slate-100">
            <Layers className="w-3 h-3 text-indigo-600" />
            <span>Keterangan Titik Peta</span>
          </div>
          <div className="flex items-center space-x-2 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-700 border border-white shrink-0" />
            <span className="text-slate-600 font-semibold">Pusat Sekolah & Radius ({maxRadiusMeters}m)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white shrink-0" />
            <span className="text-slate-600">Presensi GTK Valid (Dalam Radius)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white shrink-0 animate-pulse" />
            <span className="text-slate-600">Presensi GTK Luar Radius (&gt;{maxRadiusMeters}m)</span>
          </div>
        </div>

        {/* Zoom Controls Overlay (Floating at Bottom Right) */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col space-y-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 bg-white/95 hover:bg-slate-100 text-slate-700 font-bold rounded-xl shadow-md flex items-center justify-center cursor-pointer border border-slate-200 transition-transform active:scale-95"
            title="Perbesar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 bg-white/95 hover:bg-slate-100 text-slate-700 font-bold rounded-xl shadow-md flex items-center justify-center cursor-pointer border border-slate-200 transition-transform active:scale-95"
            title="Perkecil"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Empty State Banner if no records */}
        {teacherRecordsWithLocation.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-2xl shadow-lg border border-slate-700 flex items-center space-x-2 text-xs">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Belum ada rekaman GPS GTK yang cocok dengan filter saat ini.</span>
          </div>
        )}
      </div>

      {/* Footer Metrics Row */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Total GTK Terpetakan: <b className="text-slate-900">{totalGeoCount}</b></span>
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Dalam Radius: <b className="text-emerald-800">{insideRadiusCount}</b></span>
          </div>
          {outsideRadiusCount > 0 && (
            <div className="flex items-center space-x-1.5 text-rose-700 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Luar Radius: <b className="text-rose-800">{outsideRadiusCount}</b></span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Validasi Koordinat GPS Presensi Mandiri GTK</span>
        </div>
      </div>
    </div>
  );
};
