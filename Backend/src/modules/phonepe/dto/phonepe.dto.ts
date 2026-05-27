import { IsString, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  @Matches(/^WH-[A-Z0-9]{6,32}$/, { message: 'Invalid order number' })
  orderNumber!: string;
}
