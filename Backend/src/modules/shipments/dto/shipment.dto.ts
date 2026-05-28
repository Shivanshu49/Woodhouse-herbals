import { IsEnum, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class CreateShipmentDto {
  @IsString()
  @Matches(/^WH-[A-Z0-9]{6,32}$/, { message: 'Invalid order number' })
  orderNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  courier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;

  @IsOptional()
  @IsISO8601()
  estimatedDelivery?: string;
}

export class UpdateShipmentDto {
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
