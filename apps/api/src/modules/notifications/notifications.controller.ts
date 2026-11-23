import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { NotificationsService } from './notifications.service';

class ListNotificationsDto {
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() unread?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;
}

class MarkReadDto {
  @ApiPropertyOptional({ type: [String], description: 'Omit to mark all as read' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentAuth() a: AuthContext, @Query() q: ListNotificationsDto) {
    return this.notifications.list(a.userId, !!q.unread, 30, q.cursor);
  }

  @Post('read')
  @HttpCode(200)
  markRead(@CurrentAuth() a: AuthContext, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(a.userId, dto.ids?.length ? dto.ids : 'all');
  }
}
