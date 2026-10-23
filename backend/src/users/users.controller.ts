import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { getSessionUser } from '../auth/get-session-user';
import { UsersService } from './users.service';
import type { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: Request) {
    const user = await getSessionUser(req);
    return this.usersService.findById(user.id);
  }

  @Get(':id')
  async getPublicProfile(@Req() req: Request, @Param('id') id: string) {
    await getSessionUser(req); // réservé aux utilisateurs connectés
    const profile = await this.usersService.findPublicById(id);
    if (!profile) throw new NotFoundException('Utilisateur introuvable');
    return profile;
  }

  @Patch('me')
  async updateProfile(
    @Req() req: Request,
    @Body()
    body: {
      nickname?: string;
      bio?: string;
      socialLinks?: Record<string, string>;
      avatarColor?: string;
      image?: string;
      chatWallpaper?: string | null;
    },
  ) {
    const user = await getSessionUser(req);
    return this.usersService.updateUser(user.id, body);
  }
}
