import { describe, expect, it } from '@jest/globals';
import { getDateStringForDay, getTaskStatus } from '../time';

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
});
