import { Body, Controller, Get, NotFoundException, Param, Patch, Req } from '@nestjs/common';
import { getSessionUser } from '../auth/get-session-user';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.usersService.findById(user.id);
  }

  @Get(':id')
  async getPublicProfile(@Req() req: any, @Param('id') id: string) {
    await getSessionUser(req); // réservé aux utilisateurs connectés
    const profile = await this.usersService.findPublicById(id);
    if (!profile) throw new NotFoundException('Utilisateur introuvable');
    return profile;
  }

  @Patch('me')
  async updateProfile(
    @Req() req: any,
    @Body() body: {
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
