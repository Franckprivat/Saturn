import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { ChatGateway } from '../chat/chat.gateway';
import { getSessionUser } from '../auth/get-session-user';

function briefName(u: { nickname?: string | null; email?: string | null } | null) {
  return u?.nickname?.trim() || u?.email?.split('@')[0] || 'Quelqu\'un';
}

@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('search')
  async searchUsers(@Req() req: any, @Query('q') q: string) {
    const user = await getSessionUser(req);
    return this.friendsService.searchUsers(q ?? '', user.id);
  }

  @Post('requests')
  async sendRequest(@Req() req: any, @Body('addresseeId') addresseeId: string) {
    const user = await getSessionUser(req);
    const result = await this.friendsService.sendFriendRequest(user.id, addresseeId);

    // Notification temps réel au destinataire (badge Amis + cloche)
    const me = await this.friendsService.getUserBrief(user.id);
    const server = this.chatGateway.server;
    if (result.status === 'PENDING') {
      server.to(`user:${addresseeId}`).emit('friend_request', { from: me });
      server.to(`user:${addresseeId}`).emit('notification', {
        type: 'friend_request',
        title: 'Nouvelle demande d\'ami',
        body: `${briefName(me)} vous a ajouté`,
        href: '/friends',
        image: me?.image,
        timestamp: new Date().toISOString(),
      });
    } else if (result.status === 'ACCEPTED') {
      // Demande croisée auto-acceptée : les deux côtés rafraîchissent leur badge
      server.to(`user:${addresseeId}`).emit('friend_request_update', {});
      server.to(`user:${user.id}`).emit('friend_request_update', {});
    }
    return result;
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
    const result: any = await this.friendsService.respondToRequest(user.id, id, true);

    // Prévenir le demandeur que sa demande est acceptée
    if (result?.requesterId) {
      const me = await this.friendsService.getUserBrief(user.id);
      this.chatGateway.server.to(`user:${result.requesterId}`).emit('notification', {
        type: 'friend_accepted',
        title: 'Demande acceptée',
        body: `${briefName(me)} a accepté votre demande d'ami`,
        href: '/friends',
        image: me?.image,
        timestamp: new Date().toISOString(),
      });
      this.chatGateway.server.to(`user:${result.requesterId}`).emit('friend_request_update', {});
    }
    return result;
  }

  @Delete(':userId')
  async removeFriend(@Req() req: any, @Param('userId') userId: string) {
    const user = await getSessionUser(req);
    return this.friendsService.removeFriend(user.id, userId);
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
