import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws ConflictException when the email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com' });

      await expect(
        service.create({ email: 'a@b.com', password: 'password1' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password and creates the user without exposing the hash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      prisma.user.create.mockResolvedValue({ id: 1, email: 'a@b.com' });

      const result = await service.create({ email: 'a@b.com', password: 'password1' });

      expect(bcrypt.hash).toHaveBeenCalledWith('password1', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'a@b.com', passwordHash: 'hashed-pw' },
        omit: { passwordHash: true },
      });
      expect(result).toEqual({ id: 1, email: 'a@b.com' });
    });
  });

  describe('findOne', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com' });
      const result = await service.findOne(1);
      expect(result).toEqual({ id: 1, email: 'a@b.com' });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('delegates directly to prisma', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com' });
      const result = await service.findByEmail('a@b.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
      expect(result).toEqual({ id: 1, email: 'a@b.com' });
    });
  });

  describe('update', () => {
    const existingUser = { id: 1, email: 'a@b.com', passwordHash: 'old-hash' };

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(1, { currentPassword: 'password1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when currentPassword is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.update(1, { currentPassword: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when changing to an email already in use', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(existingUser) // findWithPassword
        .mockResolvedValueOnce({ id: 2, email: 'taken@b.com' }); // email lookup
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.update(1, { currentPassword: 'password1', email: 'taken@b.com' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('allows changing email to the same address without a conflict check', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ id: 1, email: 'a@b.com' });

      await service.update(1, { currentPassword: 'password1', email: 'a@b.com' });

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { email: 'a@b.com', passwordHash: undefined },
        omit: { passwordHash: true },
      });
    });

    it('hashes a new password when provided', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      prisma.user.update.mockResolvedValue({ id: 1, email: 'a@b.com' });

      await service.update(1, { currentPassword: 'password1', password: 'newpassword1' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword1', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { email: undefined, passwordHash: 'new-hash' },
        omit: { passwordHash: true },
      });
    });
  });

  describe('remove', () => {
    const existingUser = { id: 1, email: 'a@b.com', passwordHash: 'old-hash' };

    it('throws UnauthorizedException when currentPassword is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.remove(1, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes the user when currentPassword is correct', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.delete.mockResolvedValue({ id: 1, email: 'a@b.com' });

      const result = await service.remove(1, 'password1');

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: { passwordHash: true },
      });
      expect(result).toEqual({ id: 1, email: 'a@b.com' });
    });
  });
});
