import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPro = user.subscriptionTier === 'pro_monthly' || user.subscriptionTier === 'pro_annual';

    return {
      tier: user.subscriptionTier,
      isPro,
      expiresAt: user.subscriptionExpiresAt,
      entitlements: {
        maxHabits: isPro ? 999 : 5,
        aiCoachChatUnlocked: isPro,
        voiceJournalingUnlocked: isPro,
        audioBriefingsUnlocked: isPro,
        unlimitedCloudSync: isPro,
        accountabilityCirclesUnlocked: isPro,
      },
    };
  }

  async upgradePro(userId: string, tier: 'pro_monthly' | 'pro_annual' = 'pro_monthly') {
    const daysToAdd = tier === 'pro_annual' ? 365 : 30;
    const expiresAt = new Date(Date.now() + daysToAdd * 86400000);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        subscriptionExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        subscriptionExpiresAt: true,
      },
    });

    return {
      success: true,
      user: updated,
      message: `Successfully upgraded to Metanoia Pro (${tier === 'pro_annual' ? 'Annual' : 'Monthly'})!`,
    };
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        habits: true,
        habitCompletions: true,
        reflections: true,
        circleMemberships: {
          include: {
            circle: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...safeUserData } = user;

    return {
      exportDate: new Date().toISOString(),
      disclaimer: 'Metanoia is a habit and personal growth companion, not a licensed healthcare provider.',
      userData: safeUserData,
    };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
      message: 'Account and all associated personal data have been completely deleted.',
    };
  }
}
