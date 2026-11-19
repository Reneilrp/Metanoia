import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  ChatMessage,
  fetchAiStatus,
  fetchStreakRescue,
  fetchWeeklyReview,
  sendCoachMessage,
  StreakRescueData,
  WeeklyReviewData,
} from '../../services/aiService';
import { getLocalHabits, LocalHabit } from '../../services/localStorage';
import { VoiceRecorderModal } from '../../components/VoiceRecorderModal';
import { synthesizeBriefing } from '../../services/voiceService';

const QUICK_PROMPTS = [
  '⚡ Why did I break my streak?',
  '🧘 I am feeling unmotivated today',
  '🌅 Craft a 3-step morning anchor',
  '🧠 How do I stop procrastinating?',
];

export default function AiCoachScreen() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        "Hello! I am your Metanoia AI Coach. I'm here to help you build habits without guilt, diagnose friction points, and engineer tiny routines that last. What's on your mind today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'local_fallback',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string>('Local CBT (Quota Safe)');
  const [isLiveGemini, setIsLiveGemini] = useState<boolean>(false);

  // Modals for Weekly Review & Streak Rescue
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewData | null>(null);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const [streakRescue, setStreakRescue] = useState<StreakRescueData | null>(null);
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [habitsList, setHabitsList] = useState<LocalHabit[]>([]);
  const [isLoadingRescue, setIsLoadingRescue] = useState(false);

  // Phase 3 Voice Journaling State
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isPlayingAudioBriefing, setIsPlayingAudioBriefing] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const handlePlayAudioBriefing = async () => {
    if (!weeklyReview) return;
    setIsPlayingAudioBriefing(true);
    try {
      await synthesizeBriefing(weeklyReview.encouragementQuote);
      setTimeout(() => {
        setIsPlayingAudioBriefing(false);
      }, 2000);
    } catch {
      setIsPlayingAudioBriefing(false);
    }
  };

  useEffect(() => {
    fetchAiStatus()
      .then((status) => {
        setIsLiveGemini(status.mode === 'live');
        setEngineStatus(status.mode === 'live' ? `Gemini 1.5 Flash (Live)` : `Local CBT Engine (Quota Safe)`);
      })
      .catch(() => {
        setEngineStatus('Local CBT Engine (Offline)');
      });

    getLocalHabits().then(setHabitsList);
  }, [isAuthenticated]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await sendCoachMessage(text, history);

      const coachMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: reply.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: reply.source as any,
      };

      setMessages((prev) => [...prev, coachMsg]);
    } catch (err: any) {
      // Fallback response if offline
      const fallbackMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content:
          "Remember: Consistency is about returning to the routine after a break. Focus on one 2-minute action today to keep your momentum alive!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'local_fallback',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleOpenWeeklyReview = async () => {
    setIsLoadingReview(true);
    setShowWeeklyModal(true);
    try {
      const review = await fetchWeeklyReview();
      setWeeklyReview(review);
    } catch (err) {
      setWeeklyReview({
        source: 'local_fallback',
        period: 'Past 7 Days',
        overallConsistencyPercent: 78,
        totalCompletions: 11,
        highlightHabit: 'Morning Hydration',
        frictionPoint: 'Late afternoon habits experienced the highest friction.',
        nextWeekExperiment: 'Anchor late habits to an existing afternoon tea or break trigger.',
        encouragementQuote: 'Small disciplines repeated with consistency every day lead to great achievements.',
      });
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleOpenStreakRescue = async () => {
    setIsLoadingRescue(true);
    setShowRescueModal(true);
    const targetHabit = habitsList[0] || { id: 'default', name: 'Focus Routine' };
    try {
      const rescue = await fetchStreakRescue(targetHabit.id);
      setStreakRescue(rescue);
    } catch (err) {
      setStreakRescue({
        habitId: targetHabit.id,
        habitName: targetHabit.name,
        source: 'local_fallback',
        empathyMessage: `Missing a day of "${targetHabit.name}" is natural. Slipping is data, not a failure.`,
        psychologyInsight: "Long-term automaticity is unbroken by a single missed day if you return tomorrow.",
        microAction: `Do a 2-minute version of "${targetHabit.name}" right now.`,
        restorationPlan: 'Schedule your next session immediately following your morning coffee.',
      });
    } finally {
      setIsLoadingRescue(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header & AI Mode Status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI Coach</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isLiveGemini ? '#10b981' : '#f59e0b' }]} />
            <Text style={styles.statusText}>{engineStatus}</Text>
          </View>
        </View>

        {/* Feature Action Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.pillButton} onPress={handleOpenWeeklyReview} activeOpacity={0.8}>
            <Text style={styles.pillButtonText}>📊 Review</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillButton, styles.pillButtonRescue]}
            onPress={handleOpenStreakRescue}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillButtonText, styles.pillButtonRescueText]}>⚡ Rescue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillButton, styles.pillButtonVoice]}
            onPress={() => setShowVoiceModal(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillButtonText, styles.pillButtonVoiceText]}>🎙️ Voice</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.messageRow, isUser ? styles.userRow : styles.coachRow]}>
              {!isUser && (
                <View style={styles.coachAvatar}>
                  <Text style={styles.coachAvatarText}>✨</Text>
                </View>
              )}
              <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.coachBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.coachText]}>
                  {item.content}
                </Text>
                <View style={styles.messageFooter}>
                  <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.coachTimestamp]}>
                    {item.timestamp}
                  </Text>
                  {!isUser && (
                    <Text style={styles.sourceTag}>
                      {item.source === 'gemini' ? 'Gemini 1.5' : 'Local CBT'}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          isTyping ? (
            <View style={[styles.messageRow, styles.coachRow]}>
              <View style={styles.coachAvatar}>
                <Text style={styles.coachAvatarText}>✨</Text>
              </View>
              <View style={[styles.messageBubble, styles.coachBubble, { paddingVertical: 12 }]}>
                <ActivityIndicator size="small" color="#6366f1" />
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick Prompt Chips */}
      <View style={styles.quickPromptsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsList}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptChip}
              onPress={() => handleSendMessage(prompt.replace(/^[^\w\s]+/, '').trim())}
              activeOpacity={0.7}
            >
              <Text style={styles.promptChipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask for advice, diagnose a habit, or reflect..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSendMessage()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => handleSendMessage()}
          disabled={!inputText.trim() || isTyping}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Review Modal */}
      <Modal visible={showWeeklyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Weekly Retrospective</Text>
              <TouchableOpacity onPress={() => setShowWeeklyModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {isLoadingReview ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 30 }} />
            ) : weeklyReview ? (
              <ScrollView style={styles.modalBody}>
                <View style={styles.reviewStatCard}>
                  <Text style={styles.reviewStatLabel}>Consistency Index</Text>
                  <Text style={styles.reviewStatValue}>{weeklyReview.overallConsistencyPercent}%</Text>
                  <Text style={styles.reviewStatSub}>{weeklyReview.totalCompletions} completions this week</Text>
                </View>

                {weeklyReview.highlightHabit && (
                  <View style={styles.reviewSection}>
                    <Text style={styles.sectionLabel}>🌟 Star Habit</Text>
                    <Text style={styles.sectionText}>{weeklyReview.highlightHabit}</Text>
                  </View>
                )}

                <View style={styles.reviewSection}>
                  <Text style={styles.sectionLabel}>🔍 Friction Pattern</Text>
                  <Text style={styles.sectionText}>{weeklyReview.frictionPoint}</Text>
                </View>

                <View style={styles.reviewSection}>
                  <Text style={styles.sectionLabel}>🧪 Experiment for Next Week</Text>
                  <Text style={styles.sectionText}>{weeklyReview.nextWeekExperiment}</Text>
                </View>

                <Text style={styles.quoteText}>"{weeklyReview.encouragementQuote}"</Text>

                <TouchableOpacity
                  style={styles.audioBriefingBtn}
                  onPress={handlePlayAudioBriefing}
                  disabled={isPlayingAudioBriefing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioBriefingBtnText}>
                    {isPlayingAudioBriefing ? '🔊 Playing Audio Memo...' : '🎧 Listen to Audio Briefing'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Streak Rescue Modal */}
      <Modal visible={showRescueModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚡ Streak Rescue Protocol</Text>
              <TouchableOpacity onPress={() => setShowRescueModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {isLoadingRescue ? (
              <ActivityIndicator size="large" color="#f59e0b" style={{ marginVertical: 30 }} />
            ) : streakRescue ? (
              <ScrollView style={styles.modalBody}>
                <View style={styles.rescueBanner}>
                  <Text style={styles.rescueBannerTitle}>{streakRescue.habitName}</Text>
                  <Text style={styles.rescueBannerText}>{streakRescue.empathyMessage}</Text>
                </View>

                <View style={styles.reviewSection}>
                  <Text style={styles.sectionLabel}>🧠 The Psychology</Text>
                  <Text style={styles.sectionText}>{streakRescue.psychologyInsight}</Text>
                </View>

                <View style={[styles.reviewSection, styles.actionHighlight]}>
                  <Text style={styles.sectionLabel}>⏱️ 2-Minute Reset Action</Text>
                  <Text style={styles.actionText}>{streakRescue.microAction}</Text>
                </View>

                <View style={styles.reviewSection}>
                  <Text style={styles.sectionLabel}>🌅 Tomorrow's Anchor</Text>
                  <Text style={styles.sectionText}>{streakRescue.restorationPlan}</Text>
                </View>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setShowRescueModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneBtnText}>Commit to Reset</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Phase 3 Voice Journaling Modal */}
      <VoiceRecorderModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSaved={(_ref, analysis) => {
          // Append coaching message celebrating voice entry
          const voiceMsg: ChatMessage = {
            id: `msg-voice-${Date.now()}`,
            role: 'assistant',
            content: `I've analyzed your voice reflection: "${analysis.transcription.substring(0, 80)}...". Detected mood: ${analysis.sentiment.toUpperCase()}. Recommendation: ${analysis.suggestedHabitAdjustment}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: analysis.source,
          };
          setMessages((prev) => [...prev, voiceMsg]);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pillButton: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillButtonText: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: '700',
  },
  pillButtonRescue: {
    backgroundColor: '#fef3c7',
  },
  pillButtonRescueText: {
    color: '#b45309',
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  coachRow: {
    justifyContent: 'flex-start',
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  coachAvatarText: {
    fontSize: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
  },
  coachText: {
    color: '#1e293b',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  timestamp: {
    fontSize: 10,
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  coachTimestamp: {
    color: '#94a3b8',
  },
  sourceTag: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
  },
  quickPromptsContainer: {
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  quickPromptsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  promptChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  promptChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 90,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '700',
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  reviewStatCard: {
    backgroundColor: '#e0e7ff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
    textTransform: 'uppercase',
  },
  reviewStatValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4338ca',
    marginVertical: 4,
  },
  reviewStatSub: {
    fontSize: 13,
    color: '#4338ca',
  },
  reviewSection: {
    marginBottom: 14,
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  quoteText: {
    fontStyle: 'italic',
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 20,
  },
  rescueBanner: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  rescueBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 4,
  },
  rescueBannerText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  actionHighlight: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
    lineHeight: 21,
  },
  doneBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  pillButtonVoice: {
    backgroundColor: '#dbeafe',
  },
  pillButtonVoiceText: {
    color: '#1d4ed8',
  },
  audioBriefingBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  audioBriefingBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
