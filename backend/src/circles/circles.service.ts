import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCircleDto, JoinCircleDto, SendReactionDto } from './dto/create-circle.dto.js';

@Injectable()
export class CirclesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCircle(userId: string, dto: CreateCircleDto) {
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const circle = await this.prisma.circle.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        inviteCode,
        createdById: userId,
        members: {
          create: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return circle;
  }

  async joinCircle(userId: string, dto: JoinCircleDto) {
    const circle = await this.prisma.circle.findUnique({
      where: { inviteCode: dto.inviteCode.trim().toUpperCase() },
    });

    if (!circle) {
      throw new NotFoundException('Circle not found with this invite code');
    }

    const existingMember = await this.prisma.circleMember.findUnique({
      where: {
        circleId_userId: {
          circleId: circle.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this Circle');
    }

    const membership = await this.prisma.circleMember.create({
      data: {
        circleId: circle.id,
        userId,
      },
      include: {
        circle: true,
      },
    });

    return membership;
  }

  async getUserCircles(userId: string) {
    const memberships = await this.prisma.circleMember.findMany({
      where: { userId },
      include: {
        circle: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
            reactions: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Enrich circles with member milestone counts
    const enriched = await Promise.all(
      memberships.map(async (m) => {
        const memberIds = m.circle.members.map((mem) => mem.userId);

        const completionsToday = await this.prisma.habitCompletion.findMany({
          where: {
            userId: { in: memberIds },
            completedDate: todayStr,
            deletedAt: null,
          },
        });

        const countsByUser = new Map<string, number>();
        for (const c of completionsToday) {
          countsByUser.set(c.userId, (countsByUser.get(c.userId) || 0) + 1);
        }

        return {
          ...m.circle,
          members: m.circle.members.map((mem) => ({
            ...mem.user,
            completionsToday: countsByUser.get(mem.userId) || 0,
          })),
        };
      }),
    );

    return enriched;
  }

  async sendReaction(senderId: string, dto: SendReactionDto) {
    const isMember = await this.prisma.circleMember.findUnique({
      where: {
        circleId_userId: {
          circleId: dto.circleId,
          userId: senderId,
        },
      },
    });

    if (!isMember) {
      throw new BadRequestException('You must be a member of this Circle to send reactions');
    }

    return this.prisma.circleReaction.create({
      data: {
        circleId: dto.circleId,
        senderId,
        receiverId: dto.receiverId,
        emoji: dto.emoji,
      },
    });
  }
}
