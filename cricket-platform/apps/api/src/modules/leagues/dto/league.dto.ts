import { IsString, IsOptional } from 'class-validator';

export class CreateLeagueDto {
  @IsString()
  name: string;

  @IsString()
  season: string;

  @IsString()
  organizationId: string;

  @IsString()
  @IsOptional()
  rulesetId?: string;
}

export class UpdateLeagueDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  season?: string;

  @IsString()
  @IsOptional()
  rulesetId?: string;
}

export class LeagueResponseDto {
  id: string;
  name: string;
  season: string;
  organizationId: string;
  rulesetId?: string;
  createdAt: Date;
  updatedAt: Date;
}
