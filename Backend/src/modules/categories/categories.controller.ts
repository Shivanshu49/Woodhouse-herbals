import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/;

@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    if (!SLUG_RE.test(slug)) throw new BadRequestException('Invalid slug');
    return this.categories.findBySlug(slug);
  }
}
