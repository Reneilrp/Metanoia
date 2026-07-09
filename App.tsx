import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { 
  initializeDatabase, 
  DailyTaskItem, 
  MasterScheduleItem 
} from './src/db/database';
import { getDateStringForDay, getTaskStatus, calculateStreaks, DayProgress } from './src/utils/time';
import {
  Check,
  Plus,
  Trash2,
  Clock,
  X,
  Sliders,
  AlertCircle,
  Activity
} from 'lucide-react-native';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES: { [key: string]: string } = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const CATEGORIES = [
  { id: 'fitness', name: 'Fitness', color: '#10B981', borderClass: 'border-emerald-500', textClass: 'text-emerald-500', bgClass: 'bg-emerald-500/15' },
  { id: 'code', name: 'Code & Build', color: '#3B82F6', borderClass: 'border-blue-500', textClass: 'text-blue-500', bgClass: 'bg-blue-500/15' },
  { id: 'rest', name: 'Rest & Recover', color: '#8B5CF6', borderClass: 'border-violet-500', textClass: 'text-violet-500', bgClass: 'bg-violet-500/15' },
  { id: 'mindset', name: 'Mindset & Prep', color: '#F59E0B', borderClass: 'border-amber-500', textClass: 'text-amber-500', bgClass: 'bg-amber-500/15' },
];

function MainAppContent() {
  const db = useSQLiteContext();

  // Date and Day Logic
  const getTodayInfo = () => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    let dayIndex = now.getDay();
    const dayName = weekdays[dayIndex] === 'Sun' ? 'Sun' : weekdays[dayIndex];
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${date}`;
    return { dayName, dateStr };
  };

  const todayInfo = getTodayInfo();
  
  // App States
  const [selectedDay, setSelectedDay] = useState<string>(todayInfo.dayName);
  const [tasks, setTasks] = useState<DailyTaskItem[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Edit Schedule Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [masterItems, setMasterItems] = useState<MasterScheduleItem[]>([]);
  
  // Streak States
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [isStreakPanelExpanded, setIsStreakPanelExpanded] = useState(false);
  
  // Add/Edit Task Form States
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [formActivityName, setFormActivityName] = useState('');
  const [formCategory, setFormCategory] = useState<'fitness' | 'code' | 'rest' | 'mindset'>('code');
  const [formHour, setFormHour] = useState('08');
  const [formMinute, setFormMinute] = useState('00');
  const [formDuration, setFormDuration] = useState('60');

  // Animation values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Calculate target YYYY-MM-DD for selected weekday
  const selectedDayDateString = getDateStringForDay(selectedDay, new Date());

  // Load Checklist Tasks
  const loadTasks = async () => {
    try {
      const result = await db.getAllAsync<DailyTaskItem>(
        `SELECT 
            m.id, 
            m.time_start, 
            m.activity_name, 
            m.category, 
            m.estimated_duration, 
            COALESCE(l.is_completed, 0) as is_completed,
            (SELECT COUNT(*) FROM progress_logs WHERE schedule_id = m.id AND is_completed = 1 AND log_date >= date(?, '-6 days')) as completed_7,
            (SELECT COUNT(*) FROM progress_logs WHERE schedule_id = m.id AND is_completed = 1 AND log_date >= date(?, '-29 days')) as completed_30,
            (SELECT COUNT(*) FROM progress_logs WHERE schedule_id = m.id AND is_completed = 1 AND log_date >= date(?, '-99 days')) as completed_100
         FROM master_schedule m
         LEFT JOIN progress_logs l 
           ON m.id = l.schedule_id 
           AND l.log_date = ?
         WHERE m.day_of_week = ?
         ORDER BY m.time_start ASC;`,
        [
          selectedDayDateString, 
          selectedDayDateString, 
          selectedDayDateString, 
          selectedDayDateString, 
          selectedDay
        ]
      );
      setTasks(result);
    } catch (error) {
      console.error('Error loading checklist tasks:', error);
    }
  };

  // Load Streaks and Perfect Days
  const loadStreaks = async () => {
    try {
      const todayStr = todayInfo.dateStr;
      const progressList = await db.getAllAsync<DayProgress>(
        `WITH RECURSIVE dates(date) AS (
           VALUES(date(?, '-99 days'))
           UNION ALL
           SELECT date(date, '+1 day') FROM dates WHERE date < ?
         )
         SELECT 
           d.date,
           CASE strftime('%w', d.date)
             WHEN '0' THEN 'Sun'
             WHEN '1' THEN 'Mon'
             WHEN '2' THEN 'Tue'
             WHEN '3' THEN 'Wed'
             WHEN '4' THEN 'Thu'
             WHEN '5' THEN 'Fri'
             WHEN '6' THEN 'Sat'
           END as day_of_week,
           (SELECT COUNT(*) FROM master_schedule WHERE day_of_week = 
             CASE strftime('%w', d.date)
               WHEN '0' THEN 'Sun'
               WHEN '1' THEN 'Mon'
               WHEN '2' THEN 'Tue'
               WHEN '3' THEN 'Wed'
               WHEN '4' THEN 'Thu'
               WHEN '5' THEN 'Fri'
               WHEN '6' THEN 'Sat'
             END
           ) as total_scheduled,
           (SELECT COUNT(*) FROM progress_logs l 
            JOIN master_schedule m ON l.schedule_id = m.id
            WHERE l.log_date = d.date AND l.is_completed = 1
           ) as total_completed
         FROM dates d
         ORDER BY d.date DESC;`,
        [todayStr, todayStr]
      );

      const { currentStreak: curr, longestStreak: long } = calculateStreaks(progressList);
      setCurrentStreak(curr);
      setLongestStreak(long);
    } catch (error) {
      console.error('Error loading streaks:', error);
    }
  };

  // Load Master Blueprint for Editing
  const loadMasterItems = async () => {
    try {
      const result = await db.getAllAsync<MasterScheduleItem>(
        `SELECT * FROM master_schedule WHERE day_of_week = ? ORDER BY time_start ASC;`,
        [selectedDay]
      );
      setMasterItems(result);
    } catch (error) {
      console.error('Error loading master items:', error);
    }
  };

  // Toggle checklist complete
  const handleToggle = async (task: DailyTaskItem) => {
    try {
      const newStatus = task.is_completed === 1 ? 0 : 1;
      await db.runAsync(
        `INSERT INTO progress_logs (schedule_id, log_date, is_completed) 
         VALUES (?, ?, ?) 
         ON CONFLICT(log_date, schedule_id) 
         DO UPDATE SET is_completed = excluded.is_completed;`,
        [task.id, selectedDayDateString, newStatus]
      );
      await loadTasks();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  // Save or Create Blueprint Item
  const handleSaveBlueprintItem = async () => {
    if (!formActivityName.trim()) return;

    const timeStart = `${formHour.trim().padStart(2, '0')}:${formMinute.trim().padStart(2, '0')}`;
    const duration = parseInt(formDuration) || 60;

    try {
      if (editingItemId) {
        // Edit existing blueprint item
        await db.runAsync(
          `UPDATE master_schedule 
           SET activity_name = ?, category = ?, time_start = ?, estimated_duration = ? 
           WHERE id = ?;`,
          [formActivityName, formCategory, timeStart, duration, editingItemId]
        );
      } else {
        // Create new blueprint item
        await db.runAsync(
          `INSERT INTO master_schedule (day_of_week, time_start, activity_name, category, estimated_duration) 
           VALUES (?, ?, ?, ?, ?);`,
          [selectedDay, timeStart, formActivityName, formCategory, duration]
        );
      }

      // Reset form
      setFormActivityName('');
      setEditingItemId(null);
      
      // Reload lists
      await loadMasterItems();
      await loadTasks();
    } catch (error) {
      console.error('Error saving blueprint item:', error);
    }
  };

  // Delete Blueprint Item
  const handleDeleteBlueprintItem = async (id: number) => {
    try {
      await db.runAsync(`DELETE FROM master_schedule WHERE id = ?;`, [id]);
      await loadMasterItems();
      await loadTasks();
    } catch (error) {
      console.error('Error deleting blueprint item:', error);
    }
  };

  // Start Editing Blueprint Item
  const startEditBlueprintItem = (item: MasterScheduleItem) => {
    setEditingItemId(item.id);
    setFormActivityName(item.activity_name);
    setFormCategory(item.category);
    const [h, m] = item.time_start.split(':');
    setFormHour(h || '08');
    setFormMinute(m || '00');
    setFormDuration(String(item.estimated_duration));
  };

  // Reset Edit Form
  const resetEditForm = () => {
    setEditingItemId(null);
    setFormActivityName('');
    setFormCategory('code');
    setFormHour('08');
    setFormMinute('00');
    setFormDuration('60');
  };

  // Initialize and React to day/date changes
  useEffect(() => {
    loadTasks();
    loadStreaks();
    if (editModalVisible) {
      loadMasterItems();
    }
  }, [selectedDay, selectedDayDateString, editModalVisible]);

  // Clock updating (every 30 seconds to maintain contextual active indicators)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Pulsing glow animation for active items
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Compute tasks completion progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_completed === 1).length;
  const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) : 0;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: completionPercentage,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [completionPercentage, progressAnim]);

  // Helper function imported from src/utils/time

  const getCategoryDetails = (cat: string) => {
    return CATEGORIES.find(c => c.id === cat) || {
      color: '#A1A1AA',
      borderClass: 'border-zinc-500',
      textClass: 'text-zinc-500',
      bgClass: 'bg-zinc-500/15',
    };
  };

  const platformPadding = Platform.OS === 'android' ? RNStatusBar.currentHeight : 0;

  return (
    <View className="flex-1 bg-[#09090B]" style={{ paddingTop: platformPadding }}>
      <StatusBar style="light" />

      {/* HEADER SECTION */}
      <View className="px-5 pt-5 pb-3.5">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">
            {selectedDayDateString === todayInfo.dateStr
              ? 'Today'
              : new Date(selectedDayDateString).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
          </Text>
          <TouchableOpacity
            className="bg-zinc-900 w-[38px] h-[38px] rounded-full justify-center items-center border border-zinc-800"
            onPress={() => {
              resetEditForm();
              setEditModalVisible(true);
            }}
          >
            <Sliders size={20} color="#F4F4F5" />
          </TouchableOpacity>
        </View>
        
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-zinc-50 text-3xl font-extrabold tracking-tight">{FULL_DAY_NAMES[selectedDay]}</Text>
          <View className="bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-800">
            <Text className="text-zinc-50 text-xs font-bold font-mono">
              {completedTasks}/{totalTasks}
            </Text>
          </View>
        </View>

        {/* Dynamic progress bar */}
        <View className="h-1 w-full">
          <View className="h-full bg-zinc-900 rounded-full overflow-hidden">
            <Animated.View
              className="h-full rounded-full"
              style={[
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: completionPercentage === 1 ? '#10B981' : '#3B82F6',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* DAY SELECTOR CAPSULES */}
      <View className="flex-row justify-between px-5 mb-4">
        {DAYS_OF_WEEK.map(day => {
          const isSelected = selectedDay === day;
          const isToday = todayInfo.dayName === day;
          return (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(day)}
              className={`w-11 h-11 rounded-full justify-center items-center relative border ${
                isSelected ? 'bg-zinc-50 border-zinc-50' : 'bg-[#121214] border-zinc-900'
              }`}
            >
              <Text className={`text-xs font-bold ${isSelected ? 'text-zinc-950' : 'text-zinc-500'}`}>
                {day}
              </Text>
              {isToday && (
                <View className={`w-1 h-1 rounded-full absolute bottom-1.5 ${isSelected ? 'bg-zinc-950' : 'bg-emerald-500'}`} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MAIN CHECKLIST AREA */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {tasks.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20 px-10">
            <AlertCircle size={40} color="#3F3F46" />
            <Text className="text-zinc-50 text-base font-bold mt-4 mb-2">No Activities Planned</Text>
            <Text className="text-zinc-500 text-xs text-center leading-5">
              Tap the adjust icon above to configure your {FULL_DAY_NAMES[selectedDay]} blueprint schedule.
            </Text>
          </View>
        ) : (
          tasks.map(task => {
            const { isActive, percentElapsed } = getTaskStatus(task.time_start, task.estimated_duration, currentTime);
            const isCompleted = task.is_completed === 1;
            const catDetails = getCategoryDetails(task.category);

            return (
              <TouchableOpacity
                key={task.id}
                activeOpacity={0.8}
                onPress={() => handleToggle(task)}
                className={`rounded-2xl mb-3 border overflow-hidden relative ${
                  isCompleted 
                    ? 'opacity-40 border-[#121214] bg-[#0E0E0F]' 
                    : isActive 
                      ? 'bg-[#18181C] border-transparent' 
                      : `bg-[#121214] border-[#1C1C1E] border-l-4 ${catDetails.borderClass}`
                }`}
              >
                {/* Active glow outline */}
                {isActive && !isCompleted && (
                  <Animated.View
                    className="absolute top-0 left-0 right-0 bottom-0 border-2 rounded-2xl z-10"
                    style={{ borderColor: catDetails.color, opacity: pulseAnim }}
                  />
                )}

                <View className="flex-row items-center py-4 px-4">
                  {/* Left Column: Checkbox */}
                  <View className="mr-3.5 z-20">
                    <View
                      className={`w-[22px] h-[22px] rounded-full border-2 justify-center items-center ${
                        isCompleted ? 'border-zinc-800 bg-zinc-800' : catDetails.borderClass
                      }`}
                    >
                      {isCompleted && <Check size={14} color="#000" strokeWidth={3} />}
                    </View>
                  </View>

                  {/* Middle Column: Details */}
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Clock size={12} color={isCompleted ? '#71717A' : '#A1A1AA'} className="mr-1" />
                      <Text className={`text-xs font-bold font-mono ${isCompleted ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        {task.time_start}
                      </Text>
                      <Text className={`text-xs font-medium font-mono ml-1 ${isCompleted ? 'text-zinc-600' : 'text-zinc-500'}`}>
                        • {task.estimated_duration}m
                      </Text>
                      {isActive && !isCompleted && (
                        <View className="bg-amber-500 flex-row items-center px-1.5 py-0.5 rounded ml-2">
                          <Activity size={10} color="#09090B" className="mr-1" />
                          <Text className="text-[9px] font-black tracking-wide text-zinc-950">ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text className={`text-zinc-50 text-base font-semibold leading-5 ${isCompleted ? 'line-through text-zinc-500' : ''}`}>
                      {task.activity_name}
                    </Text>
                  </View>

                  {/* Right Column: Category Badge */}
                  {!isCompleted && (
                    <View className={`px-2 py-1 rounded ${catDetails.bgClass}`}>
                      <Text className={`text-[10px] font-bold uppercase tracking-wider ${catDetails.textClass}`}>
                        {task.category}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Active task inner elapsed progress line */}
                {isActive && !isCompleted && (
                  <View className="h-[3px] bg-zinc-800 w-full absolute bottom-0">
                    <View
                      className="h-full"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, percentElapsed))}%`, 
                        backgroundColor: catDetails.color 
                      }}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        {/* CONSISTENCY INDEX & STREAKS SECTION */}
        <View className="mt-6 bg-[#121214] rounded-2xl border border-zinc-900 overflow-hidden">
          {/* Section Header (Toggleable) */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setIsStreakPanelExpanded(!isStreakPanelExpanded)}
            className="flex-row items-center justify-between p-4"
          >
            <View className="flex-row items-center">
              <Text className="text-xl mr-2">🔥</Text>
              <View>
                <Text className="text-zinc-50 text-sm font-bold">Consistency Index</Text>
                <Text className="text-zinc-500 text-[11px] font-medium">
                  Current Streak: {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <Text className="text-zinc-400 text-xs font-bold mr-1">Best:</Text>
              <Text className="text-zinc-50 text-xs font-extrabold">{longestStreak}d</Text>
            </View>
          </TouchableOpacity>

          {/* Expanded Streak Metrics */}
          {isStreakPanelExpanded && (
            <View className="px-4 pb-4 pt-2 border-t border-zinc-900">
              <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-3">
                Task Milestones ({FULL_DAY_NAMES[selectedDay]})
              </Text>

              {tasks.length === 0 ? (
                <Text className="text-zinc-600 text-xs text-center py-2">
                  No tasks planned to track today.
                </Text>
              ) : (
                tasks.map(task => {
                  const catDetails = getCategoryDetails(task.category);
                  
                  // 7 Days progress
                  const pct7 = Math.min(100, (task.completed_7 / 7) * 100);
                  // 30 Days progress
                  const pct30 = Math.min(100, (task.completed_30 / 30) * 100);
                  // 100 Days progress
                  const pct100 = Math.min(100, (task.completed_100 / 100) * 100);

                  return (
                    <View key={`streak-${task.id}`} className="mb-4 bg-zinc-950 p-3 rounded-xl border border-zinc-900">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-zinc-200 text-xs font-bold flex-1 mr-2" numberOfLines={1}>
                          {task.activity_name}
                        </Text>
                        <View className={`px-1.5 py-0.5 rounded ${catDetails.bgClass}`}>
                          <Text className={`text-[8px] font-black uppercase ${catDetails.textClass}`}>
                            {task.category}
                          </Text>
                        </View>
                      </View>

                      {/* 7 Day Milestone Row */}
                      <View className="mb-1.5">
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-[10px] text-zinc-500 font-semibold">
                            7-Day Trust Milestone {task.completed_7 >= 7 ? '🔓' : '🔒'}
                          </Text>
                          <Text className="text-[10px] text-zinc-400 font-bold font-mono">
                            {task.completed_7}/7
                          </Text>
                        </View>
                        <View className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <View 
                            className="h-full rounded-full" 
                            style={{ width: `${pct7}%`, backgroundColor: task.completed_7 >= 7 ? '#10B981' : catDetails.color }}
                          />
                        </View>
                      </View>

                      {/* 30 Day Milestone Row */}
                      <View className="mb-1.5">
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-[10px] text-zinc-500 font-semibold">
                            30-Day Foundation Milestone {task.completed_30 >= 30 ? '🔓' : '🔒'}
                          </Text>
                          <Text className="text-[10px] text-zinc-400 font-bold font-mono">
                            {task.completed_30}/30
                          </Text>
                        </View>
                        <View className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <View 
                            className="h-full rounded-full" 
                            style={{ width: `${pct30}%`, backgroundColor: task.completed_30 >= 30 ? '#10B981' : catDetails.color }}
                          />
                        </View>
                      </View>

                      {/* 100 Day Milestone Row */}
                      <View>
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-[10px] text-zinc-500 font-semibold">
                            100-Day Identity Milestone {task.completed_100 >= 100 ? '🔓' : '🔒'}
                          </Text>
                          <Text className="text-[10px] text-zinc-400 font-bold font-mono">
                            {task.completed_100}/100
                          </Text>
                        </View>
                        <View className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <View 
                            className="h-full rounded-full" 
                            style={{ width: `${pct100}%`, backgroundColor: task.completed_100 >= 100 ? '#10B981' : catDetails.color }}
                          />
                        </View>
                      </View>

                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* EDIT BLUEPRINT MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/85 justify-end"
        >
          <View className="bg-[#09090B] rounded-t-[24px] px-5 pt-6 pb-8 h-[85%] border-t border-zinc-900">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text className="text-zinc-50 text-2xl font-black">{FULL_DAY_NAMES[selectedDay]}</Text>
                <Text className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Blueprint Editor</Text>
              </View>
              <TouchableOpacity
                className="bg-zinc-900 w-9 h-9 rounded-full justify-center items-center border border-zinc-800"
                onPress={() => setEditModalVisible(false)}
              >
                <X size={20} color="#F4F4F5" />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <View className="bg-[#121214] rounded-2xl p-4 border border-zinc-900 mb-5">
              <Text className="text-zinc-50 text-sm font-bold mb-3">
                {editingItemId ? 'Edit Blueprint Activity' : 'Add Blueprint Activity'}
              </Text>
              
              <TextInput
                className="bg-[#09090B] border border-zinc-900 rounded-lg px-3 py-2.5 text-zinc-50 text-sm mb-3"
                placeholder="Activity name (e.g. Deep Work: Coding)"
                placeholderTextColor="#71717A"
                value={formActivityName}
                onChangeText={setFormActivityName}
              />

              {/* Category Select Buttons */}
              <View className="flex-row justify-between mb-4">
                {CATEGORIES.map(cat => {
                  const isSelected = formCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setFormCategory(cat.id as any)}
                      className={`flex-1 mx-0.5 py-2 rounded-md border items-center ${
                        isSelected 
                          ? `${cat.borderClass} ${cat.bgClass}` 
                          : 'border-zinc-900 bg-[#09090B]'
                      }`}
                    >
                      <Text className={`text-[11px] font-bold ${isSelected ? cat.textClass : 'text-zinc-500'}`}>
                        {cat.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time & Duration Select */}
              <View className="flex-row justify-between mb-4">
                <View className="flex-1 mr-2.5">
                  <Text className="text-zinc-400 text-[11px] font-semibold mb-1.5">Start Time (24h)</Text>
                  <View className="flex-row items-center bg-[#09090B] border border-zinc-900 rounded-lg px-2">
                    <TextInput
                      className="flex-1 text-zinc-50 text-sm font-bold text-center py-2"
                      keyboardType="numeric"
                      maxLength={2}
                      value={formHour}
                      onChangeText={setFormHour}
                      placeholder="08"
                      placeholderTextColor="#3F3F46"
                    />
                    <Text className="text-zinc-700 font-bold">:</Text>
                    <TextInput
                      className="flex-1 text-zinc-50 text-sm font-bold text-center py-2"
                      keyboardType="numeric"
                      maxLength={2}
                      value={formMinute}
                      onChangeText={setFormMinute}
                      placeholder="00"
                      placeholderTextColor="#3F3F46"
                    />
                  </View>
                </View>

                <View className="w-[100px]">
                  <Text className="text-zinc-400 text-[11px] font-semibold mb-1.5">Duration (mins)</Text>
                  <TextInput
                    className="bg-[#09090B] border border-zinc-900 rounded-lg py-2 px-3 text-zinc-50 text-sm font-bold text-center"
                    keyboardType="numeric"
                    maxLength={3}
                    value={formDuration}
                    onChangeText={setFormDuration}
                    placeholder="60"
                    placeholderTextColor="#3F3F46"
                  />
                </View>
              </View>

              <View className="flex-row justify-end">
                {editingItemId && (
                  <TouchableOpacity
                    className="px-4 py-2.5 rounded-lg border border-zinc-800 justify-center mr-2"
                    onPress={resetEditForm}
                  >
                    <Text className="text-zinc-50 text-xs font-semibold">Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className="flex-row items-center px-4 py-2.5 rounded-lg bg-zinc-50"
                  onPress={handleSaveBlueprintItem}
                >
                  <Plus size={16} color="#09090B" className="mr-1" />
                  <Text className="text-zinc-950 text-xs font-bold">
                    {editingItemId ? 'Update Item' : 'Add to Blueprint'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* List of current blueprint items */}
            <Text className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider mb-2">Active Blueprint Items</Text>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {masterItems.length === 0 ? (
                <Text className="text-zinc-700 text-xs text-center mt-5">No blueprint items scheduled for this day.</Text>
              ) : (
                masterItems.map(item => {
                  const catDetails = getCategoryDetails(item.category);
                  return (
                    <View key={item.id} className="flex-row items-center bg-[#121214] border border-zinc-900 rounded-xl py-2.5 px-3 mb-2">
                      <View className={`w-[3px] h-10 rounded-full mr-2.5 ${catDetails.bgClass}`} style={{ backgroundColor: catDetails.color }} />
                      <View className="flex-1">
                        <Text className="text-zinc-500 text-[11px] font-semibold font-mono">
                          {item.time_start} ({item.estimated_duration} mins)
                        </Text>
                        <Text className="text-zinc-200 text-sm font-semibold">{item.activity_name}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          className="mr-3 py-1 px-2 rounded bg-zinc-900 border border-zinc-800"
                          onPress={() => startEditBlueprintItem(item)}
                        >
                          <Text className="text-zinc-400 text-[10px] font-bold">Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="p-1.5"
                          onPress={() => handleDeleteBlueprintItem(item.id)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#09090B' }}>
      <Suspense fallback={
        <View className="flex-1 justify-center items-center bg-[#09090B]">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-zinc-400 mt-3 text-sm font-medium">Initializing Metanoia...</Text>
        </View>
      }>
        <SQLiteProvider databaseName="metanoia.db" onInit={initializeDatabase} useSuspense={true}>
          <MainAppContent />
        </SQLiteProvider>
      </Suspense>
    </View>
  );
}
