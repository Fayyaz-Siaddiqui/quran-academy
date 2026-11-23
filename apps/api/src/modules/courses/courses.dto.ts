import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { CourseCategory, EnrollmentStatus } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @Length(2, 80) slug: string;
  @ApiProperty() @IsString() @Length(2, 150) title: string;
  @ApiProperty({ enum: CourseCategory }) @IsEnum(CourseCategory) category: CourseCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) level?: string;
  @ApiProperty() @IsString() @Length(10, 300) shortDescription: string;
  @ApiProperty() @IsString() @Length(10, 20000) description: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) outcomes?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) ageGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(520) durationWeeks?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(15) @Max(180) classMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsUrl() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(70) metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(170) metaDescription?: string;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class LessonDto {
  @ApiProperty() @IsString() @Length(2, 200) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50000) content?: string;
  @ApiProperty() @IsInt() @Min(1) sortOrder: number;
}

export class EnrollDto {
  @ApiProperty() @IsString() studentId: string;
  @ApiProperty() @IsString() courseId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teacherId?: string;
}

export class UpdateEnrollmentDto {
  @ApiPropertyOptional({ enum: EnrollmentStatus }) @IsOptional() @IsEnum(EnrollmentStatus) status?: EnrollmentStatus;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() teacherId?: string | null;
}
