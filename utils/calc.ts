import { Quotation, QuotationItem } from '../types';

export interface QuotationFinancialTotals {
    baseAmount: number;
    airFreightAmount: number;
    subtotal: number;
    gstAmount: number;
    grandTotal: number;
}

/**
 * Calculates complete quotation financial totals:
 * - Base Net Amount = Net Unit Price * MOQ (fallback to Req if MOQ <= 0)
 * - Air Freight Amount = (Weight per meter / 1000 * Air Freight Rate) * MOQ (if airFreight is true)
 * - Subtotal = Base Amount + Air Freight Amount
 * - GST Amount = 18% on Subtotal (if gstAdded / gst_added is true)
 * - Grand Total = Subtotal + GST Amount
 */
export const calculateQuotationTotals = (
    quotationOrDetails: Quotation | QuotationItem[] | undefined | null,
    quotationContext?: Partial<Quotation> | null
): QuotationFinancialTotals => {
    if (!quotationOrDetails) {
        return { baseAmount: 0, airFreightAmount: 0, subtotal: 0, gstAmount: 0, grandTotal: 0 };
    }

    let items: QuotationItem[] = [];
    let qDate = '';
    let isGstAdded = false;

    if (Array.isArray(quotationOrDetails)) {
        items = quotationOrDetails;
        qDate = quotationContext?.quotationDate || (quotationContext as any)?.quotation_date || '';
        isGstAdded = Boolean(quotationContext?.gstAdded ?? (quotationContext as any)?.gst_added ?? false);
    } else {
        items = quotationOrDetails.details || [];
        qDate = quotationOrDetails.quotationDate || (quotationOrDetails as any)?.quotation_date || '';
        isGstAdded = Boolean(quotationOrDetails.gstAdded ?? (quotationOrDetails as any)?.gst_added ?? false);
    }

    if (!Array.isArray(items) || items.length === 0) {
        return { baseAmount: 0, airFreightAmount: 0, subtotal: 0, gstAmount: 0, grandTotal: 0 };
    }

    // Standard rate is 180 after 2026-05-25, 150 prior
    const airFreightRate = (qDate && new Date(qDate) >= new Date('2026-05-25')) ? 180 : 150;

    let baseAmount = 0;
    let airFreightAmount = 0;

    items.forEach(item => {
        if (!item) return;
        const discountVal = parseFloat(String(item.discount)) || 0;
        const unitPrice = (Number(item.price) || 0) * (1 - discountVal / 100);
        // Quantity quoted: prefer MOQ, fallback to Req
        const qty = (item.moq !== undefined && item.moq !== null && Number(item.moq) > 0)
            ? Number(item.moq)
            : (Number(item.req) || 0);

        const itemBase = unitPrice * qty;
        baseAmount += itemBase;

        if (item.airFreight) {
            const weight = item.airFreightDetails?.weightPerMtr || 0;
            const freightPerMtr = (weight / 1000) * airFreightRate;
            airFreightAmount += freightPerMtr * qty;
        }
    });

    const subtotal = baseAmount + airFreightAmount;
    const gstAmount = isGstAdded ? subtotal * 0.18 : 0;
    const grandTotal = subtotal + gstAmount;

    return {
        baseAmount,
        airFreightAmount,
        subtotal,
        gstAmount,
        grandTotal,
    };
};

/**
 * Single source of truth for total quotation amount across the entire application.
 * Returns the grand total including Air Freight and GST.
 */
export const calculateTotalAmount = (
    quotationOrDetails: Quotation | QuotationItem[] | undefined | null,
    quotationContext?: Partial<Quotation> | null
): number => {
    return calculateQuotationTotals(quotationOrDetails, quotationContext).grandTotal;
};
