import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { SystemRole } from '@qa/shared-types';
import { CurrentAuth, RequireRoles } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { ChildDto, CLASS_TIMINGS } from '../auth/dto/auth.dto';
import { ParentsService } from './parents.service';

class UpdateChildDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 40) preferredLanguage?: string;
  @ApiPropertyOptional({ enum: CLASS_TIMINGS }) @IsOptional() @IsIn(CLASS_TIMINGS) preferredClassTiming?: string;
}

class EnableLoginDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
}

@ApiTags('Parents')
@ApiBearerAuth()
@RequireRoles(SystemRole.PARENT)
@Controller('parents/me')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get('overview')
  overview(@CurrentAuth() a: AuthContext) {
    return this.parents.overview(a.userId);
  }

  @Get('children')
  list(@CurrentAuth() a: AuthContext) {
    return this.parents.children(a.userId);
  }

  @Post('children')
  add(@CurrentAuth() a: AuthContext, @Body() dto: ChildDto) {
    return this.parents.addChild(a.userId, dto);
  }

  @Patch('children/:childId')
  update(@CurrentAuth() a: AuthContext, @Param('childId') childId: string, @Body() dto: UpdateChildDto) {
    return this.parents.updateChild(a.userId, childId, dto);
  }

  @Post('children/:childId/enable-login')
  enableLogin(@CurrentAuth() a: AuthContext, @Param('childId') childId: string, @Body() dto: EnableLoginDto) {
    return this.parents.enableChildLogin(a.userId, childId, dto.email);
  }

  @Get('children/:childId/dashboard')
  dashboard(@CurrentAuth() a: AuthContext, @Param('childId') childId: string) {
    return this.parents.childDashboard(a.userId, childId);
  }
}
