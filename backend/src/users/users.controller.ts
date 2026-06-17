import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
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

  @Patch('me')
  async updateProfile(
    @Req() req: any,
    @Body() body: {
      nickname?: string;
      bio?: string;
      socialLinks?: Record<string, string>;
      avatarColor?: string;
      image?: string;
    },
  ) {
    const user = await getSessionUser(req);
    return this.usersService.updateUser(user.id, body);
  }
}
