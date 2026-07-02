import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AddressDto, UpdateProfileDto } from './dto/customers.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';

// Accept cuid/ulid-ish ids only. Restrictive enough to stop most injection
// attempts targeting the productId path segment.
const ID_RE = /^[a-z0-9_-]{8,40}$/i;

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.getProfile(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.customers.updateProfile(user.sub, dto);
  }

  @Post('me/addresses')
  @HttpCode(201)
  createAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddressDto) {
    return this.customers.createAddress(user.sub, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddressDto,
  ) {
    if (!ID_RE.test(id)) throw new BadRequestException('Invalid address id');
    return this.customers.updateAddress(user.sub, id, dto);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!ID_RE.test(id)) throw new BadRequestException('Invalid address id');
    return this.customers.deleteAddress(user.sub, id);
  }

  @Post('me/addresses/:id/default')
  @HttpCode(200)
  setDefaultAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!ID_RE.test(id)) throw new BadRequestException('Invalid address id');
    return this.customers.setDefaultAddress(user.sub, id);
  }

  /**
   * Toggle a product in the current user's wishlist.
   *
   * Bug fix: previously productId was a method parameter without @Param,
   * so it was always undefined. Now the id is validated and the operation
   * is scoped to the authenticated caller — no IDOR.
   */
  @Post('wishlist/:productId')
  toggleWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    if (!ID_RE.test(productId)) throw new BadRequestException('Invalid product id');
    return this.customers.toggleWishlist(user.sub, productId);
  }
}
