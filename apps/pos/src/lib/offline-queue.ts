import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'yf.offlineQueue';

export type MutationMethod = 'POST' | 'PATCH' | 'DELETE';

export interface PendingMutation {
  id: string;
  path: string;
  method: MutationMethod;
  body: string;
  idempotencyKey: string;
  createdAt: string;
}

async function readQueue(): Promise<PendingMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingMutation[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(mutation: Omit<PendingMutation, 'id' | 'createdAt'>): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...mutation,
    id: mutation.idempotencyKey,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function listPending(): Promise<PendingMutation[]> {
  return readQueue();
}

export async function count(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Replay scaffold — replays each mutation using the stored idempotency key.
 * Failed items (e.g. 409 oversell) are flagged but not auto-deleted.
 * Call this when the network reconnects. Not enabled in R6 — screens block
 * submits while offline and do not enqueue.
 */
export async function flushQueue(
  token: string,
  onItem: (mutation: PendingMutation, error: Error | null) => void,
): Promise<void> {
  const queue = await readQueue();
  const remaining: PendingMutation[] = [];

  for (const mutation of queue) {
    try {
      await fetch(`http://10.0.2.2:3001/v1${mutation.path}`, {
        method: mutation.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: mutation.body,
      });
      onItem(mutation, null);
    } catch (err) {
      onItem(mutation, err instanceof Error ? err : new Error(String(err)));
      remaining.push(mutation);
    }
  }

  await writeQueue(remaining);
}
