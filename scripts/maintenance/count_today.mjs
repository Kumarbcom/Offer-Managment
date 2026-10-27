import { createClient } from '@supabase/supabase-js';
const url = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';
const supabase = createClient(url, key);
async function count() {
  const today = new Date().toISOString().split('T')[0];
  let start = 0;
  let singlePriceTodayCount = 0;
  let multiplePriceTodayCount = 0;
  let allTodayCount = 0;
  while(true) {
    const {data} = await supabase.from('products').select('id, prices').range(start, start + 999);
    if(!data || data.length === 0) break;
    for(const p of data) {
      if(!p.prices) continue;
      const hasToday = p.prices.some(x => x.validFrom === today);
      if(hasToday) {
         allTodayCount++;
         if(p.prices.length === 1) singlePriceTodayCount++;
         else multiplePriceTodayCount++;
      }
    }
    start += 1000;
  }
  console.log('Total with today:', allTodayCount);
  console.log('Single price today:', singlePriceTodayCount);
  console.log('Multiple prices today:', multiplePriceTodayCount);
  process.exit(0);
}
count();
