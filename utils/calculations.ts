import { Quotation } from '../types';

export const calculateTotalAmount = (details: Quotation['details'] | undefined): number => {
    if (!details || !Array.isArray(details)) return 0;
    return details.reduce((total, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return total + (unitPrice * (item.req || 0));
    }, 0);
};
