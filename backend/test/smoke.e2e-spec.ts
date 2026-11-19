import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('System Smoke Test (Backend Core)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({ origin: true, credentials: true });
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. [Smoke] Database connection should be alive and healthy', async () => {
    // Run simple query to check DB liveness
    const result = await prisma.$queryRaw`SELECT 1 as healthy`;
    expect(result).toBeDefined();
  });

  it('2. [Smoke] Public App Controller endpoint should return 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1').expect(200);
    expect(res.text).toBe('Hello World!');
  });

  it('3. [Smoke] CORS preflight OPTIONS request should return allowed headers', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(res.headers).toHaveProperty('access-control-allow-origin');
  });

  it('4. [Smoke] Protected endpoints should immediately reject unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/sync/status').expect(401);
    await request(app.getHttpServer()).get('/api/v1/habits').expect(401);
    await request(app.getHttpServer()).get('/api/v1/circles').expect(401);
    await request(app.getHttpServer()).get('/api/v1/users/subscription').expect(401);
  });
});
