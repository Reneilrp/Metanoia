import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service.js';
import { VoiceController } from './voice.controller.js';

@Module({
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
