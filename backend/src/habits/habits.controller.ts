import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { HabitsService } from './habits.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  async getHabits(@Request() req: any, @Query('date') date?: string) {
    return this.habitsService.getHabitsWithTodayStatus(req.user.id, date);
  }

  @Post()
  async createHabit(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      frequencyType?: string;
      targetCount?: number;
    },
  ) {
    return this.habitsService.createHabit(req.user.id, body);
  }

  @Post(':id/toggle')
  async toggleCompletion(
    @Request() req: any,
    @Param('id') habitId: string,
    @Body('date') date?: string,
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.habitsService.toggleCompletion(req.user.id, habitId, targetDate);
  }

  @Get('stats/streaks')
  async getStreakStats(@Request() req: any) {
    return this.habitsService.getStreakStats(req.user.id);
  }
}
