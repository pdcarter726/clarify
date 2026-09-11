import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { create: jest.Mock; findByEmail: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(() => {
    usersService = { create: jest.fn(), findByEmail: jest.fn() };
    jwtService = { signAsync: jest.fn() };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('creates the user and returns an access token', async () => {
      usersService.create.mockResolvedValue({ id: 1, email: 'a@b.com' });
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.signup({ email: 'a@b.com', password: 'password1' });

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'password1',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 1, email: 'a@b.com' });
      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('propagates errors from user creation (e.g. duplicate email)', async () => {
      usersService.create.mockRejectedValue(new Error('duplicate'));

      await expect(
        service.signup({ email: 'a@b.com', password: 'password1' }),
      ).rejects.toThrow('duplicate');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@b.com', password: 'password1' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('returns an access token on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.login({ email: 'a@b.com', password: 'password1' });

      expect(bcrypt.compare).toHaveBeenCalledWith('password1', 'hashed');
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 1, email: 'a@b.com' });
      expect(result).toEqual({ accessToken: 'signed-token' });
    });
  });
});
