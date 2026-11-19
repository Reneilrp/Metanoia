import { describe, it, expect, vi } from 'vitest';
import { AiService } from './ai.service.js';

describe('AiService: Dual-Mode & Quota Safety Unit Tests', () => {
  const mockConfig: any = {
    get: vi.fn((key: string) => {
      if (key === 'AI_COACH_ENABLED') return 'false';
      if (key === 'GEMINI_API_KEY') return '';
      if (key === 'GEMINI_MODEL') return 'gemini-1.5-flash';
      return null;
    }),
  };

  const mockPrisma: any = {
    habit: {
      findFirst: vi.fn(async () => ({
        id: 'h1',
        name: 'Evening Journal',
      })),
      findMany: vi.fn(async () => [
        {
          id: 'h1',
          name: 'Evening Journal',
          completions: [{ completedDate: '2026-10-01' }],
        },
      ]),
    },
  };

  it('1. should report quota-safe fallback mode when disabled', () => {
    const service = new AiService(mockConfig, mockPrisma);
    const status = service.getStatus();

    expect(status.enabled).toBe(false);
    expect(status.mode).toBe('mock_fallback');
    expect(status.freeTierSafe).toBe(true);
  });

  it('2. should generate structured Streak Rescue with CBT 2-minute reset', async () => {
    const service = new AiService(mockConfig, mockPrisma);
    const result = await service.getStreakRescue('user-1', 'h1');

    expect(result.source).toBe('local_fallback');
    expect(result.habitName).toBe('Evening Journal');
    expect(result.empathyMessage).toContain('Evening Journal');
    expect(result.microAction).toContain('2-minute reset');
  });

  it('3. should stream chat tokens progressively using async generator', async () => {
    const service = new AiService(mockConfig, mockPrisma);
    const chunks: string[] = [];

    for await (const chunk of service.streamChat('user-1', 'How to stop procrastinating?')) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(5);
    const fullText = chunks.join('');
    expect(fullText.toLowerCase()).toContain('procrastination');
  });
});
