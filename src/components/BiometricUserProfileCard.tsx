import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Camera,
  Fingerprint,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { BiometricLog } from '../types';

interface BiometricUserProfileCardProps {
  personId?: string;
  personName: string;
  personType?: 'student' | 'teacher';
  allLogs: BiometricLog[];
  onSelectUserFilter?: (userNameOrId: string) => void;
  children?: React.ReactNode;
}

export const BiometricUserProfileCard: React.FC<BiometricUserProfileCardProps> = ({
  personId,
  personName,
  personType = 'student',
  allLogs,
  onSelectUserFilter,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<any>(null);

  // Filter logs for this specific person
  const userLogs = useMemo(() => {
    return allLogs.filter((l) => {
      if (personId && l.personId && l.personId === personId) return true;
      return l.personName.trim().toLowerCase() === personName.trim().toLowerCase();
    });
  }, [allLogs, personId, personName]);

  // Aggregate user statistics
  const userStats = useMemo(() => {
    const total = userLogs.length;
    const successCount = userLogs.filter((l) => l.status === 'success').length;
    const failCount = userLogs.filter((l) => l.status === 'failed' || l.severity === 'error').length;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = userLogs.filter((l) => (l.date || l.timestamp?.split(' ')[0]) === todayStr);
    const todaySuccess = todayLogs.filter((l) => l.status === 'success').length;
    const todayFail = todayLogs.filter((l) => l.status === 'failed' || l.severity === 'error').length;

    const avgAccuracy =
      total > 0
        ? (userLogs.reduce((acc, curr) => acc + (curr.matchScore || 0), 0) / total).toFixed(1)
        : '0.0';

    // Last 5 recent attempts sorted descending by timestamp
    const sortedRecent = [...userLogs]
      .sort((a, b) => {
        const parseTime = (item: BiometricLog) => {
          const d = item.date || item.timestamp?.split(' ')[0] || '1970-01-01';
          const t = item.time || item.timestamp?.split(' ')[1] || '00:00:00';
          return new Date(`${d}T${t}`).getTime();
        };
        return parseTime(b) - parseTime(a);
      })
      .slice(0, 5);

    return {
      total,
      successCount,
      failCount,
      successRate,
      todayCount: todayLogs.length,
      todaySuccess,
      todayFail,
      avgAccuracy,
      sortedRecent,
    };
  }, [userLogs]);

  // Hover handlers with debounce
  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const initials = personName
    ? personName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'US';

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="cursor-pointer group flex items-center space-x-1.5"
      >
        {children ? (
          children
        ) : (
          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors underline decoration-dotted decoration-slate-300 group-hover:decoration-indigo-500 underline-offset-4">
            {personName}
          </span>
        )}
      </div>

      {/* Quick User Profile Popover Card */}
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-2 z-50 w-84 sm:w-96 p-4 bg-white rounded-3xl shadow-2xl border border-slate-200/90 text-slate-800 animate-in fade-in zoom-in-95 duration-150 space-y-3.5"
          style={{ transform: 'translateX(0%)' }}
        >
          {/* Header with Avatar & Details */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-md ${
                  personType === 'student'
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    : 'bg-gradient-to-br from-purple-600 to-indigo-700'
                }`}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h4 className="font-black text-sm text-slate-900 leading-tight">{personName}</h4>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono mt-0.5">
                  <span>ID: {personId || '-'}</span>
                  <span>•</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                      personType === 'student' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {personType === 'student' ? 'Siswa' : 'Guru/GTK'}
                  </span>
                </div>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                userStats.successRate >= 90
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : userStats.successRate >= 70
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {userStats.successRate}% Lolos
            </span>
          </div>

          {/* Quick Stats Grid: Total, Success vs Failed, Avg Accuracy */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">Total Sesi</span>
              <span className="text-base font-black text-slate-900">{userStats.total}</span>
              <span className="text-[9px] text-slate-500 block">({userStats.todayCount} Hari Ini)</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-[9px] font-bold uppercase text-emerald-700 block">Lolos Sukses</span>
              <span className="text-base font-black text-emerald-700">{userStats.successCount}</span>
              <span className="text-[9px] text-emerald-600 block">({userStats.todaySuccess} Hari Ini)</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100">
              <span className="text-[9px] font-bold uppercase text-rose-700 block">Ditolak / Gagal</span>
              <span className="text-base font-black text-rose-700">{userStats.failCount}</span>
              <span className="text-[9px] text-rose-600 block">({userStats.todayFail} Hari Ini)</span>
            </div>
          </div>

          {/* Progress Bar of Verification Ratio */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-600">
              <span>Rasio Keandalan Biometrik</span>
              <span className="font-mono text-indigo-600">Rata-rata Akurasi {userStats.avgAccuracy}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${userStats.successRate}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{ width: `${100 - userStats.successRate}%` }}
              />
            </div>
          </div>

          {/* Recent 5 Authentication Attempts List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Riwayat 5 Percobaan Terakhir</span>
              <span>Status & Akurasi</span>
            </div>

            {userStats.sortedRecent.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-2">Belum ada riwayat sesi tercatat</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1 divide-y divide-slate-100">
                {userStats.sortedRecent.map((item) => {
                  const isItemSuccess = item.status === 'success';
                  return (
                    <div
                      key={item.id}
                      className="pt-1.5 first:pt-0 flex items-center justify-between text-xs py-1"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="shrink-0">
                          {item.method === 'face_scan' ? (
                            <Camera className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                          )}
                        </div>
                        <div className="text-[11px] leading-tight">
                          <div className="font-semibold text-slate-800">
                            {item.time || item.timestamp?.split(' ')[1] || '-'} WITA
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {item.date || item.timestamp?.split(' ')[0] || ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[10px] font-bold text-slate-600">
                          {item.matchScore}%
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase inline-flex items-center space-x-0.5 ${
                            isItemSuccess
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isItemSuccess ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Lolos</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-2.5 h-2.5" />
                              <span>Gagal</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Button: Filter specifically for this user */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectUserFilter(personName);
              setIsOpen(false);
            }}
            className="w-full py-2 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs border border-indigo-100"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Semua Log untuk {personName.split(' ')[0]}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
