// Source: Google Maps Platform Code Assist
import React, { useState, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  Layers,
  Maximize2,
  Minimize2,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { AttendanceRecord, SchoolConfig, Teacher } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

interface GoogleMapsAttendanceViewProps {
  records?: AttendanceRecord[];
  config?: SchoolConfig;
  mapId?: string;
  schoolLat?: number;
  schoolLng?: number;
  schoolName?: string;
  geofenceRadius?: number;
  teachers?: Teacher[];
  selectedDate?: string;
  height?: string;
  showControls?: boolean;
  title?: string;
  subtitle?: string;
}

export const GoogleMapsAttendanceView: React.FC<GoogleMapsAttendanceViewProps> = ({
  records = [],
  config,
  mapId: propMapId,
  schoolLat: propSchoolLat,
  schoolLng: propSchoolLng,
  schoolName: propSchoolName,
  geofenceRadius: propGeofenceRadius,
  teachers = [],
  selectedDate,
  height = '440px',
  showControls = true,
  title = 'Peta Google Maps Presensi GTK',
  subtitle = 'Visualisasi berbasis Google Maps Platform dengan penanda presensi dan radius geofence',
}) => {
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedSchoolInfo, setSelectedSchoolInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<'all' | 'masuk' | 'pulang'>('all');
  const [selectedRadiusFilter, setSelectedRadiusFilter] = useState<'all' | 'in_radius' | 'out_radius'>('all');
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || firebaseConfig.apiKey || '';
  const mapId = propMapId || config?.googleMapId || 'DEMO_MAP_ID';

  const schoolLat = propSchoolLat ?? config?.schoolLat ?? -1.8214;
  const schoolLng = propSchoolLng ?? config?.schoolLng ?? 124.7081;
  const schoolName = propSchoolName ?? config?.schoolName ?? 'SMPN 4 Taliabu Barat';
  const schoolNpsn = config?.npsn ?? '69901234';
  const maxRadiusMeters = propGeofenceRadius ?? config?.maxRadiusMeters ?? config?.geofenceRadius ?? 150;

  const validRecords = useMemo(() => {
    return records.filter((r) => {
      const isTeacher = r.personType === 'teacher' || (!r.personType && r.employmentStatus);
      if (!isTeacher) return false;
      if (selectedDate && r.date !== selectedDate) return false;
      if (selectedSessionFilter !== 'all' && r.type !== selectedSessionFilter) return false;
      if (selectedRadiusFilter === 'in_radius' && r.location && !r.location.inRadius) return false;
      if (selectedRadiusFilter === 'out_radius' && r.location && r.location.inRadius) return false;

      const lat = r.location?.lat;
      const lng = r.location?.lng;
      return typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
    });
  }, [records, selectedDate, selectedSessionFilter, selectedRadiusFilter]);

  const totalGeoCount = validRecords.length;
  const insideRadiusCount = validRecords.filter((r) => r.location?.inRadius).length;
  const outsideRadiusCount = totalGeoCount - insideRadiusCount;

  return (
    <div
      className={`rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 shadow-2xl border-2 border-indigo-600 bg-white max-h-[calc(100vh-2rem)]'
          : 'relative'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-sky-50/20 shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm text-slate-900 truncate tracking-tight">{title}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                Google Maps
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Filters and map styles */}
        {showControls && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Map Type Switcher */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMapTypeId('roadmap')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  mapTypeId === 'roadmap' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Peta
              </button>
              <button
                type="button"
                onClick={() => setMapTypeId('hybrid')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  mapTypeId === 'hybrid' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Satelit
              </button>
            </div>

            {/* Session Type Filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('all')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedSessionFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('masuk')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedSessionFilter === 'masuk' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('pulang')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedSessionFilter === 'pulang' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:text-slate-900'
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
              <option value="all">Semua ({totalGeoCount})</option>
              <option value="in_radius">✓ Dalam Radius ({insideRadiusCount})</option>
              <option value="out_radius">⚠️ Luar Radius ({outsideRadiusCount})</option>
            </select>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl cursor-pointer shadow-2xs"
              title={isFullscreen ? 'Kecilkan' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Map View */}
      <div className="relative flex-1 min-h-[320px]" style={{ height: isFullscreen ? 'calc(100vh - 12rem)' : height }}>
        <APIProvider apiKey={apiKey}>
          <Map
            mapId={mapId}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={{ lat: schoolLat, lng: schoolLng }}
            defaultZoom={17}
            mapTypeId={mapTypeId}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
            className="w-full h-full"
          >
            {/* School Marker */}
            <AdvancedMarker
              position={{ lat: schoolLat, lng: schoolLng }}
              onClick={() => setSelectedSchoolInfo(true)}
              title={schoolName}
            >
              <Pin background={'#312e81'} glyphColor={'#ffffff'} borderColor={'#ffffff'} scale={1.2}>
                <span className="text-xs">🏫</span>
              </Pin>
            </AdvancedMarker>

            {/* School Info Window */}
            {selectedSchoolInfo && (
              <InfoWindow
                position={{ lat: schoolLat, lng: schoolLng }}
                onCloseClick={() => setSelectedSchoolInfo(false)}
              >
                <div className="p-1 text-slate-800">
                  <div className="text-[10px] font-extrabold text-indigo-600 uppercase">Titik Pusat Sekolah</div>
                  <div className="font-bold text-xs">{schoolName}</div>
                  <div className="text-[11px] text-slate-500">NPSN: {schoolNpsn}</div>
                  <div className="text-[10px] text-emerald-600 mt-1 font-semibold">Radius Geofence: {maxRadiusMeters}m</div>
                </div>
              </InfoWindow>
            )}

            {/* Teacher Attendance Markers */}
            {validRecords.map((record) => {
              const lat = record.location!.lat;
              const lng = record.location!.lng;
              const inRadius = record.location?.inRadius ?? true;
              const isLate = record.status === 'terlambat';
              const isPulang = record.type === 'pulang';
              const pinColor = !inRadius ? '#f43f5e' : isLate ? '#f59e0b' : isPulang ? '#0284c7' : '#10b981';

              return (
                <AdvancedMarker
                  key={record.id}
                  position={{ lat, lng }}
                  onClick={() => setSelectedRecord(record)}
                  title={`${record.personName} (${record.time})`}
                >
                  <Pin background={pinColor} glyphColor={'#ffffff'} borderColor={'#ffffff'}>
                    <span className="text-[10px] font-bold text-white">
                      {record.type === 'masuk' ? 'IN' : 'OUT'}
                    </span>
                  </Pin>
                </AdvancedMarker>
              );
            })}

            {/* Selected Record InfoWindow */}
            {selectedRecord && selectedRecord.location && (
              <InfoWindow
                position={{ lat: selectedRecord.location.lat, lng: selectedRecord.location.lng }}
                onCloseClick={() => setSelectedRecord(null)}
              >
                <div className="p-1.5 max-w-[240px] text-slate-800">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">
                      {selectedRecord.type === 'masuk' ? 'PRESENSI MASUK' : 'PRESENSI PULANG'}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        selectedRecord.location.inRadius ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedRecord.location.inRadius ? 'DALAM RADIUS' : 'LUAR RADIUS'}
                    </span>
                  </div>
                  <div className="font-extrabold text-xs text-slate-900">{selectedRecord.personName}</div>
                  <div className="text-[10px] text-slate-500">NIP: {selectedRecord.identifier}</div>
                  <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                    <div>🕒 Waktu: {selectedRecord.time} ({selectedRecord.date})</div>
                    <div>📍 Jarak: {selectedRecord.location.distanceMeter || 0} meter</div>
                    <div>🛡️ Status: {selectedRecord.status.toUpperCase()}</div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200 shadow-md text-[11px] space-y-1 max-w-xs">
          <div className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider flex items-center space-x-1.5 pb-1 border-b border-slate-100">
            <Layers className="w-3 h-3 text-indigo-600" />
            <span>Keterangan Titik Google Maps</span>
          </div>
          <div className="flex items-center space-x-2 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-900 border border-white shrink-0" />
            <span className="text-slate-600 font-semibold">Sekolah: {schoolName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white shrink-0" />
            <span className="text-slate-600">Presensi Valid (Radius {maxRadiusMeters}m)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white shrink-0 animate-pulse" />
            <span className="text-slate-600">Presensi Luar Radius Sekolah</span>
          </div>
        </div>

        {validRecords.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-2xl shadow-lg border border-slate-700 flex items-center space-x-2 text-xs">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Belum ada rekaman GPS GTK yang cocok dengan filter saat ini.</span>
          </div>
        )}
      </div>

      {/* Footer Metrics */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Total Terpetakan: <b className="text-slate-900">{totalGeoCount}</b></span>
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
          <span>Google Maps Platform & Biometrik Terintegrasi</span>
        </div>
      </div>
    </div>
  );
};
