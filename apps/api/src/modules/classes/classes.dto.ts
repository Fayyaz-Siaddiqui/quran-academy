import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ClassStatus } from '@prisma/client';

export class ScheduleClassDto {
  @ApiProperty() @IsString() courseId: string;
  @ApiProperty() @IsString() teacherId: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({ each: true }) studentIds: string[];
  @ApiProperty() @IsString() @Length(2, 150) title: string;
  @ApiProperty({ description: 'ISO 8601 UTC start' }) @IsDateString() startsAt: string;
  @ApiProperty({ minimum: 15, maximum: 180 }) @IsInt() @Min(15) @Max(180) durationMinutes: number;
  @ApiPropertyOptional({ description: 'Create a weekly series of N classes (1 = single class)', minimum: 1, maximum: 52 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  repeatWeeks?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
}

export class RescheduleDto {
  @ApiProperty() @IsDateString() startsAt: string;
  @ApiProperty() @IsInt() @Min(15) @Max(180) durationMinutes: number;
}

export class CancelDto {
  @ApiProperty() @IsString() @Length(3, 500) reason: string;
}

export class ClassListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ enum: ClassStatus }) @IsOptional() @IsEnum(ClassStatus) status?: ClassStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() teacherId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional({ enum: ['upcoming', 'past'] }) @IsOptional() @IsIn(['upcoming', 'past']) scope?: 'upcoming' | 'past';
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class AttendanceEntryDto {
  @ApiProperty() @IsString() studentId: string;
  @ApiProperty({ enum: ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] }) @IsIn(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']) status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
}

export class MarkAttendanceDto {
  @ApiProperty({ type: [AttendanceEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}

export class JoinClassDto {
  @ApiPropertyOptional({ description: 'Parent only: join on behalf of this child (attendance is recorded for the child)' })
  @IsOptional()
  @IsString()
  studentId?: string;
}

export class EndClassDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) teacherNotes?: string;
}
