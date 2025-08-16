import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsString()
  organizationId: string;

  @IsString()
  @IsOptional()
  leagueId?: string;

  @IsUrl()
  @IsOptional()
  logoUrl?: string;
}

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  leagueId?: string;

  @IsUrl()
  @IsOptional()
  logoUrl?: string;
}

export class TeamResponseDto {
  id: string;
  name: string;
  organizationId: string;
  leagueId?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
