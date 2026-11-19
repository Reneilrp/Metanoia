import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from '../services/apiClient';
import { executeSync, SyncResult } from '../services/syncEngine';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  syncState: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncResult: SyncResult | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  triggerSync: () => Promise<SyncResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'offline' | 'error'>('idle');
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Initialize auth
  useEffect(() => {
    async function init() {
      try {
        const storedToken = await getAuthToken();
        if (storedToken) {
          setToken(storedToken);
          const profile = await apiRequest<User>('/auth/me');
          setUser(profile);
          // Perform initial sync once authenticated
          runSync();
        }
      } catch (err) {
        // Token expired or invalid
        await clearAuthToken();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Listen to network changes for auto-sync
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && token) {
        runSync();
      } else if (!state.isConnected) {
        setSyncState('offline');
      }
    });

    return () => unsubscribe();
  }, [token]);

  const runSync = async (): Promise<SyncResult> => {
    setSyncState('syncing');
    const result = await executeSync();
    setLastSyncResult(result);
    if (result.success) {
      setSyncState('synced');
    } else if (result.error?.toLowerCase().includes('offline')) {
      setSyncState('offline');
    } else {
      setSyncState('error');
    }
    return result;
  };

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await setAuthToken(data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    await runSync();
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const data = await apiRequest<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });

    await setAuthToken(data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    await runSync();
  };

  const logout = async () => {
    await clearAuthToken();
    setToken(null);
    setUser(null);
    setSyncState('idle');
    setLastSyncResult(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        syncState,
        lastSyncResult,
        login,
        register,
        logout,
        triggerSync: runSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
