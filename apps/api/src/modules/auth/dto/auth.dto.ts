import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH } from '@qa/config';

const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const CLASS_TIMINGS = ['early-morning', 'morning', 'afternoon', 'evening', 'night', 'weekend'];
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PHONE_RULE = /^\+?[0-9\s\-()]{7,20}$/;

export class PasswordField {
  @ApiProperty({ minLength: AUTH.PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(AUTH.PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: 'Password must include upper and lower case letters and a number' })
  password: string;
}

class BaseRegistrationDto extends PasswordField {
  @ApiProperty() @trim() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @lower() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty() @trim() @Matches(PHONE_RULE, { message: 'Invalid phone number' }) phone: string;
  @ApiProperty({ example: 'GB' }) @IsString() @Length(2, 2) country: string;
  @ApiProperty({ example: 'Europe/London' }) @IsTimeZone() timezone: string;
  @ApiProperty() @Equals(true, { message: 'You must accept the terms' }) acceptTerms: boolean;
}

export class GuardianDto {
  @ApiProperty() @trim() @IsString() @Length(2, 120) name: string;
  @ApiProperty() @lower() @IsEmail() email: string;
  @ApiProperty() @Matches(PHONE_RULE) phone: string;
  @ApiProperty() @IsString() @Length(2, 40) relationship: string;
}

export class RegisterStudentDto extends BaseRegistrationDto {
  @ApiProperty({ example: '2010-05-14' }) @IsDateString({ strict: true }) dateOfBirth: string;
  @ApiPropertyOptional({ type: GuardianDto }) @IsOptional() @ValidateNested() @Type(() => GuardianDto) guardian?: GuardianDto;
  @ApiProperty() @IsString() @MaxLength(100) preferredCourseSlug: string;
  @ApiProperty() @IsString() @Length(2, 40) preferredLanguage: string;
  @ApiProperty({ enum: CLASS_TIMINGS }) @IsIn(CLASS_TIMINGS) preferredClassTiming: string;
}

export class ChildDto {
  @ApiProperty() @trim() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @IsDateString({ strict: true }) dateOfBirth: string;
  @ApiProperty() @IsString() @MaxLength(100) preferredCourseSlug: string;
  @ApiProperty() @IsString() @Length(2, 40) preferredLanguage: string;
  @ApiProperty({ enum: CLASS_TIMINGS }) @IsIn(CLASS_TIMINGS) preferredClassTiming: string;
  @ApiPropertyOptional({ description: 'Optional own login for older children' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined))
  @IsEmail()
  email?: string;
}

export class RegisterParentDto extends BaseRegistrationDto {
  @ApiProperty({ type: [ChildDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  children: ChildDto[];
}

export class AvailabilitySlotDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @ApiProperty({ example: '09:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @ApiProperty({ example: '13:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
}

export class RegisterTeacherDto extends BaseRegistrationDto {
  @ApiProperty() @trim() @IsString() @Length(10, 2000) qualifications: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(60) experienceYears: number;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(150, { each: true }) certifications: string[];
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(15) @IsString({ each: true }) languages: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availability: AvailabilitySlotDto[];
}

export class LoginDto {
  @ApiProperty() @lower() @IsEmail() email: string;
  @ApiProperty() @IsString() @MaxLength(128) password: string;
}

export class TwoFactorLoginDto {
  @ApiProperty() @IsString() challengeToken: string;
  @ApiProperty() @Matches(/^\d{6}$/) code: string;
}

export class TokenDto {
  @ApiProperty() @IsString() @Length(10, 200) token: string;
}

export class EmailDto {
  @ApiProperty() @lower() @IsEmail() email: string;
}

export class ResetPasswordDto extends PasswordField {
  @ApiProperty() @IsString() @Length(10, 200) token: string;
}

export class ChangePasswordDto extends PasswordField {
  @ApiProperty() @IsString() @MaxLength(128) currentPassword: string;
}

export class TwoFactorCodeDto {
  @ApiProperty() @Matches(/^\d{6}$/) code: string;
}

export class DisableTwoFactorDto extends TwoFactorCodeDto {
  @ApiProperty() @IsString() @MaxLength(128) password: string;
}

export class OnboardingUploadDto {
  @ApiProperty() @IsString() uploadToken: string;
  @ApiProperty({ enum: ['TEACHER_CERTIFICATE', 'TEACHER_ID', 'TEACHER_CV', 'AVATAR'] })
  @IsIn(['TEACHER_CERTIFICATE', 'TEACHER_ID', 'TEACHER_CV', 'AVATAR'])
  type: 'TEACHER_CERTIFICATE' | 'TEACHER_ID' | 'TEACHER_CV' | 'AVATAR';
  @ApiProperty() @IsString() @MaxLength(200) fileName: string;
  @ApiProperty() @IsString() @MaxLength(100) mimeType: string;
  @ApiProperty() @IsInt() @Min(1) sizeBytes: number;
}

export class OnboardingConfirmDto {
  @ApiProperty() @IsString() uploadToken: string;
  @ApiProperty() @IsString() @MaxLength(300) key: string;
}
