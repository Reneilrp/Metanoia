import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
}));

vi.mock('../apiClient', () => ({
  getAuthToken: vi.fn(async () => 'mock-jwt-token'),
  apiRequest: vi.fn(async (endpoint: string) => {
    if (endpoint === '/sync/push') {
      return { success: true, processedAt: new Date().toISOString() };
    }
    if (endpoint.startsWith('/sync/pull')) {
      return {
        habits: [],
        habitCompletions: [],
        reflections: [],
        tombstones: [],
        syncedAt: new Date().toISOString(),
      };
    }
    return {};
  }),
}));

vi.mock('../localStorage', () => ({
  getDirtyRecords: vi.fn(async () => ({
    habits: [{ id: 'h1', name: 'Test' }],
    habitCompletions: [],
    hasChanges: true,
  })),
  markRecordsSynced: vi.fn(async () => {}),
  getLastSyncedAt: vi.fn(async () => '2026-10-01T00:00:00Z'),
  setLastSyncedAt: vi.fn(async () => {}),
  mergeServerDeltas: vi.fn(async () => {}),
}));

import { executeSync, isNetworkConnected } from '../syncEngine';

describe('Frontend: SyncEngine', () => {
  it('1. should detect network connectivity correctly', async () => {
    const online = await isNetworkConnected();
    expect(online).toBe(true);
  });

  it('2. should execute push followed by pull in a single sync loop', async () => {
    const result = await executeSync();
    expect(result.success).toBe(true);
    expect(result.pushedCount).toBe(1);
    expect(result.pulledCount).toBe(0);
    expect(result).toHaveProperty('timestamp');
  });
});
