import { describe, it, expect, vi } from 'vitest';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(async (endpoint: string, options?: any) => {
    if (endpoint === '/users/subscription') {
      return {
        tier: 'free',
        isPro: false,
        entitlements: {
          maxHabits: 5,
          aiCoachChatUnlocked: false,
        },
      };
    }
    if (endpoint === '/users/upgrade-pro') {
      return {
        success: true,
        user: { subscriptionTier: 'pro_monthly' },
      };
    }
    return {};
  }),
}));

import { fetchSubscription, upgradeSubscription } from '../subscriptionService';

describe('Frontend: Subscription & Monetization Service', () => {
  it('1. should fetch user subscription entitlements', async () => {
    const sub = await fetchSubscription();
    expect(sub.tier).toBe('free');
    expect(sub.isPro).toBe(false);
    expect(sub.entitlements.maxHabits).toBe(5);
  });

  it('2. should request upgrade to pro', async () => {
    const res = await upgradeSubscription('pro_monthly');
    expect(res.success).toBe(true);
    expect(res.user.subscriptionTier).toBe('pro_monthly');
  });
});
