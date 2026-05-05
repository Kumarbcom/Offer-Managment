import type { Quotation } from '../types';

export function getFinancialYear(dateStr: string): { startYear: number, endYear: number, fyString: string } {
    const d = new Date(dateStr);
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

export function generateFormattedQuotationNumber(quotation: Quotation, allQuotations: Quotation[]): string {
    if (quotation.id === 0) return 'DRAFT';
    
    const fyInfo = getFinancialYear(quotation.quotationDate);
    const startDate = new Date(fyInfo.startYear, 3, 1); // Apr 1
    const endDate = new Date(fyInfo.endYear, 2, 31, 23, 59, 59); // Mar 31
    
    // Find all quotations in this FY
    const fyQuotations = allQuotations.filter(q => {
        const qDate = new Date(q.quotationDate);
        return qDate >= startDate && qDate <= endDate;
    });
    
    // Sort by ID to ensure consistent numbering (oldest to newest)
    fyQuotations.sort((a, b) => a.id - b.id);
    
    // Find the sequence index of the current quotation
    const index = fyQuotations.findIndex(q => q.id === quotation.id);
    
    // If somehow not found in the list, fallback to 1
    const seqNum = index !== -1 ? index + 1 : 1; 
    
    const paddedSeq = String(seqNum).padStart(4, '0');
    return `SKC/QTN/${paddedSeq}-${fyInfo.fyString}`;
}
