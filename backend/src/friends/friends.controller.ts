import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get('search')
  async searchUsers(
    @CurrentUser() user: any,
    @Query('q') q: string,
  ) {
    return this.friendsService.searchUsers(q ?? '', user.id);
  }

  @Post('requests')
  async sendRequest(
    @CurrentUser() user: any,
    @Body('addresseeId') addresseeId: string,
  ) {
    return this.friendsService.sendFriendRequest(user.id, addresseeId);
  }

  @Get('requests')
  async getRequests(@CurrentUser() user: any) {
    return this.friendsService.getFriendRequests(user.id);
  }

  @Get()
  async getFriends(@CurrentUser() user: any) {
    return this.friendsService.getFriends(user.id);
  }

  @Post('requests/:id/accept')
  async acceptRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.friendsService.respondToRequest(user.id, id, true);
  }

  @Post('requests/:id/decline')
  async declineRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.friendsService.respondToRequest(user.id, id, false);
  }
}

