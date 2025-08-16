import { IsString, IsOptional } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class OrganizationResponseDto {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
