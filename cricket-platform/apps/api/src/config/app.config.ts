import { IsString, IsNumber, IsOptional } from 'class-validator';

export class AppConfig {
  @IsString()
  DATABASE_URL: string;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string;

  @IsNumber()
  @IsOptional()
  JWT_EXPIRES_IN: number = 3600; // 1 hour in seconds

  @IsNumber()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: number = 604800; // 7 days in seconds
}
