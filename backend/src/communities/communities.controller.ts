import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { InvitationsService } from './invitations.service';
import { getSessionUser } from '../auth/get-session-user';
import type { Request } from 'express';

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Get()
  async getMine(@Req() req: Request) {
    const user = await getSessionUser(req);
    return this.communitiesService.getMyCommunities(user.id);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body() body: { name: string; description?: string; image?: string },
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.createCommunity(
      user.id,
      body.name,
      body.description,
      body.image,
    );
  }

  @Post('join/:token')
  async join(
    @Req() req: Request,
    @Param('token') token: string,
    @Body('message') message?: string,
  ) {
    const user = await getSessionUser(req);
    // Pipeline unifié : bans, quotas, expiration et politique d'adhésion
    return this.invitationsService.joinViaToken(token, user.id, message);
  }

  @Get(':id')
  async detail(@Req() req: Request, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.getCommunityDetail(id, user.id);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; image?: string },
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.updateCommunity(id, user.id, body);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.deleteCommunity(id, user.id);
  }

  @Get(':id/invite')
  async invite(@Req() req: Request, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.getInvite(id, user.id);
  }

  @Post(':id/leave')
  async leave(@Req() req: Request, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.leaveCommunity(id, user.id);
  }

  // Catégories
  @Post(':id/categories')
  async createCategory(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.createCategory(id, user.id, name);
  }

  @Delete(':id/categories/:categoryId')
  async deleteCategory(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.deleteCategory(id, user.id, categoryId);
  }

  // Salons
  @Post(':id/channels')
  async createChannel(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name: string; type: 'TEXT' | 'VOICE'; categoryId?: string },
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.createChannel(
      id,
      user.id,
      body.name,
      body.type || 'TEXT',
      body.categoryId,
    );
  }

  @Patch(':id/channels/:channelId')
  async renameChannel(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
    @Body('name') name: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.renameChannel(id, user.id, channelId, name);
  }

  @Delete(':id/channels/:channelId')
  async deleteChannel(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.deleteChannel(id, user.id, channelId);
  }

  @Post(':id/send-invite-dm')
  async sendInviteDm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.sendCommunityInviteDm(id, user.id, userId);
  }

  // Membres
  @Post(':id/members')
  async addMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.addMemberDirectly(id, user.id, userId);
  }

  @Patch(':id/members/:userId/role')
  async setRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body('role') role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER',
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.setMemberRole(
      id,
      user.id,
      targetUserId,
      role,
    );
  }

  @Delete(':id/members/:userId')
  async kick(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.kickMember(id, user.id, targetUserId);
  }
}
