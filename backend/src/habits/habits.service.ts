import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  async getHabitsWithTodayStatus(userId: string, targetDate?: string) {
    const dateStr = targetDate || new Date().toISOString().split('T')[0];

    const habits = await this.prisma.habit.findMany({
      where: {
        userId,
        deletedAt: null,
        archivedAt: null,
      },
      include: {
        completions: {
          where: {
            completedDate: dateStr,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return habits.map((habit) => ({
      ...habit,
      isCompletedToday: habit.completions.length > 0,
      todayCompletion: habit.completions[0] || null,
    }));
  }

  async createHabit(userId: string, data: { name: string; description?: string; color?: string; icon?: string; frequencyType?: string; targetCount?: number }) {
    return this.prisma.habit.create({
      data: {
        userId,
        name: data.name,
        description: data.description || null,
        color: data.color || '#6366f1',
        icon: data.icon || 'star',
        frequencyType: data.frequencyType || 'daily',
        targetCount: data.targetCount || 1,
      },
    });
  }

  async toggleCompletion(userId: string, habitId: string, completedDate: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId, deletedAt: null },
    });

    if (!habit) {
      throw new NotFoundException('Habit not found');
    }

    const existing = await this.prisma.habitCompletion.findUnique({
      where: {
        habitId_completedDate: {
          habitId,
          completedDate,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      // Toggle off (soft delete)
      const updated = await this.prisma.habitCompletion.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), updatedAt: new Date() },
      });
      return { completed: false, record: updated };
    } else if (existing && existing.deletedAt) {
      // Un-delete
      const updated = await this.prisma.habitCompletion.update({
        where: { id: existing.id },
        data: { deletedAt: null, updatedAt: new Date() },
      });
      return { completed: true, record: updated };
    } else {
      // Create new completion
      const created = await this.prisma.habitCompletion.create({
        data: {
          habitId,
          userId,
          completedDate,
          value: 1,
        },
      });
      return { completed: true, record: created };
    }
  }

  async getStreakStats(userId: string) {
    const habits = await this.prisma.habit.findMany({
      where: { userId, deletedAt: null },
      include: {
        completions: {
          where: { deletedAt: null },
          orderBy: { completedDate: 'desc' },
        },
      },
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const habitStreaks = habits.map((habit) => {
      const dates = new Set(habit.completions.map((c) => c.completedDate));
      let currentStreak = 0;
      let checkDate = new Date();

      // Check today or yesterday as streak start
      if (!dates.has(todayStr) && !dates.has(yesterday)) {
        currentStreak = 0;
      } else {
        if (!dates.has(todayStr)) {
          // If not completed today, start counting from yesterday
          checkDate = new Date(Date.now() - 86400000);
        }

        while (true) {
          const dateString = checkDate.toISOString().split('T')[0];
          if (dates.has(dateString)) {
            currentStreak++;
            checkDate = new Date(checkDate.getTime() - 86400000);
          } else {
            break;
          }
        }
      }

      return {
        habitId: habit.id,
        habitName: habit.name,
        currentStreak,
        totalCompletions: habit.completions.length,
      };
    });

    const maxCurrentStreak = habitStreaks.length > 0 ? Math.max(...habitStreaks.map((s) => s.currentStreak)) : 0;
    const totalCompletionsAll = habitStreaks.reduce((acc, h) => acc + h.totalCompletions, 0);

    return {
      habitsCount: habits.length,
      maxCurrentStreak,
      totalCompletionsAll,
      habitStreaks,
    };
  }
}
