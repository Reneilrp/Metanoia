import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SyncPushDto } from './dto/sync-push.dto.js';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async push(userId: string, dto: SyncPushDto) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Process Habits
      if (dto.habits && dto.habits.length > 0) {
        const habitIds = dto.habits.map((h) => h.id);
        const existingHabits = await tx.habit.findMany({
          where: { id: { in: habitIds } },
        });
        const existingMap = new Map(existingHabits.map((h) => [h.id, h]));

        const toCreate: any[] = [];
        const toUpdate: Array<{ id: string; data: any }> = [];

        for (const habit of dto.habits) {
          const existing = existingMap.get(habit.id);
          const clientUpdatedAt = habit.updatedAt ? new Date(habit.updatedAt) : now;
          const clientCreatedAt = habit.createdAt ? new Date(habit.createdAt) : now;
          const archivedAt = habit.archivedAt ? new Date(habit.archivedAt) : null;
          const deletedAt = habit.deletedAt ? new Date(habit.deletedAt) : null;

          if (!existing) {
            toCreate.push({
              id: habit.id,
              userId,
              name: habit.name,
              description: habit.description || null,
              color: habit.color || '#6366f1',
              icon: habit.icon || 'star',
              frequencyType: habit.frequencyType || 'daily',
              targetCount: habit.targetCount || 1,
              version: habit.version || 1,
              archivedAt,
              deletedAt,
              createdAt: clientCreatedAt,
              updatedAt: clientUpdatedAt,
            });
          } else if (existing.userId === userId) {
            // Last-Write-Wins: only apply if incoming change is newer or higher version
            if (!existing.updatedAt || clientUpdatedAt >= existing.updatedAt) {
              toUpdate.push({
                id: habit.id,
                data: {
                  name: habit.name,
                  description: habit.description ?? existing.description,
                  color: habit.color ?? existing.color,
                  icon: habit.icon ?? existing.icon,
                  frequencyType: habit.frequencyType ?? existing.frequencyType,
                  targetCount: habit.targetCount ?? existing.targetCount,
                  version: Math.max(existing.version + 1, habit.version || 1),
                  archivedAt: archivedAt ?? existing.archivedAt,
                  deletedAt: deletedAt ?? existing.deletedAt,
                  updatedAt: clientUpdatedAt,
                },
              });
            }
          }
        }

        if (toCreate.length > 0) {
          await tx.habit.createMany({ data: toCreate });
        }
        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map((u) => tx.habit.update({ where: { id: u.id }, data: u.data })),
          );
        }
      }

      // 2. Process Habit Completions
      if (dto.habitCompletions && dto.habitCompletions.length > 0) {
        await Promise.all(
          dto.habitCompletions.map((completion) => {
            const clientUpdatedAt = completion.updatedAt ? new Date(completion.updatedAt) : now;
            const clientCreatedAt = completion.createdAt ? new Date(completion.createdAt) : now;
            const deletedAt = completion.deletedAt ? new Date(completion.deletedAt) : null;

            return tx.habitCompletion.upsert({
              where: {
                habitId_completedDate: {
                  habitId: completion.habitId,
                  completedDate: completion.completedDate,
                },
              },
              create: {
                id: completion.id,
                habitId: completion.habitId,
                userId,
                completedDate: completion.completedDate,
                value: completion.value ?? 1,
                notes: completion.notes || null,
                deletedAt,
                createdAt: clientCreatedAt,
                updatedAt: clientUpdatedAt,
              },
              update: {
                value: completion.value ?? 1,
                notes: completion.notes ?? undefined,
                deletedAt,
                updatedAt: clientUpdatedAt,
              },
            });
          }),
        );
      }

      // 3. Process Reflections
      if (dto.reflections && dto.reflections.length > 0) {
        await Promise.all(
          dto.reflections.map((reflection) => {
            const clientUpdatedAt = reflection.updatedAt ? new Date(reflection.updatedAt) : now;
            const clientCreatedAt = reflection.createdAt ? new Date(reflection.createdAt) : now;
            const deletedAt = reflection.deletedAt ? new Date(reflection.deletedAt) : null;

            return tx.reflection.upsert({
              where: { id: reflection.id },
              create: {
                id: reflection.id,
                userId,
                title: reflection.title || null,
                content: reflection.content,
                moodRating: reflection.moodRating ?? null,
                audioFileUrl: reflection.audioFileUrl || null,
                deletedAt,
                createdAt: clientCreatedAt,
                updatedAt: clientUpdatedAt,
              },
              update: {
                title: reflection.title ?? undefined,
                content: reflection.content,
                moodRating: reflection.moodRating ?? undefined,
                audioFileUrl: reflection.audioFileUrl ?? undefined,
                deletedAt,
                updatedAt: clientUpdatedAt,
              },
            });
          }),
        );
      }

      // 4. Process Tombstones (Explicit Deletions)
      if (dto.tombstones && dto.tombstones.length > 0) {
        const tombstoneData = dto.tombstones.map((tombstone) => ({
          userId,
          tableName: tombstone.tableName,
          recordId: tombstone.recordId,
          deletedAt: tombstone.deletedAt ? new Date(tombstone.deletedAt) : now,
        }));

        await tx.syncTombstone.createMany({ data: tombstoneData });

        await Promise.all(
          dto.tombstones.map((tombstone) => {
            const deletedAt = tombstone.deletedAt ? new Date(tombstone.deletedAt) : now;
            if (tombstone.tableName === 'habits') {
              return tx.habit.updateMany({
                where: { id: tombstone.recordId, userId },
                data: { deletedAt, updatedAt: now },
              });
            } else if (tombstone.tableName === 'habit_completions') {
              return tx.habitCompletion.updateMany({
                where: { id: tombstone.recordId, userId },
                data: { deletedAt, updatedAt: now },
              });
            } else if (tombstone.tableName === 'reflections') {
              return tx.reflection.updateMany({
                where: { id: tombstone.recordId, userId },
                data: { deletedAt, updatedAt: now },
              });
            }
            return Promise.resolve();
          }),
        );
      }

      return {
        success: true,
        processedAt: now.toISOString(),
      };
    });
  }

  async pull(userId: string, since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    const now = new Date();

    const [habits, habitCompletions, reflections, tombstones] = await Promise.all([
      this.prisma.habit.findMany({
        where: {
          userId,
          updatedAt: { gt: sinceDate },
        },
      }),
      this.prisma.habitCompletion.findMany({
        where: {
          userId,
          updatedAt: { gt: sinceDate },
        },
      }),
      this.prisma.reflection.findMany({
        where: {
          userId,
          updatedAt: { gt: sinceDate },
        },
      }),
      this.prisma.syncTombstone.findMany({
        where: {
          userId,
          deletedAt: { gt: sinceDate },
        },
      }),
    ]);

    return {
      habits,
      habitCompletions,
      reflections,
      tombstones,
      syncedAt: now.toISOString(),
    };
  }

  async getSyncStatus(userId: string) {
    const [totalHabits, totalCompletions, totalReflections] = await Promise.all([
      this.prisma.habit.count({ where: { userId, deletedAt: null } }),
      this.prisma.habitCompletion.count({ where: { userId, deletedAt: null } }),
      this.prisma.reflection.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      userId,
      counts: {
        habits: totalHabits,
        completions: totalCompletions,
        reflections: totalReflections,
      },
      serverTime: new Date().toISOString(),
    };
  }
}
