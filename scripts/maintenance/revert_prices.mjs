import { createClient } from '@supabase/supabase-js';
const url = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';
const supabase = createClient(url, key);

async function revertPrices() {
    const today = new Date().toISOString().split('T')[0];
    console.log('Reverting prices updated today:', today);
    
    // fetch all products. Since there might be thousands, we might need pagination or just fetching all
    let allProducts = [];
    let start = 0;
    while(true) {
        const { data, error } = await supabase.from('products').select('*').range(start, start + 999);
        if(error) throw error;
        if(data.length === 0) break;
        allProducts = allProducts.concat(data);
        start += 1000;
    }
    
    let updatedCount = 0;
    for(const product of allProducts) {
        if(!product.prices || !Array.isArray(product.prices)) continue;
        const prices = product.prices;
        const originalLength = prices.length;
        
        // Remove entries with validFrom = today
        const filteredPrices = prices.filter(p => p.validFrom !== today);
        
        if(filteredPrices.length < originalLength) {
            // Sort remaining
            filteredPrices.sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
            
            // Adjust validTo
            for (let j = 0; j < filteredPrices.length - 1; j++) {
               const nextDate = new Date(filteredPrices[j+1].validFrom);
               nextDate.setDate(nextDate.getDate() - 1);
               filteredPrices[j].validTo = nextDate.toISOString().split('T')[0];
            }
            if(filteredPrices.length > 0) {
                filteredPrices[filteredPrices.length - 1].validTo = '9999-12-31';
            }
            
            const { error } = await supabase.from('products').update({ prices: filteredPrices }).eq('id', product.id);
            if(error) console.error(error);
            else updatedCount++;
        }
    }
    console.log('Reverted price updates for', updatedCount, 'products.');
}
revertPrices();
