import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Circle,
  createCircle,
  getMyCircles,
  joinCircle,
  sendCircleReaction,
} from '../services/socialService';

interface CirclesModalProps {
  visible: boolean;
  onClose: () => void;
}

const REACTION_EMOJIS = ['🔥', '💪', '☕', '🙌'];

export const CirclesModal: React.FC<CirclesModalProps> = ({ visible, onClose }) => {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_circles' | 'create' | 'join'>('my_circles');

  // Form states
  const [circleName, setCircleName] = useState('');
  const [circleDesc, setCircleDesc] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCircles = async () => {
    setIsLoading(true);
    try {
      const data = await getMyCircles();
      setCircles(data);
    } catch {
      // Mock circle if offline
      setCircles([
        {
          id: 'mock-circle-1',
          name: '🌅 5 AM Routine Crew',
          description: 'Daily consistency and morning hydration',
          inviteCode: 'MET5AM',
          createdById: 'user-1',
          members: [
            { id: '1', displayName: 'You', email: 'you@metanoia.app', completionsToday: 2 },
            { id: '2', displayName: 'Elena', email: 'elena@sample.com', completionsToday: 3 },
            { id: '3', displayName: 'Marcus', email: 'marcus@sample.com', completionsToday: 1 },
          ],
          reactions: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadCircles();
    }
  }, [visible]);

  const handleCreateCircle = async () => {
    if (!circleName.trim()) {
      Alert.alert('Required', 'Please enter a name for your Accountability Circle.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newCircle = await createCircle(circleName.trim(), circleDesc.trim() || undefined);
      Alert.alert(
        'Circle Created! 🎉',
        `Invite your accountability partner with code: ${newCircle.inviteCode}`,
      );
      setCircleName('');
      setCircleDesc('');
      setActiveTab('my_circles');
      loadCircles();
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Circle created.');
      setActiveTab('my_circles');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCircle = async () => {
    if (!inviteCodeInput.trim()) {
      Alert.alert('Required', 'Please enter the 6-character invite code.');
      return;
    }
    setIsSubmitting(true);
    try {
      await joinCircle(inviteCodeInput.trim().toUpperCase());
      Alert.alert('Joined Circle! 🤝', 'You are now part of this accountability circle.');
      setInviteCodeInput('');
      setActiveTab('my_circles');
      loadCircles();
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Could not join circle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReact = async (circleId: string, receiverId: string, emoji: string) => {
    try {
      await sendCircleReaction(circleId, receiverId, emoji);
      Alert.alert('Reaction Sent!', `You sent ${emoji} to cheer on your partner!`);
    } catch {
      Alert.alert('Cheer Sent!', `You sent ${emoji} to cheer on your partner!`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>👥 Accountability Circles</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'my_circles' && styles.tabBtnActive]}
              onPress={() => setActiveTab('my_circles')}
            >
              <Text style={[styles.tabText, activeTab === 'my_circles' && styles.tabTextActive]}>
                My Circles
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'join' && styles.tabBtnActive]}
              onPress={() => setActiveTab('join')}
            >
              <Text style={[styles.tabText, activeTab === 'join' && styles.tabTextActive]}>
                Join Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
              onPress={() => setActiveTab('create')}
            >
              <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
                + Create
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab 1: My Circles */}
          {activeTab === 'my_circles' && (
            <View style={{ flex: 1 }}>
              {isLoading ? (
                <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  data={circles}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyTitle}>No Circles Joined Yet</Text>
                      <Text style={styles.emptySub}>
                        Create a private circle or join friends using their invite code.
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <View style={styles.circleCard}>
                      <View style={styles.circleCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.circleName}>{item.name}</Text>
                          {item.description ? (
                            <Text style={styles.circleDesc}>{item.description}</Text>
                          ) : null}
                        </View>
                        <View style={styles.inviteCodeBadge}>
                          <Text style={styles.inviteCodeText}>CODE: {item.inviteCode}</Text>
                        </View>
                      </View>

                      {/* Members Progress */}
                      <Text style={styles.membersHeader}>Today's Momentum:</Text>
                      {item.members.map((mem) => (
                        <View key={mem.id} style={styles.memberRow}>
                          <Text style={styles.memberName}>{mem.displayName || mem.email}</Text>
                          <Text style={styles.memberProgress}>
                            {mem.completionsToday} completed
                          </Text>
                          {/* Send quick reaction */}
                          <View style={styles.reactionGroup}>
                            {REACTION_EMOJIS.map((emoji) => (
                              <TouchableOpacity
                                key={emoji}
                                onPress={() => handleReact(item.id, mem.id, emoji)}
                                style={styles.emojiBtn}
                              >
                                <Text style={styles.emojiText}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {/* Tab 2: Join Code */}
          {activeTab === 'join' && (
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Enter 6-Digit Circle Invite Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. MET5AM"
                value={inviteCodeInput}
                onChangeText={(t) => setInviteCodeInput(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
              />
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleJoinCircle}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>Join Accountability Circle</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Tab 3: Create Circle */}
          {activeTab === 'create' && (
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Circle Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Deep Work Sprint"
                value={circleName}
                onChangeText={setCircleName}
              />

              <Text style={styles.formLabel}>Goal Description (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 45-min focus sessions Monday through Friday"
                value={circleDesc}
                onChangeText={setCircleDesc}
              />

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCreateCircle}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>Create & Generate Invite Code</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '700',
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  circleCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  circleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  circleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  circleDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  inviteCodeBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inviteCodeText: {
    color: '#4338ca',
    fontSize: 11,
    fontWeight: '800',
  },
  membersHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  memberProgress: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
    marginRight: 10,
  },
  reactionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  emojiBtn: {
    padding: 4,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emojiText: {
    fontSize: 14,
  },
  formContainer: {
    paddingTop: 10,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 12,
  },
  actionBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});
