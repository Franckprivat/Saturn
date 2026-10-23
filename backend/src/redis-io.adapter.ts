import { Logger, type INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Adaptateur Socket.IO branché sur Redis : les évènements émis vers une salle
 * (conversation, user:<id>, community:<id>…) atteignent les sockets connectés
 * à n'importe quelle instance du backend. Activé seulement si REDIS_URL est
 * défini ; sinon Socket.IO garde son adaptateur en mémoire (une seule instance).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    for (const client of [pubClient, subClient]) {
      client.on('error', (err: Error) =>
        this.logger.error(`Redis : ${err.message}`),
      );
    }
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Socket.IO relié à Redis');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
