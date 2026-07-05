import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { AdminContentService } from './admin-content.service';
import {
  CreateBannerDto,
  CreateFaqDto,
  CreateOfferStripItemDto,
  CreateStaticPageDto,
  CreateTestimonialDto,
  ReorderDto,
  UpdateBannerDto,
  UpdateFaqDto,
  UpdateOfferStripItemDto,
  UpdateStaticPageDto,
  UpdateTestimonialDto,
} from './dto/content.dto';

// Storefront content is an editorial surface — ADMIN + MANAGER manage it.
// (STAFF is a fulfillment role with no content responsibility, so it's excluded
// here, unlike catalogue reads.)
const ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES)
@UseInterceptors(AdminAuditInterceptor)
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  // ── Hero banners ────────────────────────────────────────────────────
  @Get('banners')
  listBanners() {
    return this.content.listBanners();
  }

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.content.createBanner(dto);
  }

  // Declared BEFORE ':id' so "reorder" isn't captured as an id.
  @Patch('banners/reorder')
  reorderBanners(@Body() dto: ReorderDto) {
    return this.content.reorderBanners(dto);
  }

  @Patch('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.content.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.content.deleteBanner(id);
  }

  // ── Offer strip ─────────────────────────────────────────────────────
  @Get('offer-strip')
  listOfferStrip() {
    return this.content.listOfferStrip();
  }

  @Post('offer-strip')
  createOfferStripItem(@Body() dto: CreateOfferStripItemDto) {
    return this.content.createOfferStripItem(dto);
  }

  @Patch('offer-strip/reorder')
  reorderOfferStrip(@Body() dto: ReorderDto) {
    return this.content.reorderOfferStrip(dto);
  }

  @Patch('offer-strip/:id')
  updateOfferStripItem(@Param('id') id: string, @Body() dto: UpdateOfferStripItemDto) {
    return this.content.updateOfferStripItem(id, dto);
  }

  @Delete('offer-strip/:id')
  deleteOfferStripItem(@Param('id') id: string) {
    return this.content.deleteOfferStripItem(id);
  }

  // ── Testimonials ────────────────────────────────────────────────────
  @Get('testimonials')
  listTestimonials() {
    return this.content.listTestimonials();
  }

  @Post('testimonials')
  createTestimonial(@Body() dto: CreateTestimonialDto) {
    return this.content.createTestimonial(dto);
  }

  @Patch('testimonials/reorder')
  reorderTestimonials(@Body() dto: ReorderDto) {
    return this.content.reorderTestimonials(dto);
  }

  @Patch('testimonials/:id')
  updateTestimonial(@Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.content.updateTestimonial(id, dto);
  }

  @Delete('testimonials/:id')
  deleteTestimonial(@Param('id') id: string) {
    return this.content.deleteTestimonial(id);
  }

  // ── FAQs ────────────────────────────────────────────────────────────
  @Get('faqs')
  listFaqs() {
    return this.content.listFaqs();
  }

  @Post('faqs')
  createFaq(@Body() dto: CreateFaqDto) {
    return this.content.createFaq(dto);
  }

  @Patch('faqs/reorder')
  reorderFaqs(@Body() dto: ReorderDto) {
    return this.content.reorderFaqs(dto);
  }

  @Patch('faqs/:id')
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.content.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  deleteFaq(@Param('id') id: string) {
    return this.content.deleteFaq(id);
  }

  // ── Static pages ────────────────────────────────────────────────────
  @Get('pages')
  listPages() {
    return this.content.listPages();
  }

  @Get('pages/:id')
  getPage(@Param('id') id: string) {
    return this.content.getPage(id);
  }

  @Post('pages')
  createPage(@Body() dto: CreateStaticPageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.content.createPage(dto, user.sub);
  }

  @Patch('pages/:id')
  updatePage(
    @Param('id') id: string,
    @Body() dto: UpdateStaticPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.updatePage(id, dto, user.sub);
  }

  @Delete('pages/:id')
  deletePage(@Param('id') id: string) {
    return this.content.deletePage(id);
  }

  // ── Homepage sections overview (read-only) ──────────────────────────
  @Get('homepage-sections')
  homepageSections() {
    return this.content.homepageSections();
  }
}
