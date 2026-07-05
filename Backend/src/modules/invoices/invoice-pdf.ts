import PDFDocument from 'pdfkit';
import type { InvoiceSnapshot } from './invoice-snapshot';

const inr = (m: number) => `INR ${(m / 100).toFixed(2)}`;

/**
 * Deterministic render of the immutable snapshot → PDF Buffer. pdfkit streams
 * asynchronously, so we resolve on the document's `end` event (concatenating on
 * `data`) — concatenating synchronously right after `doc.end()` drops chunks.
 */
export function renderInvoicePdf(s: InvoiceSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks as unknown as Uint8Array[])));
    doc.on('error', reject);

    doc.fontSize(16).text('TAX INVOICE', { align: 'center' }).moveDown(0.5);

    // Seller
    doc.fontSize(10).font('Helvetica-Bold').text(s.seller.legalName).font('Helvetica');
    doc.text(s.seller.address);
    doc.text(`GSTIN: ${s.seller.gstin}${s.seller.pan ? `   PAN: ${s.seller.pan}` : ''}`);
    doc.text(`State: ${s.seller.state} (${s.seller.stateCode})`).moveDown(0.5);

    // Invoice meta
    doc.text(`Invoice No: ${s.number}`);
    doc.text(`Date: ${s.issuedAtISO.slice(0, 10)}`);
    doc.text(`Order No: ${s.orderNumber}`).moveDown(0.5);

    // Buyer
    doc.font('Helvetica-Bold').text('Bill To:').font('Helvetica');
    doc.text(s.buyer.name);
    doc.text(s.buyer.address);
    doc.text(`State: ${s.buyer.state}`);
    doc.text(`GSTIN: ${s.buyer.gstin ?? '—'}`).moveDown(0.5);

    // Lines
    doc.font('Helvetica-Bold')
      .text('Item / HSN / Qty / Rate% / Taxable / CGST / SGST / IGST')
      .font('Helvetica');
    for (const l of s.tax.lines) {
      doc.text(
        `${l.name} | ${l.hsn ?? '—'} | ${l.qty} | ${l.gstRatePercent}% | ` +
          `${inr(l.taxableMinor)} | ${inr(l.cgstMinor)} | ${inr(l.sgstMinor)} | ${inr(l.igstMinor)}`,
      );
    }
    doc.moveDown(0.5);

    // Totals
    doc.text(`Taxable: ${inr(s.tax.totalTaxableMinor)}`);
    if (s.tax.intraState) {
      doc.text(`CGST: ${inr(s.tax.totalCgstMinor)}    SGST: ${inr(s.tax.totalSgstMinor)}`);
    } else {
      doc.text(`IGST: ${inr(s.tax.totalIgstMinor)}`);
    }
    doc.font('Helvetica-Bold').text(`Grand Total: ${inr(s.tax.grandTotalMinor)}`).font('Helvetica');
    doc.text(`(${s.amountInWords})`).moveDown(0.5);

    doc.text(s.paymentNote);
    if (s.catalogueFallback) {
      doc.fillColor('#a00')
        .text('* HSN/rate from current catalogue (order pre-dates line snapshots).')
        .fillColor('#000');
    }
    if (s.tax.ambiguousPlaceOfSupply) {
      doc.fillColor('#a00')
        .text('* Place of supply from a free-text state — verify CGST/SGST vs IGST.')
        .fillColor('#000');
    }
    doc.moveDown(1).fontSize(8).text('Computer-generated invoice — no signature required.', { align: 'center' });

    doc.end();
  });
}
