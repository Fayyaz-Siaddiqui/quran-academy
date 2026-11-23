import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { ProgressType } from '@prisma/client';

export class AssignHomeworkDto {
  @ApiProperty() @IsString() studentId: string;
  @ApiProperty() @IsString() courseId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() classSessionId?: string;
  @ApiProperty() @IsString() @Length(2, 200) title: string;
  @ApiProperty() @IsString() @Length(2, 10000) instructions: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueAt?: string;
}

export class SubmitHomeworkDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) content?: string;
  @ApiPropertyOptional({ description: 'Document id of an uploaded HOMEWORK_ATTACHMENT (e.g. recitation audio)' })
  @IsOptional()
  @IsString()
  documentId?: string;
}

export class ReviewHomeworkDto {
  @ApiProperty({ minimum: 0, maximum: 100 }) @IsInt() @Min(0) @Max(100) grade: number;
  @ApiProperty() @IsString() @Length(1, 5000) feedback: string;
}

export class RecordProgressDto {
  @ApiProperty() @IsString() studentId: string;
  @ApiProperty({ enum: ProgressType }) @IsEnum(ProgressType) type: ProgressType;
  @ApiProperty({ description: '1–114; 0 for Qaida' }) @IsInt() @Min(0) @Max(114) surah: number;
  @ApiProperty() @IsInt() @Min(0) @Max(286) ayahFrom: number;
  @ApiProperty() @IsInt() @Min(0) @Max(286) ayahTo: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(60) qaidaLesson?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
