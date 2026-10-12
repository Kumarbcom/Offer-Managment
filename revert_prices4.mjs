import { createClient } from '@supabase/supabase-js';
const url = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';
const supabase = createClient(url, key);
async function run() {
  const today = new Date().toISOString().split('T')[0];
  let start = 0;
  let count = 0;
  while(true) {
    const {data} = await supabase.from('products').select('id, prices').range(start, start + 999);
    if(!data || data.length === 0) break;
    
    for(const p of data) {
      if(!p.prices) continue;
      const originalLen = p.prices.length;
      const filtered = p.prices.filter(x => x.validFrom !== today);
      if(filtered.length < originalLen) {
         filtered.sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
         for (let j = 0; j < filtered.length - 1; j++) {
            const nextDate = new Date(filtered[j+1].validFrom);
            nextDate.setDate(nextDate.getDate() - 1);
            filtered[j].validTo = nextDate.toISOString().split('T')[0];
         }
         if(filtered.length > 0) filtered[filtered.length - 1].validTo = '9999-12-31';
         
         const {error} = await supabase.from('products').update({prices: filtered}).eq('id', p.id);
         if(error) { console.log('Error updating id', p.id, error); }
         else { count++; }
      }
    }
    console.log('Checked up to', start + 1000, 'Reverted so far:', count);
    start += 1000;
  }
  console.log('Done! Total reverted:', count);
  process.exit(0);
}
run();
