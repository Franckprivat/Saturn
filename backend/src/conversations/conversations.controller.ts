import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ChatGateway } from '../chat/chat.gateway';
import { getSessionUser } from '../auth/get-session-user';

function displayName(user: { nickname?: string | null; email?: string | null } | null | undefined, fallback = 'Inconnu') {
  if (!user) return fallback;
  return user.nickname?.trim() || user.email?.split('@')[0] || fallback;
}

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async getMyConversations(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.conversationsService.getUserConversations(user.id);
  }

  @Get(':id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.conversationsService.getConversationById(id, user.id);
  }

  @Post()
  async createConversation(@Req() req: any, @Body('participantIds') participantIds: string[]) {
    const user = await getSessionUser(req);
    return this.conversationsService.createConversation(user.id, participantIds ?? []);
  }

  @Post('group')
  async createGroup(
    @Req() req: any,
    @Body('name') name: string,
    @Body('memberIds') memberIds: string[],
  ) {
    const user = await getSessionUser(req);
    const conv = await this.conversationsService.createGroupConversation(user.id, name, memberIds ?? []);
    await this.chatGateway.emitSystemMessage(conv.id, user.id, `a créé le groupe « ${name} »`);
    return conv;
  }

  @Post('dm')
  async createOrGetDm(@Req() req: any, @Body('userId') userId: string) {
    const user = await getSessionUser(req);
    return this.conversationsService.getOrCreateDmConversation(user.id, userId);
  }

  @Patch(':id')
  async updateGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; image?: string },
  ) {
    const user = await getSessionUser(req);
    const prev = await this.conversationsService.getConversationById(id, user.id);
    const result = await this.conversationsService.updateGroup(id, user.id, body);

    if (body.name && body.name !== prev.name) {
      await this.chatGateway.emitSystemMessage(id, user.id, `a renommé le groupe en « ${body.name} »`);
    }
    if (body.description !== undefined && body.description !== prev.description) {
      await this.chatGateway.emitSystemMessage(id, user.id, `a mis à jour la description du groupe`);
    }
    if (body.image !== undefined && body.image !== prev.image) {
      await this.chatGateway.emitSystemMessage(id, user.id, `a changé la photo du groupe`);
    }
    return result;
  }

  @Post(':id/members')
  async addMembers(
    @Req() req: any,
    @Param('id') id: string,
    @Body('memberIds') memberIds: string[],
  ) {
    const user = await getSessionUser(req);
    const result = await this.conversationsService.addMembers(id, user.id, memberIds ?? []);
    // Émettre un message système par membre ajouté
    for (const memberId of memberIds ?? []) {
      const added = result?.participants.find((p: any) => p.user.id === memberId);
      const nick = displayName(added?.user, memberId);
      await this.chatGateway.emitSystemMessage(id, user.id, `a ajouté ${nick} au groupe`);
    }
    return result;
  }

  @Patch(':id/members/:userId/role')
  async setRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body('role') role: 'ADMIN' | 'MEMBER',
  ) {
    const user = await getSessionUser(req);
    const result = await this.conversationsService.setMemberRole(id, user.id, targetUserId, role);
    const conv = await this.conversationsService.getConversationById(id, user.id);
    const target = conv.participants.find((p: any) => p.user.id === targetUserId);
    const nick = displayName(target?.user, targetUserId);
    const msg = role === 'ADMIN'
      ? `a promu ${nick} comme administrateur`
      : `a retiré le statut d'administrateur à ${nick}`;
    await this.chatGateway.emitSystemMessage(id, user.id, msg);
    return result;
  }

  @Post(':id/invite')
  async generateInvite(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.conversationsService.generateInviteLink(id, user.id);
  }

  @Post('join/:token')
  async joinByInvite(@Req() req: any, @Param('token') token: string) {
    const user = await getSessionUser(req);
    return this.conversationsService.joinByInvite(token, user.id);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const user = await getSessionUser(req);
    const conv = await this.conversationsService.getConversationById(id, user.id);
    const target = conv.participants.find((p: any) => p.user.id === targetUserId);
    const nick = displayName(target?.user, targetUserId);
    await this.conversationsService.removeMember(id, user.id, targetUserId);
    await this.chatGateway.emitSystemMessage(id, user.id, `a retiré ${nick} du groupe`);
    return { ok: true };
  }

  @Post(':id/leave')
  async leaveGroup(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    const conv = await this.conversationsService.getConversationById(id, user.id);
    const me = conv.participants.find((p: any) => p.user.id === user.id);
    const nick = displayName(me?.user, 'Un membre');
    await this.conversationsService.leaveGroup(id, user.id);
    await this.chatGateway.emitSystemMessage(id, user.id, `a quitté le groupe`);
    return { ok: true };
  }

  @Delete(':id')
  async deleteGroup(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.conversationsService.deleteGroup(id, user.id);
  }
}
