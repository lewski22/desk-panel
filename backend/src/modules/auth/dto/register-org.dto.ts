import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class RegisterOrgDto {
  @IsString() @MinLength(2) @MaxLength(80)   orgName:        string;
  @IsEmail()                                  adminEmail:     string;
  @IsString() @MinLength(1) @MaxLength(50)   adminFirstName: string;
  @IsString() @MinLength(1) @MaxLength(50)   adminLastName:  string;
  @IsString() @MinLength(8) @MaxLength(128)  password:       string;
}
