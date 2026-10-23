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
import { MessagesService, canSeeMessage } from '../messages/messages.service';
import {
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { auth } from '../auth/better-auth.instance';
import { getLiveKitConfig, removeFromVoiceRoom } from '../voice/livekit';
import { PushService } from '../push/push.service';

/** Notification affichée dans la cloche (et en push si l'utilisateur est hors ligne). */
export interface AppNotificationPayload {
  type: string;
  title: string;
  body: string;
  href: string;
  image?: string | null;
  [extra: string]: unknown;
}

interface AuthedSocket extends Socket {
  user?: { id: string; email: string };
}

interface SocketData {
  user?: { id: string; email: string };
  /** Salon vocal où se trouve ce socket (affichage « qui est en vocal ») */
  voice?: { channelId: string; communityId: string };
}

/** Utilisateur d'un socket, y compris ceux renvoyés par fetchSockets(). */
function socketUserId(s: { data: unknown }): string | undefined {
  return (s.data as SocketData | undefined)?.user?.id;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly push: PushService,
  ) {}

  /**
   * Notifie des utilisateurs : dans l'app (cloche) s'ils sont connectés, sinon
   * par notification push sur leurs navigateurs abonnés.
   * `except` : salle dont les sockets n'ont pas besoin de la notification
   * (ex. la conversation déjà ouverte).
   */
  async notify(
    userIds: string[],
    payload: AppNotificationPayload,
    options: { except?: string; tag?: string } = {},
  ) {
    if (!userIds.length) return;
    const full = { ...payload, timestamp: new Date().toISOString() };
    const rooms = userIds.map((id) => `user:${id}`);
    (options.except
      ? this.server.to(rooms).except(options.except)
      : this.server.to(rooms)
    ).emit('notification', full);

    const online = await this.onlineAmong(userIds).catch(
      () => new Set(userIds),
    );
    const offline = userIds.filter((id) => !online.has(id));
    if (offline.length) {
      void this.push
        .sendToUsers(offline, {
          title: payload.title,
          body: payload.body,
          href: payload.href,
          image: payload.image,
          tag: options.tag,
        })
        .catch(() => {});
    }
  }

  /**
   * Qui est dans un salon vocal : déduit des sockets de la salle voice:<id>,
   * donc valable sur toutes les instances du backend (adaptateur Redis).
   * L'audio lui-même passe par LiveKit.
   */
  private async voiceUsers(channelId: string): Promise<string[]> {
    const sockets = await this.server.in(`voice:${channelId}`).fetchSockets();
    return Array.from(
      new Set(
        sockets.map((s) => socketUserId(s)).filter((id): id is string => !!id),
      ),
    );
  }

  /** L'état vocal n'est diffusé qu'aux membres de la communauté (room community:<id>). */
  private async broadcastVoiceState(channelId: string, communityId: string) {
    const users = await this.voiceUsers(channelId);
    this.server
      .to(`community:${communityId}`)
      .emit('voice_state', { channelId, users });
  }

  private async ensureCommunityMember(communityId: string, userId: string) {
    const member = await this.prisma.communityMember.count({
      where: { communityId, userId },
    });
    if (!member) throw new ForbiddenException('Not a community member');
  }

  /**
   * Émet un évènement lié à un message à sa seule audience : toute la salle
   * pour un message normal, l'auteur et les destinataires pour un chuchotement.
   */
  async emitToMessageAudience(
    message: {
      conversationId: string;
      isWhisper: boolean;
      senderId: string;
      whisperTo: string[];
    },
    event: string,
    payload: any,
  ) {
    if (!message.isWhisper) {
      this.server.to(message.conversationId).emit(event, payload);
      return;
    }
    const sockets = await this.server.in(message.conversationId).fetchSockets();
    for (const s of sockets) {
      const userId = socketUserId(s);
      if (userId && canSeeMessage(message, userId)) s.emit(event, payload);
    }
  }

  /** Un membre retiré d'une conversation ne doit plus recevoir ses évènements. */
  evictFromConversation(userId: string, conversationId: string) {
    this.server.in(`user:${userId}`).socketsLeave(conversationId);
  }

  /** Conversation supprimée : plus personne ne reste dans sa salle. */
  closeConversationRoom(conversationId: string) {
    this.server.in(conversationId).socketsLeave(conversationId);
  }

  /** Exclusion, bannissement ou départ d'une communauté : coupe tout le temps réel associé. */
  async evictFromCommunity(userId: string, communityId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { communityId, conversationId: { not: null } },
      select: { conversationId: true },
    });
    const rooms = [
      `community:${communityId}`,
      ...channels.map((c) => c.conversationId!),
    ];
    const voiceChannels = await this.prisma.channel.findMany({
      where: { communityId, type: 'VOICE' },
      select: { id: true },
    });
    this.server
      .in(`user:${userId}`)
      .socketsLeave([...rooms, ...voiceChannels.map((c) => `voice:${c.id}`)]);
    const config = getLiveKitConfig();
    for (const { id } of voiceChannels) {
      void this.broadcastVoiceState(id, communityId);
      // Coupe aussi l'audio en cours (sinon il resterait connecté à LiveKit)
      if (config) {
        removeFromVoiceRoom(config, id, userId).catch(() => {
          /* pas dans ce salon */
        });
      }
    }
  }

  /**
   * Utilisateurs autorisés à voir la présence de `userId` : amis, membres de ses
   * conversations et de ses communautés, hors blocages.
   */
  private async presenceAudience(userId: string): Promise<string[]> {
    const [friendships, participants, members] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        select: { requesterId: true, addresseeId: true, status: true },
      }),
      this.prisma.conversationParticipant.findMany({
        where: { conversation: { participants: { some: { userId } } } },
        select: { userId: true },
      }),
      this.prisma.communityMember.findMany({
        where: { community: { members: { some: { userId } } } },
        select: { userId: true },
      }),
    ]);
    const other = (f: { requesterId: string; addresseeId: string }) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId;
    const blocked = new Set(
      friendships.filter((f) => f.status === 'BLOCKED').map(other),
    );
    const ids = new Set<string>([
      ...friendships.filter((f) => f.status === 'ACCEPTED').map(other),
      ...participants.map((p) => p.userId),
      ...members.map((m) => m.userId),
    ]);
    ids.delete(userId);
    return Array.from(ids).filter((id) => !blocked.has(id));
  }

  /**
   * Présence calculée à partir des sockets réellement connectés (salle
   * user:<id>) : avec l'adaptateur Redis, la réponse couvre toutes les
   * instances du backend, pas seulement celle-ci.
   */
  private async onlineAmong(userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const sockets = await this.server
      .in(userIds.map((id) => `user:${id}`))
      .fetchSockets();
    return new Set(
      sockets.map((s) => socketUserId(s)).filter((id): id is string => !!id),
    );
  }

  private async isUserOnline(userId: string) {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const cookieHeader = client.handshake.headers.cookie || '';
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });
      if (!session?.user) {
        client.disconnect();
        return;
      }

      client.user = { id: session.user.id, email: session.user.email };
      // Aussi dans socket.data : seule propriété garantie sur les sockets de fetchSockets()
      (client.data as SocketData).user = client.user;
      // Déjà connecté ailleurs (autre onglet, autre appareil) ?
      const wasOnline = await this.isUserOnline(session.user.id);
      // Salle personnelle pour les notifications ciblées
      await client.join(`user:${session.user.id}`);
      // Présence partagée uniquement avec les contacts (amis, conversations,
      // communautés communes), pas avec tous les comptes connectés.
      const audience = await this.presenceAudience(session.user.id);
      if (!wasOnline && audience.length) {
        this.server
          .to(audience.map((id) => `user:${id}`))
          .emit('user_online', { userId: session.user.id });
      }
      const online = await this.onlineAmong(audience);
      client.emit('online_users', {
        userIds: audience.filter((id) => online.has(id)),
      });
      // Plancher de « vu à… » dès la connexion : si le serveur meurt brutalement
      // (pas de handleDisconnect), le dernier passage reste au moins daté d'ici.
      this.prisma.user
        .update({
          where: { id: session.user.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
      this.logger.log(`Connected: ${session.user.id}`);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    if (!client.user) return;
    // Le socket a déjà quitté la salle voice:<id> : on annonce le nouvel état
    const voice = (client.data as SocketData).voice;
    if (voice) {
      void this.broadcastVoiceState(voice.channelId, voice.communityId).catch(
        () => {},
      );
    }
    const userId = client.user.id;
    // Le socket a déjà quitté ses salles : il reste les autres onglets/appareils
    if (!(await this.isUserOnline(userId).catch(() => false))) {
      const lastSeenAt = new Date();
      // Persistance « vu à… » (fire-and-forget : la déconnexion ne doit pas bloquer)
      this.prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt } })
        .catch(() => {});
      const audience = await this.presenceAudience(userId).catch(() => []);
      // Reconnecté entre-temps (rechargement de page) : ne pas l'annoncer hors ligne
      if (
        audience.length &&
        !(await this.isUserOnline(userId).catch(() => false))
      ) {
        this.server
          .to(audience.map((id) => `user:${id}`))
          .emit('user_offline', {
            userId,
            lastSeenAt: lastSeenAt.toISOString(),
          });
      }
    }
  }

  async emitSystemMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ) {
    const msg = await this.messagesService.createSystemMessage(
      senderId,
      conversationId,
      content,
    );
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
  handleTypingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user || !client.rooms.has(data?.conversationId)) return;
    client.to(data.conversationId).emit('user_typing', {
      userId: client.user.id,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user || !client.rooms.has(data?.conversationId)) return;
    client.to(data.conversationId).emit('user_stopped_typing', {
      userId: client.user.id,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    data: {
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

    const file = data.fileUrl
      ? {
          fileUrl: data.fileUrl,
          fileName: data.fileName || 'fichier',
          fileType: data.fileType || 'application/octet-stream',
        }
      : undefined;

    // Validation (longueur, pièce jointe, destinataires) faite dans le service
    const message = await this.messagesService.createMessage(
      client.user.id,
      data.conversationId,
      data.content ?? '',
      file,
      data.whisperTo,
      data.replyToId,
    );

    await this.emitToMessageAudience(message, 'new_message', message);

    // Notification push aux participants absents de la salle
    const senderName =
      message.sender?.nickname ||
      client.user.email?.split('@')[0] ||
      "Quelqu'un";
    const preview = message.content
      ? message.content.substring(0, 80)
      : message.fileType?.startsWith('audio/')
        ? '🎤 Message vocal'
        : message.fileType?.startsWith('image/')
          ? '📷 Photo'
          : '📎 Fichier';
    // Destinataires : participants (salons exclus : trop de membres), filtrés
    // sur l'audience du chuchotement. Une seule émission, sans fetchSockets :
    // `except` écarte les sockets qui ont déjà la conversation ouverte.
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: data.conversationId },
      select: { userId: true },
    });
    const recipients = participants
      .map((p) => p.userId)
      .filter(
        (id) =>
          id !== client.user!.id &&
          (!message.isWhisper || message.whisperTo.includes(id)),
      );
    await this.notify(
      recipients,
      {
        type: 'message',
        title: senderName,
        body: preview,
        href: `/chat?conversationId=${data.conversationId}`,
        conversationId: data.conversationId,
        image: message.sender?.image,
      },
      { except: data.conversationId, tag: data.conversationId },
    );

    return message;
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    const updated = await this.messagesService.editMessage(
      data.messageId,
      client.user.id,
      data.content,
    );
    await this.emitToMessageAudience(updated, 'message_edited', updated);
    return updated;
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    if (!client.user) throw new UnauthorizedException();
    const updated = await this.messagesService.deleteMessage(
      data.messageId,
      client.user.id,
    );
    await this.emitToMessageAudience(updated, 'message_deleted', {
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
    const { message, ...result } = await this.messagesService.toggleReaction(
      data.messageId,
      client.user.id,
      data.emoji,
    );
    await this.emitToMessageAudience(message, 'reaction_updated', result);
    return result;
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    const { count } = await this.messagesService.markAsRead(
      data.conversationId,
      client.user.id,
    );
    if (count === 0) return;
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
    const { count } = await this.messagesService.markAsDelivered(
      data.conversationId,
      client.user.id,
    );
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

  /**
   * User IDs des autres participants d'une conversation (pour le routage des appels).
   * Vide si l'émetteur n'en fait pas partie, ou si c'est un DM bloqué.
   */
  private async otherParticipantIds(
    conversationId: string,
    excludeUserId: string,
  ): Promise<string[]> {
    if (typeof conversationId !== 'string') return [];
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conv || conv.type === 'CHANNEL') return [];
    const ids = conv.participants.map((p) => p.userId);
    if (!ids.includes(excludeUserId)) return [];
    const others = ids.filter((id) => id !== excludeUserId);
    if (conv.type === 'DM' && others.length) {
      const blocked = await this.prisma.friendship.count({
        where: {
          status: 'BLOCKED',
          OR: [
            { requesterId: excludeUserId, addresseeId: others[0] },
            { requesterId: others[0], addresseeId: excludeUserId },
          ],
        },
      });
      if (blocked) return [];
    }
    return others;
  }

  /** Relaye un évènement d'appel à la salle personnelle de chaque autre participant. */
  private async relayCall(
    conversationId: string,
    excludeUserId: string,
    event: string,
    payload: unknown,
  ) {
    const targets = await this.otherParticipantIds(
      conversationId,
      excludeUserId,
    );
    for (const userId of targets) {
      this.server.to(`user:${userId}`).emit(event, payload);
    }
  }

  @SubscribeMessage('call_offer')
  async handleCallOffer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    data: {
      conversationId: string;
      offer: unknown;
      callType: 'audio' | 'video';
    },
  ) {
    if (!client.user) return;
    const targets = await this.otherParticipantIds(
      data.conversationId,
      client.user.id,
    );
    if (!targets.length) return;

    const caller = await this.prisma.user.findUnique({
      where: { id: client.user.id },
      select: { nickname: true, email: true, image: true },
    });
    const callerName =
      caller?.nickname || caller?.email?.split('@')[0] || 'Appel';

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
    @MessageBody() data: { conversationId: string; answer: unknown },
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
    @MessageBody() data: { conversationId: string; candidate: unknown },
  ) {
    if (!client.user) return;
    await this.relayCall(
      data.conversationId,
      client.user.id,
      'call_ice_candidate',
      {
        from: client.user.id,
        candidate: data.candidate,
      },
    );
  }

  /** Renégociation en cours d'appel (reconnexion après coupure réseau — ICE restart). */
  @SubscribeMessage('call_renegotiate')
  async handleCallRenegotiate(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; offer: unknown },
  ) {
    if (!client.user) return;
    await this.relayCall(
      data.conversationId,
      client.user.id,
      'call_renegotiate',
      {
        from: client.user.id,
        offer: data.offer,
      },
    );
  }

  @SubscribeMessage('call_end')
  async handleCallEnd(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_ended', {
      from: client.user.id,
    });
  }

  @SubscribeMessage('call_reject')
  async handleCallReject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) return;
    await this.relayCall(data.conversationId, client.user.id, 'call_rejected', {
      from: client.user.id,
    });
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
    const voiceChannels = await this.prisma.channel.findMany({
      where: { communityId: data.communityId, type: 'VOICE' },
      select: { id: true },
    });
    const voiceStates: Record<string, string[]> = {};
    for (const { id } of voiceChannels) {
      const users = await this.voiceUsers(id);
      if (users.length) voiceStates[id] = users;
    }
    return { ok: true, voiceStates };
  }

  // ── Salons vocaux ───────────────────────────────────────────────────────────
  // L'audio passe par LiveKit (jeton : POST /voice/:channelId/token). Le socket
  // annonce seulement l'entrée et la sortie, pour la liste « en vocal ».

  @SubscribeMessage('voice_join')
  async handleVoiceJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.user) return;

    // Le salon doit exister, être vocal, et l'utilisateur membre de sa communauté
    const channel = await this.prisma.channel.findUnique({
      where: { id: data?.channelId },
      select: { communityId: true, type: true },
    });
    if (!channel || channel.type !== 'VOICE')
      throw new NotFoundException('Salon vocal introuvable');
    await this.ensureCommunityMember(channel.communityId, client.user.id);

    const socketData = client.data as SocketData;
    const previous = socketData.voice;
    if (previous && previous.channelId !== data.channelId) {
      await client.leave(`voice:${previous.channelId}`);
      void this.broadcastVoiceState(previous.channelId, previous.communityId);
    }
    await client.join(`voice:${data.channelId}`);
    socketData.voice = {
      channelId: data.channelId,
      communityId: channel.communityId,
    };
    await this.broadcastVoiceState(data.channelId, channel.communityId);
    return { ok: true };
  }

  @SubscribeMessage('voice_leave')
  async handleVoiceLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const socketData = client.data as SocketData;
    const voice = socketData.voice;
    if (!client.user || !voice || voice.channelId !== data?.channelId) return;
    await client.leave(`voice:${voice.channelId}`);
    socketData.voice = undefined;
    await this.broadcastVoiceState(voice.channelId, voice.communityId);
  }
}
