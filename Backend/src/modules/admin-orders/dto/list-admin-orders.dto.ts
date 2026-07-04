import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AdminOrderSort } from '../admin-order-sort';

export class ListAdminOrdersDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  // Accepts a date ("2026-07-04") or a full ISO timestamp; the where-builder
  // treats a date-only dateTo as inclusive through end-of-day.
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
  @IsOptional() @IsEnum(AdminOrderSort) sort?: AdminOrderSort = AdminOrderSort.Newest;
}
