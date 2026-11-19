import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { VoiceService } from './voice.service.js';
import { TranscribeDto } from './dto/transcribe.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('transcribe')
  async transcribe(@Request() req: any, @Body() body: TranscribeDto) {
    return this.voiceService.transcribeAndAnalyze(req.user.id, body);
  }

  @Post('log')
  async logVoiceReflection(@Request() req: any, @Body() body: TranscribeDto) {
    return this.voiceService.saveVoiceReflection(req.user.id, body);
  }

  @Post('synthesize')
  async synthesizeBriefing(@Request() req: any, @Body('text') text: string) {
    return this.voiceService.synthesizeBriefing(req.user.id, text || '');
  }
}
