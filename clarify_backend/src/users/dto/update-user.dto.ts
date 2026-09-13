import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const PASSWORD_MESSAGE =
  'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';

/**
 * Validates the profile-update payload. `email`/`password` are optional (same
 * complexity rule as signup), but `currentPassword` is always required to
 * authorize the change.
 */
export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password?: string;

  @IsString()
  currentPassword: string;
}
