import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserBox } from './database.types';
import { Transaction } from './database.types';
import { decryptJson, encryptJson } from './secureCrypto';

const OFFLINE_QUEUE_KEY = '@skarbonka/offline_queue';
const CACHE_BOXES_KEY = '@skarbonka/cache_boxes';
const CACHE_TRANSACTIONS_KEY = '@skarbonka/cache_transactions';

export type OfflineQueueItem = {
  action: 'add' | 'withdraw';
  boxId: string;
  amount: number;
  note?: string | null;
  date: string;
};

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    try {
      const decrypted = await decryptJson<OfflineQueueItem[]>(raw);
      return Array.isArray(decrypted) ? decrypted : [];
    } catch {
      // Backward compatibility: fall back to legacy unencrypted JSON payload.
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    return [];
  }
}

export async function setOfflineQueue(queue: OfflineQueueItem[]): Promise<void> {
  const cipher = await encryptJson(queue);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, cipher);
}

export async function addToOfflineQueue(item: OfflineQueueItem): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push(item);
  await setOfflineQueue(queue);
}

export async function getCachedBoxes(): Promise<UserBox[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_BOXES_KEY);
    if (!raw) return null;
    try {
      const decrypted = await decryptJson<UserBox[]>(raw);
      return Array.isArray(decrypted) ? decrypted : null;
    } catch {
      // Backward compatibility: legacy unencrypted payload.
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    }
  } catch {
    return null;
  }
}

export async function setCachedBoxes(boxes: UserBox[]): Promise<void> {
  const cipher = await encryptJson(boxes);
  await AsyncStorage.setItem(CACHE_BOXES_KEY, cipher);
}

export async function getCachedTransactions(): Promise<Transaction[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_TRANSACTIONS_KEY);
    if (!raw) return null;
    try {
      const decrypted = await decryptJson<Transaction[]>(raw);
      return Array.isArray(decrypted) ? decrypted : null;
    } catch {
      // Backward compatibility: legacy unencrypted payload.
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    }
  } catch {
    return null;
  }
}

export async function setCachedTransactions(transactions: Transaction[]): Promise<void> {
  const cipher = await encryptJson(transactions);
  await AsyncStorage.setItem(CACHE_TRANSACTIONS_KEY, cipher);
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  const code = (err as { code?: string }).code;
  return (
    !!msg &&
    (msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('network request failed') ||
      code === 'ECONNABORTED' ||
      code === 'ERR_NETWORK')
  );
}
