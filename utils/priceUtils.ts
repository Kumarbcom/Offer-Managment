import type { Product, PriceEntry } from '../types';

export const THRESHOLD_DATE = new Date(2026, 8, 11); // 11.09.2026 (September 11, 2026)

/**
 * Safely parses various date formats (YYYY-MM-DD, DD.MM.YYYY, DD-MM-YYYY, ISO strings)
 * into a local Date object without UTC midnight timezone drift.
 */
export function parseProductDate(dateStr: any): Date {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    const s = String(dateStr).trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
        const [d, m, y] = s.split('.').map(Number);
        return new Date(y, m - 1, d);
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const parts = s.split('T')[0].split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(NaN) : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Accurately finds the price entry for a product corresponding to a target quotation date.
 * - Exact bracket match (from <= date <= to)
 * - Past or current tier (latest tier with from <= date)
 * - Earliest tier if date is before all available tiers
 */
export function getPriceForDate(product: Product | { prices?: PriceEntry[] } | null | undefined, date: string | Date): PriceEntry | null {
    if (!product || !product.prices || !Array.isArray(product.prices) || product.prices.length === 0) return null;

    const targetDate = parseProductDate(date);
    if (isNaN(targetDate.getTime())) return product.prices[0] || null;
    targetDate.setHours(0, 0, 0, 0);

    const validPrices = product.prices
        .map(p => ({
            p,
            from: parseProductDate(p.validFrom),
            to: parseProductDate(p.validTo)
        }))
        .filter(item => !isNaN(item.from.getTime()));

    if (validPrices.length === 0) return product.prices[0] || null;

    // 1. Exact validity bracket match (from <= targetDate <= to)
    for (const item of validPrices) {
        const from = new Date(item.from);
        from.setHours(0, 0, 0, 0);
        const to = !isNaN(item.to.getTime()) ? new Date(item.to) : new Date(9999, 11, 31);
        to.setHours(23, 59, 59, 999);

        if (targetDate >= from && targetDate <= to) {
            return item.p;
        }
    }

    // 2. Past or current tiers (from <= targetDate), take the latest
    const pastOrCurrent = validPrices.filter(item => {
        const from = new Date(item.from);
        from.setHours(0, 0, 0, 0);
        return from <= targetDate;
    });

    if (pastOrCurrent.length > 0) {
        pastOrCurrent.sort((a, b) => b.from.getTime() - a.from.getTime());
        return pastOrCurrent[0].p;
    }

    // 3. Fallback: if targetDate is before earliest tier, return earliest tier
    validPrices.sort((a, b) => a.from.getTime() - b.from.getTime());
    return validPrices[0].p;
}

/**
 * Checks if a product's newest price tier is older than 11.09.2026.
 * Returns true ONLY if valid prices exist and the latest validFrom date is strictly before 2026-09-11.
 * If prices are empty, missing, or not yet loaded, returns false to prevent false positives.
 */
export function isPriceOlderThanThreshold(productOrPrices: Product | PriceEntry[] | null | undefined): boolean {
    if (!productOrPrices) return false;
    const prices = Array.isArray(productOrPrices) ? productOrPrices : productOrPrices.prices;
    if (!prices || !Array.isArray(prices) || prices.length === 0) return false;

    let latestValidFromMs = -Infinity;
    for (const p of prices) {
        if (!p || !p.validFrom) continue;
        const d = parseProductDate(p.validFrom);
        if (!isNaN(d.getTime())) {
            if (d.getTime() > latestValidFromMs) {
                latestValidFromMs = d.getTime();
            }
        }
    }

    if (latestValidFromMs === -Infinity) return false;
    return latestValidFromMs < THRESHOLD_DATE.getTime();
}

/**
 * Checks if a specific price entry has validFrom strictly before 11.09.2026.
 */
export function isPriceEntryOlderThanThreshold(priceEntry: PriceEntry | null | undefined): boolean {
    if (!priceEntry || !priceEntry.validFrom) return false;
    const d = parseProductDate(priceEntry.validFrom);
    if (isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() < THRESHOLD_DATE.getTime();
}

/**
 * Sorts price entries with latest/newest validFrom at the top (descending).
 */
export function sortPricesLatestFirst(prices: PriceEntry[]): PriceEntry[] {
    if (!Array.isArray(prices)) return [];
    return [...prices].sort((a, b) => {
        const dateA = parseProductDate(a.validFrom).getTime();
        const dateB = parseProductDate(b.validFrom).getTime();
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    });
}
