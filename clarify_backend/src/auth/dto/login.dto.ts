import { IsEmail, IsString } from 'class-validator';

/** Validates the email/password payload for the login endpoint. */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
