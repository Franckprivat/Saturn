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
import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const cookieHeader = client.handshake.headers.cookie || '';
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });
      if (!session?.user) { client.disconnect(); return; }

      client.user = { id: session.user.id, email: session.user.email };
      const prev = this.onlineUsers.get(session.user.id) ?? 0;
      this.onlineUsers.set(session.user.id, prev + 1);
      if (prev === 0) this.server.emit('user_online', { userId: session.user.id });
      client.emit('online_users', { userIds: Array.from(this.onlineUsers.keys()) });
      this.logger.log(`Connected: ${session.user.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (!client.user) return;
    const userId = client.user.id;
    const count = (this.onlineUsers.get(userId) ?? 1) - 1;
    if (count <= 0) {
      this.onlineUsers.delete(userId);
      this.server.emit('user_offline', { userId });
    } else {
      this.onlineUsers.set(userId, count);
    }
  }

  // Méthode publique utilisée par ConversationsController pour émettre des messages système
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
    const isParticipant = await this.prisma.conversationParticipant.count({
      where: { userId: client.user.id, conversationId: data.conversationId },
    });
    if (!isParticipant) throw new ForbiddenException('Not a participant');
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

    const file = data.fileUrl
      ? { fileUrl: data.fileUrl, fileName: data.fileName || 'fichier', fileType: data.fileType || 'application/octet-stream' }
      : undefined;

    const message = await this.messagesService.createMessage(
      client.user.id,
      data.conversationId,
      data.content || '',
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
    return message;
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
      reactions: result.reactions,
    });
    return result;
  }
}
