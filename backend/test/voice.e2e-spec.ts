import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Voice & Multi-Modal Journaling (Phase 3 e2e)', () => {
  let app: INestApplication<App>;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Register user
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `voice_tester_${Date.now()}@metanoia.app`,
        password: 'password123',
        displayName: 'Voice Tester',
      });

    jwtToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. should transcribe audio and extract psychological sentiment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/voice/transcribe')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        durationSeconds: 20,
      })
      .expect(201);

    expect(res.body).toHaveProperty('transcription');
    expect(res.body).toHaveProperty('sentiment');
    expect(res.body).toHaveProperty('energyLevel');
    expect(res.body).toHaveProperty('identifiedObstacles');
    expect(res.body).toHaveProperty('suggestedHabitAdjustment');
    expect(Array.isArray(res.body.identifiedObstacles)).toBe(true);
  });

  it('2. should automatically log transcribed voice reflection to database', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/voice/log')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        title: 'Evening Voice Check-in',
        durationSeconds: 25,
      })
      .expect(201);

    expect(res.body).toHaveProperty('reflection');
    expect(res.body).toHaveProperty('analysis');
    expect(res.body.reflection.content).toBe(res.body.analysis.transcription);
    expect(res.body.reflection.moodRating).toBe(res.body.analysis.energyLevel);
  });

  it('3. should generate coach voice briefing synthesis metadata', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/voice/synthesize')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        text: 'Great work maintaining your meditation streak this morning!',
      })
      .expect(201);

    expect(res.body).toHaveProperty('readyForPlayback', true);
    expect(res.body).toHaveProperty('voice');
  });
});
