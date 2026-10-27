import { createClient } from '@supabase/supabase-js';
const url = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';
const supabase = createClient(url, key);

async function run() {
  const numberToDelete = 53356;
  console.log('Fetching', numberToDelete, 'highest IDs to delete...');
  
  let idsToDelete = [];
  let fetched = 0;
  let lastId = null; // for pagination if needed, but we can just use range
  
  // Supabase limit per request is 1000
  for(let i = 0; i < numberToDelete; i += 1000) {
     const limit = Math.min(1000, numberToDelete - i);
     const { data, error } = await supabase
        .from('products')
        .select('id')
        .order('id', { ascending: false })
        .range(i, i + limit - 1);
        
     if(error) { console.error(error); break; }
     if(data.length === 0) break;
     
     idsToDelete.push(...data.map(d => d.id));
     console.log('Fetched', idsToDelete.length, 'IDs');
  }
  
  console.log('Total IDs to delete:', idsToDelete.length);
  
  let deletedCount = 0;
  for(let i = 0; i < idsToDelete.length; i += 1000) {
      const chunk = idsToDelete.slice(i, i + 1000);
      const { error } = await supabase.from('products').delete().in('id', chunk);
      if(error) {
         console.error('Error deleting chunk:', error);
      } else {
         deletedCount += chunk.length;
         console.log('Deleted', deletedCount, '/', idsToDelete.length);
      }
  }
  console.log('Finished. Deleted:', deletedCount);
  process.exit(0);
}
run();
