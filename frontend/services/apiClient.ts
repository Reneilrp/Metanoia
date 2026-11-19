import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// In Android emulator, 10.0.2.2 points to host machine localhost. On iOS simulator/web, localhost works.
const DEFAULT_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3000/api/v1',
  default: 'http://localhost:3000/api/v1',
});

const TOKEN_KEY = '@metanoia_auth_token';
const SERVER_URL_KEY = '@metanoia_server_url';

export async function getBaseUrl(): Promise<string> {
  const customUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
  return customUrl || DEFAULT_BASE_URL;
}

export async function setBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = await getBaseUrl();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}
