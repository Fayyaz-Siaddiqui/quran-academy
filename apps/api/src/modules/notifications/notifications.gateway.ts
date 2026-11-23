import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SOCKET_EVENTS } from '@qa/config';
import type { Server, Socket } from 'socket.io';
import { AccessService } from '../access/access.service';
import type { AccessTokenPayload } from '../../common/types/auth-context';

export const userRoom = (userId: string) => `user:${userId}`;
export const academyRoom = (academyId: string) => `academy:${academyId}`;

/**
 * Socket.IO gateway (namespace /realtime). Clients authenticate with their
 * access token in the handshake (`auth: { token }`) and are joined to a
 * private per-user room plus their academy room.
 *
 * For horizontal scaling, attach @socket.io/redis-adapter so emits reach
 * sockets connected to other API instances.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()), credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly access: AccessService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string | undefined) ?? '';
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (payload.typ !== 'access' || (await this.access.isSessionRevoked(payload.sid))) throw new Error('revoked');
      const resolved = await this.access.resolve(payload.sub);
      if (!resolved || resolved.status !== 'ACTIVE') throw new Error('inactive');

      client.data.userId = resolved.userId;
      await client.join(userRoom(resolved.userId));
      if (resolved.academyId) await client.join(academyRoom(resolved.academyId));
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  toAcademy(academyId: string, event: string, payload: unknown) {
    this.server?.to(academyRoom(academyId)).emit(event, payload);
  }

  notification(userId: string, payload: unknown) {
    this.toUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, payload);
  }
}
