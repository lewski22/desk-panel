import { IsString, IsUUID } from 'class-validator';

export class AddUserDto {
  @IsString()
  @IsUUID()
  userId: string;
}
