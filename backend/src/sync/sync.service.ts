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
        for (const habit of dto.habits) {
          const existing = await tx.habit.findUnique({
            where: { id: habit.id },
          });

          const clientUpdatedAt = habit.updatedAt ? new Date(habit.updatedAt) : now;
          const clientCreatedAt = habit.createdAt ? new Date(habit.createdAt) : now;
          const archivedAt = habit.archivedAt ? new Date(habit.archivedAt) : null;
          const deletedAt = habit.deletedAt ? new Date(habit.deletedAt) : null;

          if (!existing) {
            await tx.habit.create({
              data: {
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
              },
            });
          } else if (existing.userId === userId) {
            // Last-Write-Wins: only apply if incoming change is newer or higher version
            if (!existing.updatedAt || clientUpdatedAt >= existing.updatedAt) {
              await tx.habit.update({
                where: { id: habit.id },
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
      }

      // 2. Process Habit Completions
      if (dto.habitCompletions && dto.habitCompletions.length > 0) {
        for (const completion of dto.habitCompletions) {
          const clientUpdatedAt = completion.updatedAt ? new Date(completion.updatedAt) : now;
          const clientCreatedAt = completion.createdAt ? new Date(completion.createdAt) : now;
          const deletedAt = completion.deletedAt ? new Date(completion.deletedAt) : null;

          await tx.habitCompletion.upsert({
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
        }
      }

      // 3. Process Reflections
      if (dto.reflections && dto.reflections.length > 0) {
        for (const reflection of dto.reflections) {
          const clientUpdatedAt = reflection.updatedAt ? new Date(reflection.updatedAt) : now;
          const clientCreatedAt = reflection.createdAt ? new Date(reflection.createdAt) : now;
          const deletedAt = reflection.deletedAt ? new Date(reflection.deletedAt) : null;

          await tx.reflection.upsert({
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
        }
      }

      // 4. Process Tombstones (Explicit Deletions)
      if (dto.tombstones && dto.tombstones.length > 0) {
        for (const tombstone of dto.tombstones) {
          const deletedAt = tombstone.deletedAt ? new Date(tombstone.deletedAt) : now;

          await tx.syncTombstone.create({
            data: {
              userId,
              tableName: tombstone.tableName,
              recordId: tombstone.recordId,
              deletedAt,
            },
          });

          // Soft delete corresponding record
          if (tombstone.tableName === 'habits') {
            await tx.habit.updateMany({
              where: { id: tombstone.recordId, userId },
              data: { deletedAt, updatedAt: now },
            });
          } else if (tombstone.tableName === 'habit_completions') {
            await tx.habitCompletion.updateMany({
              where: { id: tombstone.recordId, userId },
              data: { deletedAt, updatedAt: now },
            });
          } else if (tombstone.tableName === 'reflections') {
            await tx.reflection.updateMany({
              where: { id: tombstone.recordId, userId },
              data: { deletedAt, updatedAt: now },
            });
          }
        }
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
