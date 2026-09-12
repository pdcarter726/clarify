import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupTestUsers, uniqueEmail } from './utils/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  it('rejects signup with an invalid email', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'Password1!' })
      .expect(400);
  });

  it('rejects signup with a too-short password', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: uniqueEmail('short'), password: 'short' })
      .expect(400);
  });

  it('signs up a new user and returns an access token', async () => {
    const email = uniqueEmail('signup');
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);

    expect(typeof res.body.accessToken).toBe('string');
  });

  it('rejects signup with an email that is already registered', async () => {
    const email = uniqueEmail('dupe');
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(409);
  });

  it('rejects login for a nonexistent user', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'Password1!' })
      .expect(401);
  });

  it('rejects login with the wrong password', async () => {
    const email = uniqueEmail('wrongpw');
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'incorrect-password' })
      .expect(401);
  });

  it('logs in with correct credentials and returns an access token', async () => {
    const email = uniqueEmail('login');
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Password1!' })
      .expect(201);

    expect(typeof res.body.accessToken).toBe('string');
  });

  it('rejects /auth/me with no token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects /auth/me with a garbage token', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('returns the authenticated user payload from /auth/me', async () => {
    const email = uniqueEmail('me');
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);
    const token = signupRes.body.accessToken;

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ userId: expect.any(Number), email });
  });
});
