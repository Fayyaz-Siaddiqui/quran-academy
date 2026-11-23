import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH } from '@qa/config';
import { PrismaService } from '../../prisma/prisma.service';
import { generateOpaqueToken, sha256 } from '../../common/utils/crypto';
import { AccessService } from '../access/access.service';
import type { AccessTokenPayload } from '../../common/types/auth-context';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  sessionId: string;
}

const refreshExpiry = () => new Date(Date.now() + AUTH.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

/**
 * Session + token lifecycle.
 *
 * - Access token: JWT, 15 min, carries only user id + session id.
 * - Refresh token: opaque random string (hashed in DB), rotated on every refresh.
 * - Reuse of an already-rotated refresh token is treated as theft: the whole
 *   session is revoked and its outstanding access tokens are blocked.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly access: AccessService,
  ) {}

  signAccess(userId: string, sessionId: string) {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, typ: 'access' };
    return this.jwt.signAsync(payload, { expiresIn: AUTH.ACCESS_TOKEN_TTL_SECONDS });
  }

  async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<IssuedTokens> {
    const refreshToken = generateOpaqueToken();
    const expiresAt = refreshExpiry();
    const session = await this.prisma.session.create({
      data: {
        userId,
        userAgent: userAgent?.slice(0, 500),
        ipAddress,
        expiresAt,
        refreshTokens: { create: { tokenHash: sha256(refreshToken), expiresAt } },
      },
    });
    return {
      accessToken: await this.signAccess(userId, session.id),
      refreshToken,
      refreshExpiresAt: expiresAt,
      sessionId: session.id,
    };
  }

  async rotate(rawRefreshToken: string, ipAddress?: string): Promise<IssuedTokens & { userId: string }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawRefreshToken) },
      include: { session: true },
    });
    if (!record) throw new UnauthorizedException('Invalid refresh token');

    const { session } = record;
    if (session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException('Session expired');

    if (record.usedAt) {
      this.logger.warn(`Refresh token reuse detected for session ${session.id}; revoking`);
      await this.revokeSession(session.id, 'refresh_token_reuse');
      throw new UnauthorizedException('Session revoked');
    }
    if (record.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');

    const refreshToken = generateOpaqueToken();
    const expiresAt = refreshExpiry();
    // Atomic: mark old token used only if nobody else did first (parallel refresh race).
    const rotated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({ data: { sessionId: session.id, tokenHash: sha256(refreshToken), expiresAt } });
      await tx.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(), expiresAt, ipAddress: ipAddress ?? session.ipAddress },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeSession(session.id, 'refresh_token_reuse');
      throw new UnauthorizedException('Session revoked');
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      accessToken: await this.signAccess(session.userId, session.id),
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  }

  async revokeSession(sessionId: string, reason: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    await this.access.markSessionRevoked(sessionId);
  }

  async revokeAllSessions(userId: string, reason: string, exceptSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    for (const s of sessions) await this.revokeSession(s.id, reason);
    return sessions.length;
  }

  async sessionIdForRefreshToken(raw: string) {
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, select: { sessionId: true } });
    return rec?.sessionId ?? null;
  }
}
