import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Route guard that requires a valid bearer JWT (delegates to the
 * 'jwt' Passport strategy). Rejects unauthenticated requests with 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
