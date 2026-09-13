import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

/** Validates the email/password payload for the login endpoint. */
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
