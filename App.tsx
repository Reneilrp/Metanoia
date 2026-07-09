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
import { SQLiteProvider, useSQLiteContext, SQLiteDatabase } from 'expo-sqlite';
import { 
  initializeDatabase, 
  DailyTaskItem, 
  MasterScheduleItem,
  DailyReflectionItem,
  MilestoneReflectionItem
} from './src/db/database';
import { getDateStringForDay, getTaskStatus, calculateStreaks, DayProgress } from './src/utils/time';
import * as Notifications from 'expo-notifications';
import {
  Check,
  Plus,
  Trash2,
  Clock,
  X,
  Sliders,
  AlertCircle,
  Activity,
  Info
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

// Notifications Configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

const scheduleAllNotifications = async (db: SQLiteDatabase) => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Notifications permission not granted.');
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const items = await db.getAllAsync<MasterScheduleItem>(
      `SELECT * FROM master_schedule;`
    );

    const DAY_MAP: Record<string, number> = {
      'Sun': 1,
      'Mon': 2,
      'Tue': 3,
      'Wed': 4,
      'Thu': 5,
      'Fri': 6,
      'Sat': 7,
    };

    for (const item of items) {
      const [h, m] = item.time_start.split(':').map(Number);
      const dayNum = DAY_MAP[item.day_of_week];
      if (dayNum === undefined || h === undefined || m === undefined) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Focus Time: ${item.activity_name}`,
          body: `It's time for your ${item.estimated_duration}-min ${item.category} routine. Let's do this!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday: dayNum,
          hour: h,
          minute: m,
          repeats: true,
        },
      });
    }
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

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
  
  // Freeze State
  const [isDayFrozen, setIsDayFrozen] = useState(false);

  // Focus Mindful Transition States
  const [activeTransitionTask, setActiveTransitionTask] = useState<DailyTaskItem | null>(null);
  const [transitionTimeLeft, setTransitionTimeLeft] = useState(60);
  const transitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathAnim = useRef(new Animated.Value(1)).current;

  // Daily Reflection States
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [reflectionFocus, setReflectionFocus] = useState<number | null>(null);
  const [reflectionEnergy, setReflectionEnergy] = useState<'low' | 'medium' | 'high' | null>(null);
  const [reflectionWin, setReflectionWin] = useState('');
  
  // History and Profile States
  const [recentReflections, setRecentReflections] = useState<DailyReflectionItem[]>([]);
  const [progressHistory, setProgressHistory] = useState<DayProgress[]>([]);

  // Milestone Checkpoint States
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [currentMilestoneDay, setCurrentMilestoneDay] = useState<number | null>(null);
  const [milestoneFeelings, setMilestoneFeelings] = useState('');
  const [milestoneChanges, setMilestoneChanges] = useState('');
  const [milestoneReflectionsList, setMilestoneReflectionsList] = useState<MilestoneReflectionItem[]>([]);
  const [graduatedItems, setGraduatedItems] = useState<MasterScheduleItem[]>([]);

  // Toast State
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const toastY = useRef(new Animated.Value(-100)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({ visible: true, message, type });

    Animated.parallel([
      Animated.timing(toastY, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1.0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToast(prev => ({ ...prev, visible: false }));
      });
    }, 2500);
  };
  
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
            (SELECT COUNT(*) FROM progress_logs WHERE schedule_id = m.id AND is_completed = 1 AND log_date >= date(?, '-99 days')) as completed_100,
            (SELECT COUNT(*) FROM progress_logs WHERE schedule_id = m.id AND is_completed = 1 AND log_date >= date(?, '-364 days')) as completed_365
         FROM master_schedule m
         LEFT JOIN progress_logs l 
           ON m.id = l.schedule_id 
           AND l.log_date = ?
         WHERE m.day_of_week = ? AND m.is_graduated = 0
         ORDER BY m.time_start ASC;`,
        [
          selectedDayDateString, 
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
           ) as total_completed,
           (SELECT COUNT(*) FROM day_exceptions WHERE log_date = d.date AND exception_type = 'freeze') as is_frozen
         FROM dates d
         ORDER BY d.date DESC;`,
        [todayStr, todayStr]
      );

      const { currentStreak: curr, longestStreak: long } = calculateStreaks(progressList);
      setCurrentStreak(curr);
      setLongestStreak(long);
      setProgressHistory(progressList);
      await loadRecentReflections();
      await loadMilestones();
      await loadGraduatedItems();
    } catch (error) {
      console.error('Error loading streaks:', error);
    }
  };

  // Load milestone checkpoints log
  const loadMilestones = async () => {
    try {
      const result = await db.getAllAsync<MilestoneReflectionItem>(
        `SELECT * FROM milestone_reflections ORDER BY milestone_day ASC;`
      );
      setMilestoneReflectionsList(result);
    } catch (error) {
      console.error('Error loading milestones:', error);
    }
  };

  // Load reflections history
  const loadRecentReflections = async () => {
    try {
      const result = await db.getAllAsync<DailyReflectionItem>(
        `SELECT * FROM daily_reflections ORDER BY log_date DESC LIMIT 5;`
      );
      setRecentReflections(result);
    } catch (error) {
      console.error('Error loading reflections:', error);
    }
  };

  // Load graduated items (Hall of Identity)
  const loadGraduatedItems = async () => {
    try {
      const result = await db.getAllAsync<MasterScheduleItem>(
        `SELECT * FROM master_schedule WHERE is_graduated = 1 ORDER BY graduation_date DESC;`
      );
      setGraduatedItems(result);
    } catch (error) {
      console.error('Error loading graduated items:', error);
    }
  };

  // Graduate a routine/task
  const handleGraduateTask = async (taskId: number, activityName: string) => {
    try {
      const todayStr = todayInfo.dateStr;
      await db.runAsync(
        `UPDATE master_schedule 
         SET is_graduated = 1, graduation_date = ? 
         WHERE id = ?;`,
        [todayStr, taskId]
      );
      showToast(`🎓 ${activityName} graduated to permanent Identity!`, 'success');
      
      // Reload states
      await loadTasks();
      await loadStreaks();
      await scheduleAllNotifications(db);
    } catch (error) {
      console.error('Error graduating task:', error);
      showToast('Failed to graduate habit', 'error');
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
      await loadStreaks();
      
      showToast(
        newStatus === 1 ? `Completed: ${task.activity_name}` : `Reset: ${task.activity_name}`, 
        newStatus === 1 ? 'success' : 'info'
      );

      // Check if day is now fully complete (to prompt reflection modal)
      if (newStatus === 1) {
        const updated = await db.getAllAsync<DailyTaskItem>(
          `SELECT m.id, COALESCE(l.is_completed, 0) as is_completed
           FROM master_schedule m
           LEFT JOIN progress_logs l ON m.id = l.schedule_id AND l.log_date = ?
           WHERE m.day_of_week = ?;`,
          [selectedDayDateString, selectedDay]
        );
        const total = updated.length;
        const completed = updated.filter(t => t.is_completed === 1).length;
        
        if (total > 0 && completed === total) {
          // Trigger Reflection Sheet
          setReflectionFocus(null);
          setReflectionEnergy(null);
          setReflectionWin('');
          setReflectionModalVisible(true);
        }
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      showToast('Failed to update task', 'error');
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
        showToast('Activity updated in blueprint', 'success');
      } else {
        // Create new blueprint item
        await db.runAsync(
          `INSERT INTO master_schedule (day_of_week, time_start, activity_name, category, estimated_duration) 
           VALUES (?, ?, ?, ?, ?);`,
          [selectedDay, timeStart, formActivityName, formCategory, duration]
        );
        showToast('Activity added to blueprint', 'success');
      }

      // Reset form
      setFormActivityName('');
      setEditingItemId(null);
      
      // Reload lists
      await loadMasterItems();
      await loadTasks();
      await scheduleAllNotifications(db);
    } catch (error) {
      console.error('Error saving blueprint item:', error);
      showToast('Failed to save blueprint item', 'error');
    }
  };

  // Delete Blueprint Item
  const handleDeleteBlueprintItem = async (id: number) => {
    try {
      await db.runAsync(`DELETE FROM master_schedule WHERE id = ?;`, [id]);
      await loadMasterItems();
      await loadTasks();
      await scheduleAllNotifications(db);
      showToast('Activity removed from blueprint', 'warning');
    } catch (error) {
      console.error('Error deleting blueprint item:', error);
      showToast('Failed to delete blueprint item', 'error');
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

  const checkIfDayFrozen = async () => {
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM day_exceptions WHERE log_date = ? AND exception_type = 'freeze';`,
        [selectedDayDateString]
      );
      setIsDayFrozen((result?.count || 0) > 0);
    } catch (error) {
      console.error('Error checking if day is frozen:', error);
    }
  };

  const toggleFreezeDay = async () => {
    try {
      if (isDayFrozen) {
        await db.runAsync(
          `DELETE FROM day_exceptions WHERE log_date = ? AND exception_type = 'freeze';`,
          [selectedDayDateString]
        );
        showToast('Day unfrozen. Checklist restored.', 'info');
      } else {
        await db.runAsync(
          `INSERT INTO day_exceptions (log_date, exception_type) VALUES (?, 'freeze');`,
          [selectedDayDateString]
        );
        showToast('Streak frozen for today! ❄️', 'success');
      }
      await checkIfDayFrozen();
      await loadTasks();
      await loadStreaks();
    } catch (error) {
      console.error('Error toggling freeze day:', error);
      showToast('Failed to freeze day', 'error');
    }
  };

  // Initialize and React to day/date changes
  useEffect(() => {
    checkIfDayFrozen();
    loadTasks();
    loadStreaks();
    scheduleAllNotifications(db);
    if (editModalVisible) {
      loadMasterItems();
    }
  }, [selectedDay, selectedDayDateString, editModalVisible]);

  // Breathing Loop for transitions
  useEffect(() => {
    if (activeTransitionTask) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1.3,
            duration: 3500,
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 1.0,
            duration: 3500,
            useNativeDriver: true,
          })
        ])
      ).start();
    }
  }, [activeTransitionTask]);

  const startTransition = (task: DailyTaskItem) => {
    setActiveTransitionTask(task);
    setTransitionTimeLeft(60);
    
    if (transitionTimerRef.current) {
      clearInterval(transitionTimerRef.current);
    }
    
    transitionTimerRef.current = setInterval(() => {
      setTransitionTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(transitionTimerRef.current!);
          setActiveTransitionTask(null);
          showToast(`Focus session started for ${task.activity_name}!`, 'success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelTransition = () => {
    if (transitionTimerRef.current) {
      clearInterval(transitionTimerRef.current);
    }
    setActiveTransitionTask(null);
  };

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
  const completionPercentage = isDayFrozen ? 1 : (totalTasks > 0 ? (completedTasks / totalTasks) : 0);

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
          <View className="flex-row items-center">
            {/* Freeze Button */}
            <TouchableOpacity
              className={`w-[38px] h-[38px] rounded-full justify-center items-center border mr-2 ${
                isDayFrozen 
                  ? 'bg-blue-500/10 border-blue-500/30' 
                  : 'bg-zinc-900 border-zinc-800'
              }`}
              onPress={toggleFreezeDay}
            >
              <Text className="text-sm">{isDayFrozen ? '❄️' : '🧊'}</Text>
            </TouchableOpacity>

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
        </View>
        
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-zinc-50 text-3xl font-extrabold tracking-tight">{FULL_DAY_NAMES[selectedDay]}</Text>
          <View className="bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-800">
            <Text className="text-zinc-50 text-xs font-bold font-mono">
              {isDayFrozen ? 'FREEZE' : `${completedTasks}/${totalTasks}`}
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
        {isDayFrozen ? (
          <View className="flex-1 justify-center items-center py-20 px-10 bg-zinc-950/20 border border-blue-950/25 rounded-3xl mt-2">
            <Text className="text-4xl mb-4">❄️</Text>
            <Text className="text-zinc-50 text-lg font-black tracking-tight text-center">Streak Frozen</Text>
            <Text className="text-zinc-500 text-xs text-center leading-5 mt-2 mb-6">
              Today is marked as an exception day. Go focus on school, work, or recovery. Your streak is safe!
            </Text>
            <TouchableOpacity 
              onPress={toggleFreezeDay}
              className="px-6 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl"
            >
              <Text className="text-blue-400 text-xs font-bold">Unfreeze Day</Text>
            </TouchableOpacity>
          </View>
        ) : tasks.length === 0 ? (
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
              <View
                key={task.id}
                className={`rounded-2xl mb-3 border overflow-hidden relative flex-row items-center ${
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
                    pointerEvents="none"
                  />
                )}

                {/* Left Column: Checkbox */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleToggle(task)}
                  className="py-4 pl-4 pr-3 justify-center z-20"
                >
                  <View
                    className={`w-[22px] h-[22px] rounded-full border-2 justify-center items-center ${
                      isCompleted ? 'border-zinc-800 bg-zinc-800' : catDetails.borderClass
                    }`}
                  >
                    {isCompleted && <Check size={14} color="#000" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>

                {/* Middle/Right Column: Text Content & Details */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!isCompleted) {
                      startTransition(task);
                    } else {
                      handleToggle(task);
                    }
                  }}
                  className="flex-1 flex-row items-center py-4 pr-4 pl-1 z-20"
                >
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

                  {/* Category Badge */}
                  {!isCompleted && (
                    <View className={`px-2 py-1 rounded ${catDetails.bgClass}`}>
                      <Text className={`text-[10px] font-bold uppercase tracking-wider ${catDetails.textClass}`}>
                        {task.category}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Active task inner elapsed progress line */}
                {isActive && !isCompleted && (
                  <View className="h-[3px] bg-zinc-800 w-full absolute bottom-0 left-0 right-0" pointerEvents="none">
                    <View
                      className="h-full"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, percentElapsed))}%`, 
                        backgroundColor: catDetails.color 
                      }}
                    />
                  </View>
                )}
              </View>
            );
          })
        )}
        {/* PROFILE, HISTORY & CONSISTENCY SECTION */}
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
                <Text className="text-zinc-50 text-sm font-bold">Profile & Consistency</Text>
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

          {/* Expanded Profile metrics, 28-day grid, milestones */}
          {isStreakPanelExpanded && (
            <View className="px-4 pb-4 pt-2 border-t border-zinc-900">
              
              {/* 28-Day Consistency Grid */}
              <View className="mb-4 bg-zinc-950 p-3.5 rounded-xl border border-zinc-900">
                <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">
                  Consistency Grid (Last 28 Days)
                </Text>
                <View className="flex-row flex-wrap justify-start">
                  {progressHistory.slice(0, 28).reverse().map((day) => {
                    const isPerfect = day.is_frozen === 1
                      ? true
                      : day.total_scheduled > 0 
                        ? day.total_completed === day.total_scheduled 
                        : true;
                    
                    let colorClass = 'bg-[#161618] border border-zinc-900';
                    if (day.total_scheduled > 0) {
                      colorClass = isPerfect ? 'bg-emerald-500 border-transparent' : 'bg-zinc-800 border-transparent';
                    }
                    if (day.is_frozen === 1) {
                      colorClass = 'bg-blue-500 border-transparent';
                    }

                    return (
                      <View 
                        key={`grid-day-${day.date}`} 
                        className={`w-6 h-6 rounded-md m-0.5 justify-center items-center ${colorClass}`}
                      >
                        {day.is_frozen === 1 && <Text className="text-[8px]">❄</Text>}
                      </View>
                    );
                  })}
                </View>
                <View className="flex-row flex-wrap justify-between mt-2.5 px-0.5">
                  <View className="flex-row items-center mr-2">
                    <View className="w-2 h-2 rounded bg-emerald-500 mr-1" />
                    <Text className="text-[8px] text-zinc-500 font-bold">Perfect</Text>
                  </View>
                  <View className="flex-row items-center mr-2">
                    <View className="w-2 h-2 rounded bg-blue-500 mr-1" />
                    <Text className="text-[8px] text-zinc-500 font-bold">Frozen</Text>
                  </View>
                  <View className="flex-row items-center mr-2">
                    <View className="w-2 h-2 rounded bg-zinc-800 mr-1" />
                    <Text className="text-[8px] text-zinc-500 font-bold">Failed</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded bg-[#161618] border border-zinc-900 mr-1" />
                    <Text className="text-[8px] text-zinc-500 font-bold">Rest</Text>
                  </View>
                </View>
              </View>

              {/* Reflection Journal Log */}
              <View className="mb-4 bg-zinc-950 p-3.5 rounded-xl border border-zinc-900">
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Daily Reflection Log
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setReflectionFocus(null);
                      setReflectionEnergy(null);
                      setReflectionWin('');
                      setReflectionModalVisible(true);
                    }}
                    className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded"
                  >
                    <Text className="text-[8px] text-zinc-400 font-bold">Reflect</Text>
                  </TouchableOpacity>
                </View>

                {recentReflections.length === 0 ? (
                  <Text className="text-zinc-700 text-xs text-center py-2">
                    No reflections logged yet. Keep consistency to record your wins!
                  </Text>
                ) : (
                  recentReflections.map((ref) => (
                    <View key={`log-ref-${ref.log_date}`} className="mb-2 pb-2 border-b border-zinc-900 last:border-b-0">
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-[9px] text-zinc-500 font-bold font-mono">{ref.log_date}</Text>
                        <View className="flex-row items-center">
                          <Text className="text-[8px] font-bold text-zinc-500 mr-1.5">Focus: {ref.focus_rating === 1 ? '✅' : '❌'}</Text>
                          <Text className={`text-[7px] font-black uppercase px-1 rounded ${
                            ref.energy_level === 'high' ? 'bg-blue-500/10 text-blue-400' :
                            ref.energy_level === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-violet-500/10 text-violet-400'
                          }`}>{ref.energy_level}</Text>
                        </View>
                      </View>
                      <Text className="text-zinc-400 text-xs italic leading-4">"{ref.win_text || 'Completed.'}"</Text>
                    </View>
                  ))
                )}
              </View>

              {/* The Hall of Identity (Graduated Habits) */}
              <View className="mb-4 bg-zinc-950 p-3.5 rounded-xl border border-zinc-900">
                <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">
                  The Hall of Identity (Graduated)
                </Text>

                {graduatedItems.length === 0 ? (
                  <Text className="text-zinc-700 text-xs text-center py-2">
                    No habits graduated yet. Build consistency to automate your routines.
                  </Text>
                ) : (
                  graduatedItems.map((item) => {
                    const catDetails = getCategoryDetails(item.category);
                    return (
                      <View key={`graduated-${item.id}`} className="flex-row items-center bg-[#09090B] border border-zinc-900 rounded-xl py-3 px-3 mb-2">
                        <View className="w-8 h-8 rounded-full bg-emerald-500/10 justify-center items-center mr-2.5">
                          <Text className="text-sm">🎓</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-zinc-250 text-sm font-semibold">{item.activity_name}</Text>
                          <Text className="text-[9px] text-zinc-500 font-bold font-mono uppercase">
                            Automated on {item.graduation_date}
                          </Text>
                        </View>
                        <View className={`px-2 py-0.5 rounded ${catDetails.bgClass}`}>
                          <Text className={`text-[8px] font-black uppercase ${catDetails.textClass}`}>
                            {item.category}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Identity Milestone Logs */}
              <View className="mb-4 bg-zinc-950 p-3.5 rounded-xl border border-zinc-900">
                <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">
                  Identity Milestone Logs
                </Text>

                {milestoneReflectionsList.length === 0 ? (
                  <Text className="text-zinc-700 text-xs text-center py-2">
                    Unlock milestone logs by hitting a 7, 30, 100, or 365-day streak!
                  </Text>
                ) : (
                  milestoneReflectionsList.map((m) => (
                    <View key={`log-milestone-${m.id}`} className="mb-3 pb-3 border-b border-zinc-900 last:border-b-0">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-[10px] font-black text-amber-400">
                          🔓 {m.milestone_day}-Day Checkpoint
                        </Text>
                        <Text className="text-[9px] text-zinc-505 font-bold font-mono">{m.log_date}</Text>
                      </View>
                      
                      <View className="mb-1.5">
                        <Text className="text-[9px] text-zinc-500 font-semibold mb-0.5">What I feel now:</Text>
                        <Text className="text-zinc-350 text-xs italic leading-4">"{m.feelings_text}"</Text>
                      </View>

                      <View>
                        <Text className="text-[9px] text-zinc-500 font-semibold mb-0.5">Changes noticed since Day 1:</Text>
                        <Text className="text-zinc-350 text-xs italic leading-4">"{m.changes_text}"</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Individual Milestones */}
              <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                Task Milestones ({FULL_DAY_NAMES[selectedDay]})
              </Text>

              {tasks.length === 0 ? (
                <Text className="text-zinc-600 text-xs text-center py-2">
                  No tasks planned to track today.
                </Text>
              ) : (
                tasks.map(task => {
                  const catDetails = getCategoryDetails(task.category);
                  const pct7 = Math.min(100, (task.completed_7 / 7) * 100);
                  const pct30 = Math.min(100, (task.completed_30 / 30) * 100);
                  const pct100 = Math.min(100, (task.completed_100 / 100) * 100);
                  const pct365 = Math.min(100, (task.completed_365 / 365) * 100);
                  const canGraduate = task.completed_100 >= 100 || task.completed_365 >= 365;

                  return (
                    <View key={`streak-${task.id}`} className="mb-4 bg-zinc-950 p-3.5 rounded-xl border border-zinc-900">
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

                      {/* 7 Day Milestone */}
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

                      {/* 30 Day Milestone */}
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

                      {/* 100 Day Milestone */}
                      <View className="mb-1.5">
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-[10px] text-zinc-500 font-semibold">
                            100-Day Identity Milestone {task.completed_100 >= 100 ? '🔓' : '🔒'}
                          </Text>
                          <Text className="text-[10px] text-zinc-400 font-bold font-mono">
                            {task.completed_100}/100
                          </Text>
                        </View>
                        <View className="h-1 bg-[#161618] rounded-full overflow-hidden">
                          <View 
                            className="h-full rounded-full" 
                            style={{ width: `${pct100}%`, backgroundColor: task.completed_100 >= 100 ? '#10B981' : catDetails.color }}
                          />
                        </View>
                      </View>

                      {/* 365 Day Milestone */}
                      <View className="mb-2">
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-[10px] text-zinc-500 font-semibold">
                            365-Day Mastery Milestone {task.completed_365 >= 365 ? '🔓' : '🔒'}
                          </Text>
                          <Text className="text-[10px] text-zinc-400 font-bold font-mono">
                            {task.completed_365}/365
                          </Text>
                        </View>
                        <View className="h-1 bg-[#161618] rounded-full overflow-hidden">
                          <View 
                            className="h-full rounded-full" 
                            style={{ width: `${pct365}%`, backgroundColor: task.completed_365 >= 365 ? '#10B981' : catDetails.color }}
                          />
                        </View>
                      </View>

                      {/* Graduate Habit CTA */}
                      {canGraduate && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleGraduateTask(task.id, task.activity_name)}
                          className="mt-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl items-center flex-row justify-center"
                        >
                          <Text className="text-emerald-400 text-xs font-black mr-1">🎓 Graduate Habit to Autopilot</Text>
                        </TouchableOpacity>
                      )}
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
          <View className="bg-[#09090B] rounded-t-[24px] px-5 pt-4 pb-8 h-[85%] border-t border-zinc-900">
            {/* Sheet Handle */}
            <View className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-5" />
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
      {/* 60-SECOND MINDFUL TRANSITION OVERLAY */}
      {activeTransitionTask && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={activeTransitionTask !== null}
          onRequestClose={cancelTransition}
        >
          <View className="flex-1 bg-black justify-center items-center px-6">
            <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Mindful Transition</Text>
            <Text className="text-zinc-50 text-2xl font-black text-center mb-10 px-4 leading-8">
              Preparing for: {activeTransitionTask.activity_name}
            </Text>

            {/* Breathing Animation Ring */}
            <View className="relative w-48 h-48 justify-center items-center mb-16">
              <Animated.View 
                style={{
                  transform: [{ scale: breathAnim }],
                  opacity: breathAnim.interpolate({
                    inputRange: [1, 1.3],
                    outputRange: [0.15, 0.4]
                  })
                }}
                className="absolute w-44 h-44 rounded-full bg-blue-500"
              />
              <View className="absolute w-36 h-36 rounded-full bg-blue-500/10 border border-blue-500/20" />
              <View className="w-28 h-28 rounded-full bg-[#09090B] border-2 border-blue-500/40 justify-center items-center">
                <Text className="text-blue-400 text-3xl font-black font-mono">
                  {String(Math.floor(transitionTimeLeft / 60)).padStart(2, '0')}:
                  {String(transitionTimeLeft % 60).padStart(2, '0')}
                </Text>
              </View>
            </View>

            <Text className="text-zinc-400 text-sm font-semibold text-center mb-2">Put your phone face down.</Text>
            <Text className="text-zinc-650 text-xs text-center mb-16 px-6 leading-5">
              Take a deep breath. Release external noise. Focus on the single action in front of you.
            </Text>

            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={cancelTransition}
                className="px-6 py-3 rounded-xl border border-zinc-900 bg-zinc-950/45 mr-3"
              >
                <Text className="text-zinc-500 text-xs font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (transitionTimerRef.current) clearInterval(transitionTimerRef.current);
                  setActiveTransitionTask(null);
                  showToast(`Focus session started for ${activeTransitionTask.activity_name}!`, 'success');
                }}
                className="px-6 py-3 rounded-xl bg-blue-500"
              >
                <Text className="text-[#09090B] text-xs font-bold">Skip Timer & Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* DAILY REFLECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reflectionModalVisible}
        onRequestClose={() => setReflectionModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/85 justify-end"
        >
          <View className="bg-[#09090B] rounded-t-[24px] px-5 pt-4 pb-8 h-[80%] border-t border-zinc-900">
            {/* Sheet Handle */}
            <View className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-5" />

            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-zinc-50 text-2xl font-black">Day Complete! 🎉</Text>
                <Text className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Daily Reflection</Text>
              </View>
              <TouchableOpacity
                className="bg-zinc-900 w-9 h-9 rounded-full justify-center items-center border border-zinc-800"
                onPress={() => setReflectionModalVisible(false)}
              >
                <X size={20} color="#F4F4F5" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {/* Question 1: Focus */}
              <View className="mb-6">
                <Text className="text-zinc-300 text-sm font-bold mb-3">Did you protect your focus today?</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => setReflectionFocus(1)}
                    className={`flex-1 py-3.5 rounded-xl border items-center mr-3 ${
                      reflectionFocus === 1 
                        ? 'bg-emerald-500/10 border-emerald-500' 
                        : 'bg-zinc-950 border-zinc-900'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${reflectionFocus === 1 ? 'text-emerald-400' : 'text-zinc-500'}`}>Yes, fully</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setReflectionFocus(0)}
                    className={`flex-1 py-3.5 rounded-xl border items-center ${
                      reflectionFocus === 0 
                        ? 'bg-red-500/10 border-red-500' 
                        : 'bg-zinc-950 border-zinc-900'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${reflectionFocus === 0 ? 'text-red-400' : 'text-zinc-500'}`}>No, distracted</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Question 2: Energy */}
              <View className="mb-6">
                <Text className="text-zinc-300 text-sm font-bold mb-3">Rate your overall energy level:</Text>
                <View className="flex-row">
                  {(['low', 'medium', 'high'] as const).map(level => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => setReflectionEnergy(level)}
                      className={`flex-1 py-3 rounded-xl border items-center capitalize ${
                        level !== 'high' ? 'mr-2' : ''
                      } ${
                        reflectionEnergy === level
                          ? level === 'high' ? 'bg-blue-500/10 border-blue-500' :
                            level === 'medium' ? 'bg-amber-500/10 border-amber-500' :
                            'bg-violet-500/10 border-violet-500'
                          : 'bg-zinc-950 border-zinc-900'
                      }`}
                    >
                      <Text 
                        className={`text-xs font-bold ${
                          reflectionEnergy === level 
                            ? level === 'high' ? 'text-blue-400' : level === 'medium' ? 'text-amber-400' : 'text-violet-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Question 3: Win */}
              <View className="mb-8">
                <Text className="text-zinc-300 text-sm font-bold mb-3">What was your biggest win today?</Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-zinc-50 text-sm h-24 align-top"
                  placeholder="Today I finished my SQLite migrations, stayed clean of social media, or worked out..."
                  placeholderTextColor="#3F3F46"
                  value={reflectionWin}
                  onChangeText={setReflectionWin}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={async () => {
                  if (reflectionFocus === null || !reflectionEnergy) {
                    showToast('Please answer the ratings questions', 'warning');
                    return;
                  }
                  try {
                    await db.runAsync(
                      `INSERT INTO daily_reflections (log_date, focus_rating, energy_level, win_text)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(log_date) DO UPDATE SET
                         focus_rating = excluded.focus_rating,
                         energy_level = excluded.energy_level,
                         win_text = excluded.win_text;`,
                      [selectedDayDateString, reflectionFocus, reflectionEnergy, reflectionWin]
                    );
                    showToast('Reflection saved successfully!', 'success');
                    setReflectionModalVisible(false);

                    // Compute streak progress to verify milestone checkpoints
                    const todayStr = todayInfo.dateStr;
                    const progressList = await db.getAllAsync<DayProgress>(
                      `WITH RECURSIVE dates(date) AS (
                         VALUES(date(?, '-99 days'))
                         UNION ALL
                         SELECT date(date, '+1 day') FROM dates WHERE date < ?
                       )
                       SELECT 
                         d.date,
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
                         ) as total_completed,
                         (SELECT COUNT(*) FROM day_exceptions WHERE log_date = d.date AND exception_type = 'freeze') as is_frozen
                       FROM dates d
                       ORDER BY d.date DESC;`,
                      [todayStr, todayStr]
                    );

                    const { currentStreak: streak } = calculateStreaks(progressList);

                    const isMilestone = [7, 30, 100].includes(streak);
                    if (isMilestone) {
                      const alreadyLogged = await db.getFirstAsync<{ count: number }>(
                        `SELECT COUNT(*) as count FROM milestone_reflections WHERE milestone_day = ?;`,
                        [streak]
                      );
                      if (!alreadyLogged || alreadyLogged.count === 0) {
                        setCurrentMilestoneDay(streak);
                        setMilestoneFeelings('');
                        setMilestoneChanges('');
                        setTimeout(() => {
                          setMilestoneModalVisible(true);
                        }, 500);
                      }
                    }

                    await loadStreaks();
                  } catch (error) {
                    console.error('Error saving reflection:', error);
                    showToast('Failed to save reflection', 'error');
                  }
                }}
                className="py-4 bg-zinc-50 rounded-xl items-center mb-10"
              >
                <Text className="text-zinc-950 text-sm font-bold">Save reflection & Close Day</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MILESTONE REFLECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={milestoneModalVisible}
        onRequestClose={() => setMilestoneModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/85 justify-end"
        >
          <View className="bg-[#09090B] rounded-t-[24px] px-5 pt-4 pb-8 h-[85%] border-t border-zinc-900">
            {/* Sheet Handle */}
            <View className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-5" />

            <View className="items-center mb-6">
              <Text className="text-4xl mb-2">🎉</Text>
              <Text className="text-amber-400 text-2xl font-black">{currentMilestoneDay}-Day Checkpoint!</Text>
              <Text className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mt-1">Unlock Milestone Achievement</Text>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <Text className="text-zinc-400 text-xs text-center leading-5 mb-6 px-4">
                Incredible discipline. You have kept your routine alive for {currentMilestoneDay} consecutive days. Let's capture this state of mind.
              </Text>

              {/* Question 1: Feelings */}
              <View className="mb-5">
                <Text className="text-zinc-300 text-sm font-bold mb-2">What do you feel now?</Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-zinc-50 text-sm h-24 align-top"
                  placeholder="I feel more energetic, less restless, and more focused on my long-term build..."
                  placeholderTextColor="#3F3F46"
                  value={milestoneFeelings}
                  onChangeText={setMilestoneFeelings}
                />
              </View>

              {/* Question 2: Changes */}
              <View className="mb-8">
                <Text className="text-zinc-300 text-sm font-bold mb-2">What are the changes from Day 1 to now?</Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-zinc-50 text-sm h-24 align-top"
                  placeholder="On Day 1 I struggled to start, but now coding and workout routines are automatic habits..."
                  placeholderTextColor="#3F3F46"
                  value={milestoneChanges}
                  onChangeText={setMilestoneChanges}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={async () => {
                  if (!milestoneFeelings.trim() || !milestoneChanges.trim()) {
                    showToast('Please share your thoughts for both fields', 'warning');
                    return;
                  }
                  try {
                    await db.runAsync(
                      `INSERT INTO milestone_reflections (milestone_day, log_date, feelings_text, changes_text)
                       VALUES (?, ?, ?, ?);`,
                      [currentMilestoneDay || 7, selectedDayDateString, milestoneFeelings, milestoneChanges]
                    );
                    showToast(`${currentMilestoneDay}-Day Checkpoint recorded! 🔓`, 'success');
                    setMilestoneModalVisible(false);
                    await loadStreaks();
                  } catch (error) {
                    console.error('Error saving milestone reflection:', error);
                    showToast('Failed to record checkpoint', 'error');
                  }
                }}
                className="py-4 bg-amber-500 rounded-xl items-center mb-10"
              >
                <Text className="text-[#09090B] text-sm font-black">Record Checkpoint & Lock in</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Toast Notification */}
      {toast.visible && (
        <Animated.View
          style={{
            transform: [{ translateY: toastY }],
            opacity: toastOpacity,
            position: 'absolute',
            top: Platform.OS === 'ios' ? 55 : 25,
            left: 20,
            right: 20,
            zIndex: 9999,
          }}
          className={`flex-row items-center bg-[#121214] border px-4 py-3.5 rounded-2xl shadow-2xl ${
            toast.type === 'success' ? 'border-emerald-500/30' :
            toast.type === 'info' ? 'border-blue-500/30' :
            toast.type === 'warning' ? 'border-amber-500/30' :
            'border-red-500/30'
          }`}
        >
          {toast.type === 'success' && <Check size={18} color="#10B981" className="mr-3" />}
          {toast.type === 'info' && <Info size={18} color="#3B82F6" className="mr-3" />}
          {toast.type === 'warning' && <AlertCircle size={18} color="#F59E0B" className="mr-3" />}
          {toast.type === 'error' && <AlertCircle size={18} color="#EF4444" className="mr-3" />}
          
          <Text className="text-zinc-100 text-xs font-bold flex-1">
            {toast.message}
          </Text>
        </Animated.View>
      )}
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
