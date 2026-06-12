import type { Quotation } from '../types';

export function getFinancialYear(dateStr: string): { startYear: number, endYear: number, fyString: string } {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        d = new Date(); // Fallback to today if date is invalid
    }
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed, 3 is April
    
    let startYear, endYear;
    if (month >= 3) {
        startYear = year;
        endYear = year + 1;
    } else {
        startYear = year - 1;
        endYear = year;
    }
    
    const fyString = `${startYear}-${String(endYear).slice(2)}`;
    return { startYear, endYear, fyString };
}

export function getQuotationSeqNum(quotation: Quotation, allQuotations: Quotation[]): string {
    if (!quotation || typeof quotation.id === 'undefined') return 'ERROR';
    if (quotation.id <= 0) return 'DRAFT';
    
    const fyInfo = getFinancialYear(quotation.quotationDate);
    
    // User requested specific numbering: ID 3015 should be 0653 for FY 2026-27
    // This implies: Sequence = ID - 2362
    const FY_OFFSETS: Record<string, number> = {
        '2026-27': 2362,
        '2025-26': 0 // Default or adjust if known
    };
    
    const offset = FY_OFFSETS[fyInfo.fyString] || 0;
    const seqNum = quotation.id - offset;
    
    // Fallback: if sequence number would be negative or zero, fall back to simple FY count
    if (seqNum <= 0) {
        const startDate = new Date(fyInfo.startYear, 3, 1);
        const endDate = new Date(fyInfo.endYear, 2, 31, 23, 59, 59);
        const fyQuotations = allQuotations.filter(q => {
            const qDate = new Date(q.quotationDate);
            return qDate >= startDate && qDate <= endDate;
        }).sort((a, b) => a.id - b.id);
        
        const index = fyQuotations.findIndex(q => q.id === quotation.id);
        const fallbackSeq = index !== -1 ? index + 1 : 1;
        return String(fallbackSeq).padStart(4, '0');
    }
    
    return String(seqNum).padStart(4, '0');
}

export function generateFormattedQuotationNumber(quotation: Quotation, allQuotations: Quotation[]): string {
    if (!quotation || typeof quotation.id === 'undefined') return 'ERROR';
    if (quotation.id <= 0) return 'DRAFT';
    const fyInfo = getFinancialYear(quotation.quotationDate);
    const seqNumStr = getQuotationSeqNum(quotation, allQuotations);
    if (seqNumStr === 'ERROR' || seqNumStr === 'DRAFT') return seqNumStr;
    return `SKC/QTN/${seqNumStr}-${fyInfo.fyString}`;
}
