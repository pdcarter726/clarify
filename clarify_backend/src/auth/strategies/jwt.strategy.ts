import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Shape of the signed JWT payload (`sub` is the user id). */
export interface JwtPayload {
  sub: number;
  email: string;
}

/**
 * Passport strategy that verifies bearer JWTs against JWT_SECRET.
 * Expired tokens are rejected (ignoreExpiration: false).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  /** Called by Passport once the token signature/expiry checks pass; result becomes `request.user`. */
  validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email };
  }
}
