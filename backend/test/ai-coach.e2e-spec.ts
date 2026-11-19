import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('AI Coach Engine (Phase 2 e2e)', () => {
  let app: INestApplication<App>;
  let jwtToken: string;
  let habitId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Register test user
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `ai_tester_${Date.now()}@metanoia.app`,
        password: 'password123',
        displayName: 'AI Tester',
      });

    jwtToken = res.body.accessToken;

    // Create a habit
    const habitRes = await request(app.getHttpServer())
      .post('/api/v1/habits')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Daily Reading',
        description: 'Read 20 minutes',
      });

    habitId = habitRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. should return AI status as quota-safe and disabled by default', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ai/status')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('freeTierSafe', true);
    expect(res.body).toHaveProperty('mode');
    expect(res.body.enabled).toBe(false);
  });

  it('2. should generate structured Streak Rescue advice without external quota usage', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/streak-rescue')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ habitId })
      .expect(201);

    expect(res.body).toHaveProperty('empathyMessage');
    expect(res.body).toHaveProperty('psychologyInsight');
    expect(res.body).toHaveProperty('microAction');
    expect(res.body).toHaveProperty('restorationPlan');
    expect(res.body.source).toBe('local_fallback');
  });

  it('3. should generate Weekly Retrospective analysis', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ai/weekly-review')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('overallConsistencyPercent');
    expect(res.body).toHaveProperty('frictionPoint');
    expect(res.body).toHaveProperty('nextWeekExperiment');
    expect(res.body).toHaveProperty('encouragementQuote');
  });

  it('4. should respond compassionately to user coaching queries', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        message: 'I missed my streak today and I feel guilty.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('content');
    expect(res.body).toHaveProperty('role', 'assistant');
    expect(res.body.content.length).toBeGreaterThan(20);
  });
});
