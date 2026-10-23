import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveCallDto {
  @IsIn(['audio', 'video'])
  type: 'audio' | 'video';

  @IsIn(['incoming', 'outgoing'])
  direction: 'incoming' | 'outgoing';

  @IsIn(['answered', 'missed'])
  status: 'answered' | 'missed';

  /** Durée en secondes (24 h max). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  duration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  withName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  withImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  withNickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;
}
