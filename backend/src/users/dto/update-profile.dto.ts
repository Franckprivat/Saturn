import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Champs modifiables du profil. Tout autre champ (email, emailVerified, id…)
 * est retiré par le ValidationPipe global (whitelist).
 * Le format fin (URL d'image, liens sociaux) est vérifié dans UsersService.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  avatarColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2100)
  chatWallpaper?: string | null;
}
