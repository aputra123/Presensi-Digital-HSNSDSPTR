import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Maximize2,
  Minimize2,
  ShieldCheck,
  CheckCircle2,
  Filter,
  Users,
  Clock,
  Sparkles,
  Flame,
  Search,
  X,
  Activity,
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig, Student, Teacher } from '../types';

interface AttendanceDistributionMapProps {
  records?: AttendanceRecord[];
  config: SchoolConfig;
  students?: Student[];
  teachers?: Teacher[];
  height?: string;
  title?: string;
  subtitle?: string;
  selectedDate?: string;
  compact?: boolean;
}

export const AttendanceDistributionMap: React.FC<AttendanceDistributionMapProps> = ({
  records = [],
  config,
  students = [],
  teachers = [],
  height = '460px',
  title = 'Peta Sebaran Lokasi Presensi Siswa & GTK',
  subtitle = 'Visualisasi koordinat GPS dan validasi radius geofence sekolah secara real-time',
  selectedDate,
  compact = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Filter states
  const [selectedPersonType, setSelectedPersonType] = useState<'all' | 'teacher' | 'student'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'hadir' | 'terlambat' | 'sakit_izin' | 'alpa'>('all');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<'all' | 'masuk' | 'pulang'>('all');
  const [selectedRadiusFilter, setSelectedRadiusFilter] = useState<'all' | 'in_radius' | 'out_radius'>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'early_morning' | 'on_time' | 'late' | 'afternoon'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Layer & Visual effects
  const [mapViewMode, setMapViewMode] = useState<'markers' | 'heatmap' | 'both'>('both');
  const [enablePulseAnimation, setEnablePulseAnimation] = useState(true);
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);

  const schoolLat = config?.schoolLat ?? -1.8214;
  const schoolLng = config?.schoolLng ?? 124.7081;
  const schoolName = config?.schoolName || 'SMPN 4 Taliabu Barat';
  const schoolNpsn = config?.npsn || '69904123';
  const maxRadiusMeters = config?.maxRadiusMeters ?? config?.geofenceRadius ?? 100;

  // Filter records with valid GPS coordinates
  const filteredRecordsWithGps = useMemo(() => {
    return records.filter((r) => {
      // Date match if selectedDate provided
      if (selectedDate && r.date !== selectedDate) return false;

      // Person type filter (Guru vs Siswa)
      if (selectedPersonType !== 'all' && r.personType !== selectedPersonType) return false;

      // Status kehadiran filter (Hadir, Terlambat, Sakit/Izin, Alpa)
      if (selectedStatusFilter === 'hadir' && r.status !== 'hadir') return false;
      if (selectedStatusFilter === 'terlambat' && r.status !== 'terlambat') return false;
      if (selectedStatusFilter === 'sakit_izin' && r.status !== 'sakit' && r.status !== 'izin') return false;
      if (selectedStatusFilter === 'alpa' && r.status !== 'alpa') return false;

      // Session type filter (Masuk vs Pulang)
      if (selectedSessionFilter !== 'all' && r.type !== selectedSessionFilter) return false;

      // Radius filter (Dalam vs Luar Geofence)
      if (selectedRadiusFilter === 'in_radius' && r.location && !r.location.inRadius) return false;
      if (selectedRadiusFilter === 'out_radius' && r.location && r.location.inRadius) return false;

      // Time range filter
      if (selectedTimeRange !== 'all') {
        const timeStr = r.time || '00:00';
        if (selectedTimeRange === 'early_morning' && (timeStr < '06:00' || timeStr >= '07:00')) return false;
        if (selectedTimeRange === 'on_time' && (timeStr < '07:00' || timeStr > (config?.checkInDeadline || '07:30'))) return false;
        if (selectedTimeRange === 'late' && (timeStr <= (config?.checkInDeadline || '07:30') || timeStr > '10:00')) return false;
        if (selectedTimeRange === 'afternoon' && timeStr < '11:30') return false;
      }

      // Search query (Nama, NIP/NISN, Kelas)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = r.personName?.toLowerCase().includes(query);
        const idMatch = r.identifier?.toLowerCase().includes(query);
        const classMatch = r.classOrSubject?.toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !classMatch) return false;
      }

      const lat = r.location?.lat;
      const lng = r.location?.lng;
      return typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
    });
  }, [
    records,
    selectedDate,
    selectedPersonType,
    selectedStatusFilter,
    selectedSessionFilter,
    selectedRadiusFilter,
    selectedTimeRange,
    searchQuery,
    config?.checkInDeadline,
  ]);

  // Statistics from filtered records
  const totalCount = filteredRecordsWithGps.length;
  const teacherCount = filteredRecordsWithGps.filter((r) => r.personType === 'teacher').length;
  const studentCount = filteredRecordsWithGps.filter((r) => r.personType === 'student').length;
  const hadirCount = filteredRecordsWithGps.filter((r) => r.status === 'hadir').length;
  const terlambatCount = filteredRecordsWithGps.filter((r) => r.status === 'terlambat').length;
  const izinSakitCount = filteredRecordsWithGps.filter((r) => r.status === 'sakit' || r.status === 'izin').length;
  const inRadiusCount = filteredRecordsWithGps.filter((r) => r.location?.inRadius).length;
  const outRadiusCount = totalCount - inRadiusCount;

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

    // High resolution Voyager Map Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    const heatmapLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    heatmapLayerRef.current = heatmapLayer;
    markersLayerRef.current = markersLayer;
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
  }, [schoolLat, schoolLng]);

  // Render Markers, Heatmap Gradient, Geofence Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const heatmapLayer = heatmapLayerRef.current;
    if (!map || !markersLayer || !heatmapLayer) return;

    markersLayer.clearLayers();
    heatmapLayer.clearLayers();

    // 1. Draw School Geofence Circle Overlay
    const schoolCircle = L.circle([schoolLat, schoolLng], {
      radius: maxRadiusMeters,
      color: '#4f46e5',
      fillColor: '#6366f1',
      fillOpacity: 0.12,
      weight: 2.5,
      dashArray: '6, 6',
    });

    schoolCircle.bindPopup(`
      <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 200px;">
        <div style="font-weight: 800; font-size: 13px; color: #1e1b4b;">🏫 ${schoolName}</div>
        <div style="font-size: 11px; color: #4338ca; font-weight: 700; margin-top: 2px;">
          Lingkaran Radius Geofence: ${maxRadiusMeters} Meter
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          Batas validasi presensi siswa dan guru SMPN 4 Taliabu Barat
        </div>
      </div>
    `);
    markersLayer.addLayer(schoolCircle);

    // 2. Center School Headquarters Marker
    const schoolIcon = L.divIcon({
      className: 'school-center-marker-node',
      html: `
        <div style="
          position: relative;
          width: 42px;
          height: 42px;
          border-radius: 16px;
          background: linear-gradient(135deg, #312e81, #4f46e5);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 18px rgba(79, 70, 229, 0.45);
          border: 3px solid #ffffff;
          font-size: 18px;
        ">
          🏫
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 20px;
            border: 2px dashed #818cf8;
            pointer-events: none;
          "></div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });

    const schoolMarker = L.marker([schoolLat, schoolLng], { icon: schoolIcon });
    schoolMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 210px;">
        <div style="font-size: 10px; font-weight: 800; color: #4f46e5; text-transform: uppercase;">
          PUSAT KOORDINAT RESMI SEKOLAH
        </div>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-top: 2px;">${schoolName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">NPSN: ${schoolNpsn}</div>
        <div style="font-size: 10px; color: #0284c7; margin-top: 4px; font-family: monospace;">
          Lat: ${schoolLat.toFixed(5)}, Lng: ${schoolLng.toFixed(5)}
        </div>
      </div>
    `);
    markersLayer.addLayer(schoolMarker);

    // 3. Render Heatmap Density Overlay (if enabled)
    if ((mapViewMode === 'heatmap' || mapViewMode === 'both') && filteredRecordsWithGps.length > 0) {
      filteredRecordsWithGps.forEach((rec) => {
        const lat = rec.location!.lat;
        const lng = rec.location!.lng;
        const isTeacher = rec.personType === 'teacher';
        const inRadius = rec.location!.inRadius;

        const heatColor = !inRadius ? '#f43f5e' : isTeacher ? '#a855f7' : '#0ea5e9';

        // Outer glow gradient circle
        const heatCircle = L.circle([lat, lng], {
          radius: 18,
          color: heatColor,
          fillColor: heatColor,
          fillOpacity: 0.22,
          weight: 0,
        });
        heatmapLayer.addLayer(heatCircle);

        // Core hotspot circle
        const coreCircle = L.circle([lat, lng], {
          radius: 8,
          color: heatColor,
          fillColor: heatColor,
          fillOpacity: 0.45,
          weight: 0,
        });
        heatmapLayer.addLayer(coreCircle);
      });
    }

    // 4. Render Markers with Dynamic Pulse Animations
    if ((mapViewMode === 'markers' || mapViewMode === 'both') && filteredRecordsWithGps.length > 0) {
      const bounds = L.latLngBounds([[schoolLat, schoolLng]]);

      filteredRecordsWithGps.forEach((rec) => {
        const lat = rec.location!.lat;
        const lng = rec.location!.lng;
        const inRadius = rec.location!.inRadius;
        const distance = rec.location!.distanceMeter || 0;
        const isTeacher = rec.personType === 'teacher';
        const status = rec.status;

        // Color coding
        let markerBorderColor = inRadius ? '#10b981' : '#ef4444';
        let pulseClass = 'map-marker-pulse-emerald';

        if (!inRadius) {
          markerBorderColor = '#ef4444';
          pulseClass = 'map-marker-pulse-rose';
        } else if (status === 'terlambat') {
          markerBorderColor = '#f59e0b';
          pulseClass = 'map-marker-pulse-amber';
        } else if (status === 'sakit' || status === 'izin') {
          markerBorderColor = '#6366f1';
          pulseClass = 'map-marker-pulse-active';
        } else if (isTeacher) {
          markerBorderColor = '#8b5cf6';
          pulseClass = 'map-marker-pulse-active';
        }

        const teacherObj = teachers.find((t) => t.id === rec.personId || t.nip === rec.identifier);
        const studentObj = students.find((s) => s.id === rec.personId || s.nisn === rec.identifier);
        const avatarUrl = rec.photoUrl || teacherObj?.avatar || studentObj?.avatar;

        const pinIcon = L.divIcon({
          className: 'attendance-location-marker-node',
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              <!-- Dynamic Animated Pulse Ring -->
              ${
                enablePulseAnimation
                  ? `<div class="${pulseClass}" style="
                      position: absolute;
                      inset: -2px;
                      border-radius: 50%;
                      pointer-events: none;
                    "></div>`
                  : ''
              }

              <!-- Main Avatar / Icon Node -->
              <div style="
                position: relative;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #ffffff;
                border: 2.5px solid ${markerBorderColor};
                box-shadow: 0 4px 12px rgba(0,0,0,0.22);
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                cursor: pointer;
                z-index: 2;
              ">
                ${
                  avatarUrl
                    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />`
                    : `<div style="font-size:14px;">${isTeacher ? '👨‍🏫' : '🎓'}</div>`
                }
              </div>

              <!-- Status Dot Badge -->
              <div style="
                position: absolute;
                bottom: 0px;
                right: 0px;
                width: 11px;
                height: 11px;
                border-radius: 50%;
                background: ${inRadius ? '#10b981' : '#ef4444'};
                border: 2px solid #ffffff;
                z-index: 3;
              "></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([lat, lng], { icon: pinIcon });
        marker.on('click', () => setActiveRecord(rec));

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 230px;">
            <div style="display:flex; align-items:center; gap: 8px;">
              ${
                avatarUrl
                  ? `<img src="${avatarUrl}" style="width:38px;height:38px;border-radius:10px;object-fit:cover;" />`
                  : ''
              }
              <div>
                <div style="font-weight:800;font-size:12.5px;color:#0f172a;">${rec.personName}</div>
                <div style="font-size:10px;color:#64748b;">
                  ${rec.identifier ? `${isTeacher ? 'NIP' : 'NISN'}: ${rec.identifier}` : ''} • ${rec.classOrSubject}
                </div>
              </div>
            </div>

            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;">
              <span style="font-weight:800; text-transform: capitalize; color: ${
                status === 'hadir' ? '#059669' : status === 'terlambat' ? '#d97706' : '#dc2626'
              };">
                ● ${status} (${rec.type === 'pulang' ? 'Pulang' : 'Masuk'})
              </span>
              <span style="color:#334155;font-weight:700;font-family:monospace;">${rec.time} WITA</span>
            </div>

            <div style="margin-top:4px;font-size:10px;display:flex;justify-content:space-between;color:${
              inRadius ? '#059669' : '#dc2626'
            };font-weight:700;">
              <span>${inRadius ? '✓ Dalam Radius Sekolah' : '✕ Di Luar Radius Geofence'}</span>
              <span>${distance} Meter</span>
            </div>
          </div>
        `);

        markersLayer.addLayer(marker);
        bounds.extend([lat, lng]);
      });

      // Fit map bounds smoothly
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } else {
      map.setView([schoolLat, schoolLng], 17);
    }
  }, [
    filteredRecordsWithGps,
    schoolLat,
    schoolLng,
    maxRadiusMeters,
    teachers,
    students,
    mapViewMode,
    enablePulseAnimation,
  ]);

  const resetAllFilters = () => {
    setSelectedPersonType('all');
    setSelectedStatusFilter('all');
    setSelectedSessionFilter('all');
    setSelectedRadiusFilter('all');
    setSelectedTimeRange('all');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedPersonType !== 'all' ||
    selectedStatusFilter !== 'all' ||
    selectedSessionFilter !== 'all' ||
    selectedRadiusFilter !== 'all' ||
    selectedTimeRange !== 'all' ||
    searchQuery !== '';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header with Title & Live Filter Controls */}
      <div className="p-4 lg:p-5 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/70">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-sm lg:text-base text-slate-900 tracking-tight">
                  {title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {totalCount} Titik GPS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center space-x-2">
            {/* Layer View Mode Switcher */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs">
              <button
                onClick={() => setMapViewMode('markers')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  mapViewMode === 'markers'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Marker Titik Presensi"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marker</span>
              </button>
              <button
                onClick={() => setMapViewMode('heatmap')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  mapViewMode === 'heatmap'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Heatmap Kepadatan Area"
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Heatmap</span>
              </button>
              <button
                onClick={() => setMapViewMode('both')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  mapViewMode === 'both'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Marker & Heatmap Sekaligus"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keduanya</span>
              </button>
            </div>

            {/* Pulse Animation Toggle */}
            <button
              onClick={() => setEnablePulseAnimation(!enablePulseAnimation)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                enablePulseAnimation
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
              title={enablePulseAnimation ? 'Animasi Pulse Aktif' : 'Animasi Pulse Non-aktif'}
            >
              <Activity className={`w-4 h-4 ${enablePulseAnimation ? 'animate-pulse text-emerald-600' : ''}`} />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Real-time Filter Controls Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-200/60">
          {/* 1. Category Filter: Guru vs Siswa */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>Kategori</span>
            </label>
            <select
              value={selectedPersonType}
              onChange={(e) => setSelectedPersonType(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Semua Personil</option>
              <option value="teacher">👨‍🏫 Guru & GTK ({teacherCount})</option>
              <option value="student">🎓 Siswa ({studentCount})</option>
            </select>
          </div>

          {/* 2. Status Kehadiran Filter: Hadir, Terlambat, Sakit/Izin */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Status Kehadiran</span>
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Semua Status</option>
              <option value="hadir">✓ Hadir ({hadirCount})</option>
              <option value="terlambat">⏳ Terlambat ({terlambatCount})</option>
              <option value="sakit_izin">📝 Sakit & Izin ({izinSakitCount})</option>
              <option value="alpa">✕ Alpa / Nihil</option>
            </select>
          </div>

          {/* 3. Sesi Presensi: Masuk vs Pulang */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Sesi Presensi</span>
            </label>
            <select
              value={selectedSessionFilter}
              onChange={(e) => setSelectedSessionFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Semua Sesi</option>
              <option value="masuk">🌅 Presensi Masuk</option>
              <option value="pulang">🌇 Presensi Pulang</option>
            </select>
          </div>

          {/* 4. Radius Geofence */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Radius Geofence</span>
            </label>
            <select
              value={selectedRadiusFilter}
              onChange={(e) => setSelectedRadiusFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Semua Lokasi</option>
              <option value="in_radius">✓ Dalam Area ({inRadiusCount})</option>
              <option value="out_radius">✕ Luar Area ({outRadiusCount})</option>
            </select>
          </div>

          {/* 5. Rentang Jam Presensi */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Rentang Jam</span>
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Semua Jam</option>
              <option value="early_morning">06:00 - 07:00 Pagi</option>
              <option value="on_time">07:00 - 07:30 Tepat Waktu</option>
              <option value="late">07:30 - 10:00 Terlambat</option>
              <option value="afternoon">11:30 - 16:00 Siang/Sore</option>
            </select>
          </div>

          {/* 6. Search Input & Reset Button */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span>Pencarian Nama/ID</span>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="text-indigo-600 hover:text-indigo-800 font-extrabold underline lowercase text-[9.5px] cursor-pointer"
                >
                  reset
                </button>
              )}
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari personil..."
                className="w-full pl-7 pr-6 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map Body & Stats Overlay */}
      <div
        className={`relative ${
          isFullscreen ? 'fixed inset-4 z-50 shadow-2xl h-[calc(100vh-2rem)] rounded-3xl overflow-hidden' : ''
        }`}
        style={{ height: isFullscreen ? 'auto' : height }}
      >
        {/* Top Floating Geofence & Filter Pill Overlay */}
        <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-md text-white text-xs flex items-center space-x-2 pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
            <span className="font-extrabold">Geofence: {maxRadiusMeters}m</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">{inRadiusCount} Valid</span>
            {outRadiusCount > 0 && (
              <span className="text-rose-400 font-bold">({outRadiusCount} Luar Area)</span>
            )}
          </div>

          {hasActiveFilters && (
            <div className="bg-indigo-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-indigo-700/80 shadow-md text-indigo-200 text-xs flex items-center space-x-1.5 pointer-events-auto">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold">{totalCount} data terfilter</span>
            </div>
          )}
        </div>

        {/* Empty State Banner if 0 records match */}
        {filteredRecordsWithGps.length === 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-[400] pointer-events-none flex justify-center">
            <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-lg text-center pointer-events-auto max-w-md">
              <p className="text-xs font-bold text-slate-800">
                Tidak ada titik GPS presensi yang sesuai kriteria filter saat ini
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pusat koordinat dan radius geofence {maxRadiusMeters}m {schoolName} siap memvalidasi presensi.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selected Record Detail Card (Floating Bottom Right) */}
        {activeRecord && (
          <div className="absolute bottom-4 right-4 z-[400] max-w-xs bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                Detail Presensi GPS
              </span>
              <button
                onClick={() => setActiveRecord(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center space-x-2.5">
              {activeRecord.photoUrl ? (
                <img
                  src={activeRecord.photoUrl}
                  alt={activeRecord.personName}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                  {activeRecord.personType === 'teacher' ? '👨‍🏫' : '🎓'}
                </div>
              )}
              <div>
                <h4 className="font-bold text-xs text-slate-900">{activeRecord.personName}</h4>
                <p className="text-[10.5px] text-slate-500">
                  {activeRecord.classOrSubject} • {activeRecord.time} WITA
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10.5px]">
              <div>
                <span className="text-slate-400 block text-[9.5px]">Status:</span>
                <span className="font-bold text-slate-800 capitalize">{activeRecord.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9.5px]">Jarak ke Sekolah:</span>
                <span className={`font-bold ${activeRecord.location?.inRadius ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {activeRecord.location?.distanceMeter ?? 0}m ({activeRecord.location?.inRadius ? 'Valid' : 'Luar Radius'})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Leaflet Map Target Element */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>

      {/* Quick Summary Footer Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-600 border border-white shadow-2xs" />
            <span className="font-semibold text-slate-700">Pusat Sekolah</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 border border-white shadow-2xs" />
            <span className="font-semibold text-slate-700">GTK ({teacherCount})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-500 border border-white shadow-2xs" />
            <span className="font-semibold text-slate-700">Siswa ({studentCount})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-600">Hadir ({hadirCount})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="font-medium text-slate-600">Terlambat ({terlambatCount})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-medium text-slate-600">Luar Area ({outRadiusCount})</span>
          </div>
        </div>

        <div className="font-mono text-[11px] text-slate-500">
          Koordinat: {schoolLat.toFixed(5)}, {schoolLng.toFixed(5)} ({maxRadiusMeters}m)
        </div>
      </div>
    </div>
  );
};
