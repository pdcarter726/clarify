import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const PASSWORD_MESSAGE =
  'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';

/**
 * Validates the signup payload. Password must be at least 8 characters and
 * satisfy PASSWORD_PATTERN (upper + lower + digit + special character).
 */
export class CreateUserDto {
  // Postgres compares strings case-sensitively, so store emails lowercased.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;
}
