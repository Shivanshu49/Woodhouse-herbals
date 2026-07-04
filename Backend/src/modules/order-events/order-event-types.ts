/** OrderEvent.type is a free-form string in schema; these are the canonical values. */
export const OrderEventType = {
  StatusChanged: 'status_changed',
  NoteAdded: 'note_added',
  RefundIssued: 'refund_issued',
} as const;
export type OrderEventTypeValue = (typeof OrderEventType)[keyof typeof OrderEventType];
