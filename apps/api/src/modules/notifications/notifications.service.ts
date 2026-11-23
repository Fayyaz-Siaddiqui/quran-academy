import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SOCKET_EVENTS } from '@qa/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

export interface NotifyInput {
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}

/** Persists in-app notifications and pushes them live over Socket.IO. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async notify(userId: string, input: NotifyInput) {
    const n = await this.prisma.notification.create({ data: { userId, ...input } });
    this.gateway.notification(userId, n);
    return n;
  }

  async notifyMany(userIds: string[], input: NotifyInput) {
    const unique = [...new Set(userIds)];
    await Promise.all(unique.map((id) => this.notify(id, input)));
  }

  /** Notify every active user in the academy who holds a given permission (e.g. approvers). */
  async notifyPermissionHolders(academyId: string, permissionKey: string, input: NotifyInput) {
    const users = await this.prisma.user.findMany({
      where: {
        academyId,
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { permissions: { some: { permission: { key: permissionKey } } } } } },
      },
      select: { id: true },
    });
    await this.notifyMany(users.map((u) => u.id), input);
  }

  async list(userId: string, unreadOnly: boolean, take = 30, cursor?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const unreadCount = await this.prisma.notification.count({ where: { userId, readAt: null } });
    const hasMore = items.length > take;
    return { items: items.slice(0, take), nextCursor: hasMore ? items[take - 1]!.id : null, unreadCount };
  }

  async markRead(userId: string, ids: string[] | 'all') {
    const where: Prisma.NotificationWhereInput = { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) };
    const { count } = await this.prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    this.gateway.toUser(userId, SOCKET_EVENTS.NOTIFICATION_READ, { ids });
    return { updated: count };
  }
}
