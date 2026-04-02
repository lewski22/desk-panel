import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Nowe hasło musi mieć co najmniej 8 znaków' })
  newPassword: string;
}
