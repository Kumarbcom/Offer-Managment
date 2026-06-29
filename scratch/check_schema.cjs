
const { createClient } = require('@supabase/supabase-client');

const supabaseUrl = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('--- PRODUCTS TABLE ---');
    const { data: products, error: pError } = await supabase.from('products').select('*').limit(1);
    if (pError) console.error('Products error:', pError);
    else if (products && products.length > 0) console.log('Columns:', Object.keys(products[0]));
    else console.log('No products found');

    console.log('\n--- QUOTATIONS TABLE ---');
    const { data: quotations, error: qError } = await supabase.from('quotations').select('*').limit(1);
    if (qError) console.error('Quotations error:', qError);
    else if (quotations && quotations.length > 0) console.log('Columns:', Object.keys(quotations[0]));
    else console.log('No quotations found');

    console.log('\n--- CUSTOMERS TABLE ---');
    const { data: customers, error: cError } = await supabase.from('customers').select('*').limit(1);
    if (cError) console.error('Customers error:', cError);
    else if (customers && customers.length > 0) console.log('Columns:', Object.keys(customers[0]));
    else console.log('No customers found');
}

checkSchema();
