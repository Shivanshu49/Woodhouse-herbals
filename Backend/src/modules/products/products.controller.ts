import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ListProductsDto } from './dto/list-products.dto';
import { Public } from '../../common/decorators/public.decorator';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/;

@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() dto: ListProductsDto) {
    return this.products.list(dto);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    if (!SLUG_RE.test(slug)) throw new BadRequestException('Invalid slug');
    return this.products.findBySlug(slug);
  }
}
