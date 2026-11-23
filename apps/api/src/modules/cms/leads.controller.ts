import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsTimeZone, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { LeadStatus, Prisma } from '@prisma/client';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Audit, CurrentAuth, Public, RequirePermissions } from '../../common/decorators';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

class TrialBookingDto {
  @ApiProperty() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @lower() @IsEmail() email: string;
  @ApiProperty() @Matches(/^\+?[0-9\s\-()]{7,20}$/) phone: string;
  @ApiProperty() @IsString() @Length(2, 2) country: string;
  @ApiProperty() @IsTimeZone() timezone: string;
  @ApiProperty() @IsString() @MaxLength(100) courseSlug: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(100) studentAge?: number;
  @ApiProperty() @IsString() @Length(4, 40) preferredDate: string;
  @ApiProperty() @IsString() @Length(2, 40) preferredTime: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) numberOfStudents?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
  /** Honeypot — must be empty. Bots fill every field. */
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
}

class ContactDto {
  @ApiProperty() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @lower() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value || undefined) @Matches(/^\+?[0-9\s\-()]{7,20}$/) phone?: string;
  @ApiProperty() @IsString() @Length(3, 150) subject: string;
  @ApiProperty() @IsString() @Length(10, 5000) message: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
}

class LeadQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
}

class UpdateLeadDto {
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) internalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedToId?: string;
}

@ApiTags('Leads')
@Controller()
export class LeadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Public() @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('public/trial-bookings')
  async bookTrial(@Body() dto: TrialBookingDto, @Req() req: Request) {
    if (dto.website) return { ok: true }; // honeypot: pretend success
    const academyId = await this.tenant.publicAcademyId(req);
    const { website: _hp, ...data } = dto;
    const booking = await this.prisma.trialBooking.create({
      data: { ...data, country: dto.country.toUpperCase(), academyId, ipAddress: req.ip },
    });
    const course = await this.prisma.course.findFirst({ where: { academyId, slug: dto.courseSlug }, select: { title: true } });
    await this.mail.send({
      to: dto.email,
      template: 'trial-booked',
      data: { name: dto.fullName, course: course?.title ?? dto.courseSlug, date: dto.preferredDate, time: dto.preferredTime },
    });
    await this.notifications.notifyPermissionHolders(academyId, PERMISSIONS.LEADS_MANAGE, {
      type: 'lead.trial',
      title: 'New free trial request',
      body: `${dto.fullName} (${dto.country.toUpperCase()}) requested a ${course?.title ?? dto.courseSlug} trial.`,
      data: { trialBookingId: booking.id },
    });
    return { ok: true, id: booking.id };
  }

  @Public() @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('public/contact')
  async contact(@Body() dto: ContactDto, @Req() req: Request) {
    if (dto.website) return { ok: true };
    const academyId = await this.tenant.publicAcademyId(req);
    const { website: _hp, ...data } = dto;
    const msg = await this.prisma.contactMessage.create({ data: { ...data, academyId, ipAddress: req.ip } });
    await this.notifications.notifyPermissionHolders(academyId, PERMISSIONS.LEADS_MANAGE, {
      type: 'lead.contact',
      title: 'New contact message',
      body: `${dto.fullName}: ${dto.subject}`,
      data: { contactMessageId: msg.id },
    });
    const staffInbox = await this.prisma.siteSetting.findUnique({ where: { academyId_key: { academyId, key: 'contact' } } });
    const inbox = (staffInbox?.value as { email?: string } | null)?.email;
    if (inbox) {
      await this.mail.send({
        to: inbox,
        template: 'staff-new-lead',
        data: { kind: 'contact message', name: dto.fullName, email: dto.email, adminUrl: `${this.config.get('APP_URL')}/admin/leads` },
      });
    }
    return { ok: true };
  }

  // ───── Admin ─────

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.LEADS_READ)
  @Get('leads/trial-bookings')
  async trials(@CurrentAuth() a: AuthContext, @Query() q: LeadQueryDto, @Req() req: Request) {
    const where: Prisma.TrialBookingWhereInput = {
      academyId: this.tenant.academyId(a, req),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search ? { OR: [{ fullName: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.trialBooking.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      this.prisma.trialBooking.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.LEADS_MANAGE)
  @Audit({ action: 'lead.trial_update', entity: 'TrialBooking', idParam: 'id' })
  @Patch('leads/trial-bookings/:id')
  async updateTrial(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: Request) {
    const { count } = await this.prisma.trialBooking.updateMany({ where: { id, academyId: this.tenant.academyId(a, req) }, data: dto });
    if (!count) throw new NotFoundException();
    return this.prisma.trialBooking.findUnique({ where: { id } });
  }

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.LEADS_READ)
  @Get('leads/contact-messages')
  async messages(@CurrentAuth() a: AuthContext, @Query() q: LeadQueryDto, @Req() req: Request) {
    const where: Prisma.ContactMessageWhereInput = { academyId: this.tenant.academyId(a, req), ...(q.status ? { status: q.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      this.prisma.contactMessage.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.LEADS_MANAGE)
  @Patch('leads/contact-messages/:id')
  async updateMessage(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: Request) {
    const { count } = await this.prisma.contactMessage.updateMany({ where: { id, academyId: this.tenant.academyId(a, req) }, data: { status: dto.status } });
    if (!count) throw new NotFoundException();
    return this.prisma.contactMessage.findUnique({ where: { id } });
  }
}
