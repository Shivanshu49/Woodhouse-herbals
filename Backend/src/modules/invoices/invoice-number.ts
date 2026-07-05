const IST_OFFSET_MIN = 330; // UTC+5:30

/** Indian financial year "YYYY-YY" (Apr 1–Mar 31), evaluated in IST. */
export function financialYearOf(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MIN * 60_000);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0=Jan; April = 3
  const startYear = month >= 3 ? year : year - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

export function formatInvoiceNumber(fy: string, seq: number): string {
  return `INV-${fy}-${String(seq).padStart(5, '0')}`;
}
