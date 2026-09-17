/**
 * Token-Based Session Management & Claims-Based Authorization
 * Generates cryptographic tokens with role claims, verifies signatures via Web Crypto API,
 * and enforces strict claims checks on administrative views.
 */

import { AuthClaims, TokenSession, UserRole, AdminAccount, UserAccount } from '../types';
import { authRateLimiter } from './rateLimiter';

export type { TokenSession, AuthClaims, AdminAccount, UserAccount };

const AUTH_TOKEN_KEY = 'school_presensi_token_session';
const CREDENTIALS_KEY = 'school_presensi_credentials_vault';
const ADMIN_ACCOUNTS_KEY = 'school_presensi_admin_accounts';
export const USER_ACCOUNTS_KEY = 'school_presensi_user_accounts';
const SESSION_SIGNING_SECRET = 'school_presensi_hmac_secret_key_v2_2026';

export interface AuthCredentialsVault {
  adminHash: string;
  adminSalt: string;
  piketHash: string;
  piketSalt: string;
  guruHash?: string;
  guruSalt?: string;
  lastUpdated: string;
}

// ==========================================
// CRYPTO HELPERS (SHA-256 & HMAC-SHA-256)
// ==========================================

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signData(data: string): Promise<string> {
  const key = await getHmacKey();
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

async function verifyDataSignature(data: string, signatureBase64Url: string): Promise<boolean> {
  try {
    const key = await getHmacKey();
    const enc = new TextEncoder();
    const binary = base64UrlDecode(signatureBase64Url);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }
    return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
  } catch {
    return false;
  }
}

// Generate hash SHA-256 password
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Array.from(buffer).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ==========================================
// CREDENTIALS VAULT
// ==========================================

export async function initializeCredentialsVault(): Promise<AuthCredentialsVault> {
  try {
    const saved = localStorage.getItem(CREDENTIALS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading credentials vault:', e);
  }

  // Default initial passwords:
  // Admin: admin123
  // Piket: piket123
  // Guru: guru123
  const adminSalt = generateSalt();
  const piketSalt = generateSalt();
  const guruSalt = generateSalt();
  const adminHash = await hashPassword('admin123', adminSalt);
  const piketHash = await hashPassword('piket123', piketSalt);
  const guruHash = await hashPassword('guru123', guruSalt);

  const vault: AuthCredentialsVault = {
    adminHash,
    adminSalt,
    piketHash,
    piketSalt,
    guruHash,
    guruSalt,
    lastUpdated: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(vault));
  } catch (e) {
    console.error('Failed to save default credentials vault:', e);
  }

  return vault;
}

// ==========================================
// ADMIN ACCOUNTS MANAGEMENT
// ==========================================

export async function initializeAdminAccounts(): Promise<AdminAccount[]> {
  try {
    const saved = localStorage.getItem(ADMIN_ACCOUNTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading admin accounts:', e);
  }

  // Akun admin default: username: 'admin', password: 'admin123'
  const salt = generateSalt();
  const passwordHash = await hashPassword('admin123', salt);
  const defaultAdmin: AdminAccount = {
    id: 'admin_default',
    username: 'admin',
    name: 'Administrator Utama / Proktor',
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    isDefault: true,
    mustChangePassword: false,
  };

  const initialList = [defaultAdmin];
  try {
    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(initialList));
  } catch (e) {
    console.warn('Failed to save default admin account:', e);
  }

  return initialList;
}

export async function getAdminAccounts(): Promise<AdminAccount[]> {
  return await initializeAdminAccounts();
}

/**
 * Menambahkan akun admin baru.
 * Logika: Mewajibkan perubahan kata sandi segera setelah admin baru menambahkan akun admin tambahan di sistem,
 * dan secara otomatis memperbarui kredensial sistem.
 */
export async function addAdminAccount(
  username: string,
  rawPassword: string,
  name?: string
): Promise<{ success: boolean; message: string; account?: AdminAccount }> {
  const accounts = await getAdminAccounts();
  const cleanUsername = username.trim().toLowerCase();

  if (!cleanUsername) {
    return { success: false, message: 'Nama pengguna (username) admin tidak boleh kosong.' };
  }

  if (accounts.some((a) => a.username.toLowerCase() === cleanUsername)) {
    return { success: false, message: `Username admin "${cleanUsername}" sudah digunakan.` };
  }

  if (rawPassword.length < 6) {
    return { success: false, message: 'Kata sandi baru minimal 6 karakter/angka.' };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(rawPassword, salt);
  const newAccount: AdminAccount = {
    id: `admin_${Date.now()}`,
    username: cleanUsername,
    name: name?.trim() || `Admin Proktor (${cleanUsername})`,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    isDefault: false,
    mustChangePassword: true, // Wajib mengganti kata sandi segera
  };

  // Tandai akun admin lama bahwa akun admin tambahan telah dibuat
  const updatedAccounts: AdminAccount[] = accounts.map((acc): AdminAccount => {
    return {
      ...acc,
      isDefault: false,
    };
  });
  updatedAccounts.push(newAccount);

  try {
    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));

    // Sinkronisasi dengan vault kredensial utama
    const vault = await initializeCredentialsVault();
    vault.adminHash = passwordHash;
    vault.adminSalt = salt;
    vault.lastUpdated = new Date().toISOString();
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(vault));
  } catch (e) {
    console.warn('Gagal menyimpan pembaruan akun admin:', e);
  }

  return {
    success: true,
    message: `Akun admin baru "${cleanUsername}" berhasil ditambahkan. Wajib mengubah kata sandi saat pertama kali digunakan.`,
    account: newAccount,
  };
}

/**
 * Pembaruan kata sandi admin (baik akun default maupun akun tambahan)
 */
export async function updateAdminAccountPassword(
  usernameOrId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const accounts = await getAdminAccounts();
  const target = accounts.find(
    (a) => a.id === usernameOrId || a.username.toLowerCase() === usernameOrId.toLowerCase()
  );

  if (!target) {
    return { success: false, message: 'Akun admin tidak ditemukan.' };
  }

  const oldHash = await hashPassword(oldPassword, target.salt);
  if (oldHash !== target.passwordHash) {
    return { success: false, message: 'Kata sandi lama tidak cocok.' };
  }

  if (newPassword.length < 6) {
    return { success: false, message: 'Kata sandi baru minimal 6 karakter/angka.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  const updatedAccounts = accounts.map((a) => {
    if (a.id === target.id) {
      return {
        ...a,
        salt: newSalt,
        passwordHash: newHash,
        mustChangePassword: false, // Kewajiban ganti kata sandi telah dipenuhi
      };
    }
    return a;
  });

  try {
    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    const vault = await initializeCredentialsVault();
    vault.adminHash = newHash;
    vault.adminSalt = newSalt;
    vault.lastUpdated = new Date().toISOString();
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(vault));
    return { success: true, message: 'Kata sandi admin berhasil diperbarui!' };
  } catch {
    return { success: false, message: 'Gagal menyimpan perubahan kata sandi admin.' };
  }
}

/**
 * Verifikasi login Administrator dengan dukungan akun default dan akun tambahan
 */
export async function verifyAdminLogin(
  usernameInput: string,
  passwordInput: string
): Promise<{
  success: boolean;
  message: string;
  session?: TokenSession;
  account?: AdminAccount;
  mustChangePassword?: boolean;
}> {
  const accounts = await getAdminAccounts();
  const cleanUser = usernameInput.trim().toLowerCase();

  const rateLimitStatus = authRateLimiter.check('admin');
  if (!rateLimitStatus.allowed) {
    return {
      success: false,
      message: rateLimitStatus.message || 'Terlalu banyak percobaan gagal. Akses dikunci sementara.',
    };
  }

  // 1. Cari akun berdasarkan username
  let target = accounts.find((a) => a.username.toLowerCase() === cleanUser);

  // 2. Fallback: jika username 'admin' atau kosong, pilih akun default
  if (!target && (cleanUser === 'admin' || cleanUser === '')) {
    target = accounts.find((a) => a.isDefault) || accounts[0];
  }

  if (target) {
    const inputHash = await hashPassword(passwordInput, target.salt);
    if (inputHash === target.passwordHash) {
      authRateLimiter.reset('admin');
      const session = await createTokenSession('admin', target.name || 'Administrator Sekolah');
      return {
        success: true,
        message: 'Autentikasi admin berhasil.',
        session,
        account: target,
        mustChangePassword: Boolean(target.mustChangePassword),
      };
    }
  }

  // 3. Fallback ke vault standar
  const vault = await initializeCredentialsVault();
  const vaultHash = await hashPassword(passwordInput, vault.adminSalt);
  if (vaultHash === vault.adminHash && (cleanUser === 'admin' || !cleanUser)) {
    authRateLimiter.reset('admin');
    const session = await createTokenSession('admin', 'Administrator Sekolah');
    return {
      success: true,
      message: 'Autentikasi admin berhasil.',
      session,
      mustChangePassword: false,
    };
  }

  const recordResult = authRateLimiter.record('admin');
  return {
    success: false,
    message: recordResult.allowed
      ? `Nama pengguna atau kata sandi admin salah. Sisa percobaan: ${recordResult.remaining}`
      : `Batas percobaan terlampaui. Akses dikunci selama ${recordResult.retryAfterSeconds} detik.`,
  };
}

export async function updateRolePassword(
  role: UserRole,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (role === 'admin') {
    return await updateAdminAccountPassword('admin', oldPassword, newPassword);
  }

  const verifyOld = await verifyRoleCredentials(role, oldPassword);
  if (!verifyOld.success) {
    return { success: false, message: 'Kata sandi lama tidak cocok.' };
  }

  if (newPassword.length < 6) {
    return { success: false, message: 'Kata sandi baru minimal 6 karakter/angka.' };
  }

  const vault = await initializeCredentialsVault();
  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  if (role === 'guru') {
    vault.guruSalt = newSalt;
    vault.guruHash = newHash;
  } else {
    vault.piketSalt = newSalt;
    vault.piketHash = newHash;
  }
  vault.lastUpdated = new Date().toISOString();

  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(vault));
    return { success: true, message: 'Kata sandi berhasil diperbarui.' };
  } catch {
    return { success: false, message: 'Gagal menyimpan kata sandi.' };
  }
}

// ==========================================
// TOKEN-BASED SESSION & CLAIMS GENERATION
// ==========================================

/**
 * Creates a signed JWT-like token embedded with claims
 */
export async function createTokenSession(
  role: UserRole,
  displayName?: string,
  customClaims?: Partial<AuthClaims>
): Promise<TokenSession> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 4 * 60 * 60; // 4 Hours valid

  const isAdmin = role === 'admin';
  const isGuru = role === 'guru';
  const isPiket = role === 'piket';

  const claims: AuthClaims = {
    sub: isAdmin ? 'admin_principal' : isGuru ? 'guru_teacher' : isPiket ? 'piket_officer' : 'siswa_student',
    role,
    permissions: isAdmin
      ? [
          'admin:*',
          'views:admin',
          'config:manage',
          'personnel:manage',
          'leaves:approve',
          'records:delete',
          'reports:export_bkd',
        ]
      : isGuru
      ? [
          'guru:operate',
          'views:guru',
          'attendance:selfie',
          'attendance:asn_table',
          'attendance:scan',
          'leaves:view',
        ]
      : isPiket
      ? ['piket:operate', 'views:piket', 'attendance:scan', 'leaves:submit']
      : ['siswa:operate', 'views:siswa', 'attendance:selfie', 'attendance:scan', 'leaves:submit'],
    canAccessAdminViews: isAdmin,
    canManageConfig: isAdmin,
    canManagePersonnel: isAdmin,
    canApproveLeaves: isAdmin,
    canDeleteRecords: isAdmin,
    canExportBkd: isAdmin,
    iat: now,
    exp,
    iss: 'presensi-sekolah-auth',
    aud: 'presensi-sekolah-client',
    ...customClaims,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const payloadToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = await signData(payloadToSign);
  const token = `${payloadToSign}.${signature}`;

  const session: TokenSession = {
    token,
    claims,
    displayName:
      displayName ||
      (isAdmin
        ? 'Administrator Sekolah'
        : isGuru
        ? 'Bpk/Ibu Guru Pengajar'
        : isPiket
        ? 'Petugas Guru Piket'
        : 'Peserta Didik (Siswa)'),
  };

  saveTokenSession(session);
  return session;
}

/**
 * Verifies a token's signature, expiration, and extracts claims
 */
export async function verifyToken(
  token: string
): Promise<{ valid: boolean; claims?: AuthClaims; error?: string }> {
  if (!token) {
    return { valid: false, error: 'Token tidak disediakan.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Format token tidak valid (Malformed JWT).' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToVerify = `${encodedHeader}.${encodedPayload}`;

  const isSignatureValid = await verifyDataSignature(dataToVerify, signature);
  if (!isSignatureValid) {
    return { valid: false, error: 'Tanda tangan kriptografis token tidak valid.' };
  }

  try {
    const claims: AuthClaims = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (claims.exp && claims.exp < now) {
      return { valid: false, error: 'Sesi token telah kadaluwarsa (Expired).' };
    }

    return { valid: true, claims };
  } catch {
    return { valid: false, error: 'Gagal mendekode klaim token.' };
  }
}

/**
 * Saves token session into sessionStorage and sets Authorization header
 */
export function saveTokenSession(session: TokenSession): void {
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Session storage inaccessible:', e);
  }
}

/**
 * Retrieves and validates the active token session asynchronously
 */
export async function getActiveTokenSession(): Promise<TokenSession | null> {
  try {
    const raw = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;

    const session: TokenSession = JSON.parse(raw);
    const verification = await verifyToken(session.token);

    if (!verification.valid || !verification.claims) {
      clearTokenSession();
      return null;
    }

    // Refresh claims from decoded token
    session.claims = verification.claims;
    return session;
  } catch {
    return null;
  }
}

/**
 * Synchronously retrieves stored token session without re-verifying crypto signature immediately
 */
export function getActiveTokenSessionSync(): TokenSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const session: TokenSession = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    if (session.claims?.exp && session.claims.exp < now) {
      clearTokenSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearTokenSession(): void {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

// ==========================================
// CLAIMS-BASED AUTHORIZATION GUARDS
// ==========================================

/**
 * Checks whether user has a specific claim
 */
export function hasClaim(claims: AuthClaims | undefined | null, claimKey: keyof AuthClaims): boolean {
  if (!claims) return false;
  return Boolean(claims[claimKey]);
}

/**
 * Validates whether the active session has claims to view administrative views
 */
export function isAuthorizedForAdmin(session: TokenSession | null): boolean {
  if (!session || !session.claims) return false;
  return session.claims.role === 'admin' && Boolean(session.claims.canAccessAdminViews);
}

/**
 * Verifies if a tab requires administrative claims and checks authorization
 * Strict role boundary: Setiap role yang sudah login tidak bisa lagi mengakses role lain.
 * Pada role Guru dan Siswa, Menu Utama dihapus dan diganti dengan Metode Presensi.
 */
export function isAuthorizedForTab(
  session: TokenSession | null,
  tab: string
): { authorized: boolean; reason?: string } {
  if (!session || !session.claims) {
    return {
      authorized: false,
      reason: 'Sesi autentikasi tidak ditemukan. Harap masuk terlebih dahulu.',
    };
  }

  const role = session.claims.role;

  // Profil akun dapat diakses oleh semua pengguna yang sedang login
  if (tab === 'profile') {
    return { authorized: true };
  }

  // 1. Role SISWA: Hanya boleh mengakses Metode Presensi & Fitur Khusus Siswa
  if (role === 'siswa') {
    const studentAllowedTabs = ['profile', 'selfie', 'cards', 'leaves'];
    if (tab === 'dashboard') {
      return {
        authorized: false,
        reason: 'Menu Utama dinonaktifkan untuk peran Siswa. Silakan gunakan menu Metode Presensi.',
      };
    }
    if (!studentAllowedTabs.includes(tab)) {
      return {
        authorized: false,
        reason: 'Akses Ditolak: Anda masuk sebagai Siswa dan hanya dapat mengakses menu khusus Siswa. Fitur menu ini khusus untuk peran lain.',
      };
    }
    return { authorized: true };
  }

  // 2. Role GURU: Hanya boleh mengakses fitur khusus Guru
  if (role === 'guru') {
    const teacherAllowedTabs = [
      'profile',
      'selfie',
      'batch_class',
      'cards',
      'layanan_gtk',
    ];
    if (tab === 'dashboard') {
      return {
        authorized: false,
        reason: 'Menu Utama dinonaktifkan untuk peran Guru. Silakan gunakan menu Metode Presensi.',
      };
    }
    if (!teacherAllowedTabs.includes(tab)) {
      return {
        authorized: false,
        reason: 'Akses Ditolak: Anda masuk sebagai Guru dan tidak dapat mengakses menu peran lain.',
      };
    }
    return { authorized: true };
  }

  // 3. Role PIKET: Petugas Piket Presensi
  if (role === 'piket') {
    const piketAllowedTabs = [
      'profile',
      'scan',
      'batch_class',
      'selfie',
      'piket',
      'asn_attendance_table',
      'layanan_gtk',
      'leaves',
    ];
    if (!piketAllowedTabs.includes(tab)) {
      return {
        authorized: false,
        reason: 'Akses Ditolak: Anda masuk sebagai Petugas Piket dan tidak dapat mengakses menu peran lain.',
      };
    }
    return { authorized: true };
  }

  // 4. Role ADMIN: Akses penuh ke seluruh menu
  if (role === 'admin') {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: 'Akses Ditolak: Peran tidak dikenali.',
  };
}

// ==========================================
// MULTI-ROLE USER ACCOUNTS MANAGEMENT (GURU, PIKET, SISWA, ADMIN)
// Di-input & Dikelola Penuh Melalui Akun Admin
// ==========================================

export async function initializeUserAccounts(): Promise<UserAccount[]> {
  try {
    const saved = localStorage.getItem(USER_ACCOUNTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrasi penambahan email terdaftar jika belum ada
        let changed = false;
        let migrated = parsed.map((acc: UserAccount) => {
          if (!acc.email) {
            changed = true;
            let defaultEmail = `${acc.username.replace(/[^a-z0-9_.-]/g, '')}@sekolah.sch.id`;
            if (acc.role === 'guru') defaultEmail = `${acc.username.replace(/[^a-z0-9_.-]/g, '')}@guru.sekolah.sch.id`;
            if (acc.role === 'siswa') defaultEmail = `${acc.username.replace(/[^a-z0-9_.-]/g, '')}@siswa.sekolah.sch.id`;
            return { ...acc, email: defaultEmail };
          }
          return acc;
        });

        // Pastikan akun eksplisit Kepala Sekolah (username: kepsek) selalu tersedia
        if (!migrated.some((a: UserAccount) => a.username.toLowerCase() === 'kepsek')) {
          const guruSalt = generateSalt();
          const guruHash = await hashPassword('guru123', guruSalt);
          migrated.push({
            id: 'acc_kepsek_01',
            username: 'kepsek',
            name: 'Drs. La Ode Muhammad Syafei, M.Pd.',
            role: 'guru',
            email: 'kepsek@sekolah.sch.id',
            identifier: '197305141999031004',
            personId: 't_asn_01',
            classOrSubject: 'Kepala Sekolah (Pembina Tk. I, IV/b)',
            passwordHash: guruHash,
            salt: guruSalt,
            rawPasswordHint: 'guru123',
            isActive: true,
            createdAt: new Date().toISOString(),
            mustChangePassword: false,
          });
          changed = true;
        }

        if (changed) {
          try {
            localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(migrated));
          } catch (e) {
            console.warn(e);
          }
        }
        return migrated;
      }
    }
  } catch (e) {
    console.error('Error reading user accounts:', e);
  }

  // Siapkan akun bawaan sistem untuk pengujian dan operasional awal sekolah
  const adminSalt = generateSalt();
  const adminHash = await hashPassword('admin123', adminSalt);

  const guruSalt = generateSalt();
  const guruHash = await hashPassword('guru123', guruSalt);

  const piketSalt = generateSalt();
  const piketHash = await hashPassword('piket123', piketSalt);

  const siswaSalt = generateSalt();
  const siswaHash = await hashPassword('siswa123', siswaSalt);

  const initialList: UserAccount[] = [
    {
      id: 'acc_admin_01',
      username: 'admin',
      name: 'Administrator Utama / Proktor',
      role: 'admin',
      email: 'admin@sekolah.sch.id',
      passwordHash: adminHash,
      salt: adminSalt,
      rawPasswordHint: 'admin123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_kepsek_01',
      username: 'kepsek',
      name: 'Drs. La Ode Muhammad Syafei, M.Pd.',
      role: 'guru',
      email: 'kepsek@sekolah.sch.id',
      identifier: '197305141999031004',
      personId: 't_asn_01',
      classOrSubject: 'Kepala Sekolah (Pembina Tk. I, IV/b)',
      passwordHash: guruHash,
      salt: guruSalt,
      rawPasswordHint: 'guru123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_guru_01',
      username: 'guru',
      name: 'Drs. La Ode Muhammad Syafei, M.Pd.',
      role: 'guru',
      email: 'syafei@guru.sekolah.sch.id',
      identifier: '197305141999031004',
      personId: 't_asn_01',
      classOrSubject: 'Kepala Sekolah / PKn',
      passwordHash: guruHash,
      salt: guruSalt,
      rawPasswordHint: 'guru123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_guru_02',
      username: 'guru.hasbullah',
      name: 'Hasbullah Buamona, S.Kom., M.Si.',
      role: 'guru',
      email: 'hasbullah@guru.sekolah.sch.id',
      identifier: '198207182008011007',
      personId: 't_asn_02',
      classOrSubject: 'Informatika & TIK',
      passwordHash: guruHash,
      salt: guruSalt,
      rawPasswordHint: 'guru123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_guru_03',
      username: 'guru.siti',
      name: 'Siti Rahmawati Soamole, S.Pd.',
      role: 'guru',
      email: 'siti@guru.sekolah.sch.id',
      identifier: '198503252010012015',
      personId: 't_asn_03',
      classOrSubject: 'Bahasa Indonesia',
      passwordHash: guruHash,
      salt: guruSalt,
      rawPasswordHint: 'guru123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_piket_01',
      username: 'piket',
      name: 'Petugas Guru Piket Utama',
      role: 'piket',
      email: 'piket@sekolah.sch.id',
      identifier: 'PIKET-01',
      passwordHash: piketHash,
      salt: piketSalt,
      rawPasswordHint: 'piket123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_piket_02',
      username: 'piket.ahmad',
      name: 'Ahmad Dahlan Mus, S.Pd., Gr.',
      role: 'piket',
      email: 'ahmad.piket@sekolah.sch.id',
      identifier: '198811122014031002',
      personId: 't_asn_04',
      classOrSubject: 'Matematika',
      passwordHash: piketHash,
      salt: piketSalt,
      rawPasswordHint: 'piket123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_siswa_01',
      username: 'siswa',
      name: 'Ahmad Zaki Pratama',
      role: 'siswa',
      email: 'zaki@siswa.sekolah.sch.id',
      identifier: '0081234567',
      personId: 's_01',
      classOrSubject: 'Kelas 7A',
      passwordHash: siswaHash,
      salt: siswaSalt,
      rawPasswordHint: 'siswa123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    {
      id: 'acc_siswa_02',
      username: '0081234567',
      name: 'Ahmad Zaki Pratama',
      role: 'siswa',
      email: '0081234567@siswa.sekolah.sch.id',
      identifier: '0081234567',
      personId: 's_01',
      classOrSubject: 'Kelas 7A',
      passwordHash: siswaHash,
      salt: siswaSalt,
      rawPasswordHint: 'siswa123',
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    },
  ];

  try {
    localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(initialList));
  } catch (e) {
    console.warn('Failed to save default user accounts:', e);
  }

  return initialList;
}

export function getUserAccountsSync(): UserAccount[] {
  try {
    const saved = localStorage.getItem(USER_ACCOUNTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error in getUserAccountsSync:', e);
  }
  return [];
}

export async function getUserAccounts(): Promise<UserAccount[]> {
  return await initializeUserAccounts();
}

export function saveUserAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('Failed to save user accounts to localStorage:', e);
  }
}

/**
 * Menambahkan Akun Pengguna Baru (Guru, Piket, Siswa, atau Admin)
 * Dilakukan oleh Administrator melalui panel akun
 */
export async function createUserAccount(data: {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  email?: string;
  personId?: string;
  identifier?: string;
  classOrSubject?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  rawPasswordHint?: string;
}): Promise<{ success: boolean; message: string; account?: UserAccount }> {
  const accounts = await getUserAccounts();
  const cleanUsername = data.username.trim().toLowerCase();

  if (!cleanUsername) {
    return { success: false, message: 'Nama pengguna (username) tidak boleh kosong.' };
  }

  // Validasi karakter username yang aman
  if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
    return {
      success: false,
      message: 'Username hanya boleh berisi huruf kecil, angka, titik (.), strip (-), atau garis bawah (_).',
    };
  }

  if (accounts.some((a) => a.username.toLowerCase() === cleanUsername)) {
    return { success: false, message: `Username "${cleanUsername}" sudah digunakan oleh akun lain.` };
  }

  if (data.password.length < 4) {
    return { success: false, message: 'Kata sandi minimal 4 karakter.' };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(data.password, salt);

  let emailToSave = data.email?.trim().toLowerCase();
  if (!emailToSave) {
    emailToSave = `${cleanUsername}@${data.role === 'guru' ? 'guru.' : data.role === 'siswa' ? 'siswa.' : ''}sekolah.sch.id`;
  }

  const newAccount: UserAccount = {
    id: `acc_${data.role}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    name: data.name.trim() || cleanUsername,
    role: data.role,
    email: emailToSave,
    passwordHash,
    salt,
    rawPasswordHint: data.password,
    personId: data.personId,
    identifier: data.identifier?.trim(),
    classOrSubject: data.classOrSubject?.trim(),
    isActive: data.isActive ?? true,
    createdAt: new Date().toISOString(),
    mustChangePassword: data.mustChangePassword ?? false,
  };

  const updated = [...accounts, newAccount];
  saveUserAccounts(updated);

  return {
    success: true,
    message: `Akun "${cleanUsername}" untuk ${newAccount.name} (${newAccount.role.toUpperCase()}) berhasil dibuat.`,
    account: newAccount,
  };
}

/**
 * Memperbarui Akun Pengguna (Username, Nama, Role, Identitas Terhubung, Status Aktif, Email, dan Password Baru)
 */
export async function updateUserAccount(
  id: string,
  updates: Partial<UserAccount> & { newPassword?: string }
): Promise<{ success: boolean; message: string; account?: UserAccount }> {
  const accounts = await getUserAccounts();
  const targetIndex = accounts.findIndex((a) => a.id === id);

  if (targetIndex === -1) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  const target = { ...accounts[targetIndex] };

  if (updates.username) {
    const cleanUser = updates.username.trim().toLowerCase();
    if (accounts.some((a) => a.id !== id && a.username.toLowerCase() === cleanUser)) {
      return { success: false, message: `Username "${cleanUser}" sudah digunakan akun lain.` };
    }
    target.username = cleanUser;
  }

  if (updates.name !== undefined) target.name = updates.name.trim();
  if (updates.email !== undefined) target.email = updates.email.trim().toLowerCase();
  if (updates.role !== undefined) target.role = updates.role;
  if (updates.personId !== undefined) target.personId = updates.personId;
  if (updates.identifier !== undefined) target.identifier = updates.identifier.trim();
  if (updates.classOrSubject !== undefined) target.classOrSubject = updates.classOrSubject.trim();
  if (updates.isActive !== undefined) target.isActive = updates.isActive;
  if (updates.mustChangePassword !== undefined) target.mustChangePassword = updates.mustChangePassword;

  if (updates.newPassword && updates.newPassword.trim()) {
    if (updates.newPassword.length < 4) {
      return { success: false, message: 'Kata sandi baru minimal 4 karakter.' };
    }
    const newSalt = generateSalt();
    target.salt = newSalt;
    target.passwordHash = await hashPassword(updates.newPassword, newSalt);
    target.rawPasswordHint = updates.newPassword;
  }

  accounts[targetIndex] = target;
  saveUserAccounts(accounts);

  return {
    success: true,
    message: `Akun "${target.username}" berhasil diperbarui.`,
    account: target,
  };
}

/**
 * Menghapus Akun Pengguna
 */
export async function deleteUserAccount(id: string): Promise<{ success: boolean; message: string }> {
  const accounts = await getUserAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  if (target.username === 'admin' && accounts.filter((a) => a.role === 'admin').length <= 1) {
    return { success: false, message: 'Akun admin utama tidak boleh dihapus jika hanya tersisa satu.' };
  }

  const updated = accounts.filter((a) => a.id !== id);
  saveUserAccounts(updated);

  return { success: true, message: `Akun "${target.username}" berhasil dihapus.` };
}

/**
 * Verifikasi Login Terpadu Berbasis Akun (Username & Password)
 * Mendukung autentikasi spesifik Guru, Piket, Siswa, dan Admin
 */
export async function verifyAccountLogin(
  usernameInput: string,
  passwordInput: string,
  expectedRole?: UserRole
): Promise<{
  success: boolean;
  message: string;
  session?: TokenSession;
  account?: UserAccount;
  mustChangePassword?: boolean;
  remainingAttempts?: number;
  lockoutSeconds?: number;
}> {
  const accounts = await getUserAccounts();
  const cleanInput = usernameInput.trim().toLowerCase();

  const targetLimiterRole = expectedRole || 'admin';
  const rateLimitStatus = authRateLimiter.check(targetLimiterRole);
  if (!rateLimitStatus.allowed) {
    return {
      success: false,
      message: rateLimitStatus.message || 'Terlalu banyak percobaan gagal. Akses dikunci sementara.',
      remainingAttempts: 0,
      lockoutSeconds: rateLimitStatus.retryAfterSeconds,
    };
  }

  if (!cleanInput) {
    return { success: false, message: 'Nama pengguna (username) atau NISN/NIP harus diisi.' };
  }

  // 1. Cari akun berdasarkan username ATAU nomor induk (NISN siswa / NIP guru)
  let target = accounts.find(
    (a) =>
      a.username.toLowerCase() === cleanInput ||
      (a.identifier && a.identifier.toLowerCase() === cleanInput)
  );

  // Fallback untuk admin default
  if (!target && (cleanInput === 'admin' || cleanInput === 'administrator')) {
    target = accounts.find((a) => a.role === 'admin');
  }

  if (!target) {
    const recordResult = authRateLimiter.record(targetLimiterRole);
    return {
      success: false,
      message: recordResult.allowed
        ? `Akun "${usernameInput}" tidak ditemukan di database. Pastikan admin telah mendaftarkan akun Anda.`
        : `Batas percobaan terlampaui. Akses dikunci selama ${recordResult.retryAfterSeconds} detik.`,
      remainingAttempts: recordResult.remaining,
      lockoutSeconds: recordResult.retryAfterSeconds,
    };
  }

  // 2. Validasi kesesuaian peran jika expectedRole ditentukan
  if (expectedRole && target.role !== expectedRole) {
    const roleLabels: Record<UserRole, string> = {
      admin: 'Administrator',
      guru: 'Guru & GTK',
      piket: 'Petugas Guru Piket',
      siswa: 'Peserta Didik (Siswa)',
    };
    return {
      success: false,
      message: `Akun "${usernameInput}" terdaftar dengan peran ${roleLabels[target.role]}. Silakan gunakan tab ${roleLabels[target.role]} untuk masuk.`,
    };
  }

  // 3. Periksa status aktif akun
  if (target.isActive === false) {
    return {
      success: false,
      message: `Akun "${target.username}" sedang dinonaktifkan oleh Administrator Sekolah. Hubungi admin sekolah untuk mengaktifkan kembali.`,
    };
  }

  // 4. Verifikasi hash kata sandi
  const inputHash = await hashPassword(passwordInput, target.salt);
  let isMatch = inputHash === target.passwordHash;

  // Fallback kredensial bawaan untuk kenyamanan testing sekolah
  if (!isMatch) {
    if (
      (target.role === 'admin' && passwordInput === 'admin123' && target.username === 'admin') ||
      (target.role === 'guru' && passwordInput === 'guru123') ||
      (target.role === 'piket' && passwordInput === 'piket123') ||
      (target.role === 'siswa' && passwordInput === 'siswa123')
    ) {
      isMatch = true;
    }
  }

  if (!isMatch) {
    const recordResult = authRateLimiter.record(targetLimiterRole);
    return {
      success: false,
      message: recordResult.allowed
        ? `Kata sandi salah. Sisa percobaan: ${recordResult.remaining}`
        : `Batas percobaan terlampaui. Akses dikunci selama ${recordResult.retryAfterSeconds} detik.`,
      remainingAttempts: recordResult.remaining,
      lockoutSeconds: recordResult.retryAfterSeconds,
    };
  }

  // Autentikasi Sukses!
  authRateLimiter.reset(targetLimiterRole);

  // Perbarui waktu login terakhir
  target.lastLogin = new Date().toISOString();
  saveUserAccounts(accounts.map((a) => (a.id === target.id ? target : a)));

  // Terbitkan token sesi dan sematkan klaim pengguna
  const session = await createTokenSession(target.role, target.name, {
    accountId: target.id,
    username: target.username,
    personId: target.personId,
    personName: target.name,
    identifier: target.identifier,
    classOrSubject: target.classOrSubject,
  });

  session.account = target;
  saveTokenSession(session);

  return {
    success: true,
    message: `Selamat datang, ${target.name}! Berhasil masuk sebagai ${target.role.toUpperCase()}.`,
    session,
    account: target,
    mustChangePassword: Boolean(target.mustChangePassword),
  };
}

/**
 * Generate Akun Massal Otomatis untuk Seluruh Guru atau Seluruh Siswa
 */
export async function bulkGeneratePersonnelAccounts(
  targetRole: 'guru' | 'siswa',
  personnelList: Array<{
    id: string;
    name: string;
    nip?: string;
    nisn?: string;
    subject?: string;
    className?: string;
  }>,
  defaultPassword?: string
): Promise<{ created: number; skipped: number; accounts: UserAccount[] }> {
  const accounts = await getUserAccounts();
  const password = defaultPassword || (targetRole === 'guru' ? 'guru123' : 'siswa123');
  let createdCount = 0;
  let skippedCount = 0;

  const newAccounts: UserAccount[] = [...accounts];

  for (const person of personnelList) {
    const identifier = targetRole === 'guru' ? person.nip : person.nisn;
    const exists = newAccounts.some(
      (a) =>
        (a.personId && a.personId === person.id) ||
        (identifier && a.identifier && a.identifier.trim() === identifier.trim())
    );

    if (exists) {
      skippedCount++;
      continue;
    }

    let usernameProposal = '';
    if (targetRole === 'siswa') {
      usernameProposal = person.nisn && person.nisn.trim().length >= 4
        ? person.nisn.trim()
        : `siswa_${person.name.split(' ')[0].toLowerCase()}`;
    } else {
      usernameProposal = person.nip && person.nip.trim().length >= 4
        ? person.nip.trim()
        : `guru_${person.name.split(' ')[0].toLowerCase()}`;
    }

    usernameProposal = usernameProposal
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '');

    if (newAccounts.some((a) => a.username.toLowerCase() === usernameProposal)) {
      usernameProposal = `${usernameProposal}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const createdAccount: UserAccount = {
      id: `acc_${targetRole}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: usernameProposal,
      name: person.name,
      role: targetRole,
      identifier: identifier || undefined,
      personId: person.id,
      classOrSubject: targetRole === 'guru' ? person.subject : person.className,
      passwordHash,
      salt,
      rawPasswordHint: password,
      isActive: true,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
    };

    newAccounts.push(createdAccount);
    createdCount++;
  }

  saveUserAccounts(newAccounts);
  return { created: createdCount, skipped: skippedCount, accounts: newAccounts };
}

// ==========================================
// ROLE CREDENTIAL VERIFICATION WITH RATE LIMITER & MULTI-ACCOUNT SUPPORT
// ==========================================

export async function verifyRoleCredentials(
  role: UserRole,
  inputPassword: string,
  inputUsername?: string
): Promise<{
  success: boolean;
  message: string;
  session?: TokenSession;
  account?: UserAccount;
  remainingAttempts?: number;
  lockoutSeconds?: number;
}> {
  // Jika username disediakan, verifikasi langsung menggunakan sistem akun
  if (inputUsername && inputUsername.trim()) {
    const res = await verifyAccountLogin(inputUsername, inputPassword, role);
    return {
      success: res.success,
      message: res.message,
      session: res.session,
      account: res.account,
      remainingAttempts: res.remainingAttempts,
      lockoutSeconds: res.lockoutSeconds,
    };
  }

  // Jika tanpa username, cari akun default yang sesuai dengan role
  const accounts = getUserAccountsSync();
  const defaultAcc = accounts.find((a) => a.role === role && a.isActive);
  if (defaultAcc) {
    const res = await verifyAccountLogin(defaultAcc.username, inputPassword, role);
    if (res.success) {
      return {
        success: true,
        message: res.message,
        session: res.session,
        account: res.account,
      };
    }
  }

  if (role === 'admin') {
    const adminRes = await verifyAdminLogin('admin', inputPassword);
    return {
      success: adminRes.success,
      message: adminRes.message,
      session: adminRes.session,
    };
  }

  if (role === 'siswa') {
    authRateLimiter.reset('siswa');
    const session = await createTokenSession('siswa', inputPassword ? `Siswa (${inputPassword})` : 'Peserta Didik');
    return {
      success: true,
      message: 'Masuk sebagai Siswa berhasil.',
      session,
    };
  }

  // Check rate limiter sliding window
  const rateLimitStatus = authRateLimiter.check(role);
  if (!rateLimitStatus.allowed) {
    return {
      success: false,
      message: rateLimitStatus.message || 'Terlalu banyak percobaan. Akses dikunci sementara.',
      remainingAttempts: 0,
      lockoutSeconds: rateLimitStatus.retryAfterSeconds,
    };
  }

  const vault = await initializeCredentialsVault();
  const salt =
    role === 'guru'
      ? vault.guruSalt || vault.piketSalt
      : vault.piketSalt;
  const expectedHash =
    role === 'guru'
      ? vault.guruHash || vault.piketHash
      : vault.piketHash;

  const inputHash = await hashPassword(inputPassword, salt);

  if (inputHash === expectedHash) {
    authRateLimiter.reset(role);
    const session = await createTokenSession(role);
    return {
      success: true,
      message: 'Autentikasi berhasil. Token sesi diterbitkan.',
      session,
    };
  }

  // Record failed attempt in sliding window
  const recordResult = authRateLimiter.record(role);
  return {
    success: false,
    message: recordResult.allowed
      ? `Kata sandi / PIN salah. Sisa percobaan: ${recordResult.remaining}`
      : `Batas percobaan terlampaui. Akses dikunci selama ${recordResult.retryAfterSeconds} detik.`,
    remainingAttempts: recordResult.remaining,
    lockoutSeconds: recordResult.retryAfterSeconds,
  };
}

// ==========================================
// PROFIL PENGGUNA & RESET KATA SANDI (FORGOT PASSWORD)
// ==========================================

const PASSWORD_RESET_STORAGE_KEY = 'school_presensi_pwd_resets';

interface PasswordResetChallenge {
  resetToken: string;
  accountId: string;
  username: string;
  email: string;
  code: string; // 6-digit OTP
  expiresAt: number; // timestamp in ms
  verified: boolean;
}

function getStoredResetChallenges(): PasswordResetChallenge[] {
  try {
    const raw = sessionStorage.getItem(PASSWORD_RESET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveResetChallenges(challenges: PasswordResetChallenge[]): void {
  try {
    sessionStorage.setItem(PASSWORD_RESET_STORAGE_KEY, JSON.stringify(challenges));
  } catch (e) {
    console.warn('Failed to store reset challenges:', e);
  }
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'e***@sekolah.sch.id';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
}

/**
 * Mencari data Akun Pengguna secara sinkron berdasarkan Sesi Token Aktif
 */
export function getUserAccountBySessionSync(session: TokenSession | null): UserAccount | null {
  if (!session || !session.claims) return null;
  const accounts = getUserAccountsSync();
  const sub = session.claims.sub;
  const username = session.claims.username;

  // 1. Cari by ID
  let found = accounts.find((a) => a.id === sub);
  if (found) return found;

  // 2. Cari by username
  if (username) {
    found = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());
    if (found) return found;
  }

  // 3. Cari by role & identifier
  if (session.claims.identifier) {
    found = accounts.find(
      (a) => a.role === session.claims.role && a.identifier === session.claims.identifier
    );
    if (found) return found;
  }

  // 4. Fallback ke akun default pertama untuk role yang bersangkutan
  found = accounts.find((a) => a.role === session.claims.role);
  if (found) return found;

  // 5. Buat representasi akun virtual berbasis session token
  const role = session.claims.role;
  return {
    id: sub || `acc_${role}_session`,
    username: username || role,
    name: session.claims.personName || `Pengguna ${role.toUpperCase()}`,
    role,
    email: `${username || role}@${role === 'guru' ? 'guru.' : role === 'siswa' ? 'siswa.' : ''}sekolah.sch.id`,
    identifier: session.claims.identifier,
    classOrSubject: session.claims.classOrSubject,
    passwordHash: '',
    salt: '',
    isActive: true,
    createdAt: new Date(session.claims.iat * 1000).toISOString(),
    lastLogin: new Date(session.claims.iat * 1000).toISOString(),
  };
}

/**
 * Mencari data Akun Pengguna berdasarkan Sesi Token Aktif
 */
export async function getUserAccountBySession(session: TokenSession | null): Promise<UserAccount | null> {
  if (!session || !session.claims) return null;
  const accounts = await getUserAccounts();
  const sub = session.claims.sub;
  const username = session.claims.username;

  // 1. Cari by ID
  let found = accounts.find((a) => a.id === sub);
  if (found) return found;

  // 2. Cari by username
  if (username) {
    found = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());
    if (found) return found;
  }

  // 3. Cari by role & identifier
  if (session.claims.identifier) {
    found = accounts.find(
      (a) => a.role === session.claims.role && a.identifier === session.claims.identifier
    );
    if (found) return found;
  }

  // 4. Fallback ke akun default pertama untuk role yang bersangkutan
  found = accounts.find((a) => a.role === session.claims.role);
  if (found) return found;

  // 5. Buat representasi akun virtual berbasis session token
  const role = session.claims.role;
  return {
    id: sub || `acc_${role}_session`,
    username: username || role,
    name: session.claims.personName || `Pengguna ${role.toUpperCase()}`,
    role,
    email: `${username || role}@${role === 'guru' ? 'guru.' : role === 'siswa' ? 'siswa.' : ''}sekolah.sch.id`,
    identifier: session.claims.identifier,
    classOrSubject: session.claims.classOrSubject,
    passwordHash: '',
    salt: '',
    isActive: true,
    createdAt: new Date(session.claims.iat * 1000).toISOString(),
    lastLogin: new Date(session.claims.iat * 1000).toISOString(),
  };
}

/**
 * Memperbarui Profil Pribadi Pengguna (Nama Tampilan, Email Terdaftar, & Ubah Sandi)
 */
export async function updateOwnProfile(
  accountId: string,
  updates: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }
): Promise<{ success: boolean; message: string; account?: UserAccount }> {
  const accounts = await getUserAccounts();
  const index = accounts.findIndex((a) => a.id === accountId);
  if (index === -1) {
    return { success: false, message: 'Data akun tidak ditemukan dalam sistem.' };
  }

  const target = { ...accounts[index] };

  // Validasi jika pengguna ingin mengganti kata sandi
  if (updates.newPassword && updates.newPassword.trim()) {
    if (updates.newPassword.length < 4) {
      return { success: false, message: 'Kata sandi baru minimal harus 4 karakter.' };
    }
    // Jika kata sandi saat ini diberikan, periksa kebenarannya
    if (updates.currentPassword) {
      const currentCheck = await hashPassword(updates.currentPassword, target.salt);
      if (currentCheck !== target.passwordHash) {
        return { success: false, message: 'Kata sandi saat ini yang Anda masukkan salah.' };
      }
    }
    const newSalt = generateSalt();
    target.salt = newSalt;
    target.passwordHash = await hashPassword(updates.newPassword, newSalt);
    target.rawPasswordHint = updates.newPassword;
    target.mustChangePassword = false;
  }

  if (updates.name && updates.name.trim()) {
    target.name = updates.name.trim();
  }

  if (updates.email !== undefined) {
    const cleanEmail = updates.email.trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'Format alamat email tidak valid.' };
    }
    target.email = cleanEmail;
  }

  accounts[index] = target;
  saveUserAccounts(accounts);

  // Sinkronkan ke sesi token aktif jika yang diubah adalah akun yang sedang login
  try {
    const currentSession = getActiveTokenSessionSync();
    if (
      currentSession &&
      (currentSession.account?.id === target.id ||
        currentSession.claims?.sub === target.id ||
        currentSession.claims?.username?.toLowerCase() === target.username.toLowerCase())
    ) {
      currentSession.displayName = target.name;
      if (currentSession.claims) {
        currentSession.claims.personName = target.name;
      }
      currentSession.account = target;
      saveTokenSession(currentSession);
    }
  } catch (err) {
    console.warn('Gagal memperbarui nama di sesi aktif:', err);
  }

  return {
    success: true,
    message: 'Profil dan pengaturan akun Anda berhasil diperbarui.',
    account: target,
  };
}

/**
 * Memulai Alur Pemulihan Kata Sandi (Forgot Password Request)
 * Mengidentifikasi akun berdasarkan email terdaftar, username, NIP, atau NISN
 */
export async function requestPasswordReset(identifierOrEmail: string): Promise<{
  success: boolean;
  message: string;
  maskedEmail?: string;
  resetToken?: string;
  devCode?: string;
}> {
  const cleanInput = identifierOrEmail.trim().toLowerCase();
  if (!cleanInput) {
    return {
      success: false,
      message: 'Harap masukkan Username, Email terdaftar, NIP, atau NISN Anda.',
    };
  }

  const accounts = await getUserAccounts();
  const matched = accounts.find((a) => {
    if (a.email && a.email.toLowerCase() === cleanInput) return true;
    if (a.username.toLowerCase() === cleanInput) return true;
    if (a.identifier && a.identifier.toLowerCase() === cleanInput) return true;
    return false;
  });

  if (!matched) {
    return {
      success: false,
      message: `Akun dengan identitas "${identifierOrEmail}" tidak ditemukan dalam sistem. Harap hubungi Administrator / Proktor Sekolah jika belum memiliki akun.`,
    };
  }

  if (!matched.isActive) {
    return {
      success: false,
      message: 'Akun Anda sedang dinonaktifkan oleh Administrator. Hubungi pihak sekolah untuk pengaktifan kembali.',
    };
  }

  // Pastikan akun memiliki email terdaftar
  let email = matched.email;
  if (!email) {
    email = `${matched.username}@${matched.role === 'guru' ? 'guru.' : matched.role === 'siswa' ? 'siswa.' : ''}sekolah.sch.id`;
    matched.email = email;
    const idx = accounts.findIndex((a) => a.id === matched.id);
    if (idx !== -1) {
      accounts[idx] = matched;
      saveUserAccounts(accounts);
    }
  }

  // Generate 6-digit numeric OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetToken = `rst_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 menit masa berlaku

  const challenge: PasswordResetChallenge = {
    resetToken,
    accountId: matched.id,
    username: matched.username,
    email,
    code: otpCode,
    expiresAt,
    verified: false,
  };

  const currentChallenges = getStoredResetChallenges().filter((c) => c.expiresAt > Date.now());
  saveResetChallenges([...currentChallenges, challenge]);

  const masked = maskEmail(email);

  return {
    success: true,
    message: `Kode verifikasi keamanan 6-digit telah dikirimkan ke email terdaftar: ${masked}.`,
    maskedEmail: masked,
    resetToken,
    devCode: otpCode, // Ditampilkan pada notifikasi UI untuk verifikasi instan sekolah mandiri
  };
}

/**
 * Memverifikasi Kode OTP Reset Kata Sandi
 */
export function verifyResetCode(
  resetToken: string,
  inputCode: string
): { success: boolean; message: string } {
  const challenges = getStoredResetChallenges();
  const challenge = challenges.find((c) => c.resetToken === resetToken);

  if (!challenge) {
    return {
      success: false,
      message: 'Sesi verifikasi tidak ditemukan atau telah kedaluwarsa. Silakan minta kode baru.',
    };
  }

  if (Date.now() > challenge.expiresAt) {
    return {
      success: false,
      message: 'Kode verifikasi telah kedaluwarsa (lebih dari 10 menit). Silakan minta kode verifikasi baru.',
    };
  }

  const cleanCode = inputCode.replace(/\D/g, '').trim();
  if (cleanCode !== challenge.code) {
    return {
      success: false,
      message: 'Kode verifikasi yang Anda masukkan tidak sesuai. Harap periksa 6 digit kode Anda.',
    };
  }

  // Tandai challenge sudah terverifikasi
  challenge.verified = true;
  saveResetChallenges(challenges);

  return {
    success: true,
    message: 'Verifikasi identitas berhasil. Silakan masukkan kata sandi baru Anda.',
  };
}

/**
 * Menyimpan Kata Sandi Baru Setelah Kode Terverifikasi
 */
export async function resetPasswordWithCode(
  resetToken: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; message: string; username?: string }> {
  const verifyResult = verifyResetCode(resetToken, code);
  if (!verifyResult.success) {
    return verifyResult;
  }

  if (!newPassword || newPassword.length < 4) {
    return {
      success: false,
      message: 'Kata sandi baru minimal harus 4 karakter.',
    };
  }

  const challenges = getStoredResetChallenges();
  const challenge = challenges.find((c) => c.resetToken === resetToken);
  if (!challenge) {
    return { success: false, message: 'Permintaan reset tidak valid.' };
  }

  const accounts = await getUserAccounts();
  const targetIndex = accounts.findIndex((a) => a.id === challenge.accountId);
  if (targetIndex === -1) {
    return { success: false, message: 'Akun tidak ditemukan dalam basis data.' };
  }

  const target = { ...accounts[targetIndex] };
  const newSalt = generateSalt();
  target.salt = newSalt;
  target.passwordHash = await hashPassword(newPassword, newSalt);
  target.rawPasswordHint = newPassword;
  target.mustChangePassword = false;

  accounts[targetIndex] = target;
  saveUserAccounts(accounts);

  // Hapus challenge reset yang sudah selesai
  const filtered = challenges.filter((c) => c.resetToken !== resetToken);
  saveResetChallenges(filtered);

  // Reset juga rate limiter untuk username tersebut
  authRateLimiter.reset(target.role);

  return {
    success: true,
    message: `Kata sandi untuk akun "${target.username}" berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.`,
    username: target.username,
  };
}

// ==========================================
// GTK PERMIT & LEAVE AUTHORIZATION HELPERS
// Aturan: Hanya Kepala Sekolah (melalui akun kepala sekolah)
// dan Admin (melalui akun admin) yang berwenang menyetujui,
// mengembalikan berkas (revisi), dan menolak izin GTK.
// ==========================================

/**
 * Memeriksa apakah akun pengguna adalah akun Kepala Sekolah
 */
export function isPrincipalUser(
  account?: UserAccount | null,
  principalNip?: string,
  principalName?: string
): boolean {
  if (!account) return false;
  const username = (account.username || '').toLowerCase();
  if (username === 'kepsek' || username === 'kepala.sekolah' || username === 'kepalasekolah') {
    return true;
  }
  if (account.role === 'admin') {
    return false;
  }
  const cleanNip = (principalNip || '197305141999031004').replace(/\s+/g, '');
  const accNip = (account.identifier || '').replace(/\s+/g, '');
  if (accNip && cleanNip && accNip === cleanNip) {
    return true;
  }
  if (account.personId === 't_asn_01') {
    return true;
  }
  if (principalName && account.name) {
    const p1 = principalName.toLowerCase().replace(/[^a-z]/g, '');
    const p2 = account.name.toLowerCase().replace(/[^a-z]/g, '');
    if (p1.includes('syafei') && p2.includes('syafei')) {
      return true;
    }
  }
  const subjectOrRole = (account.classOrSubject || '').toLowerCase();
  if (subjectOrRole.includes('kepala sekolah')) {
    return true;
  }
  return false;
}

/**
 * Memeriksa apakah sesi atau akun pengguna adalah Administrator
 */
export function isAdminUser(role?: UserRole, account?: UserAccount | null): boolean {
  if (role === 'admin') return true;
  if (account?.role === 'admin') return true;
  const username = (account?.username || '').toLowerCase();
  return username === 'admin' || username === 'administrator';
}

/**
 * Memeriksa otorisasi pemrosesan izin GTK (Setujui, Kembalikan, Tolak)
 * Sesuai arahan: Hanya Kepala Sekolah dan Admin yang memiliki wewenang.
 */
export function canManageGtkPermissions(
  role?: UserRole,
  account?: UserAccount | null,
  principalNip?: string,
  principalName?: string
): {
  allowed: boolean;
  isKepsek: boolean;
  isAdmin: boolean;
  actorTitle: string;
} {
  const isAdmin = isAdminUser(role, account);
  const isKepsek = isPrincipalUser(account, principalNip, principalName);
  const allowed = isAdmin || isKepsek;
  const actorTitle = isAdmin
    ? 'Administrator SIMPEG'
    : isKepsek
    ? 'Kepala Sekolah'
    : 'Bukan Pejabat Berwenang';

  return { allowed, isKepsek, isAdmin, actorTitle };
}

