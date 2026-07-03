import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared offset pagination for admin list endpoints. Extend in list DTOs:
 *
 *   export class ListOrdersDto extends PaginationDto { ... }
 *
 * Response contract: { items, total, page, perPage } (see Paginated<T>).
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 25;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

/** Prisma skip/take from a (possibly partial) pagination input. */
export function pageArgs(dto: { page?: number; perPage?: number }): {
  skip: number;
  take: number;
  page: number;
  perPage: number;
} {
  const page = dto.page ?? 1;
  const perPage = dto.perPage ?? 25;
  return { skip: (page - 1) * perPage, take: perPage, page, perPage };
}
