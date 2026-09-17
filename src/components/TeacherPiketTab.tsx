import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Calendar,
  Clock,
  UserCheck,
  UserPlus,
  Plus,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Edit2,
  Trash2,
  Search,
  MapPin,
  X,
} from 'lucide-react';
import { TeacherPiketDuty, Teacher, SchoolConfig, ToastNotification } from '../types';
import { downloadCsv } from '../utils/soundAndDate';

export interface TeamPiketMember {
  teacherId: string;
  specificRole: string;
}

export const DEFAULT_PIKET_ROLES = [
  'Koordinator Guru Piket',
  'Pengawas Gerbang Utama & Lobi',
  'Pengawas Koridor & Ruang Kelas',
  'Petugas Presensi & Penyambutan 5S',
  'Pengawas Ketertiban Lingkungan & Kantin',
];

interface TeacherPiketTabProps {
  piketDuties: TeacherPiketDuty[];
  teachers: Teacher[];
  config: SchoolConfig;
  onAddDuty: (duty: TeacherPiketDuty) => void;
  onUpdateDuty?: (duty: TeacherPiketDuty) => void;
  onDeleteDuty?: (id: string) => void;
  onUpdateDutyStatus: (id: string, status: 'scheduled' | 'active' | 'completed') => void;
  onAddNotification?: (notification: ToastNotification) => void;
}

export const TeacherPiketTab: React.FC<TeacherPiketTabProps> = ({
  piketDuties = [],
  teachers = [],
  config,
  onAddDuty,
  onUpdateDuty,
  onDeleteDuty,
  onUpdateDutyStatus,
  onAddNotification,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingDuty, setEditingDuty] = useState<TeacherPiketDuty | null>(null);

  // Form State for Multiple Teachers (2 - 5 Teachers per shift)
  const [teamMembers, setTeamMembers] = useState<TeamPiketMember[]>([
    { teacherId: teachers[0]?.id || '', specificRole: DEFAULT_PIKET_ROLES[0] },
    { teacherId: teachers[1]?.id || teachers[0]?.id || '', specificRole: DEFAULT_PIKET_ROLES[1] },
  ]);

  // Form State for Single Teacher (Edit Mode)
  const [selectedTeacherId, setSelectedTeacherId] = useState(teachers[0]?.id || '');
  const [editRole, setEditRole] = useState(DEFAULT_PIKET_ROLES[0]);

  // Shared Duty Form State
  const [dutyDay, setDutyDay] = useState('Senin');
  const [shift, setShift] = useState('Pagi (06:30 - 13:00 WITA)');
  const [location, setLocation] = useState('Gerbang Utama & Lobby Gedung Sekolah');
  const [note, setNote] = useState('Memantau ketertiban barisan & presensi kehadiran siswa');
  const [dutyStatus, setDutyStatus] = useState<'scheduled' | 'active' | 'completed'>('scheduled');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState('ALL');

  // Delete Confirmation State
  const [deletingDuty, setDeletingDuty] = useState<TeacherPiketDuty | null>(null);

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const handleOpenAddModal = (defaultDay?: string) => {
    setEditingDuty(null);
    setDutyDay(defaultDay || 'Senin');
    setShift('Pagi (06:30 - 13:00 WITA)');
    setLocation('Gerbang Utama & Lobby Gedung Sekolah');
    setNote('Memantau ketertiban barisan & presensi kehadiran siswa');
    setDutyStatus('scheduled');

    // Initialize with 2 distinct teachers if available (user requirement: 2 - 5 teachers)
    const initial: TeamPiketMember[] = [];
    if (teachers.length >= 2) {
      initial.push(
        { teacherId: teachers[0].id, specificRole: DEFAULT_PIKET_ROLES[0] },
        { teacherId: teachers[1].id, specificRole: DEFAULT_PIKET_ROLES[1] }
      );
    } else if (teachers.length === 1) {
      initial.push({ teacherId: teachers[0].id, specificRole: DEFAULT_PIKET_ROLES[0] });
    }
    setTeamMembers(initial);
    setShowModal(true);
  };

  const handleOpenEditModal = (duty: TeacherPiketDuty) => {
    setEditingDuty(duty);
    setSelectedTeacherId(duty.teacherId || (teachers.find((t) => t.name === duty.teacherName)?.id || teachers[0]?.id || ''));
    setEditRole(duty.role || 'Koordinator Guru Piket');
    setDutyDay(duty.day || duty.dayOfWeek || 'Senin');
    setShift(duty.shift || 'Pagi (06:30 - 13:00 WITA)');
    setLocation(duty.location || duty.role || 'Gerbang Utama & Lobby Gedung Sekolah');
    setNote(duty.notes || duty.note || '');
    setDutyStatus(duty.status || 'scheduled');
    setShowModal(true);
  };

  // Presets: Set exact number of teachers (2, 3, 4, or 5)
  const handleSetPresetCount = (count: number) => {
    const newMembers: TeamPiketMember[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < count; i++) {
      const teacher = teachers.find((t) => !usedIds.has(t.id)) || teachers[i % Math.max(1, teachers.length)];
      if (teacher) {
        usedIds.add(teacher.id);
        newMembers.push({
          teacherId: teacher.id,
          specificRole: DEFAULT_PIKET_ROLES[i] || `Anggota Guru Piket #${i + 1}`,
        });
      }
    }
    setTeamMembers(newMembers);
  };

  const handleAddMemberSlot = () => {
    if (teamMembers.length >= 5) return;
    const usedIds = new Set(teamMembers.map((m) => m.teacherId));
    const availableTeacher = teachers.find((t) => !usedIds.has(t.id)) || teachers[0];
    const nextRole = DEFAULT_PIKET_ROLES[teamMembers.length] || `Anggota Guru Piket #${teamMembers.length + 1}`;
    setTeamMembers((prev) => [
      ...prev,
      { teacherId: availableTeacher?.id || '', specificRole: nextRole },
    ]);
  };

  const handleRemoveMemberSlot = (index: number) => {
    const minSlots = teachers.length >= 2 ? 2 : 1;
    if (teamMembers.length <= minSlots) return;
    setTeamMembers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMemberChange = (index: number, field: 'teacherId' | 'specificRole', value: string) => {
    setTeamMembers((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, [field]: value } : m))
    );
  };

  const memberTeacherIds = teamMembers.map((m) => m.teacherId);
  const duplicateTeacherIds = useMemo(() => {
    const counts: Record<string, number> = {};
    memberTeacherIds.forEach((id) => {
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return Object.keys(counts).filter((id) => counts[id] > 1);
  }, [memberTeacherIds]);

  const hasDuplicates = duplicateTeacherIds.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDuty) {
      const teacher = teachers.find((t) => t.id === selectedTeacherId);
      if (!teacher) {
        alert('Mohon pilih guru yang bertugas!');
        return;
      }

      const updatedDuty: TeacherPiketDuty = {
        ...editingDuty,
        teacherId: teacher.id,
        teacherName: teacher.name,
        nip: teacher.nip,
        day: dutyDay,
        dayOfWeek: dutyDay,
        shift,
        location,
        status: dutyStatus,
        role: editRole,
        note,
        notes: note,
      };

      if (onUpdateDuty) {
        onUpdateDuty(updatedDuty);
      }

      if (onAddNotification) {
        onAddNotification({
          id: `piket_update_${Date.now()}`,
          title: '✓ Jadwal Piket Diperbarui',
          message: `Jadwal piket ${teacher.name} pada hari ${dutyDay} telah berhasil diperbarui.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }
    } else {
      // Add mode: 2 to 5 teachers
      if (teamMembers.length === 0) {
        alert('Mohon pilih minimal satu guru piket!');
        return;
      }

      if (hasDuplicates) {
        alert('Terdapat guru yang dipilih lebih dari satu kali dalam tim piket. Harap pilih guru yang berbeda.');
        return;
      }

      const missingTeacher = teamMembers.some((m) => !m.teacherId);
      if (missingTeacher) {
        alert('Semua slot penugasan harus memilih guru yang valid.');
        return;
      }

      const addedTeacherNames: string[] = [];
      teamMembers.forEach((member, idx) => {
        const teacher = teachers.find((t) => t.id === member.teacherId);
        if (!teacher) return;
        addedTeacherNames.push(teacher.name);

        const newDuty: TeacherPiketDuty = {
          id: `piket_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          teacherId: teacher.id,
          teacherName: teacher.name,
          nip: teacher.nip,
          day: dutyDay,
          dayOfWeek: dutyDay,
          date: new Date().toISOString().split('T')[0],
          shift,
          location,
          status: dutyStatus,
          role: member.specificRole || (idx === 0 ? 'Koordinator Guru Piket' : `Anggota Guru Piket #${idx + 1}`),
          note,
          notes: note,
        };

        onAddDuty(newDuty);
      });

      if (onAddNotification) {
        onAddNotification({
          id: `piket_add_${Date.now()}`,
          title: `✓ Tim Guru Piket Ditugaskan (${teamMembers.length} Guru)`,
          message: `${teamMembers.length} guru (${addedTeacherNames.join(', ')}) telah ditugaskan untuk piket hari ${dutyDay}.`,
          type: 'system',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        });
      }
    }

    setShowModal(false);
    setEditingDuty(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingDuty) return;

    if (onDeleteDuty) {
      onDeleteDuty(deletingDuty.id);
    }

    if (onAddNotification) {
      onAddNotification({
        id: `piket_delete_${Date.now()}`,
        title: '🗑️ Jadwal Piket Dihapus',
        message: `Jadwal piket ${deletingDuty.teacherName} pada hari ${deletingDuty.day || deletingDuty.dayOfWeek} telah dihapus.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }

    setDeletingDuty(null);
  };

  const handleExportCsv = () => {
    const headers = [
      'No',
      'Hari',
      'Nama Guru Piket',
      'NIP',
      'Peran / Pos Tim Piket',
      'Sesi Shift',
      'Pos / Lokasi Pengawasan',
      'Status Tugas',
      'Catatan Tugas',
    ];

    const rows = piketDuties.map((d, idx) => [
      idx + 1,
      `"${d.day || d.dayOfWeek || '-'}"`,
      `"${d.teacherName.replace(/"/g, '""')}"`,
      `"${d.nip || '-'}"`,
      `"${(d.role || 'Guru Piket').replace(/"/g, '""')}"`,
      `"${(d.shift || '-').replace(/"/g, '""')}"`,
      `"${(d.location || '-').replace(/"/g, '""')}"`,
      `"${d.status === 'active' ? 'Bertugas Aktif' : d.status === 'completed' ? 'Selesai' : 'Terjadwal'}"`,
      `"${(d.notes || d.note || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCsv(`Jadwal_Guru_Piket_${config.schoolName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const filteredDuties = useMemo(() => {
    return piketDuties.filter((d) => {
      const matchesSearch =
        d.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.location && d.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.notes && d.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDay =
        selectedDayFilter === 'ALL' || d.day === selectedDayFilter || d.dayOfWeek === selectedDayFilter;
      return matchesSearch && matchesDay;
    });
  }, [piketDuties, searchQuery, selectedDayFilter]);

  // Count metrics
  const activeCount = piketDuties.filter((d) => d.status === 'active').length;
  const scheduledCount = piketDuties.filter((d) => d.status === 'scheduled' || !d.status).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900">
                Jadwal Guru Piket & Pengawasan Presensi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manajemen penugasan tim piket (2-5 guru per hari), edit, dan pantau pengawasan harian {config.schoolName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="export-piket-csv-btn"
            onClick={handleExportCsv}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center space-x-1.5"
            title="Ekspor jadwal piket ke CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>

          <button
            id="add-piket-duty-btn"
            onClick={() => handleOpenAddModal()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center space-x-2 transition-all cursor-pointer hover:shadow-indigo-200"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tugaskan Tim Piket (2-5 Guru)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Penugasan
            </div>
            <div className="text-2xl font-black text-slate-900">{piketDuties.length}</div>
            <div className="text-[10px] text-slate-400">Tersebar dalam 6 hari kerja</div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Sedang Bertugas Aktif
            </div>
            <div className="text-2xl font-black text-emerald-700">{activeCount}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Dalam pengawasan lapangan</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Terjadwal Mendatang
            </div>
            <div className="text-2xl font-black text-amber-700">{scheduledCount}</div>
            <div className="text-[10px] text-amber-600 font-medium">Menunggu jadwal bertugas</div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari guru piket, lokasi pos, catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Day Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedDayFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              selectedDayFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Hari ({piketDuties.length})
          </button>
          {daysOfWeek.map((day) => {
            const count = piketDuties.filter((d) => d.day === day || d.dayOfWeek === day).length;
            return (
              <button
                key={day}
                onClick={() => setSelectedDayFilter(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1 ${
                  selectedDayFilter === day
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{day}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedDayFilter === day ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duty Overview by Day Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {daysOfWeek
          .filter((day) => selectedDayFilter === 'ALL' || selectedDayFilter === day)
          .map((day) => {
            const dutiesOnDay = filteredDuties.filter((d) => d.day === day || d.dayOfWeek === day);

            return (
              <div
                key={day}
                className="p-5 rounded-[2rem] bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3.5 hover:border-indigo-200 transition-all"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                      {day.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-extrabold text-slate-900 block">
                          Hari {day}
                        </span>
                        {dutiesOnDay.length >= 2 && dutiesOnDay.length <= 5 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Tim {dutiesOnDay.length} Guru
                          </span>
                        )}
                        {dutiesOnDay.length === 1 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            1 Guru
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {dutiesOnDay.length} Guru Ditugaskan
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAddModal(day)}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                    title={`Tugaskan tim piket untuk hari ${day}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 min-h-[120px] flex-1">
                  {dutiesOnDay.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 space-y-2">
                      <Calendar className="w-8 h-8 text-slate-200" />
                      <p className="text-xs italic">Belum ada guru piket terjadwal di hari {day}.</p>
                      <button
                        onClick={() => handleOpenAddModal(day)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer flex items-center space-x-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Tugaskan Tim Piket (2-5 Guru)</span>
                      </button>
                    </div>
                  ) : (
                    dutiesOnDay.map((item) => {
                      const teacher = teachers.find((t) => t.id === item.teacherId || t.name === item.teacherName);

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 hover:bg-slate-50 transition-colors group"
                        >
                          {/* Teacher Name & Status Tag */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-extrabold text-slate-900 flex items-center flex-wrap gap-1">
                                <span>{item.teacherName}</span>
                                {item.role && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {item.role}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                NIP: {item.nip || teacher?.nip || '-'}
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                                item.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : item.status === 'completed'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {item.status === 'active'
                                ? 'Bertugas Aktif'
                                : item.status === 'completed'
                                ? 'Selesai'
                                : 'Terjadwal'}
                            </span>
                          </div>

                          {/* Time Shift & Location */}
                          <div className="space-y-1 text-[11px] text-slate-600">
                            <div className="flex items-center space-x-1.5 text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="font-semibold">{item.shift || 'Pagi (06:30 - 13:00 WITA)'}</span>
                            </div>

                            <div className="flex items-center space-x-1.5 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>{item.location || 'Gerbang & Lobby Sekolah'}</span>
                            </div>
                          </div>

                          {/* Notes */}
                          {(item.notes || item.note) && (
                            <div className="text-[10px] text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100">
                              💬 {item.notes || item.note}
                            </div>
                          )}

                          {/* Action Buttons: Edit, Delete, Status Toggle */}
                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
                            {/* Edit & Delete Action Buttons */}
                            <div className="flex items-center space-x-1">
                              <button
                                id={`edit-piket-${item.id}`}
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 rounded-lg bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                                title="Edit Jadwal Guru Piket"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Edit</span>
                              </button>

                              <button
                                id={`delete-piket-${item.id}`}
                                onClick={() => setDeletingDuty(item)}
                                className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                                title="Hapus Jadwal Piket Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Hapus</span>
                              </button>
                            </div>

                            {/* Status Changer Actions */}
                            <div className="flex items-center space-x-1">
                              {item.status === 'scheduled' && (
                                <button
                                  onClick={() => onUpdateDutyStatus(item.id, 'active')}
                                  className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                                >
                                  Mulai Tugas
                                </button>
                              )}
                              {item.status === 'active' && (
                                <button
                                  onClick={() => onUpdateDutyStatus(item.id, 'completed')}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                                >
                                  Selesaikan
                                </button>
                              )}
                              {item.status === 'completed' && (
                                <button
                                  onClick={() => onUpdateDutyStatus(item.id, 'scheduled')}
                                  className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer transition-colors"
                                  title="Kembalikan ke status terjadwal"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Modal Add / Edit Piket Duty */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingDuty ? 'Edit Penugasan Guru Piket' : 'Tugaskan Tim Guru Piket (2 s.d. 5 Guru)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingDuty
                      ? 'Perbarui detail dan catatan tugas guru piket'
                      : 'Tugaskan 2 sampai 5 guru piket sekaligus untuk bertugas dalam tim harian'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingDuty(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Add Mode: Multi-Teacher Selection (2 - 5 Teachers) */}
              {!editingDuty ? (
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-black text-slate-800">
                          Anggota Tim Guru Piket
                        </label>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {teamMembers.length} Guru Terpilih (Kapasitas: 2 - 5 Guru)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Pilih 2 sampai 5 guru yang bertugas bersama dalam jadwal piket hari ini.
                      </p>
                    </div>

                    {/* Quick Preset Buttons (2, 3, 4, 5 Guru) */}
                    <div className="flex items-center space-x-1 shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400 mr-1 hidden sm:inline">
                        Pilihan Cepat:
                      </span>
                      {[2, 3, 4, 5].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => handleSetPresetCount(cnt)}
                          disabled={teachers.length < cnt}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            teamMembers.length === cnt
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          } ${teachers.length < cnt ? 'opacity-40 cursor-not-allowed' : ''}`}
                          title={teachers.length < cnt ? `Membutuhkan minimal ${cnt} guru terdaftar` : `Atur tim ${cnt} guru`}
                        >
                          {cnt} Guru
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate Teacher Warning */}
                  {hasDuplicates && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-800 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Peringatan Guru Ganda:</strong>
                        <p className="text-[11px] mt-0.5">
                          Ada guru yang dipilih lebih dari satu kali dalam tim. Pastikan setiap guru dalam tim piket berbeda.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Member Slots */}
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {teamMembers.map((member, idx) => {
                      const isDup = member.teacherId && duplicateTeacherIds.includes(member.teacherId);
                      return (
                        <div
                          key={`member_slot_${idx}`}
                          className={`p-3 rounded-xl border transition-all ${
                            isDup
                              ? 'bg-rose-50/80 border-rose-300'
                              : 'bg-white border-slate-200/90 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-extrabold text-indigo-700 flex items-center space-x-1.5">
                              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
                                {idx + 1}
                              </span>
                              <span>
                                {idx === 0 ? 'Guru Piket #1 (Koordinator Utama)' : `Guru Piket #${idx + 1} (Anggota)`}
                              </span>
                            </span>

                            {teamMembers.length > (teachers.length >= 2 ? 2 : 1) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberSlot(idx)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-0.5"
                                title="Hapus slot guru ini"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Nama Guru / Pegawai
                              </label>
                              <select
                                value={member.teacherId}
                                onChange={(e) => handleMemberChange(idx, 'teacherId', e.target.value)}
                                className={`w-full text-xs px-2.5 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                                  isDup ? 'border-rose-400 text-rose-900' : 'border-slate-200 text-slate-800'
                                }`}
                                required
                              >
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.nip ? `NIP: ${t.nip}` : 'Non-NIP'}) - {t.subject}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Peran / Fokus Pos Tugas
                              </label>
                              <input
                                type="text"
                                value={member.specificRole}
                                onChange={(e) => handleMemberChange(idx, 'specificRole', e.target.value)}
                                placeholder="Contoh: Pengawas Gerbang & Lobi"
                                className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Slot Button (Up to 5) */}
                  {teamMembers.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddMemberSlot}
                      className="w-full py-2 bg-white hover:bg-indigo-50/70 text-indigo-700 border border-dashed border-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Guru ke Tim Piket ({teamMembers.length}/5 Guru)</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Edit Mode: Single Duty Edit */
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Pilih Guru / Tenaga Pendidik
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                      required
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (NIP: {t.nip || '-'}) - {t.subject}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Peran / Pos Tugas Piket
                    </label>
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      placeholder="Contoh: Koordinator Guru Piket, Pengawas Gerbang"
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Shared Schedule Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Hari Piket
                  </label>
                  <select
                    value={dutyDay}
                    onChange={(e) => setDutyDay(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {daysOfWeek.map((d) => (
                      <option key={d} value={d}>
                        Hari {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Status Penugasan
                  </label>
                  <select
                    value={dutyStatus}
                    onChange={(e) => setDutyStatus(e.target.value as any)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="scheduled">Terjadwal (Akan Datang)</option>
                    <option value="active">Bertugas Aktif (Sedang Berjalan)</option>
                    <option value="completed">Selesai Bertugas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Sesi Waktu (Shift Jam Kerja)
                </label>
                <input
                  type="text"
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  placeholder="Contoh: Pagi (06:30 - 13:00 WITA)"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pos / Lokasi Pengawasan Lapangan
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Gerbang Depan, Koridor Kelas 7 & 8, Kantin"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Catatan / Instruksi Tugas Khusus
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Memeriksa kerapian seragam, menyambut kedatangan siswa, mendata keterlambatan..."
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDuty(null);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!editingDuty && hasDuplicates}
                  className={`px-5 py-2.5 rounded-2xl text-white text-xs font-bold transition-all shadow-xs ${
                    !editingDuty && hasDuplicates
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                  }`}
                >
                  {editingDuty
                    ? 'Simpan Perubahan'
                    : `Simpan Tim Guru Piket (${teamMembers.length} Guru)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDuty && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">
                Hapus Jadwal Guru Piket?
              </h4>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus penugasan piket untuk{' '}
                <strong className="text-slate-800">{deletingDuty.teacherName}</strong> pada hari{' '}
                <strong className="text-slate-800">{deletingDuty.day || deletingDuty.dayOfWeek}</strong>?
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDuty(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
