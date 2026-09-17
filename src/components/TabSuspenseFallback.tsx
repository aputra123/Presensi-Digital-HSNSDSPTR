import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface TabSuspenseFallbackProps {
  title?: string;
  subtitle?: string;
}

export const TabSuspenseFallback: React.FC<TabSuspenseFallbackProps> = ({
  title = 'Memuat Modul Aplikasi...',
  subtitle = 'Mengoptimalkan alokasi memori dan dependensi secara asinkron.',
}) => {
  return (
    <div className="w-full min-h-[420px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-xs">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-6">
        {subtitle}
      </p>

      <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="w-full h-full bg-indigo-600 dark:bg-indigo-500 animate-pulse" />
      </div>
    </div>
  );
};
