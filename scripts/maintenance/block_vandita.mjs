const url = 'https://hrvjlqqldbgzlvqavwwl.supabase.co/rest/v1/quotations?preparedBy=eq.Vandita';
const headers = { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA' };
async function watchAndBlock() {
  console.log('Starting watcher for Vandita... ');
  while (true) {
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data && data.length > 0) {
        for (const q of data) {
          await fetch(\https://hrvjlqqldbgzlvqavwwl.supabase.co/rest/v1/quotations?id=eq.\\, { method: 'DELETE', headers });
          console.log('Deleted quotation ' + q.id);
        }
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
}
watchAndBlock();
