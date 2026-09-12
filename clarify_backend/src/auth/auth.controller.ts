import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/** Handles registration, login, and identity lookup for the current session. */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Creates a new user account and returns a signed JWT for it. */
  @Post('signup')
  signup(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto);
  }

  /** Verifies credentials and returns a signed JWT on success. */
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** Returns the identity attached to the request by {@link JwtAuthGuard}. Requires a valid bearer token. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.user;
  }
}
