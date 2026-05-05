
// import type { PaymentTerm, PreparedBy, ProductBrand, ModeOfEnquiry, QuotationStatus, Plant, UOM } from './types';

export const SALES_PERSON_NAMES = ['Ananthapadmanabha Phandari', 'Giridhar', 'Veeresh', 'Office'] as const;
// FIX: Removed explicit type annotations (e.g., `: UOM[]`) and added `as const`.
// This allows the corresponding types in `types.ts` to be inferred from this constant's value,
// breaking the circular dependency. The same fix is applied to all subsequent constants.
export const UOMS = ['M', 'PC', 'ST', 'No'] as const;
export const PLANTS = ['MFGN', 'TRDN'] as const;
export const PAYMENT_TERMS = [
  '100% Against Proforma Invoice',
  '50% Advance balance against Proforma Invoice',
  '100% Payment with in 30 Days',
  '100% Payment with in 45 Days',
  '100% Payment with 60 days',
  '30 Days Credit or 2% CD for with in 7 Days'
] as const;
export const PREPARED_BY_LIST = ['Kumar', 'Vandita', 'Ranjan'] as const;
export const PRODUCTS_BRANDS = ['Lapp', 'Eaton', 'Polycab', 'Mennakes', 'Luker', 'Hager', 'Others'] as const;
export const MODES_OF_ENQUIRY = ['Customer Email', 'Customer What’s app', 'Sales Person Email', 'Sales Person What’s app', 'Verbal', 'Walk-in'] as const;
export const QUOTATION_STATUSES = ['Open', 'PO received', 'Partial PO Received', 'Expired', 'Lost'] as const;
