import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsDefined, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpsertPageDto {
  @ApiProperty() @IsString() @Length(1, 150) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(70) metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(170) metaDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() ogImageUrl?: string;
  @ApiProperty({ description: 'Ordered section blocks', type: 'array', items: { type: 'object' } }) @IsArray() sections: Record<string, unknown>[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class TestimonialDto {
  @ApiProperty() @IsString() @Length(2, 100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) role?: string;
  @ApiProperty() @IsString() @Length(10, 2000) quote: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @ApiPropertyOptional() @IsOptional() @IsUrl() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateTestimonialDto extends PartialType(TestimonialDto) {}

export class FaqDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiProperty() @IsString() @Length(5, 300) question: string;
  @ApiProperty() @IsString() @Length(5, 5000) answer: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateFaqDto extends PartialType(FaqDto) {}

export class PricingPlanDto {
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiProperty({ example: 'USD' }) @Matches(/^[A-Z]{3}$/) currency: string;
  @ApiProperty({ description: 'Minor units (cents)' }) @IsInt() @Min(0) priceMonthly: number;
  @ApiProperty() @IsInt() @Min(1) @Max(7) classesPerWeek: number;
  @ApiProperty() @IsInt() @Min(15) @Max(180) classMinutes: number;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) features: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isHighlighted?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdatePricingPlanDto extends PartialType(PricingPlanDto) {}

export class BlogPostDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @Length(2, 120) slug: string;
  @ApiProperty() @IsString() @Length(2, 200) title: string;
  @ApiProperty() @IsString() @Length(10, 500) excerpt: string;
  @ApiProperty({ description: 'Markdown' }) @IsString() @Length(10, 200000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() coverImageUrl?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(70) metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(170) metaDescription?: string;
  @ApiPropertyOptional({ nullable: true, description: 'Null = draft' }) @IsOptional() @IsDateString() publishedAt?: string | null;
}
export class UpdateBlogPostDto extends PartialType(BlogPostDto) {}

export class SettingDto {
  // @IsDefined marks the property as known to the whitelisting ValidationPipe.
  @ApiProperty({ description: 'Any JSON value' }) @IsDefined() value: unknown;
}
