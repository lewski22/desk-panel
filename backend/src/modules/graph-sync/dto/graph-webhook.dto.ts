import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GraphChangeNotificationDto {
  // Microsoft Graph sends many fields — we only validate the envelope;
  // individual field values are checked in the service before DB writes.
  [key: string]: unknown;
}

export class GraphWebhookBodyDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphChangeNotificationDto)
  value?: GraphChangeNotificationDto[];
}
