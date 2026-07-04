/**
 * Unit tests for the pricing/tax money helpers. Indian retail money: rupee
 * text input -> integer paise (never floats), GST-inclusive reverse breakdown,
 * and margin on the net-of-GST price.
 * Run alone: npx tsx --test "src/app/(dashboard)/products/_form/pricing.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rupeesToPaise,
  paiseToRupees,
  gstBreakdown,
  computeMargin,
  pricingToPayload,
  GST_PERCENT,
} from './pricing';

test('rupeesToPaise: whole rupees and 1-2 decimal places', () => {
  assert.equal(rupeesToPaise('199'), 19900);
  assert.equal(rupeesToPaise('199.5'), 19950);
  assert.equal(rupeesToPaise('199.50'), 19950);
  assert.equal(rupeesToPaise('199.99'), 19999);
  assert.equal(rupeesToPaise('0'), 0);
});

test('rupeesToPaise: tolerates commas and surrounding whitespace', () => {
  assert.equal(rupeesToPaise('1,199'), 119900);
  assert.equal(rupeesToPaise('1,19,999'), 11999900);
  assert.equal(rupeesToPaise('  249.50  '), 24950);
});

test('rupeesToPaise: rejects >2 decimals (sub-paise), negatives, and junk — no silent truncation', () => {
  assert.equal(rupeesToPaise('199.999'), null); // sub-paise
  assert.equal(rupeesToPaise('-5'), null);
  assert.equal(rupeesToPaise('199.'), null); // trailing dot
  assert.equal(rupeesToPaise('abc'), null);
  assert.equal(rupeesToPaise(''), null);
  assert.equal(rupeesToPaise('1.2.3'), null);
});

test('rupeesToPaise: rounds float representation safely (19.99 -> 1999, not 1998)', () => {
  assert.equal(rupeesToPaise('19.99'), 1999);
  assert.equal(rupeesToPaise('0.10'), 10);
});

test('paiseToRupees: minimal typable string, trailing zeros stripped', () => {
  assert.equal(paiseToRupees(19900), '199');
  assert.equal(paiseToRupees(19950), '199.5');
  assert.equal(paiseToRupees(19999), '199.99');
  assert.equal(paiseToRupees(0), '0');
});

test('rupeesToPaise <-> paiseToRupees round-trips', () => {
  const cases: [string, string][] = [
    ['199', '199'],
    ['199.5', '199.5'],
    ['199.50', '199.5'],
    ['199.99', '199.99'],
    ['1234.05', '1234.05'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(paiseToRupees(rupeesToPaise(input)!), expected);
  }
});

test('gstBreakdown: reverse GST-inclusive split into integer paise', () => {
  // ₹199 incl 18% -> net ₹168.64 + GST ₹30.36
  assert.deepEqual(gstBreakdown(19900, 18), { netMinor: 16864, gstMinor: 3036, ratePercent: 18 });
  // components always reconstitute the gross exactly
  const b = gstBreakdown(24950, 12);
  assert.equal(b.netMinor + b.gstMinor, 24950);
});

test('gstBreakdown: EXEMPT (0%) is all net, no GST', () => {
  assert.deepEqual(gstBreakdown(19900, 0), { netMinor: 19900, gstMinor: 0, ratePercent: 0 });
  assert.deepEqual(gstBreakdown(0, 18), { netMinor: 0, gstMinor: 0, ratePercent: 18 });
});

test('computeMargin: profit and % on the net-of-GST price', () => {
  // net ₹168.64, cost ₹60 -> profit ₹108.64, margin 64%
  assert.deepEqual(computeMargin(16864, 6000), { profitMinor: 10864, marginPct: 64 });
});

test('computeMargin: negative when cost exceeds net; null when net is zero', () => {
  const m = computeMargin(16864, 20000);
  assert.equal(m!.profitMinor, -3136);
  assert.ok(m!.marginPct < 0);
  assert.equal(computeMargin(0, 5000), null);
});

test('GST_PERCENT maps every enum value to its slab', () => {
  assert.equal(GST_PERCENT.EXEMPT, 0);
  assert.equal(GST_PERCENT.GST_5, 5);
  assert.equal(GST_PERCENT.GST_12, 12);
  assert.equal(GST_PERCENT.GST_18, 18);
  assert.equal(GST_PERCENT.GST_28, 28);
});

test('pricingToPayload: converts rupees->paise, enum passthrough, ISO dates; omits blanks', () => {
  const out = pricingToPayload({
    price: '199.50',
    compareAtPrice: '249',
    costPrice: '80',
    gstRate: 'GST_18',
    hsnCode: '3304',
    saleStartsAt: '2099-01-01T00:00',
    saleEndsAt: '2099-01-10T00:00',
  });
  assert.equal(out.priceMinor, 19950);
  assert.equal(out.compareAtPriceMinor, 24900);
  assert.equal(out.costPriceMinor, 8000);
  assert.equal(out.gstRate, 'GST_18');
  assert.equal(out.hsnCode, '3304');
  assert.equal(out.saleStartsAt, new Date('2099-01-01T00:00').toISOString());
  assert.equal(out.saleEndsAt, new Date('2099-01-10T00:00').toISOString());
});

test('pricingToPayload: optional blanks are omitted, not sent as 0/empty', () => {
  const out = pricingToPayload({
    price: '199',
    compareAtPrice: '',
    costPrice: '',
    gstRate: 'GST_18',
    hsnCode: '',
    saleStartsAt: '',
    saleEndsAt: '',
  });
  assert.equal(out.priceMinor, 19900);
  assert.ok(!('compareAtPriceMinor' in out));
  assert.ok(!('costPriceMinor' in out));
  assert.ok(!('hsnCode' in out));
  assert.ok(!('saleStartsAt' in out));
  assert.ok(!('saleEndsAt' in out));
});
