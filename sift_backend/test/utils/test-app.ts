import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export const TEST_EMAIL_DOMAIN = 'e2e-test.sift.invalid';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export function uniqueEmail(label: string): string {
  return `${label}_${Date.now()}_${Math.random().toString(36).slice(2)}@${TEST_EMAIL_DOMAIN}`;
}

export async function cleanupTestUsers(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
  });
}
