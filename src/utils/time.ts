/**
 * Helper to calculate the YYYY-MM-DD date string for any target day of the week
 * relative to the current active calendar week of a baseDate (aligned Mon-Sun).
 * 
 * @param targetDay - 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', or 'Sun'
 * @param baseDate - The current device system clock Date
 */
export const getDateStringForDay = (targetDay: string, baseDate: Date): string => {
  const dayIndices: { [key: string]: number } = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };

  const targetIndex = dayIndices[targetDay];
  if (!targetIndex) return '';
  
  // JS getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We align it to Mon (1) through Sun (7)
  let currentDayIndex = baseDate.getDay();
  if (currentDayIndex === 0) {
    currentDayIndex = 7;
  }
  
  // Calculate difference in days relative to the Monday-to-Sunday week
  const diff = targetIndex - currentDayIndex;
  const targetDate = new Date(baseDate);
  targetDate.setDate(baseDate.getDate() + diff);
  
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const date = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

/**
 * Calculates whether a task is currently active based on its start time, 
 * duration, and the current device time, along with the percentage elapsed.
 * 
 * @param timeStart - Start time in 'HH:MM' 24h format
 * @param durationMinutes - Duration in minutes
 * @param currentTime - The current device clock Date
 */
export const getTaskStatus = (
  timeStart: string, 
  durationMinutes: number, 
  currentTime: Date
): { isActive: boolean; isPast: boolean; percentElapsed: number } => {
  const [startHour, startMin] = timeStart.split(':').map(Number);
  const startTotal = startHour * 60 + startMin;
  
  const currentHour = currentTime.getHours();
  const currentMin = currentTime.getMinutes();
  const currentTotal = currentHour * 60 + currentMin;
  
  const endTotal = startTotal + durationMinutes;
  
  const isActive = currentTotal >= startTotal && currentTotal < endTotal;
  const isPast = currentTotal >= endTotal;
  
  let percentElapsed = 0;
  if (isActive) {
    percentElapsed = ((currentTotal - startTotal) / durationMinutes) * 100;
  }
  
  return { isActive, isPast, percentElapsed };
};

export interface DayProgress {
  date: string;
  day_of_week: string;
  total_scheduled: number;
  total_completed: number;
}

/**
 * Calculates current and longest streaks based on daily completions over 100 days.
 * Rest days (0 scheduled tasks) are considered neutral and do not break the streak.
 */
export const calculateStreaks = (
  progressList: DayProgress[]
): { currentStreak: number; longestStreak: number } => {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Calculate longest streak chronologically (oldest to newest, i.e., index N to 0)
  const chronological = [...progressList].reverse();
  for (const day of chronological) {
    const isPerfect = day.total_scheduled > 0 
      ? day.total_completed === day.total_scheduled 
      : true; // Neutral rest day

    if (isPerfect) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Calculate current streak walking backwards from today (today is at index 0)
  if (progressList.length > 0) {
    const todayProgress = progressList[0];
    const isTodayPerfect = todayProgress.total_scheduled > 0 
      ? todayProgress.total_completed === todayProgress.total_scheduled 
      : true;

    let startIndex = 0;
    if (!isTodayPerfect) {
      // If today is not perfect yet, but we are still in today, the streak is not broken unless yesterday was also not perfect
      startIndex = 1;
    }

    for (let i = startIndex; i < progressList.length; i++) {
      const day = progressList[i];
      const isPerfect = day.total_scheduled > 0 
        ? day.total_completed === day.total_scheduled 
        : true;

      if (isPerfect) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }
  }

  return { currentStreak, longestStreak };
};

