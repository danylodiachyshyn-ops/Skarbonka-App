import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_STORAGE_KEY = 'skarbonka_crypto_encryption_key_v1';

let cachedKey: string | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToWordArray(bytes: Uint8Array): any {
  // CryptoJS WordArray is backed by 32-bit words; create() handles the conversion.
  return CryptoJS.lib.WordArray.create(Array.from(bytes));
}

async function getSecureRandomBytes(length: number): Promise<Uint8Array> {
  // #region agent log
  const globalCryptoType = typeof (globalThis as any).crypto;
  const hasGetRandomValues =
    !!(globalThis as any).crypto && typeof (globalThis as any).crypto.getRandomValues === 'function';
  fetch('http://127.0.0.1:7486/ingest/234a9c32-f928-49a1-9752-227f085fcbe7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '85dad0' },
    body: JSON.stringify({
      sessionId: '85dad0',
      runId: 'pre-fix',
      hypothesisId: 'H4',
      location: 'src/lib/secureCrypto.ts:getSecureRandomBytes:prereq',
      message: 'RNG prerequisites',
      data: { globalCryptoType, hasGetRandomValues, requestedLength: length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // 1) Prefer expo-crypto-universal (no native AES module dependency)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const universal = await import('expo-crypto-universal');
    // API shape: getRandomBytesAsync(length) -> Uint8Array
    const bytes = await (universal as any).getRandomBytesAsync(length);
    if (bytes && typeof bytes === 'object') {
      return bytes as Uint8Array;
    }
  } catch {
    // fall through
  }

  // 2) Use WebCrypto if present
  const gcrypto = (globalThis as any).crypto;
  if (gcrypto?.getRandomValues) {
    const arr = new Uint8Array(length);
    gcrypto.getRandomValues(arr);
    return arr;
  }

  // 3) Last resort (prevents crash; not cryptographically ideal)
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

async function getOrCreateEncryptionKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  // #region agent log
  const globalCryptoType = typeof (globalThis as any).crypto;
  const hasGetRandomValues =
    !!(globalThis as any).crypto && typeof (globalThis as any).crypto.getRandomValues === 'function';
  // #endregion

  // #region agent log
  fetch('http://127.0.0.1:7486/ingest/234a9c32-f928-49a1-9752-227f085fcbe7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '85dad0' },
    body: JSON.stringify({
      sessionId: '85dad0',
      runId: 'pre-fix',
      hypothesisId: 'H1',
      location: 'src/lib/secureCrypto.ts:getOrCreateEncryptionKey:enter',
      message: 'Check secure RNG prerequisites + existing key presence',
      data: { globalCryptoType, hasGetRandomValues },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) {
    cachedKey = existing;
    return existing;
  }

  // Random 256-bit key, stored as Base64 string.
  const randomBytes = await getSecureRandomBytes(32);
  const key = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, key);
  cachedKey = key;
  return key;
}

export async function encryptJson<T>(value: T): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const keyWA = CryptoJS.enc.Hex.parse(key);
  const ivBytes = await getSecureRandomBytes(16); // 128-bit IV for AES-CBC
  const ivHex = bytesToHex(ivBytes);
  const ivWA = bytesToWordArray(ivBytes);
  const plaintext = JSON.stringify(value);

  // #region agent log
  fetch('http://127.0.0.1:7486/ingest/234a9c32-f928-49a1-9752-227f085fcbe7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '85dad0' },
    body: JSON.stringify({
      sessionId: '85dad0',
      runId: 'post-rng-fix',
      hypothesisId: 'H5',
      location: 'src/lib/secureCrypto.ts:encryptJson',
      message: 'Encrypting with explicit iv + key WordArray',
      data: { keyHexLength: key.length, ivHexLength: ivHex.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const encrypted = CryptoJS.AES.encrypt(plaintext, keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Store iv + ciphertext separately to avoid relying on CryptoJS OpenSSL formatting/salt.
  const ctB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  return JSON.stringify({ iv: ivHex, ct: ctB64 });
}

export async function decryptJson<T>(cipherText: string): Promise<T> {
  const key = await getOrCreateEncryptionKey();
  const keyWA = CryptoJS.enc.Hex.parse(key);

  const parsed = (() => {
    try {
      return JSON.parse(cipherText) as { iv?: string; ct?: string };
    } catch {
      return null;
    }
  })();

  if (!parsed?.iv || !parsed?.ct) {
    throw new Error('Unsupported cipher payload format.');
  }

  const ivWA = CryptoJS.enc.Hex.parse(parsed.iv);
  const ctWA = CryptoJS.enc.Base64.parse(parsed.ct);

  // CryptoJS expects CipherParams (ciphertext + params).
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ctWA });
  const decryptedWA = CryptoJS.AES.decrypt(cipherParams, keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const decrypted = decryptedWA.toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('Failed to decrypt payload.');
  return JSON.parse(decrypted) as T;
}

