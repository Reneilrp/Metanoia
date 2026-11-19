import { apiRequest } from './apiClient';

export interface VoiceAnalysisResult {
  transcription: string;
  durationSeconds: number;
  sentiment: string;
  energyLevel: number;
  identifiedObstacles: string[];
  suggestedHabitAdjustment: string;
  source: 'gemini' | 'local_fallback';
}

export interface VoiceReflectionResponse {
  reflection: any;
  analysis: VoiceAnalysisResult;
}

export async function transcribeAudio(
  audioBase64?: string,
  durationSeconds?: number,
): Promise<VoiceAnalysisResult> {
  return apiRequest<VoiceAnalysisResult>('/voice/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audioBase64, durationSeconds }),
  });
}

export async function logVoiceReflection(
  title: string,
  audioBase64?: string,
  durationSeconds?: number,
): Promise<VoiceReflectionResponse> {
  return apiRequest<VoiceReflectionResponse>('/voice/log', {
    method: 'POST',
    body: JSON.stringify({ title, audioBase64, durationSeconds }),
  });
}

export async function synthesizeBriefing(text: string): Promise<any> {
  return apiRequest('/voice/synthesize', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
