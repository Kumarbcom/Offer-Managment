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
 * Safely compares two prices handling database raw floats, rounded inputs, and percentages.
 */
export function matchesPrice(tierPrice: number, itemPrice: number): boolean {
    if (!tierPrice || !itemPrice) return false;
    // 1. Direct float delta (handles raw float vs 1 or 2 decimal rounding)
    const diff = Math.abs(tierPrice - itemPrice);
    if (diff < 0.15) return true;
    
    // 2. Rounded to 2 decimals comparison
    const rTier = Math.round(tierPrice * 100) / 100;
    const rItem = Math.round(itemPrice * 100) / 100;
    if (Math.abs(rTier - rItem) <= 0.05) return true;

    // 3. Percentage difference < 0.2% (for high-value cables where absolute diff might be slightly larger)
    if (rTier > 0 && Math.abs(rTier - rItem) / rTier < 0.002) return true;

    return false;
}

/**
 * Checks whether an individual quotation line item has a price older than 20.11.2026.
 * - If the product has NO price tier valid on or after 20.11.2026: returns true (product only has older prices).
 * - If the quotation date is before 20.11.2026, and the active tier for that date was before 20.11.2026: returns true.
 * - If the item's price matches any current tier (validFrom >= 20.11.2026): returns false (NOT older).
 * - If the item's price matches an older tier (validFrom < 20.11.2026): returns true (OLDER price detected).
 * - If no exact tier match and quotation date is on/after 20.11.2026: returns false (custom price or current tier).
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
    const targetDate = quotationDate || new Date();
    const activePrice = getPriceForDate(product, targetDate);

    // 1. If product itself has NO price tier on or after 20.11.2026 at all
    if (isPriceOlderThanThreshold(product)) {
        return true;
    }

    // 2. If the active catalog tier for this quotation date is before 20.11.2026
    if (activePrice && activePrice.validFrom) {
        const activeFromDate = parseProductDate(activePrice.validFrom);
        if (!isNaN(activeFromDate.getTime())) {
            activeFromDate.setHours(0, 0, 0, 0);
            if (activeFromDate.getTime() < THRESHOLD_DATE.getTime()) {
                return true;
            }
        }
    }

    // 3. Check if the item's price matches any tier valid on or after 20.11.2026
    const matchesCurrentTier = product.prices.some(pr => {
        if (!pr || !pr.validFrom) return false;
        const d = parseProductDate(pr.validFrom);
        if (isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        if (d.getTime() < THRESHOLD_DATE.getTime()) return false;
        return matchesPrice(Number(pr.lp) || 0, itemPrice) || matchesPrice(Number(pr.sp) || 0, itemPrice);
    });

    if (matchesCurrentTier) {
        return false;
    }

    // 4. Check if the item's price specifically matches an older tier (validFrom < 20.11.2026)
    const matchesOlderTier = product.prices.some(pr => {
        if (!pr || !pr.validFrom) return false;
        const d = parseProductDate(pr.validFrom);
        if (isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        if (d.getTime() >= THRESHOLD_DATE.getTime()) return false;
        return matchesPrice(Number(pr.lp) || 0, itemPrice) || matchesPrice(Number(pr.sp) || 0, itemPrice);
    });

    if (matchesOlderTier) {
        return true;
    }

    // 5. If quotation date is on or after 20.11.2026 and price doesn't match any older tier, it's not older
    return false;
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
