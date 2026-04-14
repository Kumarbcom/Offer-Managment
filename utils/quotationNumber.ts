import type { Quotation } from '../types';

// New numbering starts from this date (inclusive)
export const NEW_NUMBERING_START = new Date('2026-04-01');

/**
 * Returns the Indian fiscal year label for a given date.
 * e.g. April 2026 → March 2027 → "2026-27"
 */
export const getFiscalYearLabel = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed; March = 2, April = 3
    if (month >= 3) {
        // April–December: FY starts this calendar year
        return `${year}-${String(year + 1).slice(2)}`;
    } else {
        // January–March: FY started previous calendar year
        return `${year - 1}-${String(year).slice(2)}`;
    }
};

/**
 * Formats a quotation number for display / printout.
 *
 * Rules:
 * - Quotations dated BEFORE 01-Apr-2026 → old format: "SKC/QTN/<id>"
 * - Quotations dated ON OR AFTER 01-Apr-2026 → new format: "SKC/QTN/XXXX-YYYY-YY"
 *   where XXXX is the 4-digit zero-padded sequence within the fiscal year,
 *   computed by sorting those new quotations by id (ascending) and taking their rank.
 *
 * @param quotation  The quotation to format.
 * @param allQuotations  The full list of quotations (needed to compute the sequence rank).
 * @returns The display string, e.g. "SKC/QTN/0001-2026-27" or "SKC/QTN/2183" (old style).
 */
export const getQuotationDisplayNumber = (
    quotation: Quotation,
    allQuotations: Quotation[] | null
): string => {
    if (quotation.id <= 0) return 'DRAFT';

    // Validate date - if invalid, return error format
    const qDate = new Date(quotation.quotationDate);
    if (isNaN(qDate.getTime())) {
        console.error(`Invalid quotation date for quotation ${quotation.id}:`, quotation.quotationDate);
        return `SKC/QTN/${quotation.id}-ERROR`;
    }

    // Old-style: quotations before the new numbering cutoff
    if (qDate < NEW_NUMBERING_START) {
        return `SKC/QTN/${quotation.id}`;
    }

    // New-style: compute fiscal year and rank within that FY
    const fyLabel = getFiscalYearLabel(qDate);
    const fyStartYear = parseInt(fyLabel.split('-')[0], 10);
    
    if (isNaN(fyStartYear)) {
        console.error(`Failed to parse fiscal year for date ${quotation.quotationDate}`);
        return `SKC/QTN/${quotation.id}-ERROR`;
    }
    
    const fyStart = new Date(`${fyStartYear}-04-01`);
    const fyEnd = new Date(`${fyStartYear + 1}-03-31T23:59:59`);

    if (!allQuotations) {
        // Fallback if quotations list is not available
        return `SKC/QTN/????-${fyLabel}`;
    }

    // Get all new-era quotations in the same fiscal year, sorted by ID ascending
    const fyQuotations = allQuotations
        .filter(q => {
            const d = new Date(q.quotationDate);
            // Skip invalid dates
            if (isNaN(d.getTime())) return false;
            return d >= NEW_NUMBERING_START && d >= fyStart && d <= fyEnd;
        })
        .sort((a, b) => {
            const dateA = new Date(a.quotationDate).getTime();
            const dateB = new Date(b.quotationDate).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return a.id - b.id;
        });

    const rank = fyQuotations.findIndex(q => q.id === quotation.id) + 1;
    if (rank === 0) {
        return `SKC/QTN/????-${fyLabel}`;
    }

    const seq = String(rank).padStart(4, '0');
    return `SKC/QTN/${seq}-${fyLabel}`;
};
