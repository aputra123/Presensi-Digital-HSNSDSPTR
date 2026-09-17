/**
 * Geolocation & Geofencing Utilities for School Attendance
 */

// Calculate distance in meters between two lat/lng points using Haversine formula
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Check if a point is within geofence radius
export function isWithinGeofence(
  userLat: number,
  userLng: number,
  schoolLat: number,
  schoolLng: number,
  maxRadiusMeters: number
): { inRadius: boolean; distanceMeter: number } {
  const distance = calculateDistanceMeters(userLat, userLng, schoolLat, schoolLng);
  return {
    inRadius: distance <= maxRadiusMeters,
    distanceMeter: distance,
  };
}

// Preset locations for quick testing / fallback simulations
export interface PresetLocation {
  name: string;
  description: string;
  latOffset: number; // offset in degrees (~0.0001 = ~11 meters)
  lngOffset: number;
  mockAddress: string;
}

export const SCHOOL_PRESET_LOCATIONS: PresetLocation[] = [
  {
    name: 'Lobby & Gedung Utama',
    description: 'Pusat administrasi dan kantor guru (Dalam Radius)',
    latOffset: 0.00005,
    lngOffset: 0.00006,
    mockAddress: 'Lobby Gedung Utama SMPN 4 Taliabu Barat',
  },
  {
    name: 'Gerbang Depan Sekolah',
    description: 'Pos satpam & pintu masuk utama sekolah (Dalam Radius)',
    latOffset: 0.00025,
    lngOffset: 0.00015,
    mockAddress: 'Gerbang Masuk Utama SMPN 4 Taliabu Barat',
  },
  {
    name: 'Ruang Guru & Tata Usaha',
    description: 'Ruang kerja GTK dan administrasi SIMPEG (Dalam Radius)',
    latOffset: -0.00012,
    lngOffset: 0.00018,
    mockAddress: 'Gedung Guru & TU SMPN 4 Taliabu Barat',
  },
  {
    name: 'Lapangan Upacara & Olahraga',
    description: 'Area terbuka kompleks sekolah (Dalam Radius)',
    latOffset: 0.00035,
    lngOffset: -0.0002,
    mockAddress: 'Lapangan Upacara SMPN 4 Taliabu Barat',
  },
  {
    name: 'Luar Area Sekolah (Uji Geofence)',
    description: 'Simulasi lokasi di luar radius geofencing sekolah (>150m)',
    latOffset: 0.0028,
    lngOffset: 0.0025,
    mockAddress: 'Jl. Trans Taliabu Barat (Di Luar Radius Geofence)',
  },
];
