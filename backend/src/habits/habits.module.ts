import { Module } from '@nestjs/common';
import { HabitsService } from './habits.service.js';
import { HabitsController } from './habits.controller.js';

@Module({
  controllers: [HabitsController],
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
