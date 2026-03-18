import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_STORAGE_KEY = 'skarbonka_crypto_encryption_key_v1';

let cachedKey: string | null = null;

async function getOrCreateEncryptionKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) {
    cachedKey = existing;
    return existing;
  }

  // Random 256-bit key, stored as Base64 string.
  const keyBytes = CryptoJS.lib.WordArray.random(32);
  const key = CryptoJS.enc.Base64.stringify(keyBytes);
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, key);
  cachedKey = key;
  return key;
}

export async function encryptJson<T>(value: T): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const plaintext = JSON.stringify(value);
  return CryptoJS.AES.encrypt(plaintext, key).toString();
}

export async function decryptJson<T>(cipherText: string): Promise<T> {
  const key = await getOrCreateEncryptionKey();
  const decrypted = CryptoJS.AES.decrypt(cipherText, key).toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error('Failed to decrypt payload.');
  }
  return JSON.parse(decrypted) as T;
}

