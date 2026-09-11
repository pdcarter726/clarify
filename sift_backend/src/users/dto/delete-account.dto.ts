import { IsString } from 'class-validator';

/** Validates the payload for account deletion — requires the current password as a confirmation step. */
export class DeleteAccountDto {
  @IsString()
  currentPassword: string;
}
