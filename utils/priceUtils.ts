import type { Product, PriceEntry } from '../types';

export const THRESHOLD_DATE = new Date(2026, 10, 20); // 20.11.2026 (November 20, 2026)
THRESHOLD_DATE.setHours(0, 0, 0, 0);
export const THRESHOLD_DATE_DISPLAY = '20.11.2026';

/**
 * Safely parses various date formats (YYYY-MM-DD, DD.MM.YYYY, DD-MM-YYYY, ISO strings)
 * into a local Date object without UTC midnight timezone drift.
 */
export function parseProductDate(dateStr: any): Date {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    if (typeof dateStr === 'number') {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date(NaN) : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const s = String(dateStr).trim();
    if (!s) return new Date(NaN);

    // Matches DD.MM.YYYY or D.M.YYYY
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
        const [d, m, y] = s.split('.').map(Number);
        return new Date(y, m - 1, d);
    }
    // Matches DD-MM-YYYY or D-M-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    // Matches DD/MM/YYYY or D/M/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split('/').map(Number);
        return new Date(y, m - 1, d);
    }
    // Matches YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
        const parts = s.split('T')[0].split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    // Matches YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) {
        const parts = s.split('T')[0].split('/').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    // Matches YYYY.MM.DD
    if (/^\d{4}\.\d{1,2}\.\d{1,2}/.test(s)) {
        const parts = s.split('T')[0].split('.').map(Number);
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
 * - Fallback to latest tier if date is beyond available tiers
 */
export function getPriceForDate(product: Product | { prices?: PriceEntry[] } | null | undefined, date: string | Date): PriceEntry | null {
    if (!product || !product.prices || !Array.isArray(product.prices) || product.prices.length === 0) return null;

    const targetDate = parseProductDate(date);
    const validPrices = product.prices
        .map(p => ({
            p,
            from: parseProductDate(p.validFrom),
            to: parseProductDate(p.validTo)
        }))
        .filter(item => !isNaN(item.from.getTime()));

    if (validPrices.length === 0) return product.prices[product.prices.length - 1] || product.prices[0] || null;

    if (isNaN(targetDate.getTime())) {
        validPrices.sort((a, b) => b.from.getTime() - a.from.getTime());
        return validPrices[0].p;
    }

    targetDate.setHours(0, 0, 0, 0);

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
 * Checks if a product or price list has any price tier valid on or after 20.11.2026 (2026-11-20).
 * Returns true ONLY if valid prices exist and ALL available price tiers are strictly before 20.11.2026.
 * If any price tier has validFrom >= 20.11.2026, returns false (not older).
 */
export function isPriceOlderThanThreshold(productOrPrices: Product | PriceEntry[] | null | undefined): boolean {
    if (!productOrPrices) return false;
    const prices = Array.isArray(productOrPrices) ? productOrPrices : productOrPrices.prices;
    if (!prices || !Array.isArray(prices) || prices.length === 0) return false;

    let hasPriceOnOrAfterThreshold = false;
    let hasAnyValidPrice = false;

    for (const p of prices) {
        if (!p || !p.validFrom) continue;
        const d = parseProductDate(p.validFrom);
        if (!isNaN(d.getTime())) {
            hasAnyValidPrice = true;
            d.setHours(0, 0, 0, 0);
            if (d.getTime() >= THRESHOLD_DATE.getTime()) {
                hasPriceOnOrAfterThreshold = true;
                break;
            }
        }
    }

    if (!hasAnyValidPrice) return false;
    return !hasPriceOnOrAfterThreshold;
}

/**
 * Checks whether an individual quotation line item has a price older than 20.11.2026.
 * - If the item's current price matches a price tier valid from >= 20.11.2026: returns false (NOT older).
 * - If the item's current price matches an older tier (validFrom < 20.11.2026): returns true (OLDER).
 * - If no exact price match, checks if the product itself has any price tier >= 20.11.2026:
 *   - If the product has NO price tier >= 20.11.2026: returns true (OLDER).
 *   - If the product HAS a tier >= 20.11.2026, but the item's price is different from that current tier: returns true (item has older price).
 */
export function isItemPriceOlderThanThreshold(
    item: { price?: number; partNo?: string; productId?: number },
    product: Product | null | undefined,
    quotationDate?: string | Date
): boolean {
    if (!item) return false;
    if (!product || !product.prices || !Array.isArray(product.prices) || product.prices.length === 0) {
        return false;
    }

    const itemPrice = Number(item.price) || 0;

    // 1. Check if item's current price matches a tier with validFrom >= 20.11.2026
    const matchingCurrentTier = product.prices.find(pr => {
        if (!pr || !pr.validFrom) return false;
        const priceMatches = Math.abs((Number(pr.lp) || 0) - itemPrice) < 0.02 || Math.abs((Number(pr.sp) || 0) - itemPrice) < 0.02;
        if (!priceMatches) return false;
        const d = parseProductDate(pr.validFrom);
        if (isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= THRESHOLD_DATE.getTime();
    });

    if (matchingCurrentTier) {
        // Price is valid from 20.11.2026 or later -> Not older!
        return false;
    }

    // 2. Check if item's current price matches an older tier (< 20.11.2026)
    const matchingOlderTier = product.prices.find(pr => {
        if (!pr || !pr.validFrom) return false;
        const priceMatches = Math.abs((Number(pr.lp) || 0) - itemPrice) < 0.02 || Math.abs((Number(pr.sp) || 0) - itemPrice) < 0.02;
        if (!priceMatches) return false;
        const d = parseProductDate(pr.validFrom);
        if (isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        return d.getTime() < THRESHOLD_DATE.getTime();
    });

    if (matchingOlderTier) {
        // Specifically matched an older tier from before 20.11.2026
        return true;
    }

    // 3. If price doesn't match any tier, check product's price for quotation date or latest tier
    const targetDate = quotationDate || new Date();
    const activePrice = getPriceForDate(product, targetDate);
    if (activePrice && activePrice.validFrom) {
        const d = parseProductDate(activePrice.validFrom);
        if (!isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            if (d.getTime() < THRESHOLD_DATE.getTime()) {
                return true;
            }
            // If active price is >= 20.11.2026 but item price doesn't match, item is on old price
            const activePriceVal = activePrice.lp > 0 ? activePrice.lp : activePrice.sp;
            if (itemPrice > 0 && Math.abs(activePriceVal - itemPrice) >= 0.02) {
                return true;
            }
            return false;
        }
    }

    // Fallback: check if product has any tier >= 20.11.2026
    return isPriceOlderThanThreshold(product);
}

/**
 * Checks if a specific price entry has validFrom strictly before 20.11.2026.
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
