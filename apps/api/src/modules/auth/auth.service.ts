import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { DocumentType, Prisma, UserStatus, VerificationTokenType } from '@prisma/client';
import { APP_NAME, AUTH } from '@qa/config';
import { AuthUser, PermissionKey, SystemRole } from '@qa/shared-types';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { decrypt, encrypt, generateOpaqueToken, sha256 } from '../../common/utils/crypto';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DocumentsService } from '../storage/documents.service';
import { StorageService } from '../storage/storage.service';
import {
  ChangePasswordDto,
  ChildDto,
  LoginDto,
  RegisterParentDto,
  RegisterStudentDto,
  RegisterTeacherDto,
} from './dto/auth.dto';
import { TokenService } from './token.service';
import { generateTotpSecret, totpUri, verifyTotp } from './totp';

interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

// Real hash used to equalise timing when the email does not exist (prevents user enumeration).
const DUMMY_HASH = hash(generateOpaqueToken(16));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly access: AccessService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ───────────── Registration ─────────────

  async registerStudent(academyId: string, dto: RegisterStudentDto) {
    await this.assertEmailFree(dto.email);
    const course = await this.findCourse(academyId, dto.preferredCourseSlug);
    const age = this.ageFrom(dto.dateOfBirth);
    if (age < 18 && !dto.guardian) throw new BadRequestException('Parent/guardian details are required for students under 18');

    const user = await this.prisma.user.create({
      data: {
        academyId,
        email: dto.email,
        passwordHash: await hash(dto.password),
        fullName: dto.fullName,
        phone: dto.phone,
        country: dto.country.toUpperCase(),
        timezone: dto.timezone,
        preferredLanguage: dto.preferredLanguage,
        status: UserStatus.PENDING_VERIFICATION,
        roles: { create: { role: { connect: { id: await this.roleId(SystemRole.STUDENT) } } } },
        studentProfile: {
          create: {
            dateOfBirth: new Date(dto.dateOfBirth),
            preferredCourseId: course?.id,
            preferredClassTiming: dto.preferredClassTiming,
            guardianName: dto.guardian?.name,
            guardianEmail: dto.guardian?.email,
            guardianPhone: dto.guardian?.phone,
            guardianRelationship: dto.guardian?.relationship,
          },
        },
      },
    });
    await this.sendVerification(user.id, user.email!, user.fullName);
    return { id: user.id, status: user.status };
  }

  async registerParent(academyId: string, dto: RegisterParentDto) {
    await this.assertEmailFree(dto.email);
    const childEmails = dto.children.map((c) => c.email).filter((e): e is string => !!e);
    if (new Set(childEmails).size !== childEmails.length || childEmails.includes(dto.email)) {
      throw new BadRequestException('Each child must have a different email address');
    }
    for (const e of childEmails) await this.assertEmailFree(e);

    const [parentRoleId, studentRoleId] = await Promise.all([this.roleId(SystemRole.PARENT), this.roleId(SystemRole.STUDENT)]);
    const passwordHash = await hash(dto.password);

    const { parent, children } = await this.prisma.$transaction(async (tx) => {
      const parent = await tx.user.create({
        data: {
          academyId,
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          country: dto.country.toUpperCase(),
          timezone: dto.timezone,
          status: UserStatus.PENDING_VERIFICATION,
          roles: { create: { roleId: parentRoleId } },
          parentProfile: { create: {} },
        },
      });
      const children = [];
      for (const child of dto.children) {
        children.push(await this.createChild(tx, academyId, parent, child, studentRoleId));
      }
      return { parent, children };
    });

    await this.sendVerification(parent.id, parent.email!, parent.fullName);
    return { id: parent.id, status: parent.status, children: children.map((c) => ({ id: c.id, fullName: c.fullName })) };
  }

  /**
   * Child accounts are ACTIVE immediately but have no password; they are reached
   * through the parent. A child with an email can set a password later via
   * the parent portal ("enable login"), which issues a reset link.
   */
  async createChild(
    tx: Prisma.TransactionClient,
    academyId: string,
    parent: { id: string; fullName: string; email: string | null; phone: string | null; country: string | null; timezone: string },
    child: ChildDto,
    studentRoleId: string,
  ) {
    const course = await tx.course.findFirst({ where: { academyId, slug: child.preferredCourseSlug }, select: { id: true } });
    return tx.user.create({
      data: {
        academyId,
        email: child.email ?? null,
        fullName: child.fullName,
        country: parent.country,
        timezone: parent.timezone,
        preferredLanguage: child.preferredLanguage,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        roles: { create: { roleId: studentRoleId } },
        studentProfile: {
          create: {
            dateOfBirth: new Date(child.dateOfBirth),
            preferredCourseId: course?.id,
            preferredClassTiming: child.preferredClassTiming,
            guardianName: parent.fullName,
            guardianEmail: parent.email,
            guardianPhone: parent.phone,
            guardianRelationship: 'parent',
          },
        },
        childLinks: { create: { parentId: parent.id, relationship: 'parent' } },
      },
    });
  }

  async registerTeacher(academyId: string, dto: RegisterTeacherDto) {
    await this.assertEmailFree(dto.email);
    for (const s of dto.availability) {
      if (s.startTime >= s.endTime) throw new BadRequestException('Each availability slot must end after it starts');
    }
    const user = await this.prisma.user.create({
      data: {
        academyId,
        email: dto.email,
        passwordHash: await hash(dto.password),
        fullName: dto.fullName,
        phone: dto.phone,
        country: dto.country.toUpperCase(),
        timezone: dto.timezone,
        status: UserStatus.PENDING_VERIFICATION,
        roles: { create: { roleId: await this.roleId(SystemRole.TEACHER) } },
        teacherProfile: {
          create: {
            bio: dto.bio,
            qualifications: dto.qualifications,
            experienceYears: dto.experienceYears,
            certifications: dto.certifications,
            languages: dto.languages,
            availability: {
              create: dto.availability.map((a) => ({ ...a, timezone: dto.timezone })),
            },
          },
        },
      },
    });
    await this.sendVerification(user.id, user.email!, user.fullName);
    await this.mail.send({ to: user.email!, template: 'teacher-application-received', data: { name: user.fullName } });
    await this.notifications.notifyPermissionHolders(academyId, 'teachers.approve', {
      type: 'teacher.application',
      title: 'New teacher application',
      body: `${user.fullName} applied to teach and is awaiting review.`,
      data: { teacherId: user.id },
    });

    // Short-lived grant so the applicant can attach documents before they can sign in.
    const uploadToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'onboarding' },
      { secret: this.config.getOrThrow('JWT_CHALLENGE_SECRET'), expiresIn: '2h' },
    );
    return { id: user.id, status: user.status, uploadToken };
  }

  private async onboardingUser(uploadToken: string) {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(uploadToken, {
        secret: this.config.getOrThrow('JWT_CHALLENGE_SECRET'),
      });
      if (p.typ !== 'onboarding') throw new Error();
      return p.sub;
    } catch {
      throw new UnauthorizedException('Upload session expired. Sign in after approval to add documents.');
    }
  }

  async onboardingUploadUrl(uploadToken: string, type: DocumentType, fileName: string, mimeType: string, sizeBytes: number) {
    const userId = await this.onboardingUser(uploadToken);
    const existing = await this.prisma.document.count({ where: { ownerId: userId } });
    if (existing >= 10) throw new BadRequestException('Document limit reached');
    return this.documents.requestUpload(userId, type, fileName, mimeType, sizeBytes);
  }

  async onboardingConfirm(uploadToken: string, key: string) {
    const userId = await this.onboardingUser(uploadToken);
    return this.documents.confirmUpload(userId, key);
  }

  // ───────────── Email verification ─────────────

  private async sendVerification(userId: string, email: string, name: string) {
    const token = await this.createVerificationToken(userId, VerificationTokenType.EMAIL_VERIFICATION, AUTH.EMAIL_VERIFICATION_TTL_HOURS * 60);
    const url = `${this.config.get('APP_URL')}/verify-email?token=${token}`;
    await this.mail.send({ to: email, template: 'verify-email', data: { name, url } });
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always succeed silently to avoid revealing which emails exist.
    if (user && user.status === UserStatus.PENDING_VERIFICATION) {
      await this.sendVerification(user.id, email, user.fullName);
    }
    return { ok: true };
  }

  async verifyEmail(rawToken: string) {
    const token = await this.consumeToken(rawToken, VerificationTokenType.EMAIL_VERIFICATION);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: token.userId },
      include: { teacherProfile: { select: { approvalStatus: true } } },
    });
    // Teachers still need administrator approval after verifying.
    const nextStatus =
      user.status !== UserStatus.PENDING_VERIFICATION
        ? user.status
        : user.teacherProfile && user.teacherProfile.approvalStatus !== 'APPROVED'
          ? UserStatus.PENDING_APPROVAL
          : UserStatus.ACTIVE;
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), status: nextStatus } });
    await this.access.invalidateUser(user.id);
    return { status: nextStatus };
  }

  // ───────────── Login / logout ─────────────

  async login(dto: LoginDto, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordHash || user.deletedAt) {
      await verify(await DUMMY_HASH, dto.password).catch(() => false);
      await this.logLogin(null, dto.email, false, 'invalid_credentials', client);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logLogin(user.id, dto.email, false, 'locked', client);
      throw new ForbiddenException({ message: 'Too many failed attempts. Try again later.', code: 'ACCOUNT_LOCKED' });
    }

    const valid = await verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= AUTH.MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + AUTH.LOCKOUT_MINUTES * 60_000) : undefined,
        },
      });
      await this.logLogin(user.id, dto.email, false, lock ? 'locked_now' : 'invalid_credentials', client);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.assertCanSignIn(user.status);

    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwt.signAsync(
        { sub: user.id, typ: '2fa' },
        { secret: this.config.getOrThrow('JWT_CHALLENGE_SECRET'), expiresIn: '5m' },
      );
      await this.logLogin(user.id, dto.email, true, '2fa_challenge', client);
      return { twoFactorRequired: true as const, challengeToken };
    }
    return this.completeLogin(user.id, dto.email, client);
  }

  async loginTwoFactor(challengeToken: string, code: string, client: ClientInfo) {
    let userId: string;
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(challengeToken, {
        secret: this.config.getOrThrow('JWT_CHALLENGE_SECRET'),
      });
      if (p.typ !== '2fa') throw new Error();
      userId = p.sub;
    } catch {
      throw new UnauthorizedException('Verification expired. Sign in again.');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret || !verifyTotp(this.decryptSecret(user.twoFactorSecret), code)) {
      await this.logLogin(user.id, user.email ?? '', false, 'invalid_2fa', client);
      throw new UnauthorizedException('Invalid verification code');
    }
    this.assertCanSignIn(user.status);
    return this.completeLogin(user.id, user.email ?? '', client);
  }

  private async completeLogin(userId: string, email: string, client: ClientInfo) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.logLogin(userId, email, true, null, client);
    const issued = await this.tokens.createSession(userId, client.userAgent, client.ip);
    return { ...issued, user: await this.me(userId) };
  }

  private assertCanSignIn(status: UserStatus) {
    const messages: Partial<Record<UserStatus, string>> = {
      PENDING_VERIFICATION: 'Please verify your email address before signing in.',
      PENDING_APPROVAL: 'Your application is awaiting administrator approval.',
      SUSPENDED: 'Your account has been suspended. Please contact support.',
      INACTIVE: 'Your account is inactive. Please contact support.',
      REJECTED: 'Your application was not approved.',
    };
    if (status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({ message: messages[status] ?? 'Account unavailable', code: `ACCOUNT_${status}` });
    }
  }

  async refresh(rawRefreshToken: string, client: ClientInfo) {
    const issued = await this.tokens.rotate(rawRefreshToken, client.ip);
    const user = await this.access.resolve(issued.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeSession(issued.sessionId, 'account_inactive');
      throw new UnauthorizedException('Account is not active');
    }
    return { ...issued, user: await this.me(issued.userId) };
  }

  async logout(rawRefreshToken: string | undefined, sessionId?: string) {
    const sid = sessionId ?? (rawRefreshToken ? await this.tokens.sessionIdForRefreshToken(rawRefreshToken) : null);
    if (sid) await this.tokens.revokeSession(sid, 'logout');
    return { ok: true };
  }

  // ───────────── Password ─────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const token = await this.createVerificationToken(user.id, VerificationTokenType.PASSWORD_RESET, AUTH.PASSWORD_RESET_TTL_MINUTES);
      const url = `${this.config.get('APP_URL')}/reset-password?token=${token}`;
      await this.mail.send({ to: email, template: 'reset-password', data: { name: user.fullName, url } });
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, password: string) {
    const token = await this.consumeToken(rawToken, VerificationTokenType.PASSWORD_RESET);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: token.userId } });
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(password),
        failedLoginCount: 0,
        lockedUntil: null,
        // Completing a reset proves mailbox ownership.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        status: user.status === UserStatus.PENDING_VERIFICATION ? UserStatus.ACTIVE : user.status,
      },
    });
    await this.tokens.revokeAllSessions(user.id, 'password_reset');
    await this.access.invalidateUser(user.id);
    await this.audit.record({ academyId: user.academyId, actorId: user.id, action: 'auth.password_reset', entity: 'User', entityId: user.id });
    return { ok: true };
  }

  async changePassword(userId: string, sessionId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await verify(user.passwordHash, dto.currentPassword).catch(() => false))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(dto.password) } });
    const revoked = await this.tokens.revokeAllSessions(userId, 'password_changed', sessionId);
    await this.audit.record({ academyId: user.academyId, actorId: userId, action: 'auth.password_changed', entity: 'User', entityId: userId });
    return { ok: true, otherSessionsRevoked: revoked };
  }

  // ───────────── Two-factor ─────────────

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) throw new ConflictException('Two-factor authentication is already enabled');
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: this.encryptSecret(secret) } });
    const uri = totpUri(secret, user.email ?? user.id, APP_NAME);
    return { secret, otpauthUri: uri, qrCodeDataUrl: await toDataURL(uri) };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException('Start two-factor setup first');
    if (!verifyTotp(this.decryptSecret(user.twoFactorSecret), code)) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await this.audit.record({ academyId: user.academyId, actorId: userId, action: 'auth.2fa_enabled', entity: 'User', entityId: userId });
    return { enabled: true };
  }

  async disableTwoFactor(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new BadRequestException('Two-factor is not enabled');
    const passOk = user.passwordHash && (await verify(user.passwordHash, password).catch(() => false));
    if (!passOk || !verifyTotp(this.decryptSecret(user.twoFactorSecret), code)) {
      throw new BadRequestException('Password or code is incorrect');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    await this.audit.record({ academyId: user.academyId, actorId: userId, action: 'auth.2fa_disabled', entity: 'User', entityId: userId });
    return { enabled: false };
  }

  // ───────────── Sessions & activity ─────────────

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
    });
    return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
  }

  async revokeOwnSession(userId: string, sessionId: string) {
    const s = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!s) throw new BadRequestException('Session not found');
    await this.tokens.revokeSession(sessionId, 'user_revoked');
    return { ok: true };
  }

  async loginActivity(userId: string) {
    return this.prisma.loginActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, success: true, reason: true, ipAddress: true, userAgent: true, createdAt: true },
    });
  }

  // ───────────── Current user ─────────────

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const access = await this.access.resolve(userId);
    let avatarUrl: string | null = null;
    if (user.avatarKey && this.storage.enabled) avatarUrl = (await this.storage.presignDownload(user.avatarKey)).url;
    return {
      id: user.id,
      email: user.email ?? '',
      fullName: user.fullName,
      avatarUrl,
      status: user.status,
      timezone: user.timezone,
      country: user.country,
      academyId: user.academyId,
      branchId: user.branchId,
      roles: access?.roles ?? [],
      permissions: (access?.permissions ?? []) as PermissionKey[],
      emailVerified: !!user.emailVerifiedAt,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  // ───────────── helpers ─────────────

  private async assertEmailFree(email: string) {
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException({ message: 'An account with this email already exists', code: 'EMAIL_TAKEN' });
  }

  private async findCourse(academyId: string, slug: string) {
    return this.prisma.course.findFirst({ where: { academyId, slug }, select: { id: true } });
  }

  private ageFrom(dob: string) {
    const d = new Date(dob);
    if (Number.isNaN(d.getTime()) || d > new Date()) throw new BadRequestException('Invalid date of birth');
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 86_400_000));
  }

  private roleCache = new Map<string, string>();
  async roleId(slug: string) {
    const cached = this.roleCache.get(slug);
    if (cached) return cached;
    const role = await this.prisma.role.findFirst({ where: { slug, academyId: null, isSystem: true }, select: { id: true } });
    if (!role) throw new Error(`System role "${slug}" missing — run the database seeder`);
    this.roleCache.set(slug, role.id);
    return role.id;
  }

  async createVerificationToken(userId: string, type: VerificationTokenType, ttlMinutes: number) {
    const raw = generateOpaqueToken(32);
    // Only the latest token of a type stays valid.
    await this.prisma.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.verificationToken.create({
      data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
    });
    return raw;
  }

  private async consumeToken(raw: string, type: VerificationTokenType) {
    const token = await this.prisma.verificationToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
      throw new BadRequestException({ message: 'This link is invalid or has expired', code: 'TOKEN_INVALID' });
    }
    const { count } = await this.prisma.verificationToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new BadRequestException({ message: 'This link has already been used', code: 'TOKEN_INVALID' });
    return token;
  }

  private async logLogin(userId: string | null, email: string, success: boolean, reason: string | null, c: ClientInfo) {
    await this.prisma.loginActivity.create({
      data: { userId, email, success, reason, ipAddress: c.ip, userAgent: c.userAgent?.slice(0, 500) },
    });
  }

  private encryptSecret(s: string) {
    return encrypt(s, this.config.getOrThrow('DATA_ENCRYPTION_KEY'));
  }
  private decryptSecret(s: string) {
    return decrypt(s, this.config.getOrThrow('DATA_ENCRYPTION_KEY'));
  }
}
