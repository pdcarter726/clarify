import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

/** Issues JWTs for newly created and authenticating users. */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Creates the user via {@link UsersService.create} and immediately signs them in. */
  async signup(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return this.buildToken(user.id, user.email);
  }

  /**
   * Looks up the user by email and compares the password hash.
   * @throws UnauthorizedException if the email is unknown or the password doesn't match.
   */
  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !(await bcrypt.compare(loginDto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.buildToken(user.id, user.email);
  }

  private async buildToken(userId: number, email: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
    });
    return { accessToken };
  }
}
