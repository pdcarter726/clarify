import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupTestUsers, uniqueEmail } from './utils/test-app';

const FIXTURE_HTML = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org/',
  '@type': 'Recipe',
  name: 'Fixture Pancakes',
  recipeYield: '4 servings',
  prepTime: 'PT10M',
  cookTime: 'PT15M',
  recipeIngredient: ['2 cups flour', '1 egg'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Mix.' },
    { '@type': 'HowToStep', text: 'Cook.' },
  ],
})}</script></head><body></body></html>`;

describe('Recipes (e2e)', () => {
  let app: INestApplication;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function signup(label: string) {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'Password1!' })
      .expect(201);
    return { email, token: res.body.accessToken as string };
  }

  it('rejects all recipe routes without a token', async () => {
    await request(app.getHttpServer()).get('/recipes').expect(401);
    await request(app.getHttpServer()).post('/recipes').send({ title: 'X' }).expect(401);
    await request(app.getHttpServer()).get('/recipes/1').expect(401);
    await request(app.getHttpServer()).patch('/recipes/1').send({}).expect(401);
    await request(app.getHttpServer()).delete('/recipes/1').expect(401);
    await request(app.getHttpServer())
      .post('/recipes/import')
      .send({ url: 'https://example.com' })
      .expect(401);
  });

  it('allows a guest (no token) to preview an extraction, but not save it', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => FIXTURE_HTML }) as unknown as typeof fetch;

    const res = await request(app.getHttpServer())
      .post('/extraction')
      .send({ url: 'https://example.com/recipe' })
      .expect(201);
    expect(res.body.title).toBe('Fixture Pancakes');

    await request(app.getHttpServer())
      .post('/recipes/import')
      .send({ url: 'https://example.com/recipe' })
      .expect(401);
  });

  it('creates, lists, fetches, updates, and deletes a recipe for the authenticated user', async () => {
    const { token } = await signup('crud');

    const created = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Soup',
        ingredients: [{ name: 'water', quantity: '1', unit: 'l' }],
        instructions: [{ stepNumber: 1, text: 'Boil it' }],
      })
      .expect(201);
    const recipeId = created.body.id;
    expect(created.body.title).toBe('Test Soup');
    expect(created.body.ingredients).toHaveLength(1);

    const listed = await request(app.getHttpServer())
      .get('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Soup' })
      .expect(200);
    expect(updated.body.title).toBe('Updated Soup');

    await request(app.getHttpServer())
      .delete(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('returns 404, not another user\'s data, for operations on a recipe owned by someone else', async () => {
    const userA = await signup('isoA');
    const userB = await signup('isoB');

    const created = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ title: 'Secret Recipe' })
      .expect(201);
    const recipeId = created.body.id;

    await request(app.getHttpServer())
      .get(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ title: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(404);

    const bList = await request(app.getHttpServer())
      .get('/recipes')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(200);
    expect(bList.body).toEqual([]);

    const stillThere = await request(app.getHttpServer())
      .get(`/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);
    expect(stillThere.body.title).toBe('Secret Recipe');
  });

  it('previews an extraction without saving it', async () => {
    const { token } = await signup('preview');
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => FIXTURE_HTML }) as unknown as typeof fetch;

    const res = await request(app.getHttpServer())
      .post('/extraction')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/recipe' })
      .expect(201);

    expect(res.body.title).toBe('Fixture Pancakes');

    const listed = await request(app.getHttpServer())
      .get('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toEqual([]);
  });

  it('imports a recipe from a url and persists it for the authenticated user', async () => {
    const { token } = await signup('import');
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => FIXTURE_HTML }) as unknown as typeof fetch;

    const res = await request(app.getHttpServer())
      .post('/recipes/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/recipe' })
      .expect(201);

    expect(res.body.title).toBe('Fixture Pancakes');
    expect(res.body.ingredients).toHaveLength(2);
    expect(res.body.instructions).toHaveLength(2);

    const listed = await request(app.getHttpServer())
      .get('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].title).toBe('Fixture Pancakes');
  });
});
