import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SyncModule } from './sync/sync.module.js';
import { HabitsModule } from './habits/habits.module.js';
import { AiModule } from './ai/ai.module.js';
import { VoiceModule } from './voice/voice.module.js';
import { CirclesModule } from './circles/circles.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SyncModule,
    HabitsModule,
    AiModule,
    VoiceModule,
    CirclesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
