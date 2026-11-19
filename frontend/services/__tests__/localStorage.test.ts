import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory mock for AsyncStorage
const memoryStore = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => memoryStore.get(key) || null),
    setItem: vi.fn(async (key: string, value: string) => {
      memoryStore.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      memoryStore.delete(key);
    }),
    clear: vi.fn(async () => {
      memoryStore.clear();
    }),
  },
}));

import {
  getLocalHabits,
  saveLocalHabit,
  toggleLocalCompletion,
  getLocalCompletions,
  getDirtyRecords,
  markRecordsSynced,
  mergeServerDeltas,
} from '../localStorage';

describe('Frontend: LocalStorage & Offline Engine', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('1. should seed default initial habits if storage is empty', async () => {
    const habits = await getLocalHabits();
    expect(habits.length).toBeGreaterThanOrEqual(3);
    expect(habits[0]).toHaveProperty('name');
    expect(habits[0]._status).toBe('created');
  });

  it('2. should save a new local habit with "created" status', async () => {
    const saved = await saveLocalHabit({
      name: 'Cold Shower',
      description: '2 minutes cold exposure',
      color: '#06b6d4',
      icon: 'water',
      frequencyType: 'daily',
      targetCount: 1,
    });

    expect(saved).toHaveProperty('id');
    expect(saved.name).toBe('Cold Shower');
    expect(saved._status).toBe('created');

    const all = await getLocalHabits();
    expect(all.some((h) => h.id === saved.id)).toBe(true);
  });

  it('3. should toggle habit completion and un-toggle correctly', async () => {
    const today = '2026-10-02';
    const habitId = 'test-habit-toggle';

    // 1st toggle: complete
    const toggle1 = await toggleLocalCompletion(habitId, today);
    expect(toggle1.isCompleted).toBe(true);
    expect(toggle1.completion?._status).toBe('created');

    // 2nd toggle: un-complete (soft delete)
    const toggle2 = await toggleLocalCompletion(habitId, today);
    expect(toggle2.isCompleted).toBe(false);
    expect(toggle2.completion?.deletedAt).not.toBeNull();

    // 3rd toggle: re-complete
    const toggle3 = await toggleLocalCompletion(habitId, today);
    expect(toggle3.isCompleted).toBe(true);
    expect(toggle3.completion?.deletedAt).toBeNull();
  });

  it('4. should identify dirty records pending cloud sync', async () => {
    const dirty = await getDirtyRecords();
    expect(dirty.hasChanges).toBe(true);
    expect(dirty.habits.length).toBeGreaterThan(0);
  });

  it('5. should mark pushed records as "synced"', async () => {
    const habits = await getLocalHabits();
    const habitId = habits[0].id;

    await markRecordsSynced([habitId], []);
    const updatedHabits = await getLocalHabits();
    const syncedHabit = updatedHabits.find((h) => h.id === habitId);
    expect(syncedHabit?._status).toBe('synced');
  });

  it('6. should merge server deltas and resolve conflicts using Last-Write-Wins', async () => {
    const remoteHabit = {
      id: 'remote-1',
      name: 'Read 20 Pages',
      color: '#10b981',
      icon: 'book',
      frequencyType: 'daily',
      targetCount: 1,
      version: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() + 5000).toISOString(),
    };

    await mergeServerDeltas({
      habits: [remoteHabit],
      habitCompletions: [],
      reflections: [],
      tombstones: [],
    });

    const habits = await getLocalHabits();
    const merged = habits.find((h) => h.id === 'remote-1');
    expect(merged).toBeDefined();
    expect(merged?.name).toBe('Read 20 Pages');
    expect(merged?._status).toBe('synced');
  });
});
