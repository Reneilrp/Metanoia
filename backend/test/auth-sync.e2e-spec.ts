import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Auth & Sync Protocol (e2e)', () => {
  let app: INestApplication<App>;
  let jwtToken: string;
  let testUserId: string;
  const testEmail = `test_${Date.now()}@metanoia.app`;
  const habitId = `habit_${Date.now()}`;
  const completionId = `comp_${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. should register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        displayName: 'Test Runner',
      })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toHaveProperty('email', testEmail);
    expect(res.body.user).toHaveProperty('id');
    jwtToken = res.body.accessToken;
    testUserId = res.body.user.id;
  });

  it('2. should log in with registered credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'password123',
      })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(testEmail);
  });

  it('3. should access protected /auth/me route with token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body.id).toBe(testUserId);
    expect(res.body.displayName).toBe('Test Runner');
  });

  it('4. should push local changes via /sync/push', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        habits: [
          {
            id: habitId,
            name: 'Morning Meditation',
            description: '10 minutes mindfulness',
            color: '#10b981',
            icon: 'sun',
            frequencyType: 'daily',
            targetCount: 1,
            version: 1,
          },
        ],
        habitCompletions: [
          {
            id: completionId,
            habitId: habitId,
            completedDate: '2026-10-02',
            value: 1,
            notes: 'Felt very calm',
          },
        ],
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('processedAt');
  });

  it('5. should pull synced data via /sync/pull', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('habits');
    expect(res.body).toHaveProperty('habitCompletions');
    expect(res.body.habits.some((h: any) => h.id === habitId)).toBe(true);
    expect(res.body.habitCompletions.some((c: any) => c.id === completionId)).toBe(true);
  });

  it('6. should return accurate sync status counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sync/status')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body.counts.habits).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.completions).toBeGreaterThanOrEqual(1);
  });
});
