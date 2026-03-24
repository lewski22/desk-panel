import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeskDto {
  @ApiProperty({ example: 'Desk A-01' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: 'Open Space' })
  @IsOptional()
  @IsString()
  zone?: string;
}
