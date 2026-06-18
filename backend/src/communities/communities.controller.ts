import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { getSessionUser } from '../auth/get-session-user';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  async getMine(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.communitiesService.getMyCommunities(user.id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: { name: string; description?: string; image?: string }) {
    const user = await getSessionUser(req);
    return this.communitiesService.createCommunity(user.id, body.name, body.description, body.image);
  }

  @Post('join/:token')
  async join(@Req() req: any, @Param('token') token: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.joinByInvite(token, user.id);
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.getCommunityDetail(id, user.id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; description?: string; image?: string }) {
    const user = await getSessionUser(req);
    return this.communitiesService.updateCommunity(id, user.id, body);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.deleteCommunity(id, user.id);
  }

  @Get(':id/invite')
  async invite(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.getInvite(id, user.id);
  }

  @Post(':id/leave')
  async leave(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.leaveCommunity(id, user.id);
  }

  // Catégories
  @Post(':id/categories')
  async createCategory(@Req() req: any, @Param('id') id: string, @Body('name') name: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.createCategory(id, user.id, name);
  }

  @Delete(':id/categories/:categoryId')
  async deleteCategory(@Req() req: any, @Param('id') id: string, @Param('categoryId') categoryId: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.deleteCategory(id, user.id, categoryId);
  }

  // Salons
  @Post(':id/channels')
  async createChannel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name: string; type: 'TEXT' | 'VOICE'; categoryId?: string },
  ) {
    const user = await getSessionUser(req);
    return this.communitiesService.createChannel(id, user.id, body.name, body.type || 'TEXT', body.categoryId);
  }

  @Patch(':id/channels/:channelId')
  async renameChannel(@Req() req: any, @Param('id') id: string, @Param('channelId') channelId: string, @Body('name') name: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.renameChannel(id, user.id, channelId, name);
  }

  @Delete(':id/channels/:channelId')
  async deleteChannel(@Req() req: any, @Param('id') id: string, @Param('channelId') channelId: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.deleteChannel(id, user.id, channelId);
  }

  // Membres
  @Patch(':id/members/:userId/role')
  async setRole(@Req() req: any, @Param('id') id: string, @Param('userId') targetUserId: string, @Body('role') role: any) {
    const user = await getSessionUser(req);
    return this.communitiesService.setMemberRole(id, user.id, targetUserId, role);
  }

  @Delete(':id/members/:userId')
  async kick(@Req() req: any, @Param('id') id: string, @Param('userId') targetUserId: string) {
    const user = await getSessionUser(req);
    return this.communitiesService.kickMember(id, user.id, targetUserId);
  }
}
