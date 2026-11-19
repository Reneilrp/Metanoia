import { describe, it, expect, vi } from 'vitest';
import { HabitsService } from './habits.service.js';

describe('HabitsService: Streak Calculation Unit Tests', () => {
  it('1. should calculate active streaks accurately when completed today', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgoStr = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

    const mockPrisma: any = {
      habit: {
        findMany: vi.fn(async () => [
          {
            id: 'h1',
            name: 'Daily Meditation',
            completions: [
              { completedDate: todayStr, deletedAt: null },
              { completedDate: yesterdayStr, deletedAt: null },
              { completedDate: twoDaysAgoStr, deletedAt: null },
            ],
          },
        ]),
      },
    };

    const service = new HabitsService(mockPrisma);
    const stats = await service.getStreakStats('user-1');

    expect(stats.habitsCount).toBe(1);
    expect(stats.maxCurrentStreak).toBe(3);
    expect(stats.totalCompletionsAll).toBe(3);
    expect(stats.habitStreaks[0].currentStreak).toBe(3);
  });

  it('2. should calculate streak as 0 when last completion was > 1 day ago (broken streak)', async () => {
    const threeDaysAgoStr = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

    const mockPrisma: any = {
      habit: {
        findMany: vi.fn(async () => [
          {
            id: 'h2',
            name: 'Gym Workout',
            completions: [{ completedDate: threeDaysAgoStr, deletedAt: null }],
          },
        ]),
      },
    };

    const service = new HabitsService(mockPrisma);
    const stats = await service.getStreakStats('user-1');

    expect(stats.maxCurrentStreak).toBe(0);
    expect(stats.habitStreaks[0].currentStreak).toBe(0);
    expect(stats.totalCompletionsAll).toBe(1);
  });

  it('3. should count streak starting from yesterday if not yet checked in today', async () => {
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgoStr = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

    const mockPrisma: any = {
      habit: {
        findMany: vi.fn(async () => [
          {
            id: 'h3',
            name: 'Hydration',
            completions: [
              { completedDate: yesterdayStr, deletedAt: null },
              { completedDate: twoDaysAgoStr, deletedAt: null },
            ],
          },
        ]),
      },
    };

    const service = new HabitsService(mockPrisma);
    const stats = await service.getStreakStats('user-1');

    expect(stats.maxCurrentStreak).toBe(2);
    expect(stats.habitStreaks[0].currentStreak).toBe(2);
  });
});
