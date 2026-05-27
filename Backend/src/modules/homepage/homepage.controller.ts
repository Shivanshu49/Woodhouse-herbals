import { Controller, Get } from '@nestjs/common';
import { HomepageService } from './homepage.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepage: HomepageService) {}

  @Get()
  payload() {
    return this.homepage.getPayload();
  }
}
