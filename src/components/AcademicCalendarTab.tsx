import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  X,
  Calendar,
} from 'lucide-react';
import { AcademicEvent, SchoolConfig } from '../types';

interface AcademicCalendarTabProps {
  events?: AcademicEvent[];
  onAddEvent: (event: AcademicEvent) => void;
  config: SchoolConfig;
}

export const AcademicCalendarTab: React.FC<AcademicCalendarTabProps> = ({
  events = [],
  onAddEvent,
  config,
}) => {
  const safeEvents = events || [];
  // Calendar month state (defaults to current date or August 2026)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 1)); // August 2026
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'holidays' | 'academic' | 'exams'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Event Form State
  const [newEvent, setNewEvent] = useState<Partial<AcademicEvent>>({
    title: '',
    date: '2026-08-17',
    type: 'holiday',
    description: '',
    isHoliday: true,
    color: 'rose',
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate Month Days Grid
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Filter Events
  const filteredEvents = safeEvents.filter((e) => {
    if (selectedFilter === 'holidays') return e.isHoliday;
    if (selectedFilter === 'academic') return e.type === 'academic' || e.type === 'ceremony';
    if (selectedFilter === 'exams') return e.type === 'exam';
    return true;
  });

  // Events in current visible month
  const currentMonthEvents = filteredEvents.filter((e) => {
    const [eYear, eMonth] = e.date.split('-').map(Number);
    return eYear === year && eMonth - 1 === month;
  });

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) {
      alert('Judul kegiatan dan tanggal wajib diisi!');
      return;
    }

    const eventToSave: AcademicEvent = {
      id: `evt_${Date.now()}`,
      title: newEvent.title || '',
      date: newEvent.date || '2026-08-01',
      endDate: newEvent.endDate || undefined,
      type: newEvent.type || 'academic',
      description: newEvent.description || '',
      isHoliday: !!newEvent.isHoliday,
      color: newEvent.isHoliday ? 'rose' : newEvent.type === 'exam' ? 'amber' : 'indigo',
    };

    onAddEvent(eventToSave);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 lg:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Kalender Pendidikan & Hari Libur Nasional
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tahun Ajaran {config.academicYear} • Jadwal kegiatan akademik, ujian, & hari libur
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda / Hari Libur</span>
          </button>
        </div>
      </div>

      {/* Main Calendar & Events Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Month Calendar (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 lg:p-6 shadow-xs space-y-4">
          {/* Month Header Nav */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {monthNames[month]} {year}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
                {currentMonthEvents.length} Agenda
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(2026, 7, 1))}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Bulan Ini
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-xs text-slate-400 py-1">
            <div className="text-rose-600">Min</div>
            <div>Sen</div>
            <div>Sel</div>
            <div>Rab</div>
            <div>Kam</div>
            <div>Jum</div>
            <div>Sab</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {/* Empty Offset Days */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="h-20 p-1 bg-slate-50/40 rounded-2xl opacity-40"
              />
            ))}

            {/* Actual Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNumber = idx + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                dayNumber
              ).padStart(2, '0')}`;
              const dayOfWeek = (firstDayIndex + idx) % 7;
              const isSunday = dayOfWeek === 0;

              const dayEvents = events.filter((e) => {
                if (e.date === dateKey) return true;
                if (e.endDate && e.date <= dateKey && e.endDate >= dateKey) return true;
                return false;
              });

              const hasHoliday = isSunday || dayEvents.some((e) => e.isHoliday);

              return (
                <div
                  key={`day-${dayNumber}`}
                  className={`h-20 p-1.5 rounded-2xl border transition-all flex flex-col justify-between ${
                    hasHoliday
                      ? 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50'
                      : dayEvents.length > 0
                      ? 'bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50'
                      : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold text-xs font-mono ${
                        hasHoliday ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                    )}
                  </div>

                  {/* Day Events Indicator */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 1).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[9px] font-bold px-1 py-0.5 rounded truncate leading-tight ${
                          ev.isHoliday
                            ? 'bg-rose-500 text-white'
                            : ev.type === 'exam'
                            ? 'bg-amber-500 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 1 && (
                      <span className="text-[8px] font-bold text-slate-400 block truncate">
                        +{dayEvents.length - 1} lainnya
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-md bg-rose-500 shrink-0" />
              <span>Hari Libur Nasional & Keagamaan</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
              <span>Jadwal Ujian (PTS/PAS/PAT/ANBK)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-600 shrink-0" />
              <span>Kegiatan Akademik & Sekolah</span>
            </div>
          </div>
        </div>

        {/* Right Column: Events Feed & Filter (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 lg:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Filter Buttons */}
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Daftar Kegiatan & Tanggal Merah</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Agenda
              </button>
              <button
                onClick={() => setSelectedFilter('holidays')}
                className={`py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedFilter === 'holidays'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tanggal Merah
              </button>
            </div>

            {/* List of Events */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {currentMonthEvents.map((evt) => (
                <div
                  key={evt.id}
                  className={`p-3.5 rounded-2xl border transition-all space-y-1.5 ${
                    evt.isHoliday
                      ? 'bg-rose-50/50 border-rose-200'
                      : evt.type === 'exam'
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-indigo-50/50 border-indigo-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase ${
                          evt.isHoliday
                            ? 'bg-rose-600 text-white'
                            : evt.type === 'exam'
                            ? 'bg-amber-600 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {evt.isHoliday ? 'LIBUR NASIONAL' : evt.type.toUpperCase()}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono font-bold text-slate-700">
                      {evt.date} {evt.endDate ? `s/d ${evt.endDate}` : ''}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900">{evt.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>
                </div>
              ))}

              {currentMonthEvents.length === 0 && (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">
                    Tidak ada agenda di bulan {monthNames[month]} {year}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-400">
            Pusat Kurikulum & Pembelajaran Kemdikbudristek RI
          </div>
        </div>
      </div>

      {/* Modal Add Event */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                <span>Tambah Agenda Kalender Pendidikan</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Agenda / Hari Libur *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rapat Kerja Dewan Guru Awal Semester"
                  value={newEvent.title || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={newEvent.date || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tanggal Selesai (Opsional)</label>
                  <input
                    type="date"
                    value={newEvent.endDate || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kategori Agenda *</label>
                  <select
                    value={newEvent.type || 'academic'}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, type: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="academic">Akademik & Pembelajaran</option>
                    <option value="exam">Ujian (PTS/PAS/PAT/US)</option>
                    <option value="holiday">Hari Libur / Cuti</option>
                    <option value="meeting">Rapat Dewan Guru</option>
                    <option value="ceremony">Upacara / Peringatan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Status Tanggal Merah</label>
                  <select
                    value={newEvent.isHoliday ? 'true' : 'false'}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, isHoliday: e.target.value === 'true' })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="false">Tidak (Hari Belajar Efektif)</option>
                    <option value="true">Ya (Libur / Tanggal Merah)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Deskripsi / Keterangan</label>
                <textarea
                  rows={3}
                  placeholder="Keterangan teknis pelaksanaan kegiatan..."
                  value={newEvent.description || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
