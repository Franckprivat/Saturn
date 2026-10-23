import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** GET /conversations?limit=50&before=<lastMessageAt ISO> */
export class ListConversationsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsDateString()
  before?: string;
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberIds: string[];
}

export class CreateDmDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string | null;
}

export class AddMembersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberIds: string[];
}

export class SetGroupRoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}
