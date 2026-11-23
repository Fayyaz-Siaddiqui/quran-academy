import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators';
import { AccessService } from '../../modules/access/access.service';
import type { AccessTokenPayload, AuthedRequest } from '../types/auth-context';

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * Status and permissions are re-resolved per request (Redis-cached), so suspensions
 * and role changes take effect within seconds — not when the token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly access: AccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extract(req);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.typ !== 'access') throw new UnauthorizedException('Invalid token type');

    if (await this.access.isSessionRevoked(payload.sid)) throw new UnauthorizedException('Session revoked');

    const resolved = await this.access.resolve(payload.sub);
    if (!resolved) throw new UnauthorizedException('Account not found');
    if (resolved.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({ message: 'Account is not active', code: `ACCOUNT_${resolved.status}` });
    }

    req.auth = {
      userId: resolved.userId,
      sessionId: payload.sid,
      academyId: resolved.academyId,
      branchId: resolved.branchId,
      roles: resolved.roles,
      permissions: new Set(resolved.permissions),
      isSuperAdmin: this.access.isSuperAdmin(resolved.roles),
    };
    return true;
  }

  private extract(req: AuthedRequest): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
