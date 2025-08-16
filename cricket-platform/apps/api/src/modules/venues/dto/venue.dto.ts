import { IsString, IsOptional } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  name: string;

  @IsString()
  organizationId: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  pitchNotes?: string;
}

export class UpdateVenueDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  pitchNotes?: string;
}

export class VenueResponseDto {
  id: string;
  name: string;
  organizationId: string;
  location?: string;
  pitchNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
