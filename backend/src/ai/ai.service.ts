import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
}

export interface StreakRescueResult {
  habitId: string;
  habitName: string;
  source: 'gemini' | 'local_fallback';
  empathyMessage: string;
  psychologyInsight: string;
  microAction: string;
  restorationPlan: string;
}

export interface WeeklyReviewResult {
  source: 'gemini' | 'local_fallback';
  period: string;
  overallConsistencyPercent: number;
  totalCompletions: number;
  highlightHabit: string | null;
  frictionPoint: string;
  nextWeekExperiment: string;
  encouragementQuote: string;
}

const COACH_SYSTEM_PROMPT = `You are "Metanoia AI Coach", an empathetic, supportive, and science-grounded habit & productivity mentor inspired by Cognitive Behavioral Therapy (CBT) and BJ Fogg's Tiny Habits methodology.
Your principles:
1. Eradicate guilt and perfectionism. Slipping is data, not a moral failure.
2. Focus on micro-actions: when friction is high, scale the habit down to a 2-minute version.
3. Keep responses concise (under 150 words), conversational, warm, and highly actionable.
4. When users ask questions, provide practical habit tips, trigger-routine-reward cues, or gentle encouragement.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenAI | null = null;
  private readonly isEnabled: boolean;
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isEnabled = this.configService.get<string>('AI_COACH_ENABLED') === 'true';
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';

    if (this.isEnabled && this.apiKey) {
      try {
        this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
        this.logger.log(`✨ Gemini AI Coach initialized using model: ${this.modelName}`);
      } catch (err: any) {
        this.logger.warn(`Could not initialize Gemini Client: ${err?.message}. Falling back to local engine.`);
        this.genAI = null;
      }
    } else {
      this.logger.log('ℹ️ AI Coach is running in Local Fallback mode (quota-safe, zero external API calls).');
    }
  }

  getStatus() {
    return {
      enabled: this.isEnabled && !!this.apiKey,
      mode: this.isEnabled && !!this.apiKey ? 'live' : 'mock_fallback',
      model: this.modelName,
      freeTierSafe: true,
      message: this.isEnabled && !!this.apiKey
        ? `Connected to Gemini (${this.modelName})`
        : 'AI Coach active in Local Fallback mode (zero API quota consumption)',
    };
  }

  async getStreakRescue(userId: string, habitId: string): Promise<StreakRescueResult> {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId, deletedAt: null },
    });

    const habitName = habit?.name || 'Habit';

    // If Gemini is enabled, attempt live generation
    if (this.genAI && this.isEnabled) {
      try {
        const prompt = `${COACH_SYSTEM_PROMPT}

A user has missed their streak for their habit: "${habitName}".
Please provide a JSON response with the following keys:
- empathyMessage: (a warm, non-judgmental 1-2 sentence reassurance)
- psychologyInsight: (a 1 sentence explanation of why habit disruption happens naturally)
- microAction: (a 2-minute simplified version of this habit to do right now)
- restorationPlan: (a quick prompt for tomorrow)`;

        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            habitId,
            habitName,
            source: 'gemini',
            empathyMessage: parsed.empathyMessage,
            psychologyInsight: parsed.psychologyInsight,
            microAction: parsed.microAction,
            restorationPlan: parsed.restorationPlan,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Gemini streak rescue failed: ${err.message}. Using local fallback.`);
      }
    }

    // Local Fallback CBT Engine
    return {
      habitId,
      habitName,
      source: 'local_fallback',
      empathyMessage: `Missing a day doesn't erase your progress with "${habitName}". Consistency is an average, not a streak of perfection.`,
      psychologyInsight: "Behavioral science shows that missing once has zero measurable impact on long-term habit automaticity—giving up after missing is what breaks the loop.",
      microAction: `Perform the 2-minute reset: spend just 120 seconds on "${habitName}" today simply to maintain your identity as someone who shows up.`,
      restorationPlan: "Anchor tomorrow's session immediately after your morning coffee or existing routine.",
    };
  }

  async getWeeklyReview(userId: string): Promise<WeeklyReviewResult> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const habits = await this.prisma.habit.findMany({
      where: { userId, deletedAt: null },
      include: {
        completions: {
          where: { completedDate: { gte: sevenDaysAgo }, deletedAt: null },
        },
      },
    });

    const totalCompletions = habits.reduce((acc, h) => acc + h.completions.length, 0);
    const maxPossible = habits.length * 7;
    const consistency = maxPossible > 0 ? Math.round((totalCompletions / maxPossible) * 100) : 0;

    let highlightHabit = habits.length > 0
      ? habits.reduce((prev, curr) => (curr.completions.length > prev.completions.length ? curr : prev)).name
      : null;

    if (this.genAI && this.isEnabled) {
      try {
        const prompt = `${COACH_SYSTEM_PROMPT}

Generate a weekly review summary for a user:
- Habits tracked: ${habits.map((h) => `${h.name} (${h.completions.length}/7 days)`).join(', ')}
- Weekly Consistency: ${consistency}%
- Total completions: ${totalCompletions}

Return JSON with:
- frictionPoint: (Observation of where friction was highest)
- nextWeekExperiment: (1 small tweak to test next week)
- encouragementQuote: (Inspiring, grounded quote)`;

        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            source: 'gemini',
            period: 'Past 7 Days',
            overallConsistencyPercent: consistency,
            totalCompletions,
            highlightHabit,
            frictionPoint: parsed.frictionPoint,
            nextWeekExperiment: parsed.nextWeekExperiment,
            encouragementQuote: parsed.encouragementQuote,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Gemini weekly review failed: ${err.message}. Using local fallback.`);
      }
    }

    // Local Fallback Retrospective
    return {
      source: 'local_fallback',
      period: 'Past 7 Days',
      overallConsistencyPercent: consistency,
      totalCompletions,
      highlightHabit,
      frictionPoint: consistency < 60
        ? "Mid-week fatigue created friction. Habits placed late in the evening were most prone to being skipped."
        : "Strong momentum overall. The weekend routine showed slight divergence from weekday rhythms.",
      nextWeekExperiment: "Try Habit Stacking: attach your most challenging habit directly to your most reliable morning trigger.",
      encouragementQuote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit. — Will Durant",
    };
  }

  async chat(userId: string, userMessage: string, history: ChatMessage[] = []): Promise<{ role: string; content: string; source: string }> {
    if (this.genAI && this.isEnabled) {
      try {
        const contents = [
          { role: 'user', parts: [{ text: COACH_SYSTEM_PROMPT }] },
          ...history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          { role: 'user', parts: [{ text: userMessage }] },
        ];

        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents,
        });

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          role: 'assistant',
          content: text.trim(),
          source: 'gemini',
        };
      } catch (err: any) {
        this.logger.warn(`Gemini chat error: ${err.message}. Falling back to local coach engine.`);
      }
    }

    // Local Fallback Intelligent Rule Coach
    const lower = userMessage.toLowerCase();
    let reply = "I'm right here with you. What specific habit would you like to refine or reset today?";

    if (lower.includes('streak') || lower.includes('broke') || lower.includes('missed') || lower.includes('lost')) {
      reply = "Remember: A broken streak is just a data point, not a verdict on your discipline. The golden rule of habit formation is 'Never miss twice'. What is a 2-minute version of your habit you can complete right now?";
    } else if (lower.includes('motivation') || lower.includes('lazy') || lower.includes('tired')) {
      reply = "Motivation is a feeling that comes and goes; systems and low barriers to entry are what endure. When energy is low, reduce friction: make the starting step so easy it requires zero willpower to begin.";
    } else if (lower.includes('morning') || lower.includes('routine')) {
      reply = "A great morning routine starts with clear anchors. Try pairing your desired habit with an existing automatic behavior: 'After I pour my morning water, I will do 5 deep breaths'. Keep it under 3 steps to start!";
    } else if (lower.includes('procrastinat')) {
      reply = "Procrastination is often emotional regulation rather than poor time management—we avoid the feeling of overwhelm. Try the 5-Minute Rule: commit to working on the task for just 5 minutes with full permission to stop after. 80% of the time, momentum carries you forward.";
    } else {
      reply = `I hear you. Focus on tiny increments. Small, repeated actions shape our identity more deeply than occasional heroic bursts. Let's make today count with one simple win.`;
    }

    return {
      role: 'assistant',
      content: reply,
      source: 'local_fallback',
    };
  }

  async *streamChat(userId: string, userMessage: string, history: ChatMessage[] = []): AsyncGenerator<string> {
    const fullResponse = await this.chat(userId, userMessage, history);
    const words = fullResponse.content.split(' ');

    for (const word of words) {
      yield `${word} `;
      // Simulate realistic conversational streaming cadence (25ms)
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}
