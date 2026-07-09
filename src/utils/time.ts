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
