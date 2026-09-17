import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldCheck, Bug, ChevronDown, ChevronUp } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  componentName?: string;
  activeTab?: string;
  onNavigateHome?: () => void;
  onReset?: () => void;
  onResetComponent?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onResetComponent) {
      this.props.onResetComponent();
    } else if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleToggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage, componentName, onNavigateHome } = this.props;

      return (
        <div
          role="alert"
          className="my-4 p-6 sm:p-8 rounded-2xl bg-white border border-rose-200 shadow-sm max-w-3xl mx-auto text-slate-800"
        >
          {/* Header Status */}
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase tracking-wide border border-rose-200">
                  Isolasi Kesalahan Runtime
                </span>
                {componentName && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                    Modul: {componentName}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                {fallbackTitle || 'Terjadi Kendala pada Komponen Ini'}
              </h2>

              <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                {fallbackMessage ||
                  'Sistem telah mengisolasi kendala runtime ini agar aplikasi tetap berjalan stabil. Seluruh data presensi lokal, data siswa, guru, serta antrean sinkronisasi Anda tersimpan aman tanpa ada yang hilang.'}
              </p>
            </div>
          </div>

          {/* Data Protection Banner */}
          <div className="mt-5 p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center space-x-3 text-xs text-emerald-900">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Keamanan Data Terjamin:</span> Database lokal (LocalStorage
              & Sync Queue) tidak terpengaruh. Anda dapat memuat ulang komponen ini kapan saja.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center space-x-2 shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Komponen</span>
            </button>

            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-2 border border-slate-200 cursor-pointer transition-all"
              >
                <Home className="w-4 h-4 text-slate-500" />
                <span>Kembali ke Beranda Dashboard</span>
              </button>
            )}

            <button
              type="button"
              onClick={this.handleToggleDetails}
              className="px-3.5 py-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer ml-auto"
            >
              <Bug className="w-3.5 h-3.5 text-slate-500" />
              <span>{this.state.showDetails ? 'Sembunyikan Log Error' : 'Detail Diagnostik Error'}</span>
              {this.state.showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Collapsible Error Debug Details */}
          {this.state.showDetails && (
            <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 space-y-2">
              <div className="text-rose-400 font-bold">
                {this.state.error ? this.state.error.toString() : 'Unknown Error'}
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
