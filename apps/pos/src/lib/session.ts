import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '../types/api';

const KEYS = {
  accessToken: 'yf.accessToken',
  refreshToken: 'yf.refreshToken',
  user: 'yf.user',
} as const;

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, session.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, session.refreshToken),
    AsyncStorage.setItem(KEYS.user, JSON.stringify(session.user)),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    AsyncStorage.getItem(KEYS.user),
  ]);

  if (!accessToken || !refreshToken || !userJson) return null;

  try {
    const user = JSON.parse(userJson) as UserProfile;
    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
    AsyncStorage.removeItem(KEYS.user),
  ]);
}
