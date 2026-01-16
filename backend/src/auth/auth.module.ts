import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtGuard } from './jwt/jwt.guard';

@Module({
   imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, PrismaService, JwtStrategy, JwtGuard],
  controllers: [AuthController],
  exports: [JwtGuard, AuthService],
})
export class AuthModule {}
