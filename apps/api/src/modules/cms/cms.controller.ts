import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qa/shared-types';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Audit, CurrentAuth, Public, RequirePermissions } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { TenantService } from '../access/tenant.service';
import {
  BlogPostDto,
  FaqDto,
  PricingPlanDto,
  SettingDto,
  TestimonialDto,
  UpdateBlogPostDto,
  UpdateFaqDto,
  UpdatePricingPlanDto,
  UpdateTestimonialDto,
  UpsertPageDto,
} from './cms.dto';

/** Keys that may be exposed publicly. Anything else stays admin-only. */
const PUBLIC_SETTING_KEYS = ['site', 'contact', 'social', 'whatsapp', 'seo', 'home', 'footer'];
const SETTING_KEY = /^[a-z][a-z0-9_.-]{1,40}$/;

@ApiTags('CMS')
@Controller()
export class CmsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // ═══════════ Public (read-only, published content only) ═══════════

  @Public()
  @Get('public/site')
  async site(@Req() req: Request) {
    const academyId = await this.tenant.publicAcademyId(req);
    const rows = await this.prisma.siteSetting.findMany({ where: { academyId, key: { in: PUBLIC_SETTING_KEYS } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  @Public()
  @Get('public/pages/:slug')
  async page(@Param('slug') slug: string, @Req() req: Request) {
    const page = await this.prisma.cmsPage.findFirst({ where: { academyId: await this.tenant.publicAcademyId(req), slug, isPublished: true } });
    if (!page) throw new NotFoundException();
    return page;
  }

  @Public()
  @Get('public/testimonials')
  async testimonials(@Req() req: Request) {
    return this.prisma.testimonial.findMany({
      where: { academyId: await this.tenant.publicAcademyId(req), isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Public()
  @Get('public/faqs')
  async faqs(@Req() req: Request) {
    return this.prisma.faq.findMany({
      where: { academyId: await this.tenant.publicAcademyId(req), isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  @Public()
  @Get('public/pricing')
  async pricing(@Req() req: Request) {
    return this.prisma.pricingPlan.findMany({
      where: { academyId: await this.tenant.publicAcademyId(req), isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Public()
  @Get('public/blog')
  async blog(@Req() req: Request) {
    return this.prisma.blogPost.findMany({
      where: { academyId: await this.tenant.publicAcademyId(req), publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, tags: true, publishedAt: true, author: { select: { fullName: true } } },
      take: 100,
    });
  }

  @Public()
  @Get('public/blog/:slug')
  async blogPost(@Param('slug') slug: string, @Req() req: Request) {
    const post = await this.prisma.blogPost.findFirst({
      where: { academyId: await this.tenant.publicAcademyId(req), slug, publishedAt: { lte: new Date() } },
      include: { author: { select: { fullName: true } } },
    });
    if (!post) throw new NotFoundException();
    return post;
  }

  // ═══════════ Admin CMS ═══════════

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Get('cms/pages')
  pages(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.prisma.cmsPage.findMany({ where: { academyId: this.tenant.academyId(a, req) }, orderBy: { slug: 'asc' } });
  }

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Audit({ action: 'cms.page_upsert', entity: 'CmsPage', idParam: 'slug' })
  @Put('cms/pages/:slug')
  upsertPage(@CurrentAuth() a: AuthContext, @Param('slug') slug: string, @Body() dto: UpsertPageDto, @Req() req: Request) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new BadRequestException('Invalid slug');
    const academyId = this.tenant.academyId(a, req);
    const data = { ...dto, sections: dto.sections as never, updatedById: a.userId };
    return this.prisma.cmsPage.upsert({
      where: { academyId_slug: { academyId, slug } },
      create: { ...data, academyId, slug },
      update: data,
    });
  }

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Get('cms/settings')
  async settings(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    const rows = await this.prisma.siteSetting.findMany({ where: { academyId: this.tenant.academyId(a, req) } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Audit({ action: 'cms.setting_update', entity: 'SiteSetting', idParam: 'key' })
  @Put('cms/settings/:key')
  setSetting(@CurrentAuth() a: AuthContext, @Param('key') key: string, @Body() dto: SettingDto, @Req() req: Request) {
    if (!SETTING_KEY.test(key)) throw new BadRequestException('Invalid setting key');
    const academyId = this.tenant.academyId(a, req);
    return this.prisma.siteSetting.upsert({
      where: { academyId_key: { academyId, key } },
      create: { academyId, key, value: dto.value as never },
      update: { value: dto.value as never },
    });
  }

  // Testimonials
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Get('cms/testimonials')
  listTestimonials(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.prisma.testimonial.findMany({ where: { academyId: this.tenant.academyId(a, req) }, orderBy: { sortOrder: 'asc' } });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Post('cms/testimonials')
  createTestimonial(@CurrentAuth() a: AuthContext, @Body() dto: TestimonialDto, @Req() req: Request) {
    return this.prisma.testimonial.create({ data: { ...dto, academyId: this.tenant.academyId(a, req) } });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Patch('cms/testimonials/:id')
  async updateTestimonial(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateTestimonialDto, @Req() req: Request) {
    return this.scopedUpdate('testimonial', this.tenant.academyId(a, req), id, dto);
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Delete('cms/testimonials/:id')
  deleteTestimonial(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.scopedDelete('testimonial', this.tenant.academyId(a, req), id);
  }

  // FAQs
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Get('cms/faqs')
  listFaqs(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.prisma.faq.findMany({ where: { academyId: this.tenant.academyId(a, req) }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Post('cms/faqs')
  createFaq(@CurrentAuth() a: AuthContext, @Body() dto: FaqDto, @Req() req: Request) {
    return this.prisma.faq.create({ data: { ...dto, academyId: this.tenant.academyId(a, req) } });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Patch('cms/faqs/:id')
  updateFaq(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateFaqDto, @Req() req: Request) {
    return this.scopedUpdate('faq', this.tenant.academyId(a, req), id, dto);
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Delete('cms/faqs/:id')
  deleteFaq(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.scopedDelete('faq', this.tenant.academyId(a, req), id);
  }

  // Pricing
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Get('cms/pricing')
  listPricing(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.prisma.pricingPlan.findMany({ where: { academyId: this.tenant.academyId(a, req) }, orderBy: { sortOrder: 'asc' } });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Post('cms/pricing')
  createPricing(@CurrentAuth() a: AuthContext, @Body() dto: PricingPlanDto, @Req() req: Request) {
    return this.prisma.pricingPlan.create({ data: { ...dto, academyId: this.tenant.academyId(a, req) } });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Patch('cms/pricing/:id')
  updatePricing(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdatePricingPlanDto, @Req() req: Request) {
    return this.scopedUpdate('pricingPlan', this.tenant.academyId(a, req), id, dto);
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Delete('cms/pricing/:id')
  deletePricing(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.scopedDelete('pricingPlan', this.tenant.academyId(a, req), id);
  }

  // Blog
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Get('cms/blog')
  listPosts(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.prisma.blogPost.findMany({ where: { academyId: this.tenant.academyId(a, req) }, orderBy: { updatedAt: 'desc' } });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Audit({ action: 'cms.blog_create', entity: 'BlogPost' })
  @Post('cms/blog')
  createPost(@CurrentAuth() a: AuthContext, @Body() dto: BlogPostDto, @Req() req: Request) {
    return this.prisma.blogPost.create({
      data: { ...dto, tags: dto.tags ?? [], publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null, authorId: a.userId, academyId: this.tenant.academyId(a, req) },
    });
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Audit({ action: 'cms.blog_update', entity: 'BlogPost', idParam: 'id' })
  @Patch('cms/blog/:id')
  updatePost(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Body() dto: UpdateBlogPostDto, @Req() req: Request) {
    const data = { ...dto, publishedAt: dto.publishedAt === undefined ? undefined : dto.publishedAt ? new Date(dto.publishedAt) : null };
    return this.scopedUpdate('blogPost', this.tenant.academyId(a, req), id, data);
  }
  @ApiBearerAuth() @RequirePermissions(PERMISSIONS.CMS_MANAGE)
  @Delete('cms/blog/:id')
  deletePost(@CurrentAuth() a: AuthContext, @Param('id') id: string, @Req() req: Request) {
    return this.scopedDelete('blogPost', this.tenant.academyId(a, req), id);
  }

  // ───── helpers: tenant-scoped update/delete ─────

  private async scopedUpdate(model: 'testimonial' | 'faq' | 'pricingPlan' | 'blogPost', academyId: string, id: string, data: object) {
    const delegate = this.prisma[model] as unknown as {
      updateMany(args: { where: object; data: object }): Promise<{ count: number }>;
      findUnique(args: { where: { id: string } }): Promise<unknown>;
    };
    const { count } = await delegate.updateMany({ where: { id, academyId }, data });
    if (!count) throw new NotFoundException();
    return delegate.findUnique({ where: { id } });
  }

  private async scopedDelete(model: 'testimonial' | 'faq' | 'pricingPlan' | 'blogPost', academyId: string, id: string) {
    const delegate = this.prisma[model] as unknown as { deleteMany(args: { where: object }): Promise<{ count: number }> };
    const { count } = await delegate.deleteMany({ where: { id, academyId } });
    if (!count) throw new NotFoundException();
    return { id };
  }
}
