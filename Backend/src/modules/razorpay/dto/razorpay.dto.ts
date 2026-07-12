import { Matches } from 'class-validator';

/** Initiate accepts ONLY the order number — the amount is server-derived. */
export class InitiateRazorpayDto {
  @Matches(/^WH-[A-Z0-9]{6,32}$/, { message: 'Invalid order number' })
  orderNumber!: string;
}
