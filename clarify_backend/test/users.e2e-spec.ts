import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupTestUsers, uniqueEmail } from './utils/test-app';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  async function signup(label: string) {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);
    return { email, token: res.body.accessToken as string };
  }

  it('rejects all /users routes without a token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
    await request(app.getHttpServer()).patch('/users/me').send({}).expect(401);
    await request(app.getHttpServer()).delete('/users/me').send({}).expect(401);
  });

  it('no longer exposes user listing or lookup by arbitrary id', async () => {
    const { token } = await signup('noleak');

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/users/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('returns the caller\'s own profile from GET /users/me', async () => {
    const { email, token } = await signup('getme');

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ email });
    expect(res.body.passwordHash).toBeUndefined();
  });

  describe('PATCH /users/me', () => {
    it('requires currentPassword', async () => {
      const { token } = await signup('patchreq');

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: uniqueEmail('newemail') })
        .expect(400);
    });

    it('rejects an incorrect currentPassword', async () => {
      const { token } = await signup('patchwrong');

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: uniqueEmail('newemail'), currentPassword: 'not-the-password' })
        .expect(401);
    });

    it('rejects changing to an email already in use by another account', async () => {
      const { email: takenEmail } = await signup('taken');
      const { token } = await signup('patchconflict');

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: takenEmail, currentPassword: 'Password1!' })
        .expect(409);
    });

    it('updates the email with the correct currentPassword', async () => {
      const { token } = await signup('patchok');
      const newEmail = uniqueEmail('patched');

      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: newEmail, currentPassword: 'Password1!' })
        .expect(200);

      expect(res.body.email).toBe(newEmail);
    });

    it('updates the password, and the old password no longer logs in', async () => {
      const { email, token } = await signup('patchpw');

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'NewPassword1!', currentPassword: 'Password1!' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'NewPassword1!' })
        .expect(201);
    });
  });

  describe('DELETE /users/me', () => {
    it('requires currentPassword', async () => {
      const { token } = await signup('delreq');

      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('rejects an incorrect currentPassword', async () => {
      const { token } = await signup('delwrong');

      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'not-the-password' })
        .expect(401);
    });

    it('deletes the account with the correct currentPassword, and the token stops working', async () => {
      const { token } = await signup('delok');

      await request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Password1!' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
