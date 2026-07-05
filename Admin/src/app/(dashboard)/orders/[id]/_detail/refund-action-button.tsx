'use client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { refundGate } from '@/lib/order-badges';
import type { OrderDetail } from '@/types/order';

/**
 * The ONE refund trigger, used by both the header and the refunds panel. The
 * rule (refundGate = refundable status AND ADMIN) lives in exactly one place;
 * this component renders it as an enabled button or a disabled one with the
 * reason in a tooltip. It only opens the shared dialog — no refund logic here.
 */
export function RefundActionButton({
  order,
  role,
  onRefund,
  size = 'default',
  variant = 'default',
}: {
  order: OrderDetail;
  role: string | undefined;
  onRefund: () => void;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
}) {
  const gate = refundGate(order, role);
  const button = (
    <Button size={size} variant={variant} disabled={!gate.allowed} onClick={onRefund}>
      Refund order
    </Button>
  );
  if (gate.allowed) return button;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        {/* a disabled button swallows pointer events, so wrap it for the tooltip */}
        <TooltipTrigger asChild>
          <span className="inline-block cursor-not-allowed">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{gate.reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
