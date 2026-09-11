import { Controller, Get, Patch, Delete, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Self-service account management for the authenticated user (no admin/other-user access). */
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Returns the current user's profile (password hash omitted). */
  @Get('me')
  findMe(@CurrentUser() userId: number) {
    return this.usersService.findOne(userId);
  }

  /** Updates the current user's email and/or password; requires re-confirming their current password. */
  @Patch('me')
  updateMe(
    @CurrentUser() userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, updateUserDto);
  }

  /** Permanently deletes the current user's account after verifying their current password. */
  @Delete('me')
  removeMe(
    @CurrentUser() userId: number,
    @Body() deleteAccountDto: DeleteAccountDto,
  ) {
    return this.usersService.remove(userId, deleteAccountDto.currentPassword);
  }
}
