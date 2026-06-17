import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { getSessionUser } from '../auth/get-session-user';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get('search')
  async searchUsers(@Req() req: any, @Query('q') q: string) {
    const user = await getSessionUser(req);
    return this.friendsService.searchUsers(q ?? '', user.id);
  }

  @Post('requests')
  async sendRequest(@Req() req: any, @Body('addresseeId') addresseeId: string) {
    const user = await getSessionUser(req);
    return this.friendsService.sendFriendRequest(user.id, addresseeId);
  }

  @Get('requests')
  async getRequests(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.friendsService.getFriendRequests(user.id);
  }

  @Get()
  async getFriends(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.friendsService.getFriends(user.id);
  }

  @Post('requests/:id/accept')
  async acceptRequest(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.friendsService.respondToRequest(user.id, id, true);
  }

  @Post('block/:userId')
  async blockUser(@Req() req: any, @Param('userId') userId: string) {
    const user = await getSessionUser(req);
    return this.friendsService.blockUser(user.id, userId);
  }

  @Post('unblock/:userId')
  async unblockUser(@Req() req: any, @Param('userId') userId: string) {
    const user = await getSessionUser(req);
    return this.friendsService.unblockUser(user.id, userId);
  }

  @Post('requests/:id/decline')
  async declineRequest(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.friendsService.respondToRequest(user.id, id, false);
  }
}
