import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DocumentType } from '@prisma/client';
import { API_PREFIX, AUTH } from '@qa/config';
import type { Request, Response } from 'express';
import { CurrentAuth, Public } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  DisableTwoFactorDto,
  EmailDto,
  LoginDto,
  OnboardingConfirmDto,
  OnboardingUploadDto,
  RegisterParentDto,
  RegisterStudentDto,
  RegisterTeacherDto,
  ResetPasswordDto,
  TokenDto,
  TwoFactorCodeDto,
  TwoFactorLoginDto,
} from './dto/auth.dto';
import type { IssuedTokens } from './token.service';

const STRICT = { default: { limit: 5, ttl: 60_000 } };
const MODERATE = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantService,
    private readonly config: ConfigService,
  ) {}

  // ───── Registration ─────

  @Public() @Throttle(STRICT)
  @Post('register/student')
  async registerStudent(@Body() dto: RegisterStudentDto, @Req() req: Request) {
    return this.auth.registerStudent(await this.tenant.publicAcademyId(req), dto);
  }

  @Public() @Throttle(STRICT)
  @Post('register/parent')
  async registerParent(@Body() dto: RegisterParentDto, @Req() req: Request) {
    return this.auth.registerParent(await this.tenant.publicAcademyId(req), dto);
  }

  @Public() @Throttle(STRICT)
  @Post('register/teacher')
  async registerTeacher(@Body() dto: RegisterTeacherDto, @Req() req: Request) {
    return this.auth.registerTeacher(await this.tenant.publicAcademyId(req), dto);
  }

  @Public() @Throttle(MODERATE)
  @Post('register/teacher/documents/upload-url')
  teacherUploadUrl(@Body() dto: OnboardingUploadDto) {
    return this.auth.onboardingUploadUrl(dto.uploadToken, dto.type as DocumentType, dto.fileName, dto.mimeType, dto.sizeBytes);
  }

  @Public() @Throttle(MODERATE)
  @Post('register/teacher/documents/confirm')
  teacherUploadConfirm(@Body() dto: OnboardingConfirmDto) {
    return this.auth.onboardingConfirm(dto.uploadToken, dto.key);
  }

  // ───── Email verification ─────

  @Public() @Throttle(MODERATE) @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('resend-verification')
  resend(@Body() dto: EmailDto) {
    return this.auth.resendVerification(dto.email);
  }

  // ───── Login / tokens ─────

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.client(req));
    if ('twoFactorRequired' in result) return result;
    return this.respondWithTokens(res, result);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('login/2fa')
  async login2fa(@Body() dto: TwoFactorLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginTwoFactor(dto.challengeToken, dto.code, this.client(req));
    return this.respondWithTokens(res, result);
  }

  /** Reads the httpOnly refresh cookie, rotates it, returns a new access token. */
  @Public() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[AUTH.REFRESH_COOKIE_NAME] as string | undefined;
    if (!raw) throw new UnauthorizedException('No session');
    try {
      const result = await this.auth.refresh(raw, this.client(req));
      return this.respondWithTokens(res, result);
    } catch (e) {
      this.clearCookie(res);
      throw e;
    }
  }

  @Public() @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[AUTH.REFRESH_COOKIE_NAME]);
    this.clearCookie(res);
    return { ok: true };
  }

  // ───── Password ─────

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('forgot-password')
  forgot(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @ApiBearerAuth() @Throttle(STRICT) @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentAuth() a: AuthContext, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(a.userId, a.sessionId, dto);
  }

  // ───── Current user ─────

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentAuth() a: AuthContext) {
    return this.auth.me(a.userId);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentAuth() a: AuthContext) {
    return this.auth.listSessions(a.userId, a.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  revokeSession(@CurrentAuth() a: AuthContext, @Param('id') id: string) {
    return this.auth.revokeOwnSession(a.userId, id);
  }

  @ApiBearerAuth()
  @Get('login-activity')
  activity(@CurrentAuth() a: AuthContext) {
    return this.auth.loginActivity(a.userId);
  }

  // ───── Two-factor ─────

  @ApiBearerAuth()
  @Post('2fa/setup')
  setup2fa(@CurrentAuth() a: AuthContext) {
    return this.auth.setupTwoFactor(a.userId);
  }

  @ApiBearerAuth() @Throttle(STRICT) @HttpCode(200)
  @Post('2fa/enable')
  enable2fa(@CurrentAuth() a: AuthContext, @Body() dto: TwoFactorCodeDto) {
    return this.auth.enableTwoFactor(a.userId, dto.code);
  }

  @ApiBearerAuth() @Throttle(STRICT) @HttpCode(200)
  @Post('2fa/disable')
  disable2fa(@CurrentAuth() a: AuthContext, @Body() dto: DisableTwoFactorDto) {
    return this.auth.disableTwoFactor(a.userId, dto.password, dto.code);
  }

  // ───── helpers ─────

  private client(req: Request) {
    return { ip: req.ip, userAgent: req.get('user-agent') };
  }

  private respondWithTokens(res: Response, result: IssuedTokens & { user: unknown }) {
    res.cookie(AUTH.REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      // app.<domain> and api.<domain> are same-site, so Lax is sufficient and blocks cross-site POSTs.
      sameSite: 'lax',
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
      path: `/${API_PREFIX}/auth`,
      expires: result.refreshExpiresAt,
    });
    return { accessToken: result.accessToken, expiresIn: AUTH.ACCESS_TOKEN_TTL_SECONDS, user: result.user };
  }

  private clearCookie(res: Response) {
    res.clearCookie(AUTH.REFRESH_COOKIE_NAME, {
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
      path: `/${API_PREFIX}/auth`,
    });
  }
}
