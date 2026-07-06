import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { BadRequestException, ForbiddenException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { auth } from '../auth/better-auth.instance';

interface AuthedSocket extends Socket {
  user?: { id: string; email: string };
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<string, number>();
  // Salons vocaux : channelId -> { communityId, peers: socketId -> userId }
  private voiceRooms = new Map<string, { communityId: string; peers: Map<string, string> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  /** L'état vocal n'est diffusé qu'aux membres de la communauté (room community:<id>). */
  private broadcastVoiceState(channelId: string, communityId: string) {
    const room = this.voiceRooms.get(channelId);
    const users = room ? Array.from(new Set(room.peers.values())) : [];
    this.server.to(`community:${communityId}`).emit('voice_state', { channelId, users });
  }

  private leaveAllVoiceRooms(client: AuthedSocket) {
    for (const [channelId, room] of this.voiceRooms.entries()) {
      if (room.peers.has(client.id)) {
        const userId = room.peers.get(client.id);
        room.peers.delete(client.id);
        client.to(`voice:${channelId}`).emit('voice_peer_left', { channelId, socketId: client.id, userId });
        if (room.peers.size === 0) this.voiceRooms.delete(channelId);
        this.broadcastVoiceState(channelId, room.communityId);
      }
    }
  }

  private async ensureCommunityMember(communityId: string, userId: string) {
    const member = await this.prisma.communityMember.count({
      where: { communityId, userId },
    });
    if (!member) throw new ForbiddenException('Not a community member');
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const cookieHeader = client.handshake.headers.cookie || '';
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });
      if (!session?.user) { client.disconnect(); return; }

      client.user = { id: session.user.id, email: session.user.email };
      // Salle personnelle pour les notifications ciblées
      await client.join(`user:${session.user.id}`);
      const prev = this.onlineUsers.get(session.user.id) ?? 0;
      this.onlineUsers.set(session.user.id, prev + 1);
      if (prev === 0) this.server.emit('user_online', { userId: session.user.id });
      client.emit('online_users', { userIds: Array.from(this.onlineUsers.keys()) });
      // Plancher de « vu à… » dès la connexion : si le serveur meurt brutalement
      // (pas de handleDisconnect), le dernier passage reste au moins daté d'ici.
      this.prisma.user
        .update({ where: { id: session.user.id }, data: { lastSeenAt: new Date() } })
        .catch(() => {});
      this.logger.log(`Connected: ${session.user.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (!client.user) return;
    this.leaveAllVoiceRooms(client);
    const userId = client.user.id;
    const count = (this.onlineUsers.get(userId) ?? 1) - 1;
    if (count <= 0) {
      this.onlineUsers.delete(userId);
      const lastSeenAt = new Date();
      // Persistance « vu à… » (fire-and-forget : la déconnexion ne doit pas bloquer)
      this.prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt } })
        .catch(() => {});
      this.server.emit('user_offline', { userId, lastSeenAt: lastSeenAt.toISOString() });
    } else {
      this.onlineUsers.set(userId, count);
    }
  }

  async emitSystemMessage(conversationId: string, senderId: string, content: string) {
    const msg = await this.messagesService.createSystemMessage(senderId, conversationId, content);
    this.server.to(conversationId).emit('new_message', msg);
    return msg;
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    const conv = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: { type: true, communityId: true },
    });
    if (conv?.type === 'CHANNEL' && conv.communityId) {
      const member = await this.prisma.communityMember.count({
        where: { communityId: conv.communityId, userId: client.user.id },
      });
      if (!member) throw new ForbiddenException('Not a community member');
    } else {
      const isParticipant = await this.prisma.conversationParticipant.count({
        where: { userId: client.user.id, conversationId: data.conversationId },
      });
      if (!isParticipant) throw new ForbiddenException('Not a participant');
    }
    await client.join(data.conversationId);
    return { status: 'joined', conversationId: data.conversationId };
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    client.to(data.conversationId).emit('user_typing', {
      userId: client.user.id,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    client.to(data.conversationId).emit('user_stopped_typing', {
      userId: client.user.id,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: {
      conversationId: string;
      content?: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      whisperTo?: string[];
      replyToId?: string;
    },
  ) {
    if (!client.user) throw new UnauthorizedException();

    const content = (data.content ?? '').trim();
    if (!content && !data.fileUrl) throw new BadRequestException('Message vide');
    if (content.length > 4000) throw new BadRequestException('Message trop long (4000 caractères max)');

    const file = data.fileUrl
      ? { fileUrl: data.fileUrl, fileName: data.fileName || 'fichier', fileType: data.fileType || 'application/octet-stream' }
      : undefined;

    const message = await this.messagesService.createMessage(
      client.user.id,
      data.conversationId,
      content,
      file,
      data.whisperTo,
      data.replyToId,
    );

    if (message.isWhisper && message.whisperTo?.length) {
      const allowed = new Set([...message.whisperTo, client.user.id]);
      const sockets = await this.server.in(data.conversationId).fetchSockets();
      for (const s of sockets) {
        const authed = s as any;
        if (authed.user && allowed.has(authed.user.id)) s.emit('new_message', message);
      }
    } else {
      this.server.to(data.conversationId).emit('new_message', message);
    }

    // Notification push aux participants absents de la salle
    const senderName = (message as any).sender?.nickname || client.user.email?.split('@')[0] || 'Quelqu\'un';
    const preview = message.content ? message.content.substring(0, 80) : '📎 Fichier';
    const socketsInRoom = await this.server.in(data.conversationId).fetchSockets();
    const usersInRoom = new Set(socketsInRoom.map((s: any) => s.user?.id).filter(Boolean));

    const conv = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (conv) {
      for (const p of conv.participants) {
        if (p.userId !== client.user.id && !usersInRoom.has(p.userId)) {
          this.server.to(`user:${p.userId}`).emit('notification', {
            type: 'message',
            title: senderName,
            body: preview,
            href: `/chat?conversationId=${data.conversationId}`,
            conversationId: data.conversationId,
            image: (message as any).sender?.image,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return message;
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    const updated = await this.messagesService.editMessage(data.messageId, client.user.id, data.content);
    this.server.to(updated.conversationId).emit('message_edited', updated);
    return updated;
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    const updated = await this.messagesService.deleteMessage(data.messageId, client.user.id);
    this.server.to(updated.conversationId).emit('message_deleted', {
      messageId: updated.id,
      conversationId: updated.conversationId,
    });
    return updated;
  }

  @SubscribeMessage('add_reaction')
  async handleAddReaction(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    const result = await this.messagesService.toggleReaction(data.messageId, client.user.id, data.emoji);
    this.server.to(result.conversationId).emit('reaction_updated', {
      messageId: result.messageId,
      conversationId: result.conversationId,
      reactions: result.reactions,
    });
    return result;
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    await this.messagesService.markAsRead(data.conversationId, client.user.id);
    client.to(data.conversationId).emit('messages_read', {
      conversationId: data.conversationId,
      userId: client.user.id,
      readAt: new Date().toISOString(),
    });
  }

  /** Statut « distribué » : le client signale que les messages sont arrivés chez lui. */
  @SubscribeMessage('mark_delivered')
  async handleMarkDelivered(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    const { count } = await this.messagesService.markAsDelivered(data.conversationId, client.user.id);
    // N'émettre que s'il y a réellement des nouveaux reçus (évite le bruit)
    if (count > 0) {
      client.to(data.conversationId).emit('messages_delivered', {
        conversationId: data.conversationId,
        userId: client.user.id,
        deliveredAt: new Date().toISOString(),
      });
    }
  }

  // ── WebRTC Signaling ──────────────────────────────────────────────────────────

  /** User IDs des autres participants d'une conversation (pour le routage des appels). */
  private async otherParticipantIds(conversationId: string, excludeUserId: string): Promise<string[]> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conv) return [];
    return conv.participants.map((p) => p.userId).filter((id) => id !== excludeUserId);
  }

  /** Relaye un évènement d'appel à la salle personnelle de chaque autre participant. */
  private async relayCall(conversationId: string, excludeUserId: string, event: string, payload: any) {
    const targets = await this.otherParticipantIds(conversationId, excludeUserId);
    for (const userId of targets) {
      this.server.to(`user:${userId}`).emit(event, payload);
    }
  }

  @SubscribeMessage('call_offer')
  async handleCallOffer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; offer: any; callType: 'audio' | 'video' },
  ) {
    if (!client.user) return;

    const caller = await this.prisma.user.findUnique({
      where: { id: client.user.id },
      select: { nickname: true, email: true, image: true },
    });
    const callerName = caller?.nickname || caller?.email?.split('@')[0] || 'Appel';

    // Sonne globalement via la salle personnelle de chaque destinataire (façon WhatsApp).
    await this.relayCall(data.conversationId, client.user.id, 'call_incoming', {
      from: client.user.id,
      offer: data.offer,
      callType: data.callType,
      conversationId: data.conversationId,
      callerName,
      callerImage: caller?.image || null,
    });
  }

  @SubscribeMessage('call_answer')
  async handleCallAnswer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; answer: any },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_answered', {
      from: client.user.id,
      answer: data.answer,
    });
  }

  @SubscribeMessage('call_ice_candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; candidate: any },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_ice_candidate', {
      from: client.user.id,
      candidate: data.candidate,
    });
  }

  /** Renégociation en cours d'appel (reconnexion après coupure réseau — ICE restart). */
  @SubscribeMessage('call_renegotiate')
  async handleCallRenegotiate(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; offer: any },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_renegotiate', {
      from: client.user.id,
      offer: data.offer,
    });
  }

  @SubscribeMessage('call_end')
  async handleCallEnd(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_ended', { from: client.user.id });
  }

  @SubscribeMessage('call_reject')
  async handleCallReject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_rejected', { from: client.user.id });
  }

  // ── Communautés : room de présence (état vocal, évènements de communauté) ──

  @SubscribeMessage('join_community')
  async handleJoinCommunity(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { communityId: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    await this.ensureCommunityMember(data.communityId, client.user.id);
    await client.join(`community:${data.communityId}`);

    // État vocal actuel de la communauté (pour l'affichage initial de la sidebar)
    const voiceStates: Record<string, string[]> = {};
    for (const [channelId, room] of this.voiceRooms.entries()) {
      if (room.communityId === data.communityId) {
        voiceStates[channelId] = Array.from(new Set(room.peers.values()));
      }
    }
    return { ok: true, voiceStates };
  }

  // ── Salons vocaux (mesh WebRTC) ─────────────────────────────────────────────

  @SubscribeMessage('voice_join')
  async handleVoiceJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.user) return;

    // Le salon doit exister, être vocal, et l'utilisateur membre de sa communauté
    const channel = await this.prisma.channel.findUnique({
      where: { id: data.channelId },
      select: { communityId: true, type: true },
    });
    if (!channel || channel.type !== 'VOICE') throw new NotFoundException('Salon vocal introuvable');
    await this.ensureCommunityMember(channel.communityId, client.user.id);

    const roomKey = `voice:${data.channelId}`;
    await client.join(roomKey);
    let room = this.voiceRooms.get(data.channelId);
    if (!room) {
      room = { communityId: channel.communityId, peers: new Map() };
      this.voiceRooms.set(data.channelId, room);
    }

    // Pairs déjà présents (à qui le nouvel arrivant va envoyer une offre)
    const existingPeers = Array.from(room.peers.entries()).map(([socketId, userId]) => ({ socketId, userId }));
    room.peers.set(client.id, client.user.id);

    client.emit('voice_existing_peers', { channelId: data.channelId, peers: existingPeers });
    client.to(roomKey).emit('voice_peer_joined', { channelId: data.channelId, socketId: client.id, userId: client.user.id });
    this.broadcastVoiceState(data.channelId, channel.communityId);
    return { ok: true };
  }

  @SubscribeMessage('voice_leave')
  handleVoiceLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.user) return;
    const room = this.voiceRooms.get(data.channelId);
    if (room?.peers.has(client.id)) {
      room.peers.delete(client.id);
      client.leave(`voice:${data.channelId}`);
      client.to(`voice:${data.channelId}`).emit('voice_peer_left', { channelId: data.channelId, socketId: client.id, userId: client.user.id });
      if (room.peers.size === 0) this.voiceRooms.delete(data.channelId);
      this.broadcastVoiceState(data.channelId, room.communityId);
    }
  }

  @SubscribeMessage('voice_signal')
  handleVoiceSignal(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { targetSocketId: string; signal: any },
  ) {
    if (!client.user) return;
    this.server.to(data.targetSocketId).emit('voice_signal', {
      fromSocketId: client.id,
      fromUserId: client.user.id,
      signal: data.signal,
    });
  }

  @SubscribeMessage('voice_mute')
  handleVoiceMute(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { channelId: string; muted: boolean },
  ) {
    if (!client.user) return;
    client.to(`voice:${data.channelId}`).emit('voice_peer_mute', {
      socketId: client.id,
      userId: client.user.id,
      muted: data.muted,
    });
  }
}
