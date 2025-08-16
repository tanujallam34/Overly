import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  organizationId: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class TokensResponse {
  accessToken: string;
  refreshToken: string;
}

export class UserResponse {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  status: string;
  createdAt: Date;
}
