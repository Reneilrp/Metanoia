import { Body, Controller, Delete, Get, Post, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('subscription')
  async getSubscription(@Request() req: any) {
    return this.usersService.getSubscription(req.user.id);
  }

  @Post('upgrade-pro')
  async upgradePro(
    @Request() req: any,
    @Body('tier') tier?: 'pro_monthly' | 'pro_annual',
  ) {
    return this.usersService.upgradePro(req.user.id, tier || 'pro_monthly');
  }

  @Get('export-data')
  async exportData(@Request() req: any) {
    return this.usersService.exportData(req.user.id);
  }

  @Delete('account')
  async deleteAccount(@Request() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
