import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

/**
 * Owns user accounts: signup, profile lookup/update, and account deletion.
 * Passwords are always bcrypt-hashed before storage and never returned
 * from methods that use `omitPassword` (findByEmail is the one exception,
 * used internally by AuthService to compare hashes).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly omitPassword = { passwordHash: true } as const;

  /**
   * Creates a user with a bcrypt-hashed password.
   * @throws ConflictException if the email is already registered.
   */
  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(createUserDto.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: { email: createUserDto.email, passwordHash },
      omit: this.omitPassword,
    });
  }

  /**
   * Fetches a user by id (password hash omitted).
   * @throws NotFoundException if `id` doesn't exist.
   */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: this.omitPassword,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Fetches a user by email including the password hash, for credential verification during login. */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  private async findWithPassword(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  private async verifyPassword(id: number, currentPassword: string) {
    const user = await this.findWithPassword(id);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    return user;
  }

  /**
   * Updates email and/or password after verifying `currentPassword`.
   * @throws NotFoundException if `id` doesn't exist.
   * @throws UnauthorizedException if `currentPassword` is wrong.
   * @throws ConflictException if the new email is already taken by another user.
   */
  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.verifyPassword(id, updateUserDto.currentPassword);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        email: updateUserDto.email,
        passwordHash: updateUserDto.password
          ? await bcrypt.hash(updateUserDto.password, SALT_ROUNDS)
          : undefined,
      },
      omit: this.omitPassword,
    });
  }

  /**
   * Permanently deletes a user's account after verifying their password.
   * @throws NotFoundException if `id` doesn't exist.
   * @throws UnauthorizedException if `currentPassword` is wrong.
   */
  async remove(id: number, currentPassword: string) {
    await this.verifyPassword(id, currentPassword);
    return this.prisma.user.delete({ where: { id }, omit: this.omitPassword });
  }
}
