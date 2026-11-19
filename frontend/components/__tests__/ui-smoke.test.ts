import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    setAudioModeAsync: vi.fn(async () => {}),
    Recording: {
      createAsync: vi.fn(async () => ({ recording: {} })),
    },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
    Sound: {
      createAsync: vi.fn(async () => ({ sound: { unloadAsync: vi.fn() } })),
    },
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u1', email: 'test@metanoia.app' },
    isAuthenticated: true,
    syncState: 'synced',
    triggerSync: vi.fn(async () => ({ success: true })),
  })),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
  },
}));

import { SyncBadge } from '../SyncBadge';
import { PaywallModal } from '../PaywallModal';
import { CirclesModal } from '../CirclesModal';
import { VoiceRecorderModal } from '../VoiceRecorderModal';

describe('Frontend: UI Components Smoke Test', () => {
  it('1. should verify SyncBadge is defined and callable', () => {
    expect(SyncBadge).toBeDefined();
    expect(typeof SyncBadge).toBe('function');
  });

  it('2. should verify PaywallModal is defined and callable', () => {
    expect(PaywallModal).toBeDefined();
    expect(typeof PaywallModal).toBe('function');
  });

  it('3. should verify CirclesModal is defined and callable', () => {
    expect(CirclesModal).toBeDefined();
    expect(typeof CirclesModal).toBe('function');
  });

  it('4. should verify VoiceRecorderModal is defined and callable', () => {
    expect(VoiceRecorderModal).toBeDefined();
    expect(typeof VoiceRecorderModal).toBe('function');
  });
});
