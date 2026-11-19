import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getLocalCompletions,
  getLocalHabits,
  LocalCompletion,
  LocalHabit,
  saveLocalHabit,
  toggleLocalCompletion,
} from '../../services/localStorage';
import { useAuth } from '../../context/AuthContext';
import { SyncBadge } from '../../components/SyncBadge';

const COLOR_OPTIONS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

export default function TodayScreen() {
  const { triggerSync, isAuthenticated } = useAuth();
  const [habits, setHabits] = useState<LocalHabit[]>([]);
  const [completions, setCompletions] = useState<LocalCompletion[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitDesc, setNewHabitDesc] = useState('');
  const [newHabitColor, setNewHabitColor] = useState(COLOR_OPTIONS[0]);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    const loadedHabits = await getLocalHabits();
    const loadedCompletions = await getLocalCompletions();
    setHabits(loadedHabits.filter((h) => !h.deletedAt && !h.archivedAt));
    setCompletions(loadedCompletions);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (isAuthenticated) {
      await triggerSync();
    }
    await loadData();
    setIsRefreshing(false);
  };

  const handleToggle = async (habitId: string) => {
    await toggleLocalCompletion(habitId, todayStr);
    await loadData();
    if (isAuthenticated) {
      triggerSync().catch(() => {});
    }
  };

  const handleCreateHabit = async () => {
    if (!newHabitName.trim()) return;
    await saveLocalHabit({
      name: newHabitName.trim(),
      description: newHabitDesc.trim() || undefined,
      color: newHabitColor,
      icon: 'star',
      frequencyType: 'daily',
      targetCount: 1,
    });
    setNewHabitName('');
    setNewHabitDesc('');
    setShowAddModal(false);
    await loadData();
    if (isAuthenticated) {
      triggerSync().catch(() => {});
    }
  };

  const completedSet = new Set(
    completions
      .filter((c) => c.completedDate === todayStr && !c.deletedAt)
      .map((c) => c.habitId),
  );

  const completedCount = habits.filter((h) => completedSet.has(h.id)).length;
  const progressPercent = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
          <Text style={styles.title}>Today's Focus</Text>
        </View>
        <SyncBadge />
      </View>

      {/* Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Daily Momentum</Text>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressSubtitle}>
          {completedCount} of {habits.length} habits completed today
        </Text>
      </View>

      {/* Habits List */}
      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptySubtitle}>Tap the button below to add your first habit!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isDone = completedSet.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.habitCard, isDone && styles.habitCardCompleted]}
              onPress={() => handleToggle(item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.colorIndicator, { backgroundColor: item.color || '#6366f1' }]} />
              <View style={styles.habitInfo}>
                <Text style={[styles.habitName, isDone && styles.habitNameDone]}>{item.name}</Text>
                {item.description ? (
                  <Text style={[styles.habitDesc, isDone && styles.habitDescDone]} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.checkCircle, isDone && styles.checkCircleDone]}>
                {isDone && <Text style={styles.checkIcon}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Add Habit</Text>
      </TouchableOpacity>

      {/* Add Habit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Habit</Text>

            <Text style={styles.inputLabel}>Habit Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Read 15 pages"
              value={newHabitName}
              onChangeText={setNewHabitName}
            />

            <Text style={styles.inputLabel}>Why is this important? (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Expanding mental models"
              value={newHabitDesc}
              onChangeText={setNewHabitDesc}
            />

            <Text style={styles.inputLabel}>Theme Color</Text>
            <View style={styles.colorPalette}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    newHabitColor === c && styles.colorOptionSelected,
                  ]}
                  onPress={() => setNewHabitColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleCreateHabit}
              >
                <Text style={styles.saveBtnText}>Save Habit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingBottom: 12,
  },
  dateLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  progressCard: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    padding: 18,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6366f1',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  progressSubtitle: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  habitCardCompleted: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    opacity: 0.85,
  },
  colorIndicator: {
    width: 6,
    height: 38,
    borderRadius: 3,
    marginRight: 14,
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  habitNameDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  habitDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  habitDescDone: {
    color: '#cbd5e1',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkCircleDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 30,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  colorOption: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#6366f1',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
