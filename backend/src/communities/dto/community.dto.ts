import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string;
}

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string;
}

/** Catégorie à créer ou salon à renommer. */
export class NameDto {
  @IsString()
  @MaxLength(100)
  name: string;
}

export class CreateChannelDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsIn(['TEXT', 'VOICE'])
  type?: 'TEXT' | 'VOICE';

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class TargetUserDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class SetCommunityRoleDto {
  @IsIn(['ADMIN', 'MODERATOR', 'MEMBER'])
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
}

export class JoinCommunityDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

export class InviteMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  userIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

export class CreateInviteLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  /** Durée de validité ; null ou absent = sans expiration. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 365)
  expiresInHours?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  maxUses?: number | null;
}

export class UpdateInviteLinkDto {
  @IsIn(['disable', 'enable', 'regenerate'])
  action: 'disable' | 'enable' | 'regenerate';
}

export class BanMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateInviteSettingsDto {
  /** Rôle minimal par action ; le détail est validé dans InvitationsService. */
  @IsOptional()
  @IsObject()
  permissions?: Record<string, 'ADMIN' | 'MODERATOR' | 'MEMBER'>;

  @IsOptional()
  @IsIn(['OPEN', 'APPROVAL'])
  joinPolicy?: 'OPEN' | 'APPROVAL';
}
