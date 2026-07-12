import { Matches } from 'class-validator';

/** Initiate accepts ONLY the order number — the amount is server-derived. */
export class InitiateRazorpayDto {
  @Matches(/^WH-[A-Z0-9]{6,32}$/, { message: 'Invalid order number' })
  orderNumber!: string;
}

/** Checkout success tuple — a HINT the server re-verifies against the API. */
export class VerifyRazorpayDto {
  @Matches(/^WH-[A-Z0-9]{6,32}$/, { message: 'Invalid order number' })
  orderNumber!: string;

  @Matches(/^order_[A-Za-z0-9]{1,64}$/, { message: 'Invalid Razorpay order id' })
  razorpayOrderId!: string;

  @Matches(/^pay_[A-Za-z0-9]{1,64}$/, { message: 'Invalid Razorpay payment id' })
  razorpayPaymentId!: string;

  @Matches(/^[a-f0-9]{16,128}$/, { message: 'Invalid signature' })
  razorpaySignature!: string;
}
