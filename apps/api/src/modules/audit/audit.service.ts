import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';

export interface AuditEntry {
  academyId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: an audit failure must not fail the business operation. */
  async record(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (e) {
      this.logger.error(`Failed to write audit log for ${entry.action}`, e as Error);
    }
  }

  async list(academyId: string | null, q: PaginationQueryDto & { entity?: string; actorId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(academyId ? { academyId } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.search ? { action: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, fullName: true, email: true } } },
        ...paginate(q),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
