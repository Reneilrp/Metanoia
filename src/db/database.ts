import * as SQLite from 'expo-sqlite';

export interface MasterScheduleItem {
  id: number;
  day_of_week: string;
  time_start: string;
  activity_name: string;
  category: 'fitness' | 'code' | 'rest' | 'mindset';
  estimated_duration: number;
}

export interface DailyTaskItem {
  id: number; // master_schedule.id
  time_start: string;
  activity_name: string;
  category: 'fitness' | 'code' | 'rest' | 'mindset';
  estimated_duration: number;
  is_completed: number; // 0 or 1
  completed_7: number;
  completed_30: number;
  completed_100: number;
}

export interface DailyReflectionItem {
  log_date: string;
  focus_rating: number; // 0 or 1
  energy_level: 'low' | 'medium' | 'high';
  win_text: string;
}


/**
 * Initializes tables and triggers automatic relational seeding for Metanoia.
 * Built for modern async execution in expo-sqlite.
 */
export const initializeDatabase = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  // 1. Enforce SQLite schema structures and composite performance index
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS master_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week TEXT NOT NULL,
        time_start TEXT NOT NULL,
        activity_name TEXT NOT NULL,
        category TEXT NOT NULL,
        estimated_duration INTEGER DEFAULT 60
    );

    CREATE TABLE IF NOT EXISTS progress_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER NOT NULL,
        log_date TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        FOREIGN KEY(schedule_id) REFERENCES master_schedule(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_date_schedule 
    ON progress_logs (log_date, schedule_id);

    CREATE TABLE IF NOT EXISTS day_exceptions (
        log_date TEXT PRIMARY KEY,
        exception_type TEXT NOT NULL DEFAULT 'freeze'
    );

    CREATE TABLE IF NOT EXISTS daily_reflections (
        log_date TEXT PRIMARY KEY,
        focus_rating INTEGER,
        energy_level TEXT,
        win_text TEXT
    );
  `);

  // 2. Guard clause: Check if seeding has already executed previously
  const checkSeed = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM master_schedule;'
  );

  if (checkSeed && checkSeed.count > 0) {
    return; // Schema matches and rows exist. Terminate seeding.
  }

  // 3. Define standard repeatable schedule framework
  const structuralDayTemplate = [
    { time: '05:30', name: 'Wake up & Sunlight Exposure', cat: 'mindset', dur: 30 },
    // Slot 06:00 is calculated dynamically based on daily fitness variation
    { time: '08:30', name: 'Deep Work: System Architecture & Coding', cat: 'code', dur: 210 },
    { time: '13:30', name: 'Secondary Work: API Debugging & Tasks', cat: 'code', dur: 210 },
    { time: '17:00', name: 'The Play Window: Gaming / Anime / Manga', cat: 'rest', dur: 150 },
    { time: '19:30', name: 'Dinner & Heavy Tech Wind Down', cat: 'rest', dur: 60 },
    { time: '20:30', name: 'Digital Blackout: Book Reading Ritual', cat: 'mindset', dur: 60 },
    { time: '21:30', name: 'Sleep & Deep Recovery Window', cat: 'rest', dur: 480 },
  ];

  // Specific training parameters per day
  const physicalWorkoutsByDay: Record<string, { name: string; cat: string }> = {
    Mon: { name: 'Calisthenics: Upper Body Push & Pull', cat: 'fitness' },
    Tue: { name: 'Active Recovery: Steady Biking & Hip Mobility', cat: 'fitness' },
    Wed: { name: 'Calisthenics: Lower Body Strength (Legs)', cat: 'fitness' },
    Thu: { name: 'Full Rest & Mental Reset Window', cat: 'mindset' },
    Fri: { name: 'Calisthenics: Full Body Conditioning', cat: 'fitness' },
    Sat: { name: 'Endurance: Long Bike Ride (10-15 km)', cat: 'fitness' },
    Sun: { name: 'System Prep: Weekly Task & Schedule Review', cat: 'mindset' },
  };

  const dayMatrix = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // 4. Batch loop injection into local hardware storage
  for (const day of dayMatrix) {
    const targetExercise = physicalWorkoutsByDay[day];
    
    // Stitch standard array timeline blocks together with daily fitness parameters
    const compiledDailyTimeline = [
      structuralDayTemplate[0], // 05:30 AM
      { time: '06:00', name: targetExercise.name, cat: targetExercise.cat, dur: 60 }, // 06:00 AM
      ...structuralDayTemplate.slice(1) // 08:30 AM to Night
    ];

    for (const item of compiledDailyTimeline) {
      await db.runAsync(
        `INSERT INTO master_schedule (day_of_week, time_start, activity_name, category, estimated_duration) 
         VALUES (?, ?, ?, ?, ?);`,
        [day, item.time, item.name, item.cat, item.dur]
      );
    }
  }
};
