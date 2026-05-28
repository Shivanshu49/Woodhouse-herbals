import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { PrismaService } from '../../common/prisma/prisma.service';

const ORDER_NUMBER_RE = /^WH-[A-Z0-9]{6,32}$/;
const ID_RE = /^[a-z0-9_-]{8,40}$/i;

@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Customer-facing: view shipments for an order they own ──────────
  @UseGuards(JwtAuthGuard)
  @Get('order/:number')
  async forOrder(
    @Param('number') number: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!ORDER_NUMBER_RE.test(number)) throw new BadRequestException('Invalid order number');
    const order = await this.prisma.order.findUnique({
      where: { number },
      select: { id: true, userId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const isStaff = user.role === UserRole.ADMIN || user.role === UserRole.STAFF;
    if (!isStaff && order.userId !== user.sub) throw new ForbiddenException();
    return this.shipments.forOrder(order.id);
  }

  // ── Admin: create + update ───────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post()
  create(@Body() dto: CreateShipmentDto) {
    return this.shipments.create({
      orderNumber: dto.orderNumber,
      courier: dto.courier,
      trackingNumber: dto.trackingNumber,
      trackingUrl: dto.trackingUrl,
      estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    if (!ID_RE.test(id)) throw new BadRequestException('Invalid shipment id');
    await this.shipments.updateStatus(id, dto.status, dto.description);
    return { ok: true };
  }
}
