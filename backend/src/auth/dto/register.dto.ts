import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Nickname must be a string' })
  @IsNotEmpty({ message: 'Nickname is required' })
  @MinLength(3, { message: 'Nickname must be at least 3 characters long' })
  nickname: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
