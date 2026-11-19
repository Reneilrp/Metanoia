import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Phase 4: Social Circles & Monetization (e2e)', () => {
  let app: INestApplication<App>;
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let circleId: string;
  let inviteCode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // User 1
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `social1_${Date.now()}@metanoia.app`,
        password: 'password123',
        displayName: 'Alice',
      });
    user1Token = res1.body.accessToken;
    user1Id = res1.body.user.id;

    // User 2
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `social2_${Date.now()}@metanoia.app`,
        password: 'password123',
        displayName: 'Bob',
      });
    user2Token = res2.body.accessToken;
    user2Id = res2.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. should create an Accountability Circle with unique invite code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/circles')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: '5 AM Mindful Morning',
        description: 'Wake up early, hydrate, meditate',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('inviteCode');
    expect(res.body.name).toBe('5 AM Mindful Morning');
    circleId = res.body.id;
    inviteCode = res.body.inviteCode;
  });

  it('2. should allow another user to join the circle with invite code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/circles/join')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ inviteCode })
      .expect(201);

    expect(res.body).toHaveProperty('circleId', circleId);
    expect(res.body).toHaveProperty('userId', user2Id);
  });

  it('3. should list user circles with member completion milestones', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/circles')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: any) => c.id === circleId)).toBe(true);
  });

  it('4. should send a non-toxic encouragement reaction', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/circles/react')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        circleId,
        receiverId: user2Id,
        emoji: '🔥',
      })
      .expect(201);

    expect(res.body).toHaveProperty('emoji', '🔥');
    expect(res.body.senderId).toBe(user1Id);
    expect(res.body.receiverId).toBe(user2Id);
  });

  it('5. should fetch free tier entitlements', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/subscription')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    expect(res.body.tier).toBe('free');
    expect(res.body.isPro).toBe(false);
    expect(res.body.entitlements.maxHabits).toBe(5);
  });

  it('6. should upgrade user to Metanoia Pro tier', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/upgrade-pro')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ tier: 'pro_annual' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.user.subscriptionTier).toBe('pro_annual');

    const checkRes = await request(app.getHttpServer())
      .get('/api/v1/users/subscription')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    expect(checkRes.body.isPro).toBe(true);
    expect(checkRes.body.entitlements.maxHabits).toBe(999);
  });

  it('7. should export GDPR-compliant personal data with health disclaimer', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/export-data')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    expect(res.body).toHaveProperty('exportDate');
    expect(res.body).toHaveProperty('disclaimer');
    expect(res.body.userData.email).toContain('social1_');
    expect(res.body.userData).not.toHaveProperty('passwordHash');
  });
});
