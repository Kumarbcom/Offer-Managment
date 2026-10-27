import type { Quotation, QuotationItem } from '../types';

export interface DiffFieldChange<T = any> {
  changed: boolean;
  initial: T;
  final: T;
}

export interface QuotationItemDiff {
  key: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  partNo: string;
  description: string;
  uom: string;
  stockStatus: string;
  imageUrl?: string;
  
  // Initial values (Rev 0)
  initialMoq: number;
  initialReq: number;
  initialPrice: number;
  initialDiscount: number | string;
  initialNetRate: number;
  initialAmount: number;
  initialAirFreight: boolean;
  initialStockStatus: string;

  // Final values (Rev N / Current)
  finalMoq: number;
  finalReq: number;
  finalPrice: number;
  finalDiscount: number | string;
  finalNetRate: number;
  finalAmount: number;
  finalAirFreight: boolean;
  finalStockStatus: string;

  // Deltas (final - initial)
  moqDelta: number;
  reqDelta: number;
  priceDelta: number;
  discountDelta: number;
  netRateDelta: number;
  amountDelta: number;

  // Change flags
  hasMoqChanged: boolean;
  hasReqChanged: boolean;
  hasPriceChanged: boolean;
  hasDiscountChanged: boolean;
  hasNetRateChanged: boolean;
  hasAmountChanged: boolean;
  hasAirFreightChanged: boolean;
  hasStockStatusChanged: boolean;
}

export interface QuotationDiffResult {
  hasDifferences: boolean;
  initialDate: string;
  finalDate: string;
  revisionNumber: number;
  items: QuotationItemDiff[];

  // Commercial totals
  initialSubtotal: number;
  finalSubtotal: number;
  subtotalDelta: number;

  initialGst: number;
  finalGst: number;
  gstDelta: number;

  initialGrandTotal: number;
  finalGrandTotal: number;
  grandTotalDelta: number;
  percentageChange: number;

  // Counts
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  totalInitialItems: number;
  totalFinalItems: number;

  // Terms and conditions diff
  paymentTermsChange: DiffFieldChange<string>;
  otherTermsChange: DiffFieldChange<string>;
  gstAddedChange: DiffFieldChange<boolean>;
  dateChange: DiffFieldChange<string>;
}

const calcNetRate = (price: number, discount: number | string): number => {
  const d = typeof discount === 'string' ? parseFloat(discount) || 0 : (discount || 0);
  return price * (1 - d / 100);
};

const calcAmount = (netRate: number, moq: number): number => {
  return netRate * (moq || 0);
};

/**
 * Computes the complete difference between an Initial Quotation (Rev 0)
 * and the Final / Current Quotation (Rev 1+).
 */
export function calculateQuotationDiff(
  current: Quotation,
  initialSnapshotOverride?: {
    quotationDate?: string;
    details: QuotationItem[];
    otherTerms?: string;
    paymentTerms?: any;
    gstAdded?: boolean;
  }
): QuotationDiffResult {
  const initialSnap = initialSnapshotOverride || current.initialSnapshot || {
    quotationDate: current.quotationDate,
    details: current.details || [],
    otherTerms: current.otherTerms,
    paymentTerms: current.paymentTerms,
    gstAdded: current.gstAdded,
  };

  const initialItems: QuotationItem[] = initialSnap.details || [];
  const currentItems: QuotationItem[] = current.details || [];

  // Match items between initial and current.
  // Matching strategy:
  // 1. By productId (if > 0)
  // 2. By trimmed partNo (case-insensitive)
  // 3. Fallback to index if parts match or duplicates occur
  const matchedInitialIndices = new Set<number>();
  const matchedCurrentIndices = new Set<number>();
  const diffItems: QuotationItemDiff[] = [];

  // Pass 1: Match by exact productId (if valid > 0) or exact trimmed partNo
  currentItems.forEach((cItem, cIdx) => {
    let matchIdx = -1;
    if (cItem.productId && cItem.productId > 0) {
      matchIdx = initialItems.findIndex(
        (iItem, iIdx) => !matchedInitialIndices.has(iIdx) && iItem.productId === cItem.productId
      );
    }
    if (matchIdx === -1 && cItem.partNo && cItem.partNo.trim()) {
      const cleanPNo = cItem.partNo.trim().toLowerCase();
      matchIdx = initialItems.findIndex(
        (iItem, iIdx) => !matchedInitialIndices.has(iIdx) && (iItem.partNo || '').trim().toLowerCase() === cleanPNo
      );
    }

    if (matchIdx !== -1) {
      matchedInitialIndices.add(matchIdx);
      matchedCurrentIndices.add(cIdx);
      const iItem = initialItems[matchIdx];

      const iNet = calcNetRate(iItem.price, iItem.discount);
      const fNet = calcNetRate(cItem.price, cItem.discount);
      const iAmt = calcAmount(iNet, iItem.moq);
      const fAmt = calcAmount(fNet, cItem.moq);

      const hasMoq = (iItem.moq || 0) !== (cItem.moq || 0);
      const hasReq = (iItem.req || 0) !== (cItem.req || 0);
      const hasPrice = Math.abs((iItem.price || 0) - (cItem.price || 0)) > 0.001;
      const iDisc = parseFloat(String(iItem.discount)) || 0;
      const fDisc = parseFloat(String(cItem.discount)) || 0;
      const hasDisc = Math.abs(iDisc - fDisc) > 0.001;
      const hasNet = Math.abs(iNet - fNet) > 0.01;
      const hasAmt = Math.abs(iAmt - fAmt) > 0.01;
      const hasAir = Boolean(iItem.airFreight) !== Boolean(cItem.airFreight);
      const hasStock = (iItem.stockStatus || '') !== (cItem.stockStatus || '');

      const isModified = hasMoq || hasReq || hasPrice || hasDisc || hasAir || hasStock;

      diffItems.push({
        key: `match_${matchIdx}_${cIdx}`,
        status: isModified ? 'modified' : 'unchanged',
        partNo: cItem.partNo || iItem.partNo || '',
        description: cItem.description || iItem.description || '',
        uom: cItem.uom || iItem.uom || '',
        stockStatus: cItem.stockStatus || '',
        imageUrl: cItem.imageUrl || iItem.imageUrl,

        initialMoq: iItem.moq || 0,
        initialReq: iItem.req || 0,
        initialPrice: iItem.price || 0,
        initialDiscount: iItem.discount ?? 0,
        initialNetRate: iNet,
        initialAmount: iAmt,
        initialAirFreight: Boolean(iItem.airFreight),
        initialStockStatus: iItem.stockStatus || '',

        finalMoq: cItem.moq || 0,
        finalReq: cItem.req || 0,
        finalPrice: cItem.price || 0,
        finalDiscount: cItem.discount ?? 0,
        finalNetRate: fNet,
        finalAmount: fAmt,
        finalAirFreight: Boolean(cItem.airFreight),
        finalStockStatus: cItem.stockStatus || '',

        moqDelta: (cItem.moq || 0) - (iItem.moq || 0),
        reqDelta: (cItem.req || 0) - (iItem.req || 0),
        priceDelta: (cItem.price || 0) - (iItem.price || 0),
        discountDelta: fDisc - iDisc,
        netRateDelta: fNet - iNet,
        amountDelta: fAmt - iAmt,

        hasMoqChanged: hasMoq,
        hasReqChanged: hasReq,
        hasPriceChanged: hasPrice,
        hasDiscountChanged: hasDisc,
        hasNetRateChanged: hasNet,
        hasAmountChanged: hasAmt,
        hasAirFreightChanged: hasAir,
        hasStockStatusChanged: hasStock,
      });
    }
  });

  // Pass 2: Remaining current items are 'added'
  currentItems.forEach((cItem, cIdx) => {
    if (!matchedCurrentIndices.has(cIdx)) {
      const fNet = calcNetRate(cItem.price, cItem.discount);
      const fAmt = calcAmount(fNet, cItem.moq);
      const fDisc = parseFloat(String(cItem.discount)) || 0;

      diffItems.push({
        key: `added_${cIdx}`,
        status: 'added',
        partNo: cItem.partNo || '',
        description: cItem.description || '',
        uom: cItem.uom || '',
        stockStatus: cItem.stockStatus || '',
        imageUrl: cItem.imageUrl,

        initialMoq: 0,
        initialReq: 0,
        initialPrice: 0,
        initialDiscount: 0,
        initialNetRate: 0,
        initialAmount: 0,
        initialAirFreight: false,
        initialStockStatus: '',

        finalMoq: cItem.moq || 0,
        finalReq: cItem.req || 0,
        finalPrice: cItem.price || 0,
        finalDiscount: cItem.discount ?? 0,
        finalNetRate: fNet,
        finalAmount: fAmt,
        finalAirFreight: Boolean(cItem.airFreight),
        finalStockStatus: cItem.stockStatus || '',

        moqDelta: cItem.moq || 0,
        reqDelta: cItem.req || 0,
        priceDelta: cItem.price || 0,
        discountDelta: fDisc,
        netRateDelta: fNet,
        amountDelta: fAmt,

        hasMoqChanged: true,
        hasReqChanged: true,
        hasPriceChanged: true,
        hasDiscountChanged: true,
        hasNetRateChanged: true,
        hasAmountChanged: true,
        hasAirFreightChanged: Boolean(cItem.airFreight),
        hasStockStatusChanged: Boolean(cItem.stockStatus),
      });
    }
  });

  // Pass 3: Remaining initial items are 'removed'
  initialItems.forEach((iItem, iIdx) => {
    if (!matchedInitialIndices.has(iIdx)) {
      const iNet = calcNetRate(iItem.price, iItem.discount);
      const iAmt = calcAmount(iNet, iItem.moq);
      const iDisc = parseFloat(String(iItem.discount)) || 0;

      diffItems.push({
        key: `removed_${iIdx}`,
        status: 'removed',
        partNo: iItem.partNo || '',
        description: iItem.description || '',
        uom: iItem.uom || '',
        stockStatus: iItem.stockStatus || '',
        imageUrl: iItem.imageUrl,

        initialMoq: iItem.moq || 0,
        initialReq: iItem.req || 0,
        initialPrice: iItem.price || 0,
        initialDiscount: iItem.discount ?? 0,
        initialNetRate: iNet,
        initialAmount: iAmt,
        initialAirFreight: Boolean(iItem.airFreight),
        initialStockStatus: iItem.stockStatus || '',

        finalMoq: 0,
        finalReq: 0,
        finalPrice: 0,
        finalDiscount: 0,
        finalNetRate: 0,
        finalAmount: 0,
        finalAirFreight: false,
        finalStockStatus: '',

        moqDelta: -(iItem.moq || 0),
        reqDelta: -(iItem.req || 0),
        priceDelta: -(iItem.price || 0),
        discountDelta: -iDisc,
        netRateDelta: -iNet,
        amountDelta: -iAmt,

        hasMoqChanged: true,
        hasReqChanged: true,
        hasPriceChanged: true,
        hasDiscountChanged: true,
        hasNetRateChanged: true,
        hasAmountChanged: true,
        hasAirFreightChanged: Boolean(iItem.airFreight),
        hasStockStatusChanged: Boolean(iItem.stockStatus),
      });
    }
  });

  // Totals calculation
  const initialSubtotal = initialItems.reduce((acc, item) => {
    const net = calcNetRate(item.price, item.discount);
    return acc + calcAmount(net, item.moq);
  }, 0);

  const finalSubtotal = currentItems.reduce((acc, item) => {
    const net = calcNetRate(item.price, item.discount);
    return acc + calcAmount(net, item.moq);
  }, 0);

  const initialGstAdded = initialSnap.gstAdded ?? current.gstAdded ?? true;
  const finalGstAdded = current.gstAdded ?? true;

  const initialGst = initialGstAdded ? initialSubtotal * 0.18 : 0;
  const finalGst = finalGstAdded ? finalSubtotal * 0.18 : 0;

  const initialGrandTotal = Math.round(initialSubtotal + initialGst);
  const finalGrandTotal = Math.round(finalSubtotal + finalGst);

  const grandTotalDelta = finalGrandTotal - initialGrandTotal;
  const percentageChange = initialGrandTotal > 0 ? (grandTotalDelta / initialGrandTotal) * 100 : 0;

  const addedCount = diffItems.filter(i => i.status === 'added').length;
  const removedCount = diffItems.filter(i => i.status === 'removed').length;
  const modifiedCount = diffItems.filter(i => i.status === 'modified').length;
  const unchangedCount = diffItems.filter(i => i.status === 'unchanged').length;

  const paymentTermsChange: DiffFieldChange<string> = {
    changed: (initialSnap.paymentTerms || '') !== (current.paymentTerms || ''),
    initial: initialSnap.paymentTerms || '',
    final: current.paymentTerms || '',
  };

  const otherTermsChange: DiffFieldChange<string> = {
    changed: (initialSnap.otherTerms || '') !== (current.otherTerms || ''),
    initial: initialSnap.otherTerms || '',
    final: current.otherTerms || '',
  };

  const gstAddedChange: DiffFieldChange<boolean> = {
    changed: initialGstAdded !== finalGstAdded,
    initial: initialGstAdded,
    final: finalGstAdded,
  };

  const initialDate = initialSnap.quotationDate || current.quotationDate || '';
  const finalDate = current.quotationDate || '';
  const dateChange: DiffFieldChange<string> = {
    changed: initialDate !== finalDate,
    initial: initialDate,
    final: finalDate,
  };

  const hasDifferences =
    addedCount > 0 ||
    removedCount > 0 ||
    modifiedCount > 0 ||
    paymentTermsChange.changed ||
    otherTermsChange.changed ||
    gstAddedChange.changed ||
    dateChange.changed;

  return {
    hasDifferences,
    initialDate,
    finalDate,
    revisionNumber: current.revisionNumber || 1,
    items: diffItems,
    initialSubtotal,
    finalSubtotal,
    subtotalDelta: finalSubtotal - initialSubtotal,
    initialGst,
    finalGst,
    gstDelta: finalGst - initialGst,
    initialGrandTotal,
    finalGrandTotal,
    grandTotalDelta,
    percentageChange,
    addedCount,
    removedCount,
    modifiedCount,
    unchangedCount,
    totalInitialItems: initialItems.length,
    totalFinalItems: currentItems.length,
    paymentTermsChange,
    otherTermsChange,
    gstAddedChange,
    dateChange,
  };
}
