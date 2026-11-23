import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class UserListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional({ description: 'Role slug' }) @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
}

export class CreateUserDto {
  @ApiProperty() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9\s\-()]{7,20}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 2) country?: string;
  @ApiProperty() @IsTimeZone() timezone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiProperty({ type: [String], description: 'Role ids' }) @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleIds: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9\s\-()]{7,20}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 2) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsTimeZone() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) preferredLanguage?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() branchId?: string | null;
}

export const ADMIN_SETTABLE_STATUSES = [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED] as const;

export class ChangeStatusDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_STATUSES }) @IsIn(ADMIN_SETTABLE_STATUSES) status: (typeof ADMIN_SETTABLE_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class AssignRolesDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsString({ each: true }) roleIds: string[];
}

export class UpdateOwnProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9\s\-()]{7,20}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 2) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsTimeZone() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) preferredLanguage?: string;
}
