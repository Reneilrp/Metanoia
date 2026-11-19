import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted';

export interface LocalHabit {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  frequencyType: string;
  targetCount: number;
  version: number;
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _status: SyncStatus;
}

export interface LocalCompletion {
  id: string;
  habitId: string;
  completedDate: string; // YYYY-MM-DD
  value: number;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _status: SyncStatus;
}

export interface LocalReflection {
  id: string;
  title?: string;
  content: string;
  moodRating?: number;
  audioFileUrl?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _status: SyncStatus;
}

const HABITS_KEY = '@metanoia_local_habits';
const COMPLETIONS_KEY = '@metanoia_local_completions';
const REFLECTIONS_KEY = '@metanoia_local_reflections';
const LAST_SYNC_KEY = '@metanoia_last_synced_at';

export async function getLastSyncedAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

export async function setLastSyncedAt(timestamp: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
}

// Initial demo seed for a pleasant first-run experience
const DEFAULT_INITIAL_HABITS: LocalHabit[] = [
  {
    id: 'habit-seed-1',
    name: 'Morning Hydration',
    description: 'Drink 500ml of water right after waking up',
    color: '#06b6d4',
    icon: 'water',
    frequencyType: 'daily',
    targetCount: 1,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _status: 'created',
  },
  {
    id: 'habit-seed-2',
    name: '10-Min Mindfulness',
    description: 'Focus on breathing and set morning intention',
    color: '#8b5cf6',
    icon: 'sparkles',
    frequencyType: 'daily',
    targetCount: 1,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _status: 'created',
  },
  {
    id: 'habit-seed-3',
    name: 'Deep Work Sprint',
    description: '45 minutes uninterrupted focus session',
    color: '#f59e0b',
    icon: 'flame',
    frequencyType: 'daily',
    targetCount: 1,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _status: 'created',
  },
];

export async function getLocalHabits(): Promise<LocalHabit[]> {
  const json = await AsyncStorage.getItem(HABITS_KEY);
  if (!json) {
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(DEFAULT_INITIAL_HABITS));
    return DEFAULT_INITIAL_HABITS;
  }
  return JSON.parse(json);
}

export async function saveLocalHabit(habit: Partial<LocalHabit> & { name: string }): Promise<LocalHabit> {
  const habits = await getLocalHabits();
  const now = new Date().toISOString();

  let savedItem: LocalHabit;
  if (habit.id) {
    const index = habits.findIndex((h) => h.id === habit.id);
    if (index >= 0) {
      savedItem = {
        ...habits[index],
        ...habit,
        version: (habits[index].version || 1) + 1,
        updatedAt: now,
        _status: habits[index]._status === 'created' ? 'created' : 'updated',
      };
      habits[index] = savedItem;
    } else {
      savedItem = {
        id: habit.id,
        name: habit.name,
        description: habit.description || '',
        color: habit.color || '#6366f1',
        icon: habit.icon || 'star',
        frequencyType: habit.frequencyType || 'daily',
        targetCount: habit.targetCount || 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
        _status: 'created',
      };
      habits.push(savedItem);
    }
  } else {
    savedItem = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: habit.name,
      description: habit.description || '',
      color: habit.color || '#6366f1',
      icon: habit.icon || 'star',
      frequencyType: habit.frequencyType || 'daily',
      targetCount: habit.targetCount || 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
      _status: 'created',
    };
    habits.push(savedItem);
  }

  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  return savedItem;
}

export async function deleteLocalHabit(habitId: string): Promise<void> {
  const habits = await getLocalHabits();
  const updatedHabits = habits.map((h) => {
    if (h.id === habitId) {
      return {
        ...h,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _status: 'deleted' as SyncStatus,
      };
    }
    return h;
  });
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(updatedHabits));
}

export async function getLocalCompletions(): Promise<LocalCompletion[]> {
  const json = await AsyncStorage.getItem(COMPLETIONS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function toggleLocalCompletion(
  habitId: string,
  completedDate: string,
): Promise<{ isCompleted: boolean; completion: LocalCompletion | null }> {
  const completions = await getLocalCompletions();
  const now = new Date().toISOString();
  const existingIndex = completions.findIndex(
    (c) => c.habitId === habitId && c.completedDate === completedDate,
  );

  if (existingIndex >= 0) {
    const existing = completions[existingIndex];
    if (!existing.deletedAt) {
      // Toggle off
      existing.deletedAt = now;
      existing.updatedAt = now;
      existing._status = existing._status === 'created' ? 'created' : 'updated';
      await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
      return { isCompleted: false, completion: existing };
    } else {
      // Un-delete / Toggle on
      existing.deletedAt = null;
      existing.updatedAt = now;
      existing._status = 'updated';
      await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
      return { isCompleted: true, completion: existing };
    }
  } else {
    // New completion
    const newCompletion: LocalCompletion = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      habitId,
      completedDate,
      value: 1,
      createdAt: now,
      updatedAt: now,
      _status: 'created',
    };
    completions.push(newCompletion);
    await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
    return { isCompleted: true, completion: newCompletion };
  }
}

export async function getDirtyRecords() {
  const habits = await getLocalHabits();
  const completions = await getLocalCompletions();

  const dirtyHabits = habits.filter((h) => h._status !== 'synced');
  const dirtyCompletions = completions.filter((c) => c._status !== 'synced');

  return {
    habits: dirtyHabits,
    habitCompletions: dirtyCompletions,
    hasChanges: dirtyHabits.length > 0 || dirtyCompletions.length > 0,
  };
}

export async function markRecordsSynced(pushedHabitIds: string[], pushedCompletionIds: string[]) {
  const habits = await getLocalHabits();
  const habitSet = new Set(pushedHabitIds);
  const updatedHabits = habits.map((h) => {
    if (habitSet.has(h.id)) {
      return { ...h, _status: 'synced' as SyncStatus };
    }
    return h;
  });
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(updatedHabits));

  const completions = await getLocalCompletions();
  const compSet = new Set(pushedCompletionIds);
  const updatedCompletions = completions.map((c) => {
    if (compSet.has(c.id)) {
      return { ...c, _status: 'synced' as SyncStatus };
    }
    return c;
  });
  await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(updatedCompletions));
}

export async function mergeServerDeltas(pulledData: {
  habits: any[];
  habitCompletions: any[];
  reflections: any[];
  tombstones: any[];
}) {
  const localHabits = await getLocalHabits();
  const habitMap = new Map(localHabits.map((h) => [h.id, h]));

  for (const remote of pulledData.habits) {
    const local = habitMap.get(remote.id);
    if (!local || local._status === 'synced' || new Date(remote.updatedAt) >= new Date(local.updatedAt)) {
      habitMap.set(remote.id, {
        ...remote,
        _status: 'synced',
      });
    }
  }

  // Handle tombstones
  for (const tomb of pulledData.tombstones) {
    if (tomb.tableName === 'habits') {
      const target = habitMap.get(tomb.recordId);
      if (target) {
        target.deletedAt = tomb.deletedAt;
        target._status = 'synced';
      }
    }
  }

  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(Array.from(habitMap.values())));

  // Merge completions
  const localComps = await getLocalCompletions();
  const compMap = new Map(localComps.map((c) => [`${c.habitId}_${c.completedDate}`, c]));

  for (const remote of pulledData.habitCompletions) {
    const key = `${remote.habitId}_${remote.completedDate}`;
    const local = compMap.get(key);
    if (!local || local._status === 'synced' || new Date(remote.updatedAt) >= new Date(local.updatedAt)) {
      compMap.set(key, {
        ...remote,
        _status: 'synced',
      });
    }
  }

  await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(Array.from(compMap.values())));
}
