import { IsArray, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AdminOrderSort } from '../admin-order-sort';

export class ListAdminOrdersDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;

  // Accepts a comma-separated list ("PENDING,PAID") or a single value → array.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  // Accepts a date ("2026-07-04") or a full ISO timestamp; the where-builder
  // treats a date-only dateTo as inclusive through end-of-day.
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
  @IsOptional() @IsEnum(AdminOrderSort) sort?: AdminOrderSort = AdminOrderSort.Newest;
}
