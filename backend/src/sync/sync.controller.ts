import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { SyncPushDto } from './dto/sync-push.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  async push(@Request() req: any, @Body() dto: SyncPushDto) {
    return this.syncService.push(req.user.id, dto);
  }

  @Get('pull')
  async pull(@Request() req: any, @Query('since') since?: string) {
    return this.syncService.pull(req.user.id, since);
  }

  @Get('status')
  async status(@Request() req: any) {
    return this.syncService.getSyncStatus(req.user.id);
  }
}
