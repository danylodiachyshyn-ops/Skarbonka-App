import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserBox } from './database.types';
import { Transaction } from './database.types';

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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setOfflineQueue(queue: OfflineQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setCachedBoxes(boxes: UserBox[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_BOXES_KEY, JSON.stringify(boxes));
}

export async function getCachedTransactions(): Promise<Transaction[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_TRANSACTIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setCachedTransactions(transactions: Transaction[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_TRANSACTIONS_KEY, JSON.stringify(transactions));
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
