import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Post,
  Query,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AiService, ChatMessage } from './ai.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('streak-rescue')
  async getStreakRescue(@Request() req: any, @Body('habitId') habitId: string) {
    return this.aiService.getStreakRescue(req.user.id, habitId);
  }

  @Get('weekly-review')
  async getWeeklyReview(@Request() req: any) {
    return this.aiService.getWeeklyReview(req.user.id);
  }

  @Post('chat')
  async chat(
    @Request() req: any,
    @Body('message') message: string,
    @Body('history') history?: ChatMessage[],
  ) {
    return this.aiService.chat(req.user.id, message, history || []);
  }

  @Sse('chat/stream')
  streamChat(
    @Request() req: any,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    const generator = this.aiService.streamChat(req.user.id, message || 'Hello coach');

    return from(generator).pipe(
      map((chunk) => ({
        data: { text: chunk },
      }) as MessageEvent),
    );
  }
}
