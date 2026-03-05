import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface AuthedSocket extends Socket {
  user?: {
    id: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost'],
    credentials: false,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers.authorization as string | undefined)?.split(' ')[1];

      if (!token) {
        this.logger.warn('Socket connection attempt without token');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        this.logger.warn('Socket connection with invalid user');
        client.disconnect();
        return;
      }

      client.user = { id: user.id, email: user.email };
      this.logger.log(`Client connected: ${user.id}`);
    } catch (error: any) {
      this.logger.warn(`Socket authentication failed: ${error?.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (client.user) {
      this.logger.log(`Client disconnected: ${client.user.id}`);
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) {
      throw new UnauthorizedException();
    }

    const isParticipant = await this.prisma.conversationParticipant.count({
      where: {
        userId: client.user.id,
        conversationId: data.conversationId,
      },
    });

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    await client.join(data.conversationId);
    return { status: 'joined', conversationId: data.conversationId };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    if (!client.user) {
      throw new UnauthorizedException();
    }

    const message = await this.messagesService.createMessage(
      client.user.id,
      data.conversationId,
      data.content,
    );

    this.server.to(data.conversationId).emit('new_message', message);

    return message;
  }
}
