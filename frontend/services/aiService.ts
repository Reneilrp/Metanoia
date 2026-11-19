import { apiRequest } from './apiClient';

export interface AiStatus {
  enabled: boolean;
  mode: 'live' | 'mock_fallback';
  model: string;
  freeTierSafe: boolean;
  message: string;
}

export interface StreakRescueData {
  habitId: string;
  habitName: string;
  source: 'gemini' | 'local_fallback';
  empathyMessage: string;
  psychologyInsight: string;
  microAction: string;
  restorationPlan: string;
}

export interface WeeklyReviewData {
  source: 'gemini' | 'local_fallback';
  period: string;
  overallConsistencyPercent: number;
  totalCompletions: number;
  highlightHabit: string | null;
  frictionPoint: string;
  nextWeekExperiment: string;
  encouragementQuote: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'gemini' | 'local_fallback';
}

export async function fetchAiStatus(): Promise<AiStatus> {
  return apiRequest<AiStatus>('/ai/status');
}

export async function fetchStreakRescue(habitId: string): Promise<StreakRescueData> {
  return apiRequest<StreakRescueData>('/ai/streak-rescue', {
    method: 'POST',
    body: JSON.stringify({ habitId }),
  });
}

export async function fetchWeeklyReview(): Promise<WeeklyReviewData> {
  return apiRequest<WeeklyReviewData>('/ai/weekly-review');
}

export async function sendCoachMessage(
  message: string,
  history: Array<{ role: string; content: string }>,
): Promise<{ role: string; content: string; source: string }> {
  return apiRequest('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
}
