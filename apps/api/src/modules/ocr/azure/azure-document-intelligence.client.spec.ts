import { extractReceiptFields } from './azure-document-intelligence.client';
import type { DocumentFieldOutput } from '@azure-rest/ai-document-intelligence';

describe('extractReceiptFields', () => {
  it('returns a non-receipt shape when fields are empty', () => {
    const r = extractReceiptFields({});
    expect(r.isReceipt).toBe(false);
    expect(r.total).toBeNull();
    expect(r.meanConfidence).toBe(0);
  });

  it('extracts currency, dates, and times into flat shape', () => {
    const fields: Record<string, DocumentFieldOutput> = {
      Total: { type: 'currency', confidence: 0.95, valueCurrency: { amount: 104, currencyCode: 'EGP', currencySymbol: 'EGP' } },
      Subtotal: { type: 'currency', confidence: 0.9, valueCurrency: { amount: 91.16, currencyCode: 'EGP', currencySymbol: 'EGP' } },
      TotalTax: { type: 'currency', confidence: 0.8, valueCurrency: { amount: 1.58, currencyCode: 'EGP', currencySymbol: 'EGP' } },
      Tip: { type: 'currency', confidence: 0.7, valueCurrency: { amount: 5, currencyCode: 'EGP', currencySymbol: 'EGP' } },
      MerchantName: { type: 'string', confidence: 0.85, valueString: 'Careem' },
      TransactionDate: { type: 'date', confidence: 0.92, valueDate: '2026-05-15' },
      TransactionTime: { type: 'time', confidence: 0.88, valueTime: '20:10:00' },
    };
    const r = extractReceiptFields(fields);
    expect(r.isReceipt).toBe(true);
    expect(r.total).toBe(104);
    expect(r.subtotal).toBe(91.16);
    expect(r.tip).toBe(5);
    expect(r.tax).toBe(1.58);
    expect(r.merchantName).toBe('Careem');
    expect(r.transactionDate).toBe('2026-05-15');
    expect(r.transactionTime).toBe('20:10:00');
    expect(r.meanConfidence).toBeGreaterThan(0.7);
    expect(r.meanConfidence).toBeLessThanOrEqual(1);
  });

  it('falls back to valueNumber when valueCurrency is missing', () => {
    const r = extractReceiptFields({
      Total: { type: 'number', confidence: 0.6, valueNumber: 42 },
    });
    expect(r.total).toBe(42);
    expect(r.isReceipt).toBe(true);
  });

  it('rejects malformed date strings', () => {
    const r = extractReceiptFields({
      TransactionDate: { type: 'date', confidence: 0.9, valueDate: 'not-a-date' },
    });
    expect(r.transactionDate).toBeNull();
  });
});
