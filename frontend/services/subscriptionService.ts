import { apiRequest } from './apiClient';

export interface SubscriptionInfo {
  tier: string;
  isPro: boolean;
  expiresAt?: string | null;
  entitlements: {
    maxHabits: number;
    aiCoachChatUnlocked: boolean;
    voiceJournalingUnlocked: boolean;
    audioBriefingsUnlocked: boolean;
    unlimitedCloudSync: boolean;
    accountabilityCirclesUnlocked: boolean;
  };
}

export async function fetchSubscription(): Promise<SubscriptionInfo> {
  return apiRequest<SubscriptionInfo>('/users/subscription');
}

export async function upgradeSubscription(
  tier: 'pro_monthly' | 'pro_annual' = 'pro_monthly',
): Promise<any> {
  return apiRequest('/users/upgrade-pro', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
}

export async function exportUserData(): Promise<any> {
  return apiRequest('/users/export-data');
}

export async function deleteAccount(): Promise<any> {
  return apiRequest('/users/account', {
    method: 'DELETE',
  });
}
