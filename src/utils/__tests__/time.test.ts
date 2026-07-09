import { describe, expect, it } from '@jest/globals';
import { getDateStringForDay, getTaskStatus, calculateStreaks, DayProgress } from '../time';

describe('Time and Date Arithmetic Utilities', () => {
  describe('getDateStringForDay', () => {
    // Thursday, July 9, 2026 (now.getDay() === 4)
    const baseDate = new Date('2026-07-09T10:00:00');

    it('should correctly calculate the date string for Monday of the current week', () => {
      const result = getDateStringForDay('Mon', baseDate);
      expect(result).toBe('2026-07-06');
    });

    it('should correctly calculate the date string for Wednesday of the current week', () => {
      const result = getDateStringForDay('Wed', baseDate);
      expect(result).toBe('2026-07-08');
    });

    it('should correctly calculate the date string for Thursday of the current week (today)', () => {
      const result = getDateStringForDay('Thu', baseDate);
      expect(result).toBe('2026-07-09');
    });

    it('should correctly calculate the date string for Sunday of the current week', () => {
      const result = getDateStringForDay('Sun', baseDate);
      expect(result).toBe('2026-07-12');
    });

    it('should return empty string for invalid day name input', () => {
      const result = getDateStringForDay('InvalidDay', baseDate);
      expect(result).toBe('');
    });
  });

  describe('getTaskStatus', () => {
    // 08:30 AM start time, 210 minutes duration (ends at 12:00 PM)
    const timeStart = '08:30';
    const duration = 210; 

    it('should identify task as inactive and not past before start time', () => {
      // 08:00 AM
      const currentTime = new Date('2026-07-09T08:00:00');
      const result = getTaskStatus(timeStart, duration, currentTime);
      
      expect(result.isActive).toBe(false);
      expect(result.isPast).toBe(false);
      expect(result.percentElapsed).toBe(0);
    });

    it('should identify task as active and calculate progress during duration', () => {
      // 10:15 AM (105 minutes elapsed out of 210 minutes = exactly 50%)
      const currentTime = new Date('2026-07-09T10:15:00');
      const result = getTaskStatus(timeStart, duration, currentTime);
      
      expect(result.isActive).toBe(true);
      expect(result.isPast).toBe(false);
      expect(result.percentElapsed).toBe(50);
    });

    it('should identify task as past and inactive after completion time', () => {
      // 01:00 PM
      const currentTime = new Date('2026-07-09T13:00:00');
      const result = getTaskStatus(timeStart, duration, currentTime);
      
      expect(result.isActive).toBe(false);
      expect(result.isPast).toBe(true);
      expect(result.percentElapsed).toBe(0);
    });
  });

  describe('calculateStreaks', () => {
    it('should calculate correct current and longest streaks with perfect days', () => {
      const data: DayProgress[] = [
        { date: '2026-07-09', day_of_week: 'Thu', total_scheduled: 5, total_completed: 5 }, // today (perfect)
        { date: '2026-07-08', day_of_week: 'Wed', total_scheduled: 5, total_completed: 5 }, // yesterday (perfect)
        { date: '2026-07-07', day_of_week: 'Tue', total_scheduled: 5, total_completed: 4 }, // broken (not perfect)
        { date: '2026-07-06', day_of_week: 'Mon', total_scheduled: 5, total_completed: 5 }, // perfect
        { date: '2026-07-05', day_of_week: 'Sun', total_scheduled: 5, total_completed: 5 }, // perfect
        { date: '2026-07-04', day_of_week: 'Sat', total_scheduled: 5, total_completed: 5 }, // perfect
      ];

      const { currentStreak, longestStreak } = calculateStreaks(data);
      expect(currentStreak).toBe(2);
      expect(longestStreak).toBe(3);
    });

    it('should treat rest days (0 tasks) as neutral perfect days in streaks', () => {
      const data: DayProgress[] = [
        { date: '2026-07-09', day_of_week: 'Thu', total_scheduled: 5, total_completed: 5 }, // today (perfect)
        { date: '2026-07-08', day_of_week: 'Wed', total_scheduled: 0, total_completed: 0 }, // yesterday (rest day - neutral)
        { date: '2026-07-07', day_of_week: 'Tue', total_scheduled: 5, total_completed: 5 }, // perfect
      ];

      const { currentStreak, longestStreak } = calculateStreaks(data);
      expect(currentStreak).toBe(3);
      expect(longestStreak).toBe(3);
    });

    it('should not break current streak if today is not perfect yet but yesterday was', () => {
      const data: DayProgress[] = [
        { date: '2026-07-09', day_of_week: 'Thu', total_scheduled: 5, total_completed: 2 }, // today (not perfect yet)
        { date: '2026-07-08', day_of_week: 'Wed', total_scheduled: 5, total_completed: 5 }, // yesterday (perfect)
        { date: '2026-07-07', day_of_week: 'Tue', total_scheduled: 5, total_completed: 5 }, // perfect
      ];

      const { currentStreak, longestStreak } = calculateStreaks(data);
      expect(currentStreak).toBe(2); // starts counting backwards from yesterday
      expect(longestStreak).toBe(2);
    });

    it('should break current streak if yesterday was not perfect', () => {
      const data: DayProgress[] = [
        { date: '2026-07-09', day_of_week: 'Thu', total_scheduled: 5, total_completed: 2 }, // today (not perfect yet)
        { date: '2026-07-08', day_of_week: 'Wed', total_scheduled: 5, total_completed: 2 }, // yesterday (not perfect)
        { date: '2026-07-07', day_of_week: 'Tue', total_scheduled: 5, total_completed: 5 }, // perfect
      ];

      const { currentStreak, longestStreak } = calculateStreaks(data);
      expect(currentStreak).toBe(0); // broken
      expect(longestStreak).toBe(1); // the single perfect Tuesday
    });
  });
});
