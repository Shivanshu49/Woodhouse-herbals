import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ConcernsService } from './concerns.service';
import { Public } from '../../common/decorators/public.decorator';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/;

@Public()
@Controller('concerns')
export class ConcernsController {
  constructor(private readonly concerns: ConcernsService) {}

  @Get()
  list() {
    return this.concerns.list();
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    if (!SLUG_RE.test(slug)) throw new BadRequestException('Invalid slug');
    return this.concerns.findBySlug(slug);
  }
}
