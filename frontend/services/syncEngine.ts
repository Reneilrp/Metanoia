import NetInfo from '@react-native-community/netinfo';
import { apiRequest, getAuthToken } from './apiClient';
import {
  getDirtyRecords,
  getLastSyncedAt,
  markRecordsSynced,
  mergeServerDeltas,
  setLastSyncedAt,
} from './localStorage';

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  error?: string;
  timestamp: string;
}

export async function isNetworkConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function executeSync(): Promise<SyncResult> {
  const token = await getAuthToken();
  const timestamp = new Date().toISOString();

  if (!token) {
    return {
      success: false,
      pushedCount: 0,
      pulledCount: 0,
      error: 'Not logged in. Sign in to sync with cloud.',
      timestamp,
    };
  }

  const online = await isNetworkConnected();
  if (!online) {
    return {
      success: false,
      pushedCount: 0,
      pulledCount: 0,
      error: 'Device is offline. Changes will sync automatically when reconnected.',
      timestamp,
    };
  }

  try {
    // 1. PUSH: Collect dirty records
    const dirty = await getDirtyRecords();
    let pushedCount = 0;

    if (dirty.hasChanges) {
      const pushPayload = {
        habits: dirty.habits.map((h) => ({
          id: h.id,
          name: h.name,
          description: h.description,
          color: h.color,
          icon: h.icon,
          frequencyType: h.frequencyType,
          targetCount: h.targetCount,
          version: h.version,
          archivedAt: h.archivedAt,
          deletedAt: h.deletedAt,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        })),
        habitCompletions: dirty.habitCompletions.map((c) => ({
          id: c.id,
          habitId: c.habitId,
          completedDate: c.completedDate,
          value: c.value,
          notes: c.notes,
          deletedAt: c.deletedAt,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      };

      await apiRequest('/sync/push', {
        method: 'POST',
        body: JSON.stringify(pushPayload),
      });

      // Mark local records as synced
      await markRecordsSynced(
        dirty.habits.map((h) => h.id),
        dirty.habitCompletions.map((c) => c.id),
      );
      pushedCount = dirty.habits.length + dirty.habitCompletions.length;
    }

    // 2. PULL: Fetch server deltas since last sync
    const lastSynced = await getLastSyncedAt();
    const pullUrl = lastSynced ? `/sync/pull?since=${encodeURIComponent(lastSynced)}` : '/sync/pull';

    const serverDeltas = await apiRequest(pullUrl, {
      method: 'GET',
    });

    // Merge changes into local store
    await mergeServerDeltas(serverDeltas);
    await setLastSyncedAt(serverDeltas.syncedAt || timestamp);

    const pulledCount =
      (serverDeltas.habits?.length || 0) +
      (serverDeltas.habitCompletions?.length || 0) +
      (serverDeltas.reflections?.length || 0);

    return {
      success: true,
      pushedCount,
      pulledCount,
      timestamp,
    };
  } catch (error: any) {
    return {
      success: false,
      pushedCount: 0,
      pulledCount: 0,
      error: error?.message || 'Sync failed',
      timestamp,
    };
  }
}
