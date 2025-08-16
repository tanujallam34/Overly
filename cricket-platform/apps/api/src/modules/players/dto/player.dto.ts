import { IsString, IsOptional, IsDateString, IsUrl } from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  name: string;

  @IsString()
  organizationId: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  battingStyle?: string;

  @IsString()
  @IsOptional()
  bowlingStyle?: string;

  @IsUrl()
  @IsOptional()
  photoUrl?: string;
}

export class UpdatePlayerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  battingStyle?: string;

  @IsString()
  @IsOptional()
  bowlingStyle?: string;

  @IsUrl()
  @IsOptional()
  photoUrl?: string;
}

export class PlayerResponseDto {
  id: string;
  name: string;
  organizationId: string;
  dob?: Date;
  battingStyle?: string;
  bowlingStyle?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
