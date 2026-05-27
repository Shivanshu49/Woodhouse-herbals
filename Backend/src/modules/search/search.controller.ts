import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * Suggest is intentionally rate-limited tighter than the global default
   * because autocomplete is the easiest endpoint to abuse for scraping.
   */
  @Throttle({ default: { ttl: 60 * 1000, limit: 60 } })
  @Get('suggest')
  suggest(@Query('q') q = '') {
    // Hard-cap the input length to prevent regex/CPU abuse against the DB.
    const safeQ = String(q).slice(0, 80);
    return this.search.suggest(safeQ);
  }
}
