import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { SchoolClass, Student } from '../types';

interface StudentAcademicDistributionChartProps {
  students?: Student[];
  classes?: SchoolClass[];
  selectedGradeFilter: string;
  onSelectGradeFilter: (grade: string) => void;
}

export const StudentAcademicDistributionChart: React.FC<StudentAcademicDistributionChartProps> = ({
  students = [],
  classes = [],
  selectedGradeFilter,
  onSelectGradeFilter,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Helper to extract academic level from student & class
  const getStudentAcademicLevel = (student: Student): string => {
    const cls = classes.find((c) => c.id === student.classId || c.name.toLowerCase() === student.className.toLowerCase());
    if (cls && cls.grade) return cls.grade;
    const name = student.className;
    if (/^VII(\s|$|\.)|^7(\s|\.|\-|$)/i.test(name)) return '7';
    if (/^VIII(\s|$|\.)|^8(\s|\.|\-|$)/i.test(name)) return '8';
    if (/^IX(\s|$|\.)|^9(\s|\.|\-|$)/i.test(name)) return '9';
    if (/^X(\s|$|\.|\-)|^10(\s|\.|\-|$)/i.test(name)) return '10';
    if (/^XI(\s|$|\.|\-)|^11(\s|\.|\-|$)/i.test(name)) return '11';
    if (/^XII(\s|$|\.|\-)|^12(\s|\.|\-|$)/i.test(name)) return '12';
    if (/^1(\s|\.|\-|$)|^Kelas 1/i.test(name)) return '1';
    if (/^2(\s|\.|\-|$)|^Kelas 2/i.test(name)) return '2';
    if (/^3(\s|\.|\-|$)|^Kelas 3/i.test(name)) return '3';
    if (/^4(\s|\.|\-|$)|^Kelas 4/i.test(name)) return '4';
    if (/^5(\s|\.|\-|$)|^Kelas 5/i.test(name)) return '5';
    if (/^6(\s|\.|\-|$)|^Kelas 6/i.test(name)) return '6';
    return '7';
  };

  const getAcademicLevelName = (grade: string): string => {
    switch (grade) {
      case '1': return 'Kelas 1 (SD)';
      case '2': return 'Kelas 2 (SD)';
      case '3': return 'Kelas 3 (SD)';
      case '4': return 'Kelas 4 (SD)';
      case '5': return 'Kelas 5 (SD)';
      case '6': return 'Kelas 6 (SD)';
      case '7': return 'Jenjang 7 (SMP)';
      case '8': return 'Jenjang 8 (SMP)';
      case '9': return 'Jenjang 9 (SMP)';
      case '10': return 'Jenjang 10 (SMA)';
      case '11': return 'Jenjang 11 (SMA)';
      case '12': return 'Jenjang 12 (SMA)';
      default: return `Jenjang ${grade}`;
    }
  };

  // Compile distribution analytics
  const distributionData = useMemo(() => {
    const gradeMap: Record<
      string,
      {
        grade: string;
        label: string;
        shortLabel: string;
        studentCount: number;
        classCount: number;
        totalCapacity: number;
        classNames: string[];
      }
    > = {};

    // First, initialize from active registered classes
    classes.forEach((c) => {
      const g = c.grade || '7';
      if (!gradeMap[g]) {
        gradeMap[g] = {
          grade: g,
          label: getAcademicLevelName(g),
          shortLabel: ['7', '8', '9'].includes(g) ? `Kelas ${g}` : `J.${g}`,
          studentCount: 0,
          classCount: 0,
          totalCapacity: 0,
          classNames: [],
        };
      }
      gradeMap[g].classCount += 1;
      gradeMap[g].totalCapacity += (c.totalStudents || 32);
      gradeMap[g].classNames.push(c.name);
    });

    // Populate students into map
    students.forEach((st) => {
      const g = getStudentAcademicLevel(st);
      if (!gradeMap[g]) {
        gradeMap[g] = {
          grade: g,
          label: getAcademicLevelName(g),
          shortLabel: ['7', '8', '9'].includes(g) ? `Kelas ${g}` : `J.${g}`,
          studentCount: 0,
          classCount: 0,
          totalCapacity: 0,
          classNames: [],
        };
      }
      gradeMap[g].studentCount += 1;
    });

    const standardOrder = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    
    return Object.values(gradeMap)
      .map((item) => {
        const avgStudentsPerClass =
          item.classCount > 0
            ? +(item.studentCount / item.classCount).toFixed(1)
            : item.studentCount;
        
        const idealCapacity = item.classCount * 32;
        const utilizationRate =
          idealCapacity > 0
            ? Math.round((item.studentCount / idealCapacity) * 100)
            : 100;

        let status: 'ideal' | 'overcrowded' | 'underfilled' = 'ideal';
        let statusText = 'Ukuran Rombel Ideal';

        if (avgStudentsPerClass > 34) {
          status = 'overcrowded';
          statusText = 'Kelebihan Kapasitas (Padat)';
        } else if (avgStudentsPerClass < 22 && item.studentCount > 0) {
          status = 'underfilled';
          statusText = 'Di Bawah Kapasitas Target';
        }

        return {
          ...item,
          avgStudentsPerClass,
          idealCapacity,
          utilizationRate,
          status,
          statusText,
        };
      })
      .sort((a, b) => {
        const idxA = standardOrder.indexOf(a.grade);
        const idxB = standardOrder.indexOf(b.grade);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.grade.localeCompare(b.grade);
      });
  }, [students, classes]);

  // Overall analytics calculation
  const totalStudents = students.length;
  const totalClasses = classes.length;
  const averageClassSize = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : '0';

  const overcrowdedLevels = distributionData.filter((d) => d.status === 'overcrowded');
  const underfilledLevels = distributionData.filter((d) => d.status === 'underfilled');
  const isBalanced = overcrowdedLevels.length === 0 && underfilledLevels.length === 0;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[200px] z-50">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-extrabold text-indigo-400">{data.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 font-mono">
              {data.classCount} Rombel
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div>
              <span className="text-[10px] text-slate-400 block">Total Siswa:</span>
              <span className="font-black text-sm">{data.studentCount} Siswa</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Rata-rata / Rombel:</span>
              <span className="font-black text-sm text-emerald-400">{data.avgStudentsPerClass}</span>
            </div>
          </div>
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Status Keseimbangan:</span>
            <span
              className={`font-bold ${
                data.status === 'ideal'
                  ? 'text-emerald-400'
                  : data.status === 'overcrowded'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {data.statusText}
            </span>
          </div>
          <div className="text-[9px] text-slate-400 italic pt-1">
            Klik bar untuk memfilter daftar siswa jenjang ini
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
      {/* Header with expand/collapse */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                Distribusi Siswa & Analisis Keseimbangan Rombel
              </h3>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 ${
                  isBalanced
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                }`}
              >
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Distribusi Rata & Seimbang</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Perlu Perhatian Keseimbangan</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualisasi jumlah siswa antar jenjang pendidikan untuk mendeteksi ketimpangan ukuran rombongan belajar
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
        >
          <span>{isExpanded ? 'Tutup Grafik' : 'Lihat Analisis'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Siswa / Rombel
              </span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-xl font-black text-slate-900 dark:text-white">{totalStudents}</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">/ {totalClasses} Rombel</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Rata-rata Ukuran Kelas
              </span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-xl font-black text-slate-900 dark:text-white">{averageClassSize}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Siswa / Kelas</span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Ideal Kemendikbud: 28-32</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Jenjang Siswa Terbanyak
              </span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                {distributionData.length > 0 ? (
                  <>
                    <span className="text-base font-black text-slate-900 dark:text-white truncate">
                      {distributionData.reduce((prev, cur) => (cur.studentCount > prev.studentCount ? cur : prev), distributionData[0]).label}
                    </span>
                    <span className="text-xs font-bold text-indigo-600">
                      ({Math.max(...distributionData.map((d) => d.studentCount))} Siswa)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Diagnostik Rombel
              </span>
              <div className="flex items-center space-x-1 mt-1 text-xs font-black">
                {overcrowdedLevels.length > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{overcrowdedLevels.length} Jenjang Padat (&gt;34/kelas)</span>
                  </span>
                ) : underfilledLevels.length > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>{underfilledLevels.length} Jenjang di Bawah Target</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Semua Jenjang Seimbang</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 20, right: 20, left: 0, bottom: 25 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const grade = e.activePayload[0].payload.grade;
                    onSelectGradeFilter(selectedGradeFilter === grade ? 'ALL' : grade);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748B' }}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
                <ReferenceLine
                  y={32}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Kapasitas Standar Rombel (32)',
                    position: 'top',
                    fill: '#10B981',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="studentCount"
                  name="Jumlah Siswa"
                  radius={[8, 8, 0, 0]}
                  className="cursor-pointer transition-all"
                >
                  {distributionData.map((entry, index) => {
                    const isSelected = selectedGradeFilter === entry.grade;
                    const fillColor =
                      isSelected
                        ? '#4338CA'
                        : entry.status === 'overcrowded'
                        ? '#F43F5E'
                        : entry.status === 'underfilled'
                        ? '#F59E0B'
                        : '#6366F1';
                    return <Cell key={`cell-${index}`} fill={fillColor} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Legend & Quick Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-indigo-500 inline-block" />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Rombel Standar / Ideal</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Padat (&gt;34 Siswa/Rombel)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Di Bawah Kapasitas (&lt;22)</span>
              </span>
            </div>

            <div className="text-[11px] font-bold text-slate-400">
              💡 Tip: Klik salah satu bar untuk menyaring siswa per jenjang secara instan.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
