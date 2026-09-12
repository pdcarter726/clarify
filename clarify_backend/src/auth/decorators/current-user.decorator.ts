import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Param decorator that extracts the authenticated user's id from the
 * request (populated by {@link JwtAuthGuard}). Use only on routes guarded
 * by JwtAuthGuard, otherwise `request.user` is undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request.user as { userId: number }).userId;
  },
);
