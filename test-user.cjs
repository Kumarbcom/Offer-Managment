require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkVandita() {
  const { data, error } = await supabase.from('users').select('*').ilike('name', '%vandita%');
  console.log('Users:', data);
}

checkVandita();
