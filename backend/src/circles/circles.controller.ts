import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { CirclesService } from './circles.service.js';
import { CreateCircleDto, JoinCircleDto, SendReactionDto } from './dto/create-circle.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('circles')
export class CirclesController {
  constructor(private readonly circlesService: CirclesService) {}

  @Post()
  async createCircle(@Request() req: any, @Body() dto: CreateCircleDto) {
    return this.circlesService.createCircle(req.user.id, dto);
  }

  @Post('join')
  async joinCircle(@Request() req: any, @Body() dto: JoinCircleDto) {
    return this.circlesService.joinCircle(req.user.id, dto);
  }

  @Get()
  async getMyCircles(@Request() req: any) {
    return this.circlesService.getUserCircles(req.user.id);
  }

  @Post('react')
  async sendReaction(@Request() req: any, @Body() dto: SendReactionDto) {
    return this.circlesService.sendReaction(req.user.id, dto);
  }
}
