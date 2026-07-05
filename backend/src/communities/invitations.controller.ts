import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { InvitationsService, type PermissionAction } from './invitations.service';
import { getSessionUser } from '../auth/get-session-user';

/**
 * Routes « côté utilisateur » du système d'invitations.
 * Préfixe distinct de /communities pour ne pas entrer en collision
 * avec la route générique GET /communities/:id.
 */
@Controller('community-invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** Invitations en attente reçues par l'utilisateur connecté. */
  @Get('me')
  async myInvites(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.invitations.myInvites(user.id);
  }

  @Post(':inviteId/accept')
  async accept(@Req() req: any, @Param('inviteId') inviteId: string) {
    const user = await getSessionUser(req);
    return this.invitations.respondToInvite(inviteId, user.id, true);
  }

  @Post(':inviteId/decline')
  async decline(@Req() req: any, @Param('inviteId') inviteId: string) {
    const user = await getSessionUser(req);
    return this.invitations.respondToInvite(inviteId, user.id, false);
  }

  /** Aperçu d'un lien d'invitation (page de jonction, saisie de code). */
  @Get('link/:token')
  async linkPreview(@Req() req: any, @Param('token') token: string) {
    const user = await getSessionUser(req);
    return this.invitations.getLinkPreview(token, user.id);
  }

  /** Rejoindre (ou demander à rejoindre) via un lien / code. */
  @Post('link/:token/join')
  async joinViaLink(@Req() req: any, @Param('token') token: string, @Body('message') message?: string) {
    const user = await getSessionUser(req);
    return this.invitations.joinViaToken(token, user.id, message);
  }
}

/** Routes « côté administration », scindées par communauté. */
@Controller('communities/:id')
export class CommunityAdminController {
  constructor(private readonly invitations: InvitationsService) {}

  // ── Invitations directes ──
  @Post('invitations')
  async invite(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userIds: string[]; message?: string },
  ) {
    const user = await getSessionUser(req);
    return this.invitations.inviteMembers(id, user.id, body.userIds ?? [], body.message);
  }

  @Get('invitations')
  async listInvites(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.invitations.listInvites(id, user.id);
  }

  @Delete('invitations/:inviteId')
  async cancelInvite(@Req() req: any, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    const user = await getSessionUser(req);
    return this.invitations.cancelInvite(id, user.id, inviteId);
  }

  // ── Liens d'invitation ──
  @Post('invite-links')
  async createLink(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { label?: string; expiresInHours?: number | null; maxUses?: number | null },
  ) {
    const user = await getSessionUser(req);
    return this.invitations.createInviteLink(id, user.id, body);
  }

  @Get('invite-links')
  async listLinks(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.invitations.listInviteLinks(id, user.id);
  }

  @Patch('invite-links/:linkId')
  async updateLink(
    @Req() req: any,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body('action') action: 'disable' | 'enable' | 'regenerate',
  ) {
    const user = await getSessionUser(req);
    return this.invitations.updateInviteLink(id, user.id, linkId, action);
  }

  @Delete('invite-links/:linkId')
  async deleteLink(@Req() req: any, @Param('id') id: string, @Param('linkId') linkId: string) {
    const user = await getSessionUser(req);
    return this.invitations.deleteInviteLink(id, user.id, linkId);
  }

  // ── Demandes d'adhésion ──
  @Get('join-requests')
  async listRequests(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.invitations.listJoinRequests(id, user.id);
  }

  @Post('join-requests/:requestId/approve')
  async approveRequest(@Req() req: any, @Param('id') id: string, @Param('requestId') requestId: string) {
    const user = await getSessionUser(req);
    return this.invitations.respondToJoinRequest(id, user.id, requestId, true);
  }

  @Post('join-requests/:requestId/reject')
  async rejectRequest(@Req() req: any, @Param('id') id: string, @Param('requestId') requestId: string) {
    const user = await getSessionUser(req);
    return this.invitations.respondToJoinRequest(id, user.id, requestId, false);
  }

  // ── Bans ──
  @Get('bans')
  async listBans(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.invitations.listBans(id, user.id);
  }

  @Post('bans')
  async ban(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userId: string; reason?: string },
  ) {
    const user = await getSessionUser(req);
    return this.invitations.banMember(id, user.id, body.userId, body.reason);
  }

  @Delete('bans/:userId')
  async unban(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    const user = await getSessionUser(req);
    return this.invitations.unbanMember(id, user.id, userId);
  }

  // ── Journal & réglages ──
  @Get('audit-log')
  async auditLog(@Req() req: any, @Param('id') id: string, @Query('limit') limit?: string) {
    const user = await getSessionUser(req);
    return this.invitations.getAuditLog(id, user.id, limit ? parseInt(limit, 10) : 100);
  }

  @Get('invite-settings')
  async getSettings(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.invitations.getSettings(id, user.id);
  }

  @Patch('invite-settings')
  async updateSettings(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { permissions?: Partial<Record<PermissionAction, 'ADMIN' | 'MODERATOR' | 'MEMBER'>>; joinPolicy?: 'OPEN' | 'APPROVAL' },
  ) {
    const user = await getSessionUser(req);
    return this.invitations.updateSettings(id, user.id, body as any);
  }
}
