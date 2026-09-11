import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Application entry point. Enables CORS and a global validation pipe
 * (whitelisting/stripping unknown properties and transforming payloads
 * to their DTO types) before starting the HTTP listener.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
